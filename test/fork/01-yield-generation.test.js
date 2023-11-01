const { assert, expect } = require("chai")
const { isFork, isMainnet, networkConfig } = require("../../utils/_networks")
const { network, ethers } = require("hardhat")
const {
    FundStates,
    getFundStateFromIndex,
    advanceTime,
    impersonateAccount,
} = require("../../utils/_helpers")
const {
    totalParticipants,
    cycleTime,
    contributionAmount,
    contributionPeriod,
    balanceForUser,
    registrationPeriod,
    getRandomInt,
} = require("../utils/test-utils")
const { abi } = require("../../deployments/mainnet_arbitrum/TakaturnDiamond.json")
const { BigNumber } = require("ethers")

let takaturnDiamond, usdc

async function executeCycle(
    termId,
    defaultersAmount = 0,
    specificDefaultersIndices = [],
    withdrawFund = true
) {
    let randomDefaulterIndices = specificDefaultersIndices

    let fund = await takaturnDiamond.getFundSummary(termId)

    let currentCycle = parseInt(fund[6])
    // console.log(`Current cycle is: ${currentCycle}`)

    while (defaultersAmount != randomDefaulterIndices.length) {
        if (defaultersAmount > totalParticipants) {
            //console.log("Too many defaulters specified!")
            break
        }
        let randomInt = getRandomInt(Math.floor(totalParticipants - 1))
        if (!randomDefaulterIndices.includes(randomInt)) {
            //console.log("Defaulting user..")
            randomDefaulterIndices.push(randomInt)
        }
    }

    //console.log(`Random Defaulter Indices: ${randomDefaulterIndices}`)

    let paidAmount = 0
    for (let i = 1; i <= totalParticipants; i++) {
        if (randomDefaulterIndices.includes(i)) {
            continue
        } else {
            try {
                await usdc
                    .connect(accounts[i])
                    .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)

                await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                paidAmount++
                //console.log(`Participant: ${i} paid the contribution`)
            } catch (e) {
                //console.log(e)
            }
        }
    }

    // Artifically increase time to skip the wait
    await advanceTime(contributionPeriod + 1)

    await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

    fund = await takaturnDiamond.getFundSummary(termId)
    let state = fund[1]
    //console.log(`State is: ${getFundStateFromIndex(state)}`)
    expect(getFundStateFromIndex(fund[1])).not.to.equal(FundStates.AcceptingContributions)

    let fundClaimed = false
    let claimant
    let previousBalanceClaimant = 0
    let poolEmpty = 0
    if (withdrawFund) {
        for (let i = 1; i <= totalParticipants; i++) {
            // console.log(`Participant withdrawing: ${i}`)
            try {
                claimant = accounts[i]
                previousBalanceClaimant = await usdc.balanceOf(claimant.address)
                await takaturnDiamond.connect(accounts[i]).withdrawFund(termId)
                fundClaimed = true
                //console.log(`Participant: ${i} withdrew the fund`)
                break
            } catch (e) {
                //console.log(e)
            }
        }
        depositorFundSummary = await takaturnDiamond.getParticipantFundSummary(
            claimant.address,
            termId
        )
        poolEmpty = depositorFundSummary[4]
    }

    let poolEmptyOk = poolEmpty == 0

    if (!fundClaimed) {
        assert.ok(true)
        //console.log("No one claimed the fund")
    } else {
        assert.ok(fundClaimed)
        assert.ok(poolEmptyOk)
        //console.log(`Claimant: ${claimant.address}`)
    }

    // Artifically increase time to skip the wait
    await advanceTime(cycleTime + 1)

    //await makeExcelSheet();
    try {
        await takaturnDiamondParticipant_1.startNewCycle(termId)
        //console.log("New cycle started")
    } catch (e) {
        //console.log(e)
    }

    fund = await takaturnDiamond.getFundSummary(termId)

    let newCycle = parseInt(fund[6])

    //console.log(`We enter to the new cycle. Cycle is: ${newCycle}`)

    let newCycleStarted = currentCycle + 1 == newCycle
    //console.log(`newCycleStarted: ${newCycleStarted}`)
    fund = await takaturnDiamond.getFundSummary(termId)
    state = fund[1]
    //console.log(`State is: ${getFundStateFromIndex(state)}`)

    let fundClosed = getFundStateFromIndex(state) == FundStates.FundClosed
    if (fundClosed) {
        assert.ok(true)
    } else {
        assert.ok(newCycleStarted)
    }
}

!isFork || isMainnet
    ? describe.skip
    : describe("Fork Mainnet test. Yield generation tests", function () {
          const chainId = network.config.chainId

          let deployer,
              participant_1,
              participant_2,
              participant_3,
              participant_4,
              participant_5,
              participant_6,
              participant_7,
              participant_8,
              participant_9,
              participant_10,
              participant_11,
              participant_12
          beforeEach(async function () {
              // Get the accounts
              accounts = await ethers.getSigners()

              // accounts used:
              // 0: deployer
              // 1 - 12: participants

              deployer = accounts[0]
              participant_1 = accounts[1]
              participant_2 = accounts[2]
              participant_3 = accounts[3]
              participant_4 = accounts[4]
              participant_5 = accounts[5]
              participant_6 = accounts[6]
              participant_7 = accounts[7]
              participant_8 = accounts[8]
              participant_9 = accounts[9]
              participant_10 = accounts[10]
              participant_11 = accounts[11]
              participant_12 = accounts[12]

              participants = []
              // From account[1] to account[12]
              for (let i = 1; i <= totalParticipants; i++) {
                  participants.push(accounts[i])
              }

              // Deploy contract
              await deployments.fixture(["takaturn_upgrade"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")
              // Get the contract instances

              const usdcAddress = networkConfig[chainId]["usdc"]
              const zaynZapAddress = networkConfig[chainId]["zaynfiZap"]
              const zaynVaultAddress = networkConfig[chainId]["zaynfiVault"]

              usdc = await ethers.getContractAt(
                  "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                  usdcAddress
              )
              zaynZap = await ethers.getContractAt(
                  "contracts/interfaces/IZaynZapV2TakaDAO.sol:IZaynZapV2TakaDAO",
                  zaynZapAddress
              )
              zaynVault = await ethers.getContractAt(
                  "contracts/interfaces/IZaynVaultV2TakaDao.sol:IZaynVaultV2TakaDao",
                  zaynVaultAddress
              )

              // Connect the accounts
              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)
              takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1)

              const zapOwner = "0xff0C52AfD43CeCA4c5E674f61fa93BE32647f185"
              const usdcWhale = networkConfig[chainId]["usdcWhale"]

              await impersonateAccount(zapOwner)
              await impersonateAccount(usdcWhale)

              const zapOwnerSigner = await ethers.getSigner(zapOwner)
              const whale = await ethers.getSigner(usdcWhale)

              zaynZapOwner = zaynZap.connect(zapOwnerSigner)
              usdcWhaleSigner = usdc.connect(whale)

              await zaynZapOwner.toggleTrustedSender(takaturnDiamond.address, true, {
                  gasLimit: 1000000,
              })

              let userAddress

              for (let i = 1; i <= totalParticipants; i++) {
                  userAddress = accounts[i].address
                  await usdcWhaleSigner.transfer(userAddress, balanceForUser)

                  await usdc
                      .connect(accounts[i])
                      .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)
              }

              await takaturnDiamondParticipant_1.createTerm(
                  totalParticipants,
                  registrationPeriod,
                  cycleTime,
                  contributionAmount,
                  contributionPeriod,
                  usdc.address
              )
          })

          describe("Lock yield generation", function () {
              it("Only the contract owner can lock the yield", async function () {
                  // Only the owner can toggle the lock
                  await expect(takaturnDiamondParticipant_1.toggleYieldLock()).to.be.revertedWith(
                      "LibDiamond: Must be contract owner"
                  )
                  // Lock true
                  await expect(takaturnDiamondDeployer.toggleYieldLock()).not.to.be.reverted
              })
              it("Should allow optedIn yield when lock is false", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      if (i < totalParticipants) {
                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  .joinTerm(termId, true, { value: entrance })
                          )
                              .to.emit(takaturnDiamond, "OnCollateralDeposited")
                              .withArgs(termId, accounts[i].address, entrance)
                      } else {
                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  .joinTerm(termId, true, { value: entrance })
                          )
                              .to.emit(takaturnDiamond, "OnTermFilled")
                              .withArgs(termId)
                      }

                      let hasOptedIn = await takaturnDiamond.userHasoptedInYG(
                          termId,
                          accounts[i].address
                      )

                      assert.ok(hasOptedIn)
                  }
              })

              it("Should not allow optedIn yield when lock is false, at joining", async function () {
                  // Lock true
                  await takaturnDiamondDeployer.toggleYieldLock()

                  const lastTerm = await takaturnDiamond.getTermsId()
                  const termId = lastTerm[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      if (i < totalParticipants) {
                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  .joinTerm(termId, true, { value: entrance })
                          )
                              .to.emit(takaturnDiamond, "OnCollateralDeposited")
                              .withArgs(termId, accounts[i].address, entrance)
                      } else {
                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  .joinTerm(termId, true, { value: entrance })
                          )
                              .to.emit(takaturnDiamond, "OnTermFilled")
                              .withArgs(termId)
                      }
                  }

                  await advanceTime(registrationPeriod / 2)

                  for (let i = 1; i <= totalParticipants; i++) {
                      let hasOptedIn = await takaturnDiamond.userHasoptedInYG(
                          termId,
                          accounts[i].address
                      )

                      assert.ok(!hasOptedIn)
                      // Should be false as the lock is true, Even if the user joins with true on yield generation
                  }
              })

              it("Should not allow optedIn yield when lock is false, before joining at start term", async function () {
                  const lastTerm = await takaturnDiamond.getTermsId()
                  const termId = lastTerm[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamond.minCollateralToDeposit(termId, i - 1)

                      await takaturnDiamond
                          .connect(accounts[i])
                          .joinTerm(termId, true, { value: entrance })

                      let userHasoptedInYGAtJoining = await takaturnDiamond.userHasoptedInYG(
                          termId,
                          accounts[i].address
                      )
                      assert.ok(userHasoptedInYGAtJoining)
                  }

                  // Lock true
                  await takaturnDiamondDeployer.toggleYieldLock()

                  await advanceTime(registrationPeriod + 1)

                  await takaturnDiamond.startTerm(termId)

                  for (let i = 1; i <= totalParticipants; i++) {
                      const userHasoptedInYGAtStart = await takaturnDiamond.userHasoptedInYG(
                          termId,
                          accounts[i].address
                      )

                      // Should be false as the lock is true, Even if the user joins with true on yield generation

                      assert.ok(!userHasoptedInYGAtStart)
                  }
              })
          })

          describe("Update yield providers", function () {
              it("Only the contract owner can update the yield providers", async function () {
                  // Only the owner can toggle the lock
                  await expect(
                      takaturnDiamondParticipant_1.updateYieldProvider(
                          "test",
                          participant_2.address
                      )
                  ).to.be.revertedWith("LibDiamond: Must be contract owner")
                  // Lock true
                  await expect(
                      takaturnDiamondDeployer.updateYieldProvider("test", participant_2.address)
                  ).not.to.be.reverted
              })
          })
          describe("Term creation with participants opting in the yield generation", function () {
              it("allows participant to join with yield generation and emit events", async function () {
                  const ids = await takaturnDiamondDeployer.getTermsId()
                  const termId = ids[0]

                  await expect(takaturnDiamond.connect(accounts[1]).toggleOptInYG(termId)).to.be
                      .reverted

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      if (i < totalParticipants) {
                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  .joinTerm(termId, true, { value: entrance })
                          )
                              .to.emit(takaturnDiamond, "OnCollateralDeposited")
                              .withArgs(termId, accounts[i].address, entrance)
                      } else {
                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  .joinTerm(termId, true, { value: entrance })
                          )
                              .to.emit(takaturnDiamond, "OnTermFilled")
                              .withArgs(termId)
                      }

                      let hasOptedIn = await takaturnDiamond.userHasoptedInYG(
                          termId,
                          accounts[i].address
                      )

                      assert.ok(hasOptedIn)
                  }
              })

              it("allows to start a term with participants joining yield generation", async function () {
                  const ids = await takaturnDiamondDeployer.getTermsId()
                  const termId = ids[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      await takaturnDiamond
                          .connect(accounts[i])
                          .joinTerm(termId, true, { value: entrance })
                  }
                  await advanceTime(registrationPeriod + 1)
                  await expect(takaturnDiamond.startTerm(termId)).not.to.be.reverted
              })

              it("allows to start a term with some participants joining yield generation and some dont", async function () {
                  const ids = await takaturnDiamondDeployer.getTermsId()
                  const termId = ids[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      if (i == 1 || i == totalParticipants) {
                          await takaturnDiamond
                              .connect(accounts[i])
                              .joinTerm(termId, true, { value: entrance })
                      } else {
                          await takaturnDiamond
                              .connect(accounts[i])
                              .joinTerm(termId, false, { value: entrance })
                      }
                  }
                  await advanceTime(registrationPeriod + 1)
                  await expect(takaturnDiamond.startTerm(termId)).not.to.be.reverted
              })

              it("Should revert to toggle optIn if has not payed", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  await expect(
                      takaturnDiamondParticipant_1.toggleOptInYG(termId)
                  ).to.be.revertedWith("Pay the collateral security deposit first")
              })

              it("Should allow to opt out from yield generation if the term has not started", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(termId, 0)

                  await takaturnDiamondParticipant_1.joinTerm(termId, true, {
                      value: entrance,
                  })

                  const userHasoptedInYGBefore = await takaturnDiamond.userHasoptedInYG(
                      termId,
                      participant_1.address
                  )

                  await expect(takaturnDiamondParticipant_1.toggleOptInYG(termId))
                      .to.emit(takaturnDiamond, "OnYGOptInToggled")
                      .withArgs(termId, participant_1.address, false)

                  const userHasoptedInYGAfter = await takaturnDiamond.userHasoptedInYG(
                      termId,
                      participant_1.address
                  )

                  assert.ok(userHasoptedInYGBefore)
                  assert.ok(!userHasoptedInYGAfter)
              })

              it("Should revert to toggle optIn if the term started", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      await takaturnDiamond
                          .connect(accounts[i])
                          .joinTerm(termId, true, { value: entrance })
                  }
                  await advanceTime(registrationPeriod + 1)

                  await takaturnDiamondParticipant_1.startTerm(termId)

                  await expect(
                      takaturnDiamondParticipant_1.toggleOptInYG(termId)
                  ).to.be.revertedWith("Too late to change YG opt in")
              })
          })

          describe("On going terms, with participants opted in yield generation", function () {
              beforeEach(async function () {
                  const ids = await takaturnDiamondDeployer.getTermsId()
                  const termId = ids[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      await takaturnDiamond
                          .connect(accounts[i])
                          .joinTerm(termId, true, { value: entrance })
                  }
                  await advanceTime(registrationPeriod + 1)
                  await takaturnDiamond.startTerm(termId)
              })

              describe("Yield parameters", function () {
                  xit("Probando", async function () {
                      const ids = await takaturnDiamond.getTermsId()
                      const termId = ids[0]

                      await executeCycle(termId, 0, [], false)
                      await executeCycle(termId, 0, [], false)
                      await executeCycle(termId, 0, [], false)
                      await executeCycle(termId, 0, [], false)
                      await executeCycle(termId, 1, [], false)

                      await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                      const yieldDistributionRatio = await takaturnDiamond.yieldDistributionRatio(
                          termId,
                          participant_1.address
                      )
                      //yieldDistributionRatio = 163141993957703927
                      //   console.log(yieldDistributionRatio.toString())
                      assert(yieldDistributionRatio.toString() > 0)

                      const totalYieldGenerated = await takaturnDiamond.totalYieldGenerated(termId)
                      //   console.log(totalYieldGenerated.toString())
                  })
                  it("Should return the correct yield parameters", async function () {
                      this.timeout(200000)
                      const ids = await takaturnDiamond.getTermsId()
                      const termId = ids[0]

                      const yieldParameters = await takaturnDiamond.getYieldSummary(termId)
                      const collateralParameters = await takaturnDiamond.getCollateralSummary(
                          termId
                      )

                      const collateralFirstDepositTime = collateralParameters[2]
                      let expectedDeposit = 0
                      for (let i = 1; i <= totalParticipants; i++) {
                          let deposited = await takaturnDiamond.getUserYieldSummary(
                              accounts[i].address,
                              termId
                          )

                          let depositedByUser = deposited[4]

                          expectedDeposit = BigNumber.from(expectedDeposit).add(
                              BigNumber.from(depositedByUser)
                          )
                      }
                      const shares = await zaynVault.balanceOf(termId)

                      const yieldInitialized = yieldParameters[0]
                      const yieldStartTimestamp = yieldParameters[1]
                      const yieldTotalDeposit = yieldParameters[2]
                      const yieldCurrentTotalDeposit = yieldParameters[3]
                      const yieldTotalShares = yieldParameters[4]
                      const yieldUsers = yieldParameters[5]

                      assert.ok(yieldInitialized)
                      assert(
                          yieldStartTimestamp.toString() >
                              collateralFirstDepositTime + registrationPeriod + 1
                      )
                      assert.equal(yieldTotalDeposit.toString(), expectedDeposit.toString())
                      assert.equal(
                          yieldTotalDeposit.toString(),
                          yieldCurrentTotalDeposit.toString()
                      )
                      assert.equal(yieldTotalShares.toString(), shares.toString())
                      assert.equal(yieldUsers.length, totalParticipants)
                      for (let i = 0; i < totalParticipants; i++) {
                          assert.equal(yieldUsers[i], accounts[i + 1].address)
                      }
                  })
                  it("Should return the correct yield parameters for a user", async function () {
                      this.timeout(200000)
                      const ids = await takaturnDiamond.getTermsId()
                      const termId = ids[0]

                      for (let i = 1; i <= totalParticipants; i++) {
                          let yieldUser = await takaturnDiamond.getUserYieldSummary(
                              accounts[i].address,
                              termId
                          )
                          let collaterlUserSummary =
                              await takaturnDiamond.getDepositorCollateralSummary(
                                  accounts[i].address,
                                  termId
                              )
                          let collateralDeposited = collaterlUserSummary[3]
                          let expectedYieldDeposited = collateralDeposited.mul(90).div(100)

                          assert.ok(yieldUser[0])
                          assert.equal(yieldUser[1].toString(), 0)
                          assert.equal(yieldUser[2].toString(), 0)
                          assert.equal(yieldUser[3].toString(), 0)
                          assert.equal(yieldUser[4].toString(), expectedYieldDeposited.toString())
                      }
                  })
              })

              describe("Transactions never expected to revert", function () {
                  it("Should not revert when everyone pays and somebody want to withdraw collateral", async function () {
                      const ids = await takaturnDiamond.getTermsId()
                      const termId = ids[0]

                      await executeCycle(termId, 0, [], false)

                      await expect(takaturnDiamondParticipant_1.withdrawCollateral(termId)).not.to
                          .be.reverted
                  })

                  it("Should not revert when there are defaulters and finish funding period", async function () {
                      const ids = await takaturnDiamond.getTermsId()
                      const termId = ids[0]

                      await advanceTime(cycleTime + 1)

                      await expect(takaturnDiamond.closeFundingPeriod(termId)).not.to.be.reverted

                      await expect(takaturnDiamond.startNewCycle(termId)).not
                  })
              })

              describe("Yield claimed", function () {
                  it("Should emit an event if there is available yield or revert if not", async function () {
                      const ids = await takaturnDiamond.getTermsId()
                      const termId = ids[0]

                      await executeCycle(termId, 0, [], false)

                      await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                      const yield = await takaturnDiamond.getUserYieldSummary(
                          participant_1.address,
                          termId
                      )

                      const availableYield = yield[3]

                      if (availableYield > 0) {
                          await expect(
                              takaturnDiamond["claimAvailableYield(uint256,address)"](
                                  termId,
                                  participant_1.address
                              )
                          )
                              .to.emit(takaturnDiamond, "OnYieldClaimed")
                              .withArgs(termId, participant_1.address, availableYield)
                      } else {
                          await expect(
                              takaturnDiamond["claimAvailableYield(uint256,address)"](
                                  termId,
                                  participant_1.address
                              )
                          ).to.be.revertedWith("No yield to withdraw")
                      }
                  })
                  it("Should emit an event if there is available yield or revert if not", async function () {
                      const ids = await takaturnDiamond.getTermsId()
                      const termId = ids[0]

                      await executeCycle(termId, 0, [], false)

                      await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                      const yield = await takaturnDiamond.getUserYieldSummary(
                          participant_1.address,
                          termId
                      )

                      const availableYield = yield[3]

                      if (availableYield > 0) {
                          await expect(
                              takaturnDiamondParticipant_1["claimAvailableYield(uint256)"](termId)
                          )
                              .to.emit(takaturnDiamond, "OnYieldClaimed")
                              .withArgs(termId, participant_1.address, availableYield)
                      } else {
                          await expect(
                              takaturnDiamondParticipant_1["claimAvailableYield(uint256)"](termId)
                          ).to.be.revertedWith("No yield to withdraw")
                      }
                  })
              })
          })
      })
