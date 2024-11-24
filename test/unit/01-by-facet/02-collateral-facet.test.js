const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")
const { advanceTimeByDate, advanceTime, impersonateAccount } = require("../../../utils/_helpers")
const { hour, day } = require("../../../utils/units")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Unit Tests. Collateral Facet", function () {
          const chainId = network.config.chainId

          const totalParticipants = 6 // Create term param
          const cycleTime = 180 // Create term param
          const contributionAmount = 10 // Create term param
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
                              ["joinTerm(uint256,bool)"](termId, false, { value: entrance })
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

                      it("Should be able to withdraw (partially) more if has already payed for the cycle", async function () {
                          const lastTerm = await takaturnDiamondDeployer.getTermsId()
                          const termId = lastTerm[0]

                          // Advance time to the second cycle

                          await advanceTime(cycleTime + 1)

                          await takaturnDiamond.closeFundingPeriod(termId)

                          await takaturnDiamond.startNewCycle(termId)

                          const withdrawableBefore =
                              await takaturnDiamond.getWithdrawableUserBalance(
                                  termId,
                                  participant_1.address
                              )

                          // Pay the contribution for the second cycle

                          await takaturnDiamondParticipant_1.payContribution(termId)

                          const withdrawableAfter =
                              await takaturnDiamond.getWithdrawableUserBalance(
                                  termId,
                                  participant_1.address
                              )

                          await expect(takaturnDiamondParticipant_1.withdrawCollateral(termId))
                              .to.emit(takaturnDiamond, "OnCollateralWithdrawal")
                              .withArgs(
                                  termId,
                                  participant_1.address,
                                  participant_1.address,
                                  withdrawableAfter
                              )

                          assert(withdrawableBefore < withdrawableAfter)
                      })
                  })
                  describe("Withdraw to another account", function () {
                      it("Should withdraw to a different adress", async function () {
                          const lastTerm = await takaturnDiamondDeployer.getTermsId()
                          const termId = lastTerm[0]

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

                          // Pay the contribution for the second cycle
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
                              participant_2.address
                          )

                          await expect(
                              takaturnDiamondParticipant_2.withdrawCollateralToAnotherAddress(
                                  termId,
                                  deployer.address
                              )
                          )
                              .to.emit(takaturnDiamond, "OnCollateralWithdrawal")
                              .withArgs(
                                  termId,
                                  participant_2.address,
                                  deployer.address,
                                  withdrawable
                              )
                      })
                  })
              })
          })

          describe("Defaults & expelleds", function () {
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
                          ["joinTerm(uint256,bool)"](termId, false, { value: entrance })
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

              it("No obligation to pay, no defaulters", async function () {
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
                          ).to.be.revertedWith("TT-FF-15") // Participant is exempted this cycle
                      }
                      if (i == 5) {
                          await expect(
                              takaturnDiamond.connect(accounts[i]).payContribution(termId)
                          ).to.be.revertedWith("TT-FF-12") // Not a participant
                      }
                  }

                  await advanceTime(cycleTime + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)
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
                  ).to.be.revertedWith("TT-FF-10") // Need at least 1.1RCC collateral to unfreeze your fund

                  assert.ok(moneyPotFrozen)
              })

              describe("Liquidate collateral", function () {
                  it("To non previous beneficiary [ @skip-on-ci ]", async function () {
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
                          .withArgs(termId, participant_6.address, 3812428516965306)
                  })

                  it("To previous beneficiary [ @skip-on-ci ]", async function () {
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
                          .withArgs(termId, participant_1.address, 3812428516965306)
                  })
              })

              describe("Liquidate money pot", function () {
                  beforeEach(async () => {
                      // Already tested the money pot frozen in other tests. Here we just need to test the liquidation
                      // The participant 2 will be the subject of study
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      // First cycle
                      for (let i = 1; i <= totalParticipants; i++) {
                          if (i !== 2) {
                              try {
                                  await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                              } catch (e) {}
                          }
                      }
                      await advanceTime(cycleTime + 1)
                      await takaturnDiamond.closeFundingPeriod(termId)

                      // Second cycle
                      await takaturnDiamond.startNewCycle(termId)

                      for (let i = 1; i <= totalParticipants; i++) {
                          if (i !== 2) {
                              try {
                                  await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                              } catch (e) {}
                          }
                      }

                      await advanceTime(cycleTime + 1)

                      const rcc = await takaturnDiamond.getRemainingCyclesContributionWei(termId)
                      await takaturnDiamond.testHelper_setCollateralMembersBank(
                          termId,
                          rcc / 2n,
                          participant_2.address
                      )

                      await takaturnDiamond.closeFundingPeriod(termId)

                      // Third cycle
                      await takaturnDiamond.startNewCycle(termId)
                  })

                  it("Sanity check", async function () {
                      // Only to check the functionality from the helper function
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      const participant_2_FundSummary = await takaturnDiamond.getUserRelatedSummary(
                          participant_2.address,
                          termId
                      )

                      const moneyPotFrozen = participant_2_FundSummary.moneyPotFrozen

                      assert.ok(moneyPotFrozen)
                  })

                  it("If collateral is enough to cover the cycle, not expelled", async function () {
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      for (let i = 1; i <= totalParticipants; i++) {
                          if (i !== 2) {
                              try {
                                  await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                              } catch (e) {}
                          }
                      }

                      await advanceTime(cycleTime + 1)

                      await expect(takaturnDiamond.closeFundingPeriod(termId)).to.emit(
                          takaturnDiamond,
                          "OnCollateralLiquidated"
                      )
                  })

                  it("If collateral is not enough to cover the cycle but money pot is", async function () {
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      for (let i = 1; i <= totalParticipants; i++) {
                          if (i !== 2) {
                              try {
                                  await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                              } catch (e) {}
                          }
                      }

                      await takaturnDiamond.testHelper_setCollateralMembersBank(
                          termId,
                          contributionAmount,
                          participant_2.address
                      )

                      await advanceTime(cycleTime + 1)

                      await expect(takaturnDiamond.closeFundingPeriod(termId))
                          .to.emit(takaturnDiamond, "OnFrozenMoneyPotLiquidated")
                          .withArgs(termId, participant_2.address, contributionAmount)
                  })

                  it("No money pot available, collateral not enough, expelled", async function () {
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      for (let i = 1; i <= totalParticipants; i++) {
                          if (i !== 2) {
                              try {
                                  await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                              } catch (e) {}
                          }
                      }

                      await takaturnDiamond.testHelper_setBeneficiariesPool(
                          termId,
                          0,
                          participant_2.address
                      )
                      await takaturnDiamond.testHelper_setCollateralMembersBank(
                          termId,
                          contributionAmount,
                          participant_2.address
                      )

                      await advanceTime(cycleTime + 1)

                      let userSummary = await takaturnDiamond.getUserRelatedSummary(
                          participant_2.address,
                          termId
                      )

                      const closeFundingPeriodTx = takaturnDiamond.closeFundingPeriod(termId)

                      await Promise.all([
                          expect(closeFundingPeriodTx)
                              .to.emit(takaturnDiamond, "OnCollateralLiquidated")
                              .withArgs(
                                  termId,
                                  participant_2.address,
                                  userSummary.membersBank + userSummary.paymentBank
                              ),
                          expect(closeFundingPeriodTx)
                              .to.emit(takaturnDiamond, "OnFrozenMoneyPotLiquidated")
                              .withArgs(termId, participant_2.address, userSummary.pool),
                      ])

                      userSummary = await takaturnDiamond.getUserRelatedSummary(
                          participant_2.address,
                          termId
                      )

                      const termSummary = await takaturnDiamond.getTermRelatedSummary(termId)

                      assert.equal(termSummary[3].fundCurrentCycle, userSummary.cycleExpelled)
                  })

                  it("No money pot available, no locked collateral available. Non locked collateral enough to pay rcc, no expelled", async function () {
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      for (let i = 1; i <= totalParticipants; i++) {
                          if (i !== 2) {
                              try {
                                  await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                              } catch (e) {}
                          }
                      }

                      const rcc = await takaturnDiamond.getRemainingCyclesContributionWei(termId)

                      await takaturnDiamond.testHelper_setBeneficiariesPool(
                          termId,
                          0,
                          participant_2.address
                      )
                      await takaturnDiamond.testHelper_setCollateralMembersBank(
                          termId,
                          0,
                          participant_2.address
                      )
                      await takaturnDiamond.testHelper_setCollateralPaymentBank(
                          termId,
                          rcc,
                          participant_2.address
                      )

                      await advanceTime(cycleTime + 1)

                      await expect(takaturnDiamond.closeFundingPeriod(termId)).to.emit(
                          takaturnDiamond,
                          "OnFrozenMoneyPotLiquidated"
                      )

                      let userSummary = await takaturnDiamond.getUserRelatedSummary(
                          participant_4.address,
                          termId
                      )

                      assert.equal(userSummary.cycleExpelled, 0n)
                  })

                  it("No money pot available, some locked collateral available. Non locked collateral + locked collateral enough to pay rcc, no expelled", async function () {
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      for (let i = 1; i <= totalParticipants; i++) {
                          if (i !== 2) {
                              try {
                                  await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                              } catch (e) {}
                          }
                      }

                      const rcc = await takaturnDiamond.getRemainingCyclesContributionWei(termId)

                      await takaturnDiamond.testHelper_setBeneficiariesPool(
                          termId,
                          0,
                          participant_2.address
                      )
                      await takaturnDiamond.testHelper_setCollateralMembersBank(
                          termId,
                          contributionAmount,
                          participant_2.address
                      )
                      await takaturnDiamond.testHelper_setCollateralPaymentBank(
                          termId,
                          rcc,
                          participant_2.address
                      )

                      await advanceTime(cycleTime + 1)

                      const closeFundingPeriodTx = takaturnDiamond.closeFundingPeriod(termId)

                      await Promise.all([
                          expect(closeFundingPeriodTx)
                              .to.emit(takaturnDiamond, "OnCollateralLiquidated")
                              .withArgs(termId, participant_2.address, contributionAmount),
                          expect(closeFundingPeriodTx).to.emit(
                              takaturnDiamond,
                              "OnFrozenMoneyPotLiquidated"
                          ),
                      ])

                      //   let userSummary = await takaturnDiamond.getUserRelatedSummary(
                      //       participant_4.address,
                      //       termId
                      //   )

                      //   assert.equal(userSummary.cycleExpelled, 0n)
                  })
              })

              describe("Expelleds", function () {
                  it("Non previous beneficiary", async function () {
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
              })
          })

          describe("Empty Collateral", function () {
              it("Wait 180 days to empty collateral in expired terms", async () => {
                  // participant_1 creating a new term
                  await takaturnDiamond
                      .connect(participant_1)
                      .createTerm(
                          totalParticipants,
                          registrationPeriod,
                          cycleTime,
                          contributionAmount,
                          contributionPeriod,
                          usdc
                      )
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]
                  const collat1 = await takaturnDiamondDeployer.minCollateralToDeposit(termId, 0)

                  // participant_2 joins the term
                  await takaturnDiamond
                      .connect(participant_2)
                      ["joinTerm(uint256,bool)"](termId, false, { value: collat1 })

                  const collat2 = await takaturnDiamondDeployer.minCollateralToDeposit(termId, 1)

                  // participant_3 joins the term
                  await takaturnDiamond
                      .connect(participant_3)
                      ["joinTerm(uint256,bool)"](termId, false, { value: collat2 })

                  // contribution period ends, not enough contributors (2/3), the term will be expired
                  await advanceTime(contributionPeriod + 1)
                  await takaturnDiamond.connect(participant_1).expireTerm(termId) // the term's owner expire it

                  // participant_1 is the term owner who expired it, he can steal both participants collateral
                  const ethBalanceBefore = await ethers.provider.getBalance(participant_1.address)
                  await expect(
                      takaturnDiamond.connect(participant_1).emptyCollateralAfterEnd(termId)
                  ).to.be.revertedWith("TT-TF-15")

                  await advanceTime(181 * day)
                  await expect(
                      takaturnDiamond.connect(participant_1).emptyCollateralAfterEnd(termId)
                  )
              })
          })
      })
