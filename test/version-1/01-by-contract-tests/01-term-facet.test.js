const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")
const { constants } = require("@openzeppelin/test-helpers")
const {
    CollateralStates,
    FundStates,
    getCollateralStateFromIndex,
    getFundStateFromIndex,
    advanceTimeByDate,
    toWei,
} = require("../../../utils/_helpers")
const { BigNumber } = require("ethers")
const { hour, erc20Units } = require("../../../utils/units")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Term Facet unit tests", function () {
          const chainId = network.config.chainId

          const totalParticipants = BigNumber.from("12") // Create term param
          const cycleTime = BigNumber.from("60") // Create term param
          const contributionAmount = BigNumber.from("100") // Create term param
          const contributionPeriod = BigNumber.from("20") // Create term param
          const collateralEth = toWei(3)
          const fixedCollateralEth = BigNumber.from(collateralEth) // Create term param
          const collateralFundingPeriod = BigNumber.from("604800")
          const collateralAmount = "60"

          let takaturnDiamond

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

          let takaturnDiamondDeployer, takaturnDiamondParticipant_1

          beforeEach(async () => {
              // Get the accounts
              accounts = await ethers.getSigners()
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

              // Deploy contracts
              await deployments.fixture(["takaturn_deploy"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")
              //   usdc = await ethers.getContract("FiatTokenV2_1")
              if (isDevnet && !isFork) {
                  aggregator = await ethers.getContract("MockV3Aggregator")
              } else {
                  const aggregatorAddress = networkConfig[chainId]["ethUsdPriceFeed"]
                  const usdcAddress = networkConfig[chainId]["usdc"]
                  aggregator = await ethers.getContractAt(
                      "AggregatorV3Interface",
                      aggregatorAddress
                  )
                  usdc = await ethers.getContractAt(
                      // "contracts/version-1/mocks/USDC.sol:IERC20"
                      "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                      usdcAddress
                  )
              }
              // Connect the accounts
              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)
              takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1)
          })

          describe("Create term function", function () {
              describe("Revert error tests", function () {
                  it("Should revert to create a new term if the inputs are incorrect", async function () {
                      // total participants is 0
                      await expect(
                          takaturnDiamondDeployer.createTerm(
                              0,
                              cycleTime,
                              contributionAmount,
                              contributionPeriod,
                              fixedCollateralEth,
                              collateralAmount,
                              usdc.address,
                              aggregator.address
                          )
                      ).to.be.revertedWith("Invalid inputs")

                      // cycle time is 0
                      await expect(
                          takaturnDiamondDeployer.createTerm(
                              totalParticipants,
                              0,
                              contributionAmount,
                              contributionPeriod,
                              fixedCollateralEth,
                              collateralAmount,
                              usdc.address,
                              aggregator.address
                          )
                      ).to.be.revertedWith("Invalid inputs")

                      // contribution amount is 0
                      await expect(
                          takaturnDiamondDeployer.createTerm(
                              totalParticipants,
                              cycleTime,
                              0,
                              contributionPeriod,
                              fixedCollateralEth,
                              collateralAmount,
                              usdc.address,
                              aggregator.address
                          )
                      ).to.be.revertedWith("Invalid inputs")

                      // contribution period is 0
                      await expect(
                          takaturnDiamondDeployer.createTerm(
                              totalParticipants,
                              cycleTime,
                              contributionAmount,
                              0,
                              fixedCollateralEth,
                              collateralAmount,
                              usdc.address,
                              aggregator.address
                          )
                      ).to.be.revertedWith("Invalid inputs")

                      // contribution period is less than cycle time
                      await expect(
                          takaturnDiamondDeployer.createTerm(
                              totalParticipants,
                              cycleTime,
                              contributionAmount,
                              cycleTime + 1,
                              fixedCollateralEth,
                              collateralAmount,
                              usdc.address,
                              aggregator.address
                          )
                      ).to.be.revertedWith("Invalid inputs")

                      // collateral amount is 0
                      await expect(
                          takaturnDiamondDeployer.createTerm(
                              totalParticipants,
                              cycleTime,
                              contributionAmount,
                              contributionPeriod,
                              fixedCollateralEth,
                              0,
                              usdc.address,
                              aggregator.address
                          )
                      ).to.be.revertedWith("Invalid inputs")

                      // stable token address is the address 0
                      await expect(
                          takaturnDiamondDeployer.createTerm(
                              totalParticipants,
                              cycleTime,
                              contributionAmount,
                              contributionPeriod,
                              fixedCollateralEth,
                              collateralAmount,
                              constants.ZERO_ADDRESS,
                              aggregator.address
                          )
                      ).to.be.revertedWith("Invalid inputs")

                      // aggregator address is the address 0
                      await expect(
                          takaturnDiamondDeployer.createTerm(
                              totalParticipants,
                              cycleTime,
                              contributionAmount,
                              contributionPeriod,
                              fixedCollateralEth,
                              collateralAmount,
                              usdc.address,
                              constants.ZERO_ADDRESS
                          )
                      ).to.be.revertedWith("Invalid inputs")
                  })
              })

              describe("Create term tests", function () {
                  it("Should create a new term with the default values", async function () {
                      await takaturnDiamondParticipant_1.createTerm(
                          totalParticipants,
                          cycleTime,
                          contributionAmount,
                          contributionPeriod,
                          fixedCollateralEth,
                          collateralAmount,
                          usdc.address,
                          aggregator.address
                      )
                      const termsId = await takaturnDiamondDeployer.getTermsId()
                      const lastTermId = termsId[0]
                      const nextTermId = termsId[1]

                      const newTerm = await takaturnDiamondDeployer.getTermSummary(lastTermId)

                      expect(nextTermId).to.equal(lastTermId.add(1))
                      assert.equal(newTerm.termOwner, participant_1.address)
                      assert.equal(newTerm.initialized, true)
                      assert.equal(newTerm.totalParticipants.toString(), totalParticipants)
                      assert.equal(newTerm.cycleTime.toString(), cycleTime)
                      assert.equal(newTerm.contributionAmount.toString(), contributionAmount)
                      assert.equal(newTerm.contributionPeriod.toString(), contributionPeriod)
                      assert.equal(newTerm.fixedCollateralEth.toString(), fixedCollateralEth)
                      assert.equal(newTerm.stableTokenAddress, usdc.address)
                      assert.equal(newTerm.aggregatorAddress, aggregator.address)
                  })

                  it("Should create a new collateral with the default values", async function () {
                      await takaturnDiamondParticipant_1.createTerm(
                          totalParticipants,
                          cycleTime,
                          contributionAmount,
                          contributionPeriod,
                          fixedCollateralEth,
                          collateralAmount,
                          usdc.address,
                          aggregator.address
                      )

                      const termsId = await takaturnDiamondDeployer.getTermsId()
                      const lastTermId = termsId[0]

                      const newCollateral = await takaturnDiamondDeployer.getCollateralSummary(
                          lastTermId
                      )

                      assert.equal(newCollateral[0], true)
                      expect(getCollateralStateFromIndex(newCollateral[1])).to.equal(
                          CollateralStates.AcceptingCollateral
                      )
                      assert.equal(newCollateral[2].toString(), "0")
                      assert.equal(newCollateral[3].toString(), "0")
                      assert.equal(newCollateral[4].length, totalParticipants)
                      for (let i = 0; i < totalParticipants; i++) {
                          assert.equal(newCollateral[4][i], constants.ZERO_ADDRESS)
                      }
                      assert.equal(
                          newCollateral[5].toString(),
                          erc20Units(collateralAmount).toString()
                      )
                  })
              })
          })

          describe("Join term function", function () {
              beforeEach(async function () {
                  await takaturnDiamondParticipant_1.createTerm(
                      totalParticipants,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      fixedCollateralEth,
                      collateralAmount,
                      usdc.address,
                      aggregator.address
                  )
              })
              describe("Revert errors tests", function () {
                  it("Revert errors", async function () {
                      const termId = await takaturnDiamondDeployer.getTermsId()
                      const lastTermId = termId[0]
                      const nextTermId = termId[1]

                      const term = await takaturnDiamondDeployer.getTermSummary(lastTermId)
                      const entrance = term.fixedCollateralEth

                      await expect(
                          takaturnDiamondParticipant_1.joinTerm(lastTermId, { value: 0 })
                      ).to.be.revertedWith("Eth payment too low")
                      await expect(
                          takaturnDiamondParticipant_1.joinTerm(nextTermId, { value: entrance })
                      ).to.be.reverted

                      await takaturnDiamondParticipant_1.joinTerm(lastTermId, { value: entrance })

                      await expect(
                          takaturnDiamondParticipant_1.joinTerm(lastTermId, { value: entrance })
                      ).to.be.revertedWith("Reentry")
                  })
              })
              describe("Join term", function () {
                  it("Should update the users mappings, emit an event and update the firstDepositTime", async function () {
                      // Get the correct term id
                      const termId = await takaturnDiamondDeployer.getTermsId()
                      const lastTermId = termId[0]

                      // Get the collateral payment deposit
                      const term = await takaturnDiamondDeployer.getTermSummary(lastTermId)
                      const entrance = term.fixedCollateralEth

                      // Iterate through every participant
                      for (let i = 1; i <= totalParticipants; i++) {
                          // Participants start in accounts 1
                          let depositor = accounts[i]

                          // Get the participant summary before joining
                          const depositorSummaryBefore =
                              await takaturnDiamondDeployer.getDepositorCollateralSummary(
                                  depositor.address,
                                  lastTermId
                              )

                          const memberBefore = depositorSummaryBefore[0]
                          const memberBankBefore = depositorSummaryBefore[1]

                          // Get the collateral summary before the participant joins
                          let collateral = await takaturnDiamondDeployer.getCollateralSummary(
                              lastTermId
                          )

                          const counterMembersBefore = collateral[3]

                          // Join
                          await expect(
                              takaturnDiamond
                                  .connect(depositor)
                                  .joinTerm(lastTermId, { value: entrance })
                          ).to.emit(takaturnDiamond, "OnCollateralDeposited")

                          // Get the participant summary after joining
                          const depositorSummaryAfter =
                              await takaturnDiamondDeployer.getDepositorCollateralSummary(
                                  depositor.address,
                                  lastTermId
                              )

                          const memberAfter = depositorSummaryAfter[0]
                          const memberBankAfter = depositorSummaryAfter[1]
                          // Get the collateral summary after the participant joins
                          collateral = await takaturnDiamondDeployer.getCollateralSummary(
                              lastTermId
                          )

                          const counterMembersAfter = collateral[3]
                          const depositorsArray = collateral[4]

                          if (i === 1) {
                              const firstDepositTime = collateral[2]
                              assert(firstDepositTime.toString() > "0")
                          }
                          // Assertions before joining
                          assert.equal(memberBefore, false)
                          assert.equal(memberBankBefore, "0")

                          // Assertions after joining
                          expect(counterMembersAfter).to.equal(counterMembersBefore.add(1))
                          assert.equal(memberAfter, true)
                          assert.equal(memberBankAfter.toString(), entrance.toString())
                          assert(memberBankAfter > memberBankBefore)
                          assert.equal(depositorsArray[i - 1], depositor.address)
                          if (i < totalParticipants) {
                              expect(getCollateralStateFromIndex(collateral[1])).to.equal(
                                  CollateralStates.AcceptingCollateral
                              )
                          } else {
                              expect(getCollateralStateFromIndex(collateral[1])).to.equal(
                                  CollateralStates.CycleOngoing
                              )
                              // Nobody else can enter
                              await expect(
                                  takaturnDiamondDeployer.joinTerm(lastTermId, { value: entrance })
                              ).to.be.revertedWith("No space")
                          }
                      }
                  })
              })
          })

          describe("Start term function", function () {
              describe("Revert errors tests", function () {
                  it("Should not enter until all requires passes", async function () {
                      // The participant must join the term
                      await expect(takaturnDiamondParticipant_1.startTerm(0)).to.be.reverted

                      const termId = await takaturnDiamondParticipant_1.createTerm(
                          totalParticipants,
                          cycleTime,
                          contributionAmount,
                          contributionPeriod,
                          fixedCollateralEth,
                          collateralAmount,
                          usdc.address,
                          aggregator.address
                      )

                      await expect(takaturnDiamondParticipant_1.startTerm(termId)).to.be.reverted
                  })
              })
              describe("Start term", function () {
                  beforeEach(async function () {
                      await takaturnDiamondParticipant_1.createTerm(
                          totalParticipants,
                          cycleTime,
                          contributionAmount,
                          contributionPeriod,
                          fixedCollateralEth,
                          collateralAmount,
                          usdc.address,
                          aggregator.address
                      )

                      const termId = await takaturnDiamondDeployer.getTermsId()
                      const lastTermId = termId[0]

                      const term = await takaturnDiamondDeployer.getTermSummary(lastTermId)
                      const entrance = term.fixedCollateralEth

                      for (let i = 1; i <= totalParticipants; i++) {
                          let depositor = accounts[i]

                          await takaturnDiamond
                              .connect(depositor)
                              .joinTerm(lastTermId, { value: entrance })
                      }
                  })
                  it("Start term", async function () {
                      const termId = await takaturnDiamondDeployer.getTermsId()
                      const lastTermId = termId[0]

                      await advanceTimeByDate(1, hour)

                      await expect(takaturnDiamondParticipant_1.startTerm(lastTermId))
                          .to.emit(takaturnDiamond, "OnTermStart")
                          .withArgs(lastTermId)

                      const newFund = await takaturnDiamondDeployer.getFundSummary(lastTermId)

                      assert.equal(newFund[0], true)
                      expect(getFundStateFromIndex(newFund[1])).to.equal(
                          FundStates.AcceptingContributions
                      )
                      assert.equal(newFund[2], usdc.address)

                      assert.equal(newFund[3].toString(), "1")
                      for (let i = 0; i < totalParticipants; i++) {
                          const participantSummary =
                              await takaturnDiamondDeployer.getParticipantFundSummary(
                                  accounts[i + 1].address,
                                  lastTermId
                              )
                          assert.equal(newFund[4][i], accounts[i + 1].address)
                          assert.equal(participantSummary[0], true)
                          assert.equal(participantSummary[2], false)
                      }

                      //assert.equal(newFund[5].toString(), Date.now() / 1000)
                  })
              })
          })
      })
