const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")
const { advanceTimeByDate, advanceTime, impersonateAccount } = require("../../../utils/_helpers")
const { hour } = require("../../../utils/units")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Unit Tests. Collateral Facet", function () {
          const chainId = network.config.chainId

          const totalParticipants = 6 // Create term param
          const cycleTime = 180 // Create term param
          const contributionAmount = 10 // Create term paramfli
          const contributionPeriod = 120 // Create term param
          const registrationPeriod = 120 // Create term param

          let takaturnDiamond

          let deployer,
              participant_1,
              participant_2,
              participant_3,
              participant_4,
              participant_5,
              participant_6,
              usdcOwner,
              usdcMasterMinter,
              usdcRegularMinter,
              usdcLostAndFound,
              usdcWhaleSigner

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
              usdcOwner = accounts[13]
              usdcMasterMinter = accounts[14]
              usdcRegularMinter = accounts[15]
              usdcLostAndFound = accounts[16]

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
                      // "contracts/version-1/mocks/USDC.sol:IERC20"
                      "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                      usdcAddress
                  )
              }
              // Connect the accounts
              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)
              takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1)
              takaturnDiamondParticipant_2 = takaturnDiamond.connect(participant_2)
              takaturnDiamondParticipant_3 = takaturnDiamond.connect(participant_3)

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
                  usdc
              )

              const balanceForUser = contributionAmount * totalParticipants * 10 ** 6

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
                          .approve(takaturnDiamond, balanceForUser * 10 ** 6)
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
                          .approve(takaturnDiamond, balanceForUser * 10 ** 6)
                  }
              }
          })

          describe("Participant can withdraw collateral", function () {
              describe("Participant joins without yield generation", function () {
                  beforeEach(async () => {
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]
                      for (let i = 0; i < totalParticipants; i++) {
                          // Get the collateral payment deposit
                          const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                              termId,
                              i
                          )
                          // Each participant joins the term
                          await takaturnDiamondParticipant_1
                              .connect(accounts[i + 1])
                              .joinTerm(termId, false, { value: entrance })
                      }

                      await advanceTime(registrationPeriod + 1)
                      await takaturnDiamond.startTerm(termId)
                  })
                  describe("Withdraw to same account", function () {
                      it("Should withdraw to the same participant address", async function () {
                          const lastTerm = await takaturnDiamondDeployer.getTermsId()
                          const termId = lastTerm[0]

                          const underCollateralized = await takaturnDiamond.isUnderCollaterized(
                              termId,
                              participant_1.address
                          )
                          const currentBeneficiary = await takaturnDiamond.getCurrentBeneficiary(
                              termId
                          )

                          // Pay the contribution for the first cycle
                          for (let i = 1; i <= totalParticipants; i++) {
                              try {
                                  await takaturnDiamondParticipant_1
                                      .connect(accounts[i])
                                      .payContribution(termId)
                              } catch (e) {}
                          }

                          await advanceTime(cycleTime + 1)

                          await takaturnDiamond.closeFundingPeriod(termId)

                          await takaturnDiamond.startNewCycle(termId)

                          const withdrawable = await takaturnDiamond.getWithdrawableUserBalance(
                              termId,
                              participant_1.address
                          )

                          await expect(takaturnDiamondParticipant_1.withdrawCollateral(termId))
                              .to.emit(takaturnDiamond, "OnCollateralWithdrawal")
                              .withArgs(
                                  termId,
                                  participant_1.address,
                                  participant_1.address,
                                  withdrawable
                              )

                          assert.ok(!underCollateralized)
                          assert.equal(currentBeneficiary, participant_1.address)
                      })
                  })
                  describe("Withdraw to another account", function () {
                      it("Should withdraw to a different adress", async function () {
                          const lastTerm = await takaturnDiamondDeployer.getTermsId()
                          const termId = lastTerm[0]

                          const underCollateralized = await takaturnDiamond.isUnderCollaterized(
                              termId,
                              participant_1.address
                          )
                          const currentBeneficiary = await takaturnDiamond.getCurrentBeneficiary(
                              termId
                          )

                          // Pay the contribution for the first cycle
                          for (let i = 1; i <= totalParticipants; i++) {
                              try {
                                  await takaturnDiamondParticipant_1
                                      .connect(accounts[i])
                                      .payContribution(termId)
                              } catch (e) {}
                          }

                          await advanceTime(cycleTime + 1)

                          await takaturnDiamond.closeFundingPeriod(termId)

                          await takaturnDiamond.startNewCycle(termId)

                          const withdrawable = await takaturnDiamond.getWithdrawableUserBalance(
                              termId,
                              participant_1.address
                          )

                          await expect(
                              takaturnDiamondParticipant_1.withdrawCollateralToAnotherAddress(
                                  termId,
                                  deployer.address
                              )
                          )
                              .to.emit(takaturnDiamond, "OnCollateralWithdrawal")
                              .withArgs(
                                  termId,
                                  participant_1.address,
                                  deployer.address,
                                  withdrawable
                              )

                          assert.ok(!underCollateralized)
                          assert.equal(currentBeneficiary, participant_1.address)
                      })
                  })
              })
          })

          describe("Frozen Money pot", function () {
              beforeEach(async () => {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]
                  for (let i = 0; i < totalParticipants; i++) {
                      // Get the collateral payment deposit
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i
                      )
                      // Each participant joins the term
                      await takaturnDiamondParticipant_1
                          .connect(accounts[i + 1])
                          .joinTerm(termId, false, { value: entrance })
                  }

                  await advanceTime(registrationPeriod + 1)
                  await takaturnDiamond.startTerm(termId)
              })
              it("Participant 1 gets the money pot, nobody defaults", async function () {
                  // Contribution period ended
                  // Participant 1 does not have to pay the contribution
                  // Participant 1 is the beneficiary
                  // Collateral bigger than 1.1RCC
                  // Participant 1 receives the money pot and can withdraw it.
                  // No money pot frozen
                  // Nobody defaults
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // Pay the contribution for the first cycle
                  for (let i = 2; i <= totalParticipants; i++) {
                      await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                  }

                  await advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)

                  const moneyPot = contributionAmount * (totalParticipants - 1) * 10 ** 6

                  await expect(takaturnDiamondParticipant_1.withdrawFund(termId))
                      .to.emit(takaturnDiamond, "OnFundWithdrawn")
                      .withArgs(termId, participant_1.address, participant_1.address, moneyPot)

                  const participant_1_FundSummary = await takaturnDiamond.getParticipantFundSummary(
                      participant_1.address,
                      termId
                  )

                  const moneyPotFrozen = participant_1_FundSummary[5]

                  assert.ok(!moneyPotFrozen)
              })

              it("Frozen money pot for participant 4", async function () {
                  // Contribution period ended on the foutth cycle
                  // Participant 4 always defaults
                  // Participant 4 is the beneficiary on cycle 4
                  // Participant 4 does not have to pay the contribution on cycle 4
                  // Collateral lowe than 1.1RCC
                  // Participant 4 receives the money pot and can not withdraw it.
                  // Money pot frozen
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // First cycle
                  for (let i = 1; i <= totalParticipants; i++) {
                      if (i == 1) {
                          continue
                      }
                      if (i !== 4) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  }
                  await advanceTime(cycleTime + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)
                  await takaturnDiamond.startNewCycle(termId)

                  // Second cycle
                  for (let i = 1; i <= totalParticipants; i++) {
                      if (i == 2) {
                          continue
                      }
                      if (i !== 4) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  }

                  await advanceTime(cycleTime + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)
                  await takaturnDiamond.startNewCycle(termId)

                  // Third cycle
                  for (let i = 1; i <= totalParticipants; i++) {
                      if (i == 3) {
                          continue
                      }
                      if (i !== 4) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  }

                  await advanceTime(cycleTime + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)
                  await takaturnDiamond.startNewCycle(termId)

                  // Fourth cycle
                  for (let i = 1; i <= totalParticipants; i++) {
                      if (i == 4) {
                          continue
                      }
                      await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                  }

                  await advanceTime(cycleTime + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)

                  const participant_4_FundSummary = await takaturnDiamond.getParticipantFundSummary(
                      participant_4.address,
                      termId
                  )

                  const moneyPotFrozen = participant_4_FundSummary[5]

                  await expect(
                      takaturnDiamond.connect(participant_4).withdrawFund(termId)
                  ).to.be.revertedWith("Need at least 1.1RCC collateral to unfreeze your fund")

                  assert.ok(moneyPotFrozen)
              })

              it("Liquidate collateral to non previous beneficiary [ @skip-on-ci ]", async function () {
                  // Contribution period ended on the first cycle
                  // Participant 6 defaults
                  // Everyone else pays
                  // Participant 1 is the beneficiary
                  // Collateral liquidated for participant 6
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // Pay the contribution for the first cycle
                  for (let i = 2; i < totalParticipants; i++) {
                      await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                  }

                  await advanceTime(cycleTime + 1)

                  await expect(takaturnDiamond.closeFundingPeriod(termId))
                      .to.emit(takaturnDiamond, "OnCollateralLiquidated")
                      .withArgs(termId, participant_6.address, 4478280340349305)
              })

              it("Liquidate collateral previous beneficiary [ @skip-on-ci ]", async function () {
                  // Contribution period ended on the second cycle
                  // Nobody defaults on first cycle
                  // Participant 1 defaults on second cycle
                  // Collateral liquidated for participant 1
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // Pay the contribution for the first cycle
                  for (let i = 2; i <= totalParticipants; i++) {
                      await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                  }

                  await advanceTime(cycleTime + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)
                  await takaturnDiamond.startNewCycle(termId)

                  // Pay the contribution for the second cycle
                  for (let i = 3; i <= totalParticipants; i++) {
                      await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                  }

                  await advanceTime(cycleTime + 1)
                  await expect(takaturnDiamond.closeFundingPeriod(termId))
                      .to.emit(takaturnDiamond, "OnCollateralLiquidated")
                      .withArgs(termId, participant_1.address, 4478280340349305)
              })

              it("Defaulter expelled, non previous beneficiary", async function () {
                  // Participant 5 defaults all cycles
                  // Participant 5 expelled at the end of the fourth cycle
                  this.timeout(200000)
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // First cycle
                  for (let i = 1; i <= totalParticipants; i++) {
                      if (i == 1) {
                          continue
                      }
                      if (i !== 5) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  }
                  await advanceTime(cycleTime + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)
                  await takaturnDiamond.startNewCycle(termId)

                  // Second cycle
                  for (let i = 1; i <= totalParticipants; i++) {
                      if (i == 2) {
                          continue
                      }
                      if (i !== 5) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  }

                  await advanceTime(cycleTime + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)
                  await takaturnDiamond.startNewCycle(termId)

                  // Third cycle
                  for (let i = 1; i <= totalParticipants; i++) {
                      if (i == 3) {
                          continue
                      }
                      if (i !== 5) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  }

                  await advanceTime(cycleTime + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)
                  await takaturnDiamond.startNewCycle(termId)

                  // Fourth cycle
                  for (let i = 1; i <= totalParticipants; i++) {
                      if (i == 4) {
                          continue
                      }
                      if (i !== 5) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  }

                  await advanceTime(cycleTime + 1)

                  const fundSummary = await takaturnDiamond.getFundSummary(termId)
                  const currentCycle = fundSummary[6]

                  await expect(takaturnDiamond.closeFundingPeriod(termId))
                      .to.emit(takaturnDiamond, "OnDefaulterExpelled")
                      .withArgs(termId, currentCycle, participant_5.address)
              })

              it("No obligation to pay", async function () {
                  // Participant 5 defaults all cycles
                  // Participant 5 expelled at the end of the fourth cycle
                  // Participants 4 and 6 are exempted from paying the contribution on the fifth cycle
                  // Participant 5 is no longer a participant
                  this.timeout(200000)
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // First cycle
                  for (let i = 1; i <= totalParticipants; i++) {
                      if (i == 1) {
                          continue
                      }
                      if (i !== 5) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  }
                  await advanceTime(cycleTime + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)
                  await takaturnDiamond.startNewCycle(termId)

                  // Second cycle
                  for (let i = 1; i <= totalParticipants; i++) {
                      if (i == 2) {
                          continue
                      }
                      if (i !== 5) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  }

                  await advanceTime(cycleTime + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)
                  await takaturnDiamond.startNewCycle(termId)

                  // Third cycle
                  for (let i = 1; i <= totalParticipants; i++) {
                      if (i == 3) {
                          continue
                      }
                      if (i !== 5) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  }

                  await advanceTime(cycleTime + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)
                  await takaturnDiamond.startNewCycle(termId)

                  // Fourth cycle
                  for (let i = 1; i <= totalParticipants; i++) {
                      if (i == 4) {
                          continue
                      }
                      if (i !== 5) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  }

                  await advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)
                  await takaturnDiamond.startNewCycle(termId)

                  // Fifth cycle
                  for (let i = 1; i <= totalParticipants; i++) {
                      if (i <= 3) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                      if (i == 4 && i == 6) {
                          await expect(
                              takaturnDiamond.connect(accounts[i]).payContribution(termId)
                          ).to.be.revertedWith("Participant is exempted this cycle")
                      }
                      if (i == 5) {
                          await expect(
                              takaturnDiamond.connect(accounts[i]).payContribution(termId)
                          ).to.be.revertedWith("Not a participant")
                      }
                  }

                  await advanceTime(cycleTime + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)
              })
          })
      })
