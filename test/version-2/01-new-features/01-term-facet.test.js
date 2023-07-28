const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")
const { toWei } = require("../../../utils/_helpers")
const { BigNumber } = require("ethers")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Upgrades Term Facet unit tests", function () {
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
              await deployments.fixture(["takaturn_upgrade"])
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

              // Create five terms
              for (let i = 0; i < 5; i++) {
                  await takaturnDiamondParticipant_1.createTerm(
                      totalParticipants,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      collateralAmount,
                      usdc.address
                  )
              }
          })

          describe("Participant can join multiple terms", function () {
              describe("Join term", function () {
                  it("Should update the users mappings, emit an event and update the firstDepositTime", async function () {
                      // Participant 1 joins the the five terms
                      for (let i = 0; i < 5; i++) {
                          const termId = i
                          // Get the collateral payment deposit
                          const term = await takaturnDiamondDeployer.getTermSummary(termId)
                          const entrance = term.fixedCollateralEth

                          // Join
                          await expect(
                              takaturnDiamond
                                  .connect(participant_1)
                                  .joinTerm(termId, { value: entrance })
                          ).to.emit(takaturnDiamond, "OnCollateralDeposited")

                          const participantSummary =
                              await takaturnDiamond.getDepositorCollateralSummary(
                                  participant_1.address,
                                  termId
                              )
                          const isCollateralMember = participantSummary[0]

                          assert.ok(isCollateralMember)
                      }

                      const participantTerms = await takaturnDiamond.getParticipantTerms(
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
          })
      })
