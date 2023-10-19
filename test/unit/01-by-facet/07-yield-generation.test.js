const { assert, expect } = require("chai")
const { isFork, networkConfig } = require("../../../utils/_networks")
const { network, ethers } = require("hardhat")
const {
    FundStates,
    getFundStateFromIndex,
    advanceTime,
    impersonateAccount,
} = require("../../../utils/_helpers")
const {
    totalParticipants,
    cycleTime,
    contributionAmount,
    contributionPeriod,
    balanceForUser,
    registrationPeriod,
    getRandomInt,
} = require("../utils/test-utils")
// const { takaturnABI } = require("../utils/takaturnABI")
const { abi } = require("../../../deployments/mainnet_arbitrum/TakaturnDiamond.json")
const { deployments } = require("hardhat")

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

!isFork
    ? describe.skip
    : describe("Yield generation unit tests. Mainnet fork", function () {
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

              // Get the contract instances
              const takaturnDiamondAddress = networkConfig[chainId]["takaturnDiamond"]
              //   takaturnDiamond = await ethers.getContractAt(takaturnABI, takaturnDiamondAddress)
              takaturnDiamond = await ethers.getContractAt(abi, takaturnDiamondAddress)

              const zaynVaultAddress = networkConfig[chainId]["zaynfiVault"]
              zaynVault = await ethers.getContractAt(
                  "contracts/interfaces/IZaynVaultV2TakaDao.sol:IZaynVaultV2TakaDao",
                  zaynVaultAddress
              )

              const usdcAddress = networkConfig[chainId]["usdc"]

              usdc = await ethers.getContractAt(
                  "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                  usdcAddress
              )

              // Connect the accounts
              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)
              takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1)

              const usdcWhale = networkConfig[chainId]["usdcWhale"]
              await impersonateAccount(usdcWhale)
              const whale = await ethers.getSigner(usdcWhale)
              usdcWhaleSigner = usdc.connect(whale)

              let userAddress
              for (let i = 1; i <= totalParticipants; i++) {
                  userAddress = accounts[i].address
                  await usdcWhaleSigner.transfer(userAddress, balanceForUser)

                  await usdc
                      .connect(accounts[i])
                      .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)
              }
          })

          describe("Yield generation term creation", function () {
              beforeEach(async function () {
                  // Deploy upgrade
                  //   const waitBlockConfirmations = 1

                  //   const diamondDeployer = "0xF5C5B85eA5f255495e037563cB8cDe3513eE602e"
                  //   await impersonateAccount(diamondDeployer)

                  //   console.log("chainId", chainId)
                  //   ethUsdPriceFeedAddress = networkConfig[chainId]["ethUsdPriceFeed"]
                  //   usdcUsdPriceFeedAddress = networkConfig[chainId]["usdcUsdPriceFeed"]
                  //   zaynfiZapAddress = networkConfig[chainId]["zaynfiZap"]
                  //   zaynfiVaultAddress = networkConfig[chainId]["zaynfiVault"]

                  //   const args = []
                  //   const initArgs = [
                  //       ethUsdPriceFeedAddress,
                  //       usdcUsdPriceFeedAddress,
                  //       zaynfiZapAddress,
                  //       zaynfiVaultAddress,
                  //       false,
                  //   ]
                  //   console.log("Deploying upgrade...")
                  //   takaturnDiamondUpgrade = await deployments.diamond.deploy("TakaturnDiamond", {
                  //       from: deployer.address,
                  //       owner: deployer.address,
                  //       args: args,
                  //       log: true,
                  //       facets: [
                  //           "CollateralFacet",
                  //           "FundFacet",
                  //           "TermFacet",
                  //           "GettersFacet",
                  //           "YGFacetZaynFi",
                  //       ],
                  //       execute: {
                  //           contract: "DiamondInit",
                  //           methodName: "init",
                  //           args: initArgs,
                  //       },
                  //       waitConfirmations: waitBlockConfirmations,
                  //   })
                  console.log("Deployed upgrade")
                  await takaturnDiamondParticipant_1.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      usdc.address
                  )
              })

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
                  await takaturnDiamond.startTerm(termId)
              })
          })

          describe("Yield generation Getters", function () {
              beforeEach(async function () {
                  await takaturnDiamondParticipant_1.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      usdc.address
                  )

                  const ids = await takaturnDiamondDeployer.getTermsId()
                  const termId = ids[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      if (i < 2) {
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
                  await takaturnDiamond.startTerm(termId)
              })

              it("Return value of balanceOf", async function () {
                  const ids = await takaturnDiamond.getTermsId()
                  const termId = ids[0]

                  await executeCycle(termId, 0, [], false) // First cycle
                  //   await executeCycle(termId, 0, [], false) // Second cycle
                  //   await executeCycle(termId, 0, [], false) // Third cycle
                  //   await executeCycle(termId, 0, [], false) // Fourth cycle
                  //   await executeCycle(termId, 0, [], false) // Fifth cycle
                  //   await executeCycle(termId, 0, [], false) // Sixth cycle
                  //   await executeCycle(termId, 0, [], false) // Seventh cycle
                  //   await executeCycle(termId, 0, [], false) // Eighth cycle
                  //   await executeCycle(termId, 0, [], false) // Ninth cycle
                  //   await executeCycle(termId, 0, [], false) // Tenth cycle
                  //   await executeCycle(termId, 0, [], false) // Eleventh cycle
                  //   await executeCycle(termId, 0, [], false) // Twelfth cycle

                  const balanceOf = await zaynVault.callStatic.balanceOf(termId)

                  console.log(`Balance of: ${balanceOf}`)

                  const yieldDistributionRatio =
                      await takaturnDiamondDeployer.yieldDistributionRatio(
                          termId,
                          accounts[1].address
                      )
                  console.log("yieldDistributionRatio", yieldDistributionRatio.toString())

                  const userYieldGenerated =
                      await takaturnDiamondDeployer.callStatic.userYieldGenerated(
                          termId,
                          accounts[1].address
                      )
                  console.log("userYieldGenerated", userYieldGenerated.toString())

                  //   for (let i = 1; i <= totalParticipants; i++) {
                  //       const getWithdrawableUserBalance =
                  //           await takaturnDiamond.callStatic.user(
                  //               termId,
                  //               accounts[i].address
                  //           )
                  //       const getDepositorCollateralSummary =
                  //           await takaturnDiamond.getDepositorCollateralSummary(
                  //               accounts[i].address,
                  //               termId
                  //           )
                  //       const getCollateralSummary = await takaturnDiamond.getCollateralSummary(
                  //           termId
                  //       )
                  //       console.log(`Collateral state: ${getCollateralSummary[1]}`)
                  //       console.log(
                  //           `Participant ${i} collateralMembersBank: ${getDepositorCollateralSummary[1]}`
                  //       )
                  //       console.log(
                  //           `Participant ${i} getWithdrawableUserBalance: ${getWithdrawableUserBalance}`
                  //       )
                  //   }
              })
          })
      })
