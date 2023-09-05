const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../utils/_networks")
const { toWei, advanceTimeByDate } = require("../../utils/_helpers")
const { BigNumber } = require("ethers")
const { hour } = require("../../utils/units")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Upgrades Term Facet unit tests", function () {
          const chainId = network.config.chainId

          const totalParticipants = BigNumber.from("12") // Create term param
          const cycleTime = BigNumber.from("60") // Create term param
          const contributionAmount = BigNumber.from("100") // Create term param
          const contributionPeriod = BigNumber.from("20") // Create term param
          const registrationPeriod = BigNumber.from("6000") // Create term param
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
              usdcOwner = accounts[13]
              usdcMasterMinter = accounts[14]
              usdcRegularMinter = accounts[15]
              usdcLostAndFound = accounts[16]

              // Deploy contracts
              await deployments.fixture(["takaturn_upgrade"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")
              if (isDevnet && !isFork) {
                  aggregator = await ethers.getContract("MockEthUsdAggregator")
                  sequencer = await ethers.getContract("MockSequencer")
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
                      // "contracts/version-1/mocks/USDC.sol:IERC20"
                      "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                      usdcAddress
                  )
              }
              // Connect the accounts
              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)
              takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1)

              if (!isFork) {
                  await advanceTimeByDate(1, hour)
              }

              // Create the first term
              await takaturnDiamondParticipant_1.createTerm(
                  totalParticipants,
                  registrationPeriod,
                  cycleTime,
                  contributionAmount,
                  contributionPeriod,
                  usdc.address
              )
          })

          if (!isFork) {
              describe("Sequencer and oracle unit tests", function () {
                  it("Should revert if the sequencer does not met requires", async function () {
                      // Revert if the sequencer is down
                      await sequencer.setSequencerAnswer()

                      const term = await takaturnDiamondDeployer.getTermSummary(0)
                      await expect(
                          takaturnDiamondDeployer.minCollateralToDeposit(term, 0)
                      ).to.be.revertedWith("Sequencer down")

                      // Revert if the has not passed an hour since started
                      await sequencer.setSequencerAnswer()

                      await expect(
                          takaturnDiamondDeployer.minCollateralToDeposit(term, 0)
                      ).to.be.revertedWith("Sequencer starting up")

                      // Should not revert if the sequencer is up and has passed an hour since started
                      await advanceTimeByDate(1, hour)

                      await expect(takaturnDiamondDeployer.minCollateralToDeposit(term, 0)).not.to
                          .be.reverted
                  })

                  it("Should revert if the oracle does not met requires", async function () {
                      await advanceTimeByDate(1, hour)

                      await aggregator.setPrice(0)

                      const term = await takaturnDiamondDeployer.getTermSummary(0)
                      await expect(
                          takaturnDiamondDeployer.minCollateralToDeposit(term, 0)
                      ).to.be.revertedWith("ChainlinkOracle: stale data")
                  })
              })
          }

          describe("Participant can join multiple terms", function () {
              it("Should update the users mappings", async function () {
                  // Create five terms
                  for (let i = 0; i < 4; i++) {
                      await takaturnDiamondParticipant_1.createTerm(
                          totalParticipants,
                          registrationPeriod,
                          cycleTime,
                          contributionAmount,
                          contributionPeriod,
                          usdc.address
                      )
                  }

                  // Get the collateral payment deposit
                  const term = await takaturnDiamondDeployer.getTermSummary(0)
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(term, 0)

                  // Participant 1 joins the the five terms
                  for (let i = 0; i < 5; i++) {
                      const termId = i

                      // Join
                      await expect(
                          takaturnDiamond
                              .connect(participant_1)
                              .joinTerm(termId, false, { value: entrance })
                      ).to.emit(takaturnDiamond, "OnCollateralDeposited")

                      const participantSummary =
                          await takaturnDiamond.getDepositorCollateralSummary(
                              participant_1.address,
                              termId
                          )

                      const isCollateralMember = participantSummary[0]

                      assert.ok(isCollateralMember)
                  }

                  const participantTerms = await takaturnDiamond.getAllJoinedTerms(
                      participant_1.address
                  )

                  assert.equal(participantTerms.length, 5)
                  assert.equal(participantTerms[0], 0)
                  assert.equal(participantTerms[1], 1)
                  assert.equal(participantTerms[2], 2)
                  assert.equal(participantTerms[3], 3)
                  assert.equal(participantTerms[4], 4)
              })
          })

          describe("Participant can pay less as security deposit according their index order", function () {
              it("Last participant pays less than the first one", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]
                  // Get the collateral payment deposit
                  const term = await takaturnDiamondDeployer.getTermSummary(termId)

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          term,
                          i - 1
                      )

                      const failedEntrance = BigNumber.from(entrance).sub(1)

                      // Each participant fail to join the term with less than the min collateral

                      await expect(
                          takaturnDiamond
                              .connect(accounts[i])
                              .joinTerm(termId, false, { value: failedEntrance })
                      ).to.be.revertedWith("Eth payment too low")

                      await expect(
                          takaturnDiamond
                              .connect(accounts[i])
                              .joinTerm(termId, false, { value: entrance })
                      ).not.to.be.reverted
                  }

                  const participant_1_Summary = await takaturnDiamond.getDepositorCollateralSummary(
                      participant_1.address,
                      termId
                  )
                  const participant_1_Collateral = participant_1_Summary[3]

                  const participant_12_Summary =
                      await takaturnDiamond.getDepositorCollateralSummary(
                          participant_12.address,
                          termId
                      )
                  const participant_12_Collateral = participant_12_Summary[3]

                  assert(participant_1_Collateral > participant_12_Collateral)
              })
          })
      })
