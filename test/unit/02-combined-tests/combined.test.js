const { assert, expect } = require("chai")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")
const { network, ethers } = require("hardhat")
const {
    FundStates,
    getFundStateFromIndex,
    advanceTime,
    advanceTimeByDate,
    impersonateAccount,
    toWei,
    getCollateralStateFromIndex,
    CollateralStates,
} = require("../../../utils/_helpers")
const { day } = require("../../../utils/units")

const {
    totalParticipants,
    cycleTime,
    contributionAmount,
    contributionPeriod,
    balanceForUser,
    registrationPeriod,
    getRandomInt,
} = require("../../utils/test-utils")

let takaturnDiamond, usdc

async function everyonePaysAndCloseCycle(termId) {
    for (let i = 1; i <= totalParticipants; i++) {
        try {
            await takaturnDiamond.connect(accounts[i]).payContribution(termId)
        } catch (e) {}
    }

    // Artifically increase time to skip the wait
    await advanceTime(contributionPeriod + 1)
    await takaturnDiamondParticipant_1.closeFundingPeriod(termId)
}

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
                    .approve(takaturnDiamond, contributionAmount * 10 ** 6)

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

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Unit Test. Combined Scenarios", function () {
          const chainId = network.config.chainId

          let aggregator

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
              participant_12,
              usdcOwner,
              usdcMasterMinter,
              usdcRegularMinter,
              usdcLostAndFound
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
              usdcOwner = accounts[13]
              usdcMasterMinter = accounts[14]
              usdcRegularMinter = accounts[15]
              usdcLostAndFound = accounts[16]

              participants = []
              // From account[1] to account[12]
              for (let i = 1; i <= totalParticipants; i++) {
                  participants.push(accounts[i])
              }

              // Deploy contracts
              await deployments.fixture(["takaturn_upgrade"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")

              if (isDevnet && !isFork) {
                  aggregator = await ethers.getContract("MockEthUsdAggregator")
                  usdc = await ethers.getContract("FiatTokenV2_1")
              } else {
                  // Fork
                  const aggregatorAddress = networkConfig[chainId]["ethUsdPriceFeed"]
                  const usdcAddress = networkConfig[chainId]["usdc"]

                  aggregator = await ethers.getContractAt(
                      "AggregatorV3Interface",
                      aggregatorAddress
                  )
                  usdc = await ethers.getContractAt(
                      //"contracts/version-1/mocks/USDC.sol:IERC20",
                      "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                      usdcAddress
                  )
              }
              // Connect the accounts
              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)
              takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1)

              if (isFork) {
                  const usdcWhale = networkConfig[chainId]["usdcWhale"]
                  await impersonateAccount(usdcWhale)
                  const whale = await ethers.getSigner(usdcWhale)
                  usdcWhaleSigner = usdc.connect(whale)

                  let userAddress
                  for (let i = 1; i <= totalParticipants; i++) {
                      userAddress = accounts[i].address
                      await usdcWhaleSigner.transfer(userAddress, balanceForUser, {
                          gasLimit: 1000000,
                      })

                      await usdc
                          .connect(accounts[i])
                          .approve(takaturnDiamond, contributionAmount * 10 ** 6)
                  }
              } else {
                  // Initialize USDC
                  const tokenName = "USD Coin"
                  const tokenSymbol = "USDC"
                  const tokenCurrency = "USD"
                  const tokenDecimals = 6

                  await usdc
                      .connect(usdcOwner)
                      .initialize(
                          tokenName,
                          tokenSymbol,
                          tokenCurrency,
                          tokenDecimals,
                          usdcMasterMinter.address,
                          usdcOwner.address,
                          usdcOwner.address,
                          usdcOwner.address
                      )

                  await usdc
                      .connect(usdcMasterMinter)
                      .configureMinter(usdcRegularMinter.address, 10000000000000)

                  await usdc.connect(usdcOwner).initializeV2(tokenName)

                  await usdc.connect(usdcOwner).initializeV2_1(usdcLostAndFound.address)

                  for (let i = 1; i <= totalParticipants; i++) {
                      let depositor = accounts[i]

                      // Mint USDC for depositor
                      await usdc.connect(usdcRegularMinter).mint(depositor.address, balanceForUser)

                      await usdc
                          .connect(depositor)
                          .approve(takaturnDiamond, contributionAmount * 10 ** 6)
                  }
              }
          })

          /*
           * To be able to run the "Combined Tests Part 2", You have to set FORK=false
           * on your .env file to run these tests
           */

          describe("Combined Tests Part 1 & Part 2", function () {
              beforeEach(async function () {
                  // Create a new term where participant_1 is the term owner
                  // This create the term and collateral
                  await takaturnDiamondParticipant_1.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      usdc
                  )

                  // Get the correct term id
                  const ids = await takaturnDiamondDeployer.getTermsId()
                  const termId = ids[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      await takaturnDiamond
                          .connect(accounts[i])
                          ["joinTerm(uint256,bool)"](termId, false, { value: entrance })
                  }

                  await advanceTime(registrationPeriod + 1)

                  await takaturnDiamondParticipant_1.startTerm(termId)
              })
              describe("Combined Tests Part 1. Normal Behavior", function () {
                  it("checks collateral specs", async function () {
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      const collateral = await takaturnDiamondDeployer.getCollateralSummary(termId)
                      const collateralInit = collateral[0]
                      const collateralState = collateral[1]

                      assert(collateralInit)
                      await expect(getCollateralStateFromIndex(collateralState)).to.equal(
                          CollateralStates.CycleOngoing
                      )
                  })

                  it("enables participants to pay in USDC and the payments are succesful", async function () {
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      const term = await takaturnDiamondDeployer.getTermSummary(termId)
                      const contributionAmount = term.contributionAmount

                      await expect(
                          takaturnDiamondDeployer.payContribution(termId)
                      ).to.be.revertedWith("Not a participant")

                      await expect(
                          takaturnDiamondParticipant_1.payContribution(termId)
                      ).to.be.revertedWith("Beneficiary doesn't pay")

                      for (let i = 2; i <= totalParticipants; i++) {
                          let takaturnBalanceBefore = await usdc.balanceOf(takaturnDiamond)
                          let participantBalanceBefore = await usdc.balanceOf(accounts[i].address)

                          await expect(
                              takaturnDiamond.connect(accounts[i]).payContribution(termId)
                          ).to.emit(takaturnDiamond, "OnPaidContribution")

                          await expect(
                              takaturnDiamond.connect(accounts[i]).payContribution(termId)
                          ).to.be.revertedWith("Already paid for cycle")

                          let takaturnBalanceAfter = await usdc.balanceOf(takaturnDiamond)
                          let participantBalanceAfter = await usdc.balanceOf(accounts[i].address)

                          let depositorSummary =
                              await takaturnDiamondDeployer.getParticipantFundSummary(
                                  accounts[i].address,
                                  termId
                              )

                          assert.equal(depositorSummary[2], true)
                          assert(takaturnBalanceAfter > takaturnBalanceBefore)
                          assert(participantBalanceBefore > participantBalanceAfter)

                          assert.equal(
                              takaturnBalanceAfter - takaturnBalanceBefore,
                              contributionAmount * 10n ** 6n
                          )
                          assert.equal(
                              participantBalanceBefore - participantBalanceAfter,
                              contributionAmount * 10n ** 6n
                          )
                      }
                  })

                  it("can close the funding period after the given time", async function () {
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      for (let i = 2; i <= totalParticipants; i++) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }

                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      expect(getFundStateFromIndex(fund[1])).to.equal(
                          FundStates.AcceptingContributions
                      )

                      await expect(
                          takaturnDiamondParticipant_1.closeFundingPeriod(termId)
                      ).to.be.revertedWith("Still time to contribute")

                      // Artifically increase time to skip the wait
                      await advanceTime(contributionPeriod + 1)

                      fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      expect(getFundStateFromIndex(fund[1])).to.equal(
                          FundStates.AcceptingContributions
                      )

                      await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                      fund = await takaturnDiamondDeployer.getFundSummary(termId)

                      const time = await takaturnDiamondDeployer.getRemainingContributionTime(
                          termId
                      )

                      await advanceTime(cycleTime + 1)

                      await takaturnDiamond.startNewCycle(termId)

                      const remainingCycles = await takaturnDiamondDeployer.getRemainingCycles(
                          termId
                      )

                      expect(getFundStateFromIndex(fund[1])).to.equal(FundStates.CycleOngoing)
                      assert.equal(time, 0)
                      assert.equal(remainingCycles, totalParticipants - 1)
                  })

                  it("can have participants autopay at the end of the funding period", async function () {
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      for (let i = 1; i <= totalParticipants; i++) {
                          await takaturnDiamond.connect(accounts[i]).toggleAutoPay(termId)
                      }

                      // Artifically increase time to skip the wait
                      await advanceTime(contributionPeriod + 1)

                      await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                      for (let i = 2; i <= totalParticipants; i++) {
                          const participantSummary =
                              await takaturnDiamondDeployer.getParticipantFundSummary(
                                  accounts[i].address,
                                  termId
                              )
                          assert.equal(participantSummary[2], true)
                      }
                  })

                  // This happens in the 1st cycle
                  it("rewards beneficiaries based on a first come first served basis", async function () {
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      await everyonePaysAndCloseCycle(termId)

                      const fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      let beneficiariesOrder = fund[3]
                      let supposedBeneficiary = beneficiariesOrder[0]

                      assert.ok(supposedBeneficiary == participant_1.address)
                  })

                  // This happens in the 1st cycle
                  it("allows the beneficiary to claim the fund", async function () {
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      await expect(
                          takaturnDiamondParticipant_1.withdrawFund(termId)
                      ).to.be.revertedWith("The caller must be a participant")

                      await everyonePaysAndCloseCycle(termId)

                      await expect(takaturnDiamondParticipant_1.withdrawFund(termId))
                          .to.emit(takaturnDiamond, "OnFundWithdrawn")
                          .withArgs(termId, participant_1.address, participant_1.address, 550000000)
                  })

                  // This happens in the 1st cycle
                  it("allows the beneficiary to claim the fund to a different address", async function () {
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      await expect(
                          takaturnDiamondParticipant_1.withdrawFundOnAnotherWallet(
                              termId,
                              deployer.address
                          )
                      ).to.be.revertedWith("The caller must be a participant")

                      await everyonePaysAndCloseCycle(termId)

                      await expect(
                          takaturnDiamondParticipant_1.withdrawFundOnAnotherWallet(
                              termId,
                              deployer.address
                          )
                      )
                          .to.emit(takaturnDiamond, "OnFundWithdrawn")
                          .withArgs(termId, participant_1.address, deployer.address, 550000000)
                  })

                  // This happens in the 1st cycle
                  it("allows the beneficiary to claim the collateral from defaulters", async function () {
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      // Everyone pays but last 2 participants
                      for (let i = 2; i <= totalParticipants - 1; i++) {
                          await expect(
                              takaturnDiamond.connect(accounts[i]).payContribution(termId)
                          ).to.emit(takaturnDiamond, "OnPaidContribution")
                      }

                      // Artifically increase time to skip the wait
                      await advanceTime(contributionPeriod + 1)
                      await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                      currentBalance = await ethers.provider.getBalance(participant_1.address)

                      const withdrawFundTx = takaturnDiamondParticipant_1.withdrawFund(termId)

                      await Promise.all([
                          expect(withdrawFundTx).to.emit(takaturnDiamond, "OnFundWithdrawn"),
                          expect(withdrawFundTx).to.emit(
                              takaturnDiamond,
                              "OnReimbursementWithdrawn"
                          ),
                      ])

                      newBalance = await ethers.provider.getBalance(participant_1.address)

                      assert.ok(newBalance > currentBalance)
                  })

                  it("does not move the order of beneficiaries of previous cycles if they default in future cycles", async function () {
                      this.timeout(200000)

                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      await everyonePaysAndCloseCycle(termId)
                      await advanceTime(cycleTime + 1)

                      //   await expect(
                      //       takaturnDiamondDeployer.startNewCycle(termId)
                      //   ).to.be.revertedWith("TermOwnable: caller is not the owner")

                      await takaturnDiamondParticipant_1.startNewCycle(termId)

                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      let beneficiariesOrder = fund[3]
                      let firstBeneficiary = beneficiariesOrder[0]
                      await executeCycle(termId, 1, [1])
                      fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      beneficiariesOrder = fund[3]
                      let firstBeneficiaryAfterDefault = beneficiariesOrder[0]
                      assert.ok(firstBeneficiary == firstBeneficiaryAfterDefault)
                  })

                  // This happens in the 1st cycle
                  it("does not moves the order of beneficiaries if the supposed beneficiary of this cycle defaults", async function () {
                      this.timeout(200000)
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      let beneficiariesOrder = fund[3]
                      let supposedBeneficiary = beneficiariesOrder[0]

                      // Everyone pays but the first participant, which should be the first beneficiary
                      for (let i = 2; i <= totalParticipants; i++) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                      // Artifically increase time to skip the wait
                      await advanceTime(contributionPeriod + 1)
                      await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                      fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      beneficiariesOrder = fund[3]
                      let supposedBeneficiaryAfterDefault = beneficiariesOrder[0]
                      let supposedBeneficiaryNewPosition = beneficiariesOrder[1]

                      assert.ok(supposedBeneficiary == supposedBeneficiaryAfterDefault)
                      assert.ok(supposedBeneficiary != supposedBeneficiaryNewPosition)
                  })

                  // This happens in the 1st cycle
                  it("does not permit a graced defaulter to withdraw their fund in the current cycle", async function () {
                      this.timeout(200000)
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      let beneficiariesOrder = fund[3]
                      let supposedBeneficiary = beneficiariesOrder[0]
                      // Everyone pays but the first participant, which should be the first beneficiary
                      for (let i = 2; i <= totalParticipants; i++) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                      // Artifically increase time to skip the wait
                      await advanceTime(contributionPeriod + 1)
                      await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                      fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      beneficiariesOrder = fund[3]
                      let supposedBeneficiaryAfterDefault = beneficiariesOrder[0]

                      assert.ok(supposedBeneficiary == supposedBeneficiaryAfterDefault)
                  })

                  it("simulates a whole fund cycle and allows everyone to withdraw after the fund is closed", async function () {
                      this.timeout(200000)

                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      await everyonePaysAndCloseCycle(termId)
                      await advanceTime(cycleTime + 1)

                      await takaturnDiamondParticipant_1.startNewCycle(termId)

                      await executeCycle(termId, 1, [], false)
                      await executeCycle(termId, 6, [], false)

                      await executeCycle(termId, 1, [], false)
                      await executeCycle(termId, 6, [], false)

                      await executeCycle(termId, 5, [], false)
                      await executeCycle(termId, 3, [], false)

                      await executeCycle(termId, 2, [], false)
                      await executeCycle(termId, 6, [], false)

                      await executeCycle(termId, 6, [], false)
                      await executeCycle(termId, 8, [], false)

                      await executeCycle(termId, 6, [], false)

                      const takaturnBalanceBefore = await usdc.balanceOf(takaturnDiamond)

                      for (let i = 1; i <= totalParticipants; i++) {
                          try {
                              await takaturnDiamond.connect(accounts[i]).withdrawFund(termId)
                              //   console.log(`Fund claimed by: ${i}`)
                          } catch (e) {
                              //           console.log(e)
                          }
                      }

                      const takaturnBalanceAfter = await usdc.balanceOf(takaturnDiamond)

                      assert(takaturnBalanceBefore > takaturnBalanceAfter)
                  })

                  it("simulates a whole fund cycle and empty the collateral", async function () {
                      this.timeout(200000)

                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      for (let i = 1; i <= totalParticipants; i++) {
                          await everyonePaysAndCloseCycle(termId)
                          await advanceTime(cycleTime + 1)
                          if (i < totalParticipants) {
                              await takaturnDiamondParticipant_1.startNewCycle(termId)
                          }
                          for (let j = 1; j <= totalParticipants; j++) {
                              await usdc
                                  .connect(accounts[j])
                                  .approve(takaturnDiamond, contributionAmount * 10 ** 6)
                          }
                      }

                      await advanceTimeByDate(180, day)

                      await expect(
                          takaturnDiamondDeployer.emptyCollateralAfterEnd(termId)
                      ).to.be.revertedWith("TermOwnable: caller is not the owner")

                      await expect(takaturnDiamondParticipant_1.emptyCollateralAfterEnd(termId)).not
                          .to.be.reverted
                  })

                  it("makes sure the fund is closed correctly", async function () {
                      this.timeout(200000)

                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      await everyonePaysAndCloseCycle(termId)
                      await advanceTime(cycleTime + 1)
                      await takaturnDiamondParticipant_1.startNewCycle(termId)

                      // Close remaining cycles

                      while ((await takaturnDiamondDeployer.getFundSummary(termId))[1] < 4) {
                          await executeCycle(termId)
                      }

                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      expect(getFundStateFromIndex(fund[1])).to.equal(FundStates.FundClosed)
                  })

                  it("allows owner to withdraw any unclaimed funds after 180 days, but not earlier", async function () {
                      this.timeout(200000)

                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      await everyonePaysAndCloseCycle(termId)
                      await advanceTime(cycleTime + 1)
                      await takaturnDiamondParticipant_1.startNewCycle(termId)

                      let balance = 0
                      // Attempt to withdraw while cycles are ongoing, this should fail
                      await expect(
                          takaturnDiamondParticipant_1.emptyFundAfterEnd(termId)
                      ).to.be.revertedWith("Can't empty yet")

                      balance = await usdc.balanceOf(takaturnDiamond)
                      assert.ok(balance > 0)

                      // Close remaining cycles
                      while ((await takaturnDiamondDeployer.getFundSummary(termId))[1] < 4) {
                          await executeCycle(termId, 0, [], false)
                      }

                      // Make sure fund is closed
                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      expect(getFundStateFromIndex(fund[1])).to.equal(FundStates.FundClosed)

                      // Attempt to withdraw after last cycle, this should fail
                      await expect(
                          takaturnDiamondParticipant_1.emptyFundAfterEnd(termId)
                      ).to.be.revertedWith("Can't empty yet")

                      balance = await usdc.balanceOf(takaturnDiamond)
                      assert.ok(balance > 0)

                      // Artifically increase time to skip the long wait of 180 days
                      await advanceTimeByDate(180, day)

                      // Attempt to withdraw after 180 days
                      try {
                          await takaturnDiamondParticipant_1.emptyFundAfterEnd(termId)
                      } catch (e) {}

                      balance = await usdc.balanceOf(takaturnDiamond)
                      assert.ok(balance == 0)
                  })

                  // This happens in the 1st cycle
                  it("returns remaining cycle time properly [ @skip-on-ci ]", async function () {
                      //todo: this one sometimes fails. check where to wait
                      this.timeout(200000)

                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      let fundStart = fund[4]
                      let currentCycle = fund[6]

                      let currentRemainingCycleTime =
                          await takaturnDiamondDeployer.getRemainingCycleTime(termId)

                      //console.log(cycleTime * currentCycle + fundStart)

                      assert.ok(cycleTime == currentRemainingCycleTime)
                      // Artifically increase time to skip the wait
                      await advanceTime(contributionPeriod + 1)

                      let newRemainingCycleTime =
                          await takaturnDiamondDeployer.getRemainingCycleTime(termId)

                      // console.log("new remaning cycle time:", newRemainingCycleTime)

                      assert.ok(
                          currentRemainingCycleTime - newRemainingCycleTime ==
                              contributionPeriod + 1
                      )

                      assert.ok(
                          BigInt(cycleTime) * currentCycle + fundStart - currentRemainingCycleTime >
                              0
                      )
                      // Artifically increase time to skip the wait
                      await advanceTime(cycleTime + 1)

                      newRemainingCycleTime = await takaturnDiamondDeployer.getRemainingCycleTime(
                          termId
                      )

                      assert.ok(newRemainingCycleTime.toString() == 0)
                  })

                  // This happens in the 1st cycle
                  it("returns remaining contribution time properly [ @skip-on-ci ]", async function () {
                      //todo: this one sometimes fails. check where to wait
                      this.timeout(200000)

                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      let fundStart = fund[4]
                      let currentCycle = fund[6]

                      let contributionEndTimestamp =
                          BigInt(cycleTime) * (currentCycle - 1n) +
                          fundStart +
                          BigInt(contributionPeriod)

                      let currentRemainingContributionTime =
                          await takaturnDiamondDeployer.getRemainingContributionTime(termId)

                      //   console.log("answer", fundStart + currentRemainingContributionTime)
                      assert.ok(
                          fundStart + currentRemainingContributionTime == contributionEndTimestamp
                      )
                      // Artifically increase time to skip the wait
                      await advanceTime(contributionPeriod * 0.5)

                      let newRemainingContributionTime =
                          await takaturnDiamondDeployer.getRemainingContributionTime(termId)

                      assert.ok(newRemainingContributionTime == contributionPeriod * 0.5)

                      // Artifically increase time to skip the wait
                      await advanceTime(contributionPeriod)

                      newRemainingContributionTime =
                          await takaturnDiamondDeployer.getRemainingContributionTime(termId)
                      //console.log("new remaning contribution time:", newRemainingContributionTime);
                      assert.ok(newRemainingContributionTime == 0)
                  })
              })

              if (!isFork) {
                  describe("Combined Tests Part 2. ETH price changes", function () {
                      it("Allow defaulted beneficiaries to withdraw their fund", async function () {
                          this.timeout(200000)

                          const lastTerm = await takaturnDiamondDeployer.getTermsId()
                          const termId = lastTerm[0]

                          await everyonePaysAndCloseCycle(termId)

                          await advanceTime(cycleTime + 1)

                          await takaturnDiamondParticipant_1.startNewCycle(termId)

                          await aggregator.setPrice(toWei("1500"))

                          await executeCycle(termId, 1, [1], false)

                          // Should not be able to withdraw because beneficiary defaulted
                          await expect(takaturnDiamondParticipant_1.withdrawFund(termId)).not.to.be
                              .reverted
                      })
                  })
              }
          })

          describe("Combined Tests Part 3. Defaulters", function () {
              beforeEach(async function () {
                  let totalParticipantsPart3 = 3

                  // Create a new term where participant_1 is the term owner
                  // This create the term and collateral
                  await takaturnDiamondParticipant_1.createTerm(
                      totalParticipantsPart3,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      usdc
                  )

                  // Get the correct term id
                  const ids = await takaturnDiamondDeployer.getTermsId()
                  const termId = ids[0]

                  for (let i = 1; i <= totalParticipantsPart3; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      await takaturnDiamond
                          .connect(accounts[i])
                          ["joinTerm(uint256,bool)"](termId, false, { value: entrance + 1n })
                  }

                  await advanceTime(registrationPeriod + 1)

                  await takaturnDiamondParticipant_1.startTerm(termId)
              })

              it("selects beneficiaries even if they default", async function () {
                  this.timeout(200000)

                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // First cycle, participant 3 pay
                  payers = [1, 3]

                  await takaturnDiamond.connect(accounts[payers[1]]).payContribution(termId)

                  // Artifically increase time to skip the wait
                  await advanceTime(contributionPeriod + 1)
                  await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                  // Artifically increase time to skip the wait
                  await advanceTime(cycleTime + 1)
                  await takaturnDiamondParticipant_1.startNewCycle(termId)

                  // Next cycle, only participant 1 pays. Participant 2 and 3 default. Participant 2 should be beneficiary
                  await executeCycle(termId, 2, [2, 3])
                  const participantSummary =
                      await takaturnDiamondDeployer.getParticipantFundSummary(
                          participant_2.address,
                          termId
                      )
                  assert.ok(participantSummary[1])
              })

              it("allow a participant to withdraw fund even if defaulted", async function () {
                  this.timeout(200000)

                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // First cycle, participant 1 & 3 pay
                  payers = [1, 3]

                  await takaturnDiamond.connect(accounts[payers[1]]).payContribution(termId)

                  // Artifically increase time to skip the wait
                  await advanceTime(contributionPeriod + 1)
                  await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                  // Artifically increase time to skip the wait
                  await advanceTime(cycleTime + 1)
                  await takaturnDiamondParticipant_1.startNewCycle(termId)

                  // Next cycle, only participant 1 pays. Participant 2 and 3 default. Participant 2 should be beneficiary
                  await executeCycle(termId, 2, [2, 3], false)

                  // Make sure participant 2 is beneficiary
                  let participantSummary = await takaturnDiamondDeployer.getParticipantFundSummary(
                      participant_2.address,
                      termId
                  )
                  assert.ok(participantSummary[1])

                  // Should be able to withdraw

                  await expect(takaturnDiamond.connect(participant_2).withdrawFund(termId)).not.to
                      .be.reverted
              })
          })

          describe("Combined Tests Part 4. Low number of participants", function () {
              beforeEach(async function () {
                  totalParticipantsPart4 = 2

                  // Create a new term where participant_1 is the term owner
                  // This create the term and collateral
                  await takaturnDiamondParticipant_1.createTerm(
                      totalParticipantsPart4,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      usdc
                  )

                  // Get the correct term id
                  const ids = await takaturnDiamondDeployer.getTermsId()
                  const termId = ids[0]

                  for (let i = 1; i <= totalParticipantsPart4; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      await takaturnDiamond
                          .connect(accounts[i])
                          ["joinTerm(uint256,bool)"](termId, false, { value: entrance })
                  }

                  await advanceTime(registrationPeriod + 1)

                  await takaturnDiamondParticipant_1.startTerm(termId)
              })

              it("does not produce weird behaviour when theres only 2 participants, and one pays and the other doesnt 1", async function () {
                  this.timeout(200000)

                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // First participant pays, second doesn't
                  await usdc
                      .connect(participant_1)
                      .approve(takaturnDiamond, contributionAmount * 10 ** 6)

                  await expect(
                      takaturnDiamond.connect(participant_1).payContribution(termId)
                  ).to.be.revertedWith("Beneficiary doesn't pay")

                  // Artifically increase time to skip the wait
                  await advanceTime(contributionPeriod + 1)
                  await takaturnDiamondParticipant_1.closeFundingPeriod(termId)
                  await advanceTime(cycleTime + 1)

                  await takaturnDiamondParticipant_1.startNewCycle(termId)

                  // Second participant pays, first doesn't
                  await usdc
                      .connect(participant_2)
                      .approve(takaturnDiamond, contributionAmount * 10 ** 6)
                  await expect(
                      takaturnDiamond.connect(participant_2).payContribution(termId)
                  ).to.be.revertedWith("Beneficiary doesn't pay")

                  // Artifically increase time to skip the wait
                  await advanceTime(contributionPeriod + 1)
                  await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                  let participant_1FundSummary =
                      await takaturnDiamondDeployer.getParticipantFundSummary(
                          participant_1.address,
                          termId
                      )
                  let participant_1BeneficiariesPool = participant_1FundSummary[4]

                  let participant_2FundSummary =
                      await takaturnDiamondDeployer.getParticipantFundSummary(
                          participant_2.address,
                          termId
                      )
                  let participant_2BeneficiariesPool = participant_2FundSummary[4]

                  let participant_1CollateralSummary =
                      await takaturnDiamondDeployer.getDepositorCollateralSummary(
                          participant_1.address,
                          termId
                      )
                  let participant_1PaymentBank = participant_1CollateralSummary[2]

                  let participant_2CollateralSummary =
                      await takaturnDiamondDeployer.getDepositorCollateralSummary(
                          participant_2.address,
                          termId
                      )
                  let participant_2PaymentBank = participant_2CollateralSummary[2]

                  assert.ok(participant_1BeneficiariesPool == participant_2BeneficiariesPool)
                  assert.ok(
                      participant_1PaymentBank.toString() == participant_2PaymentBank.toString()
                  )
              })

              it("does not produce weird behaviour when theres only 2 participants, and one pays and the other doesnt 2", async function () {
                  this.timeout(200000)

                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]
                  // First participant pays, second doesn't
                  await usdc
                      .connect(participant_2)
                      .approve(takaturnDiamond, contributionAmount * 10 ** 6)
                  await takaturnDiamond.connect(participant_2).payContribution(termId)

                  // Artifically increase time to skip the wait
                  await advanceTime(contributionPeriod + 1)
                  await takaturnDiamondParticipant_1.closeFundingPeriod(termId)
                  await advanceTime(cycleTime + 1)
                  await takaturnDiamondParticipant_1.startNewCycle(termId)

                  // First participant pays, second doesn't
                  await usdc
                      .connect(participant_1)
                      .approve(takaturnDiamond, contributionAmount * 10 ** 6)
                  await takaturnDiamond.connect(participant_1).payContribution(termId)

                  // Artifically increase time to skip the wait
                  await advanceTime(contributionPeriod + 1)
                  await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                  let participant_1FundSummary =
                      await takaturnDiamondDeployer.getParticipantFundSummary(
                          participant_1.address,
                          termId
                      )
                  let participant_1BeneficiariesPool = participant_1FundSummary[4]

                  let participant_2FundSummary =
                      await takaturnDiamondDeployer.getParticipantFundSummary(
                          participant_2.address,
                          termId
                      )
                  let participant_2BeneficiariesPool = participant_2FundSummary[4]

                  let participant_1CollateralSummary =
                      await takaturnDiamondDeployer.getDepositorCollateralSummary(
                          participant_1.address,
                          termId
                      )
                  let participant_1PaymentBank = participant_1CollateralSummary[2]

                  let participant_2CollateralSummary =
                      await takaturnDiamondDeployer.getDepositorCollateralSummary(
                          participant_2.address,
                          termId
                      )
                  let participant_2PaymentBank = participant_2CollateralSummary[2]

                  assert.ok(participant_1BeneficiariesPool == participant_2BeneficiariesPool)
                  assert.ok(participant_1PaymentBank == participant_2PaymentBank)
              })
          })
      })
