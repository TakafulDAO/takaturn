const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../utils/_networks")

const { advanceTimeByDate, toWei } = require("../../utils/_helpers")
const { BigNumber } = require("ethers")
const { hour } = require("../../utils/units")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Fund Facet unit tests", function () {
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
              participant_12,
              usdcOwner,
              usdcMasterMinter,
              usdcRegularMinter,
              usdcLostAndFound

          let takaturnDiamondDeployer, takaturnParticipant_1

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
              await deployments.fixture(["all"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")
              usdc = await ethers.getContract("FiatTokenV2_1")
              if (isDevnet && !isFork) {
                  aggregator = await ethers.getContract("MockV3Aggregator")
              } else {
                  const aggregatorAddress = networkConfig[chainId]["ethUsdPriceFeed"]
                  aggregator = await ethers.getContractAt(
                      "AggregatorV3Interface",
                      aggregatorAddress
                  )
              }

              // Connect the accounts
              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)
              takaturnParticipant_1 = takaturnDiamond.connect(participant_1)

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

              //   participants = []
              //   for (let i = 1; i <= totalParticipants; i++) {
              //       participants.push(accounts[i])
              //   }

              // Create a new term
              await takaturnParticipant_1.createTerm(
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

                  // Mint USDC for depositor
                  await usdc
                      .connect(usdcRegularMinter)
                      .mint(depositor.address, contributionAmount * 10 ** 8 * totalParticipants)

                  // The depositor joins the term
                  await takaturnDiamond.connect(depositor).joinTerm(lastTermId, { value: entrance })
              }

              // Advance time by 1 hour for the sequencer started up
              await advanceTimeByDate(1, hour)
              await takaturnParticipant_1.startTerm(lastTermId)
          })

          describe("USDC related tests", function () {
              it("gives some USDC to the participants", async function () {
                  for (let i = 1; i <= totalParticipants; i++) {
                      balance = await usdc.balanceOf(accounts[i].address)
                      // console.log(`Accunt's ${i} balance: ${balance}`)
                      assert.ok(balance > 0)
                  }
              })
          })

          describe("Start new cycle tests", function () {
              // Functionality is tested on the term facet tests
              describe("Revert errors tests", function () {
                  it("reverts if the caller is not the owner", async () => {
                      const term = await takaturnDiamondDeployer.getTermsId()
                      const termId = term[0]
                      await expect(
                          takaturnDiamondDeployer.startNewCycle(termId)
                      ).to.be.revertedWith("TermOwnable: caller is not the owner")
                  })
                  it("reverts if the time is not met", async () => {
                      const term = await takaturnDiamondDeployer.getTermsId()
                      const termId = term[0]
                      await expect(takaturnParticipant_1.startNewCycle(termId)).to.be.revertedWith(
                          "Too early to start new cycle"
                      )
                  })
              })
          })
          describe("Paying contribution tests", function () {
              beforeEach(async () => {
                  for (let i = 1; i < totalParticipants; i++) {
                      await usdc
                          .connect(accounts[i])
                          .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)
                  }
              })
              describe("payContribution function", function () {
                  describe("Revert errors tests", function () {
                      it("reverts if the caller is not a participant", async () => {
                          const term = await takaturnDiamondDeployer.getTermsId()
                          const termId = term[0]
                          await expect(
                              takaturnDiamondDeployer.payContribution(termId)
                          ).to.be.revertedWith("Not a participant")
                      })
                  })
                  describe("Functionality tests", function () {
                      it("pays the contribution, updates the mappings and emit an event", async () => {
                          const lastTerm = await takaturnDiamondDeployer.getTermsId()
                          const termId = lastTerm[0]

                          const term = await takaturnDiamondDeployer.getTermSummary(termId)
                          const contributionAmount = term.contributionAmount

                          const takaturnBalanceBefore = await usdc.balanceOf(
                              takaturnDiamond.address
                          )
                          const participantBalanceBefore = await usdc.balanceOf(
                              participant_1.address
                          )

                          await expect(takaturnParticipant_1.payContribution(termId)).to.emit(
                              takaturnDiamond,
                              "OnPaidContribution"
                          )

                          await expect(
                              takaturnParticipant_1.payContribution(termId)
                          ).to.be.revertedWith("Already paid for cycle")

                          const takaturnBalanceAfter = await usdc.balanceOf(takaturnDiamond.address)
                          const participantBalanceAfter = await usdc.balanceOf(
                              participant_1.address
                          )

                          const depositorSummary =
                              await takaturnDiamondDeployer.getDepositorFundSummary(
                                  participant_1.address,
                                  termId
                              )

                          assert.equal(depositorSummary[2], true)
                          assert(takaturnBalanceAfter > takaturnBalanceBefore)
                          assert(participantBalanceBefore > participantBalanceAfter)
                          assert.equal(
                              takaturnBalanceAfter - takaturnBalanceBefore,
                              contributionAmount
                          )
                          assert.equal(
                              participantBalanceBefore - participantBalanceAfter,
                              contributionAmount
                          )
                      })
                  })
              })
              describe("payContributionOnBehalfOf function", function () {
                  describe("Revert errors tests", function () {
                      it("reverts if the beneficiary is not a participant", async () => {
                          const term = await takaturnDiamondDeployer.getTermsId()
                          const termId = term[0]
                          await expect(
                              takaturnParticipant_1.payContributionOnBehalfOf(
                                  termId,
                                  deployer.address
                              )
                          ).to.be.revertedWith("Not a participant")
                      })
                  })
                  describe("Functionality tests", function () {
                      it("pays the contribution, updates the mappings and emit an event", async () => {
                          const lastTerm = await takaturnDiamondDeployer.getTermsId()
                          const termId = lastTerm[0]

                          const term = await takaturnDiamondDeployer.getTermSummary(termId)
                          const contributionAmount = term.contributionAmount

                          const takaturnBalanceBefore = await usdc.balanceOf(
                              takaturnDiamond.address
                          )
                          const participantBalanceBefore = await usdc.balanceOf(
                              participant_1.address
                          )

                          await expect(
                              takaturnParticipant_1.payContributionOnBehalfOf(
                                  termId,
                                  participant_2.address
                              )
                          ).to.emit(takaturnDiamond, "OnPaidContribution")

                          await expect(
                              takaturnParticipant_1.payContributionOnBehalfOf(
                                  termId,
                                  participant_2.address
                              )
                          ).to.be.revertedWith("Already paid for cycle")

                          const takaturnBalanceAfter = await usdc.balanceOf(takaturnDiamond.address)
                          const participantBalanceAfter = await usdc.balanceOf(
                              participant_1.address
                          )

                          const depositorSummary =
                              await takaturnDiamondDeployer.getDepositorFundSummary(
                                  participant_2.address,
                                  termId
                              )

                          assert.equal(depositorSummary[2], true)
                          assert(takaturnBalanceAfter > takaturnBalanceBefore)
                          assert(participantBalanceBefore > participantBalanceAfter)
                          assert.equal(
                              takaturnBalanceAfter - takaturnBalanceBefore,
                              contributionAmount
                          )
                          assert.equal(
                              participantBalanceBefore - participantBalanceAfter,
                              contributionAmount
                          )
                      })
                  })
              })
          })
      })
