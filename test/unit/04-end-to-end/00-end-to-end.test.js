const { assert, expect } = require("chai")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")
const { network, ethers } = require("hardhat")
const {
    advanceTime,
    impersonateAccount,
    getTermStateFromIndex,
    TermStates,
    getCollateralStateFromIndex,
    CollateralStates,
    getFundStateFromIndex,
    FundStates,
} = require("../../../utils/_helpers")
const {
    totalParticipants,
    cycleTime,
    contributionAmount,
    contributionPeriod,
    registrationPeriod,
    moneyPot,
} = require("../utils/test-utils")
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants")
const { BigNumber } = require("ethers")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("End to end test", function () {
          const chainId = network.config.chainId

          let takaturnDiamond, aggregator, usdc, zaynZap

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

              // Deploy contract
              await deployments.fixture(["mocks"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")
              aggregator = await ethers.getContract("MockEthUsdAggregator")

              // Get contract instances

              const usdcAddress = networkConfig[chainId]["usdc"]
              const zaynZapAddress = networkConfig[chainId]["zaynfiZap"]

              usdc = await ethers.getContractAt(
                  "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                  usdcAddress
              )
              zaynZap = await ethers.getContractAt(
                  "contracts/interfaces/IZaynZapV2TakaDAO.sol:IZaynZapV2TakaDAO",
                  zaynZapAddress
              )

              // Connect the accounts
              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)

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

                  if (i == 3) {
                      const amount = moneyPot * 2
                      await usdcWhaleSigner.transfer(userAddress, amount * 10 ** 6)

                      await usdc
                          .connect(accounts[i])
                          .approve(takaturnDiamond.address, amount * 10 ** 6)
                  } else {
                      await usdcWhaleSigner.transfer(userAddress, moneyPot * 10 ** 6)

                      await usdc
                          .connect(accounts[i])
                          .approve(takaturnDiamond.address, moneyPot * 10 ** 6)
                  }
              }
          })

          it.only("End to end test", async function () {
              this.timeout(200000)
              // Reverts for create term
              await expect(
                  takaturnDiamond.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      0,
                      contributionAmount,
                      contributionPeriod,
                      usdc.address
                  )
              ).to.be.revertedWith("Invalid inputs")
              await expect(
                  takaturnDiamond.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      cycleTime,
                      0,
                      contributionPeriod,
                      usdc.address
                  )
              ).to.be.revertedWith("Invalid inputs")
              await expect(
                  takaturnDiamond.createTerm(
                      0,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      usdc.address
                  )
              ).to.be.revertedWith("Invalid inputs")
              await expect(
                  takaturnDiamond.createTerm(
                      totalParticipants,
                      0,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      usdc.address
                  )
              ).to.be.revertedWith("Invalid inputs")
              await expect(
                  takaturnDiamond.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      0,
                      usdc.address
                  )
              ).to.be.revertedWith("Invalid inputs")
              await expect(
                  takaturnDiamond.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      ZERO_ADDRESS
                  )
              ).to.be.revertedWith("Invalid inputs")
              // Create term
              await expect(
                  takaturnDiamond.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      usdc.address
                  )
              )
                  .to.emit(takaturnDiamond, "OnTermCreated")
                  .withArgs(0, deployer.address)

              // Check everything is store correctly
              const termsIds = await takaturnDiamond.getTermsId()
              const termId = termsIds[0]

              let term = await takaturnDiamond.getTermSummary(termId)
              let collateral = await takaturnDiamond.getCollateralSummary(termId)

              expect(term.initialized).to.equal(true)
              await expect(getTermStateFromIndex(term.state)).to.equal(TermStates.InitializingTerm)
              expect(term.termOwner).to.equal(deployer.address)
              expect(term.termId).to.equal(termId)
              expect(term.totalParticipants).to.equal(totalParticipants)
              expect(term.registrationPeriod).to.equal(registrationPeriod)
              expect(term.cycleTime).to.equal(cycleTime)
              expect(term.contributionAmount).to.equal(contributionAmount)
              expect(term.contributionPeriod).to.equal(contributionPeriod)
              expect(term.stableTokenAddress).to.equal(usdc.address)

              expect(collateral[0]).to.equal(true)
              await expect(getCollateralStateFromIndex(collateral[1])).to.equal(
                  CollateralStates.AcceptingCollateral
              )

              // A participant try to join an uninitialized term
              const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(termId, 0)
              await expect(
                  takaturnDiamond
                      .connect(participant_1)
                      .joinTerm(termsIds[1], false, { value: entrance })
              ).to.be.revertedWith("Term doesn't exist")

              // Participants join
              for (let i = 1; i <= totalParticipants; i++) {
                  let entrance = await takaturnDiamondDeployer.minCollateralToDeposit(termId, i - 1)

                  if (i % 2 == 0) {
                      if (i == totalParticipants) {
                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  .joinTerm(termId, true, { value: 0 })
                          ).to.be.revertedWith("Eth payment too low")

                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  .joinTerm(termId, true, { value: entrance })
                          )
                              .to.emit(takaturnDiamond, "OnTermFilled")
                              .withArgs(termId)

                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  .joinTerm(termId, true, { value: 0 })
                          ).to.be.revertedWith("No space")

                          await expect(
                              takaturnDiamondDeployer.minCollateralToDeposit(termId, i)
                          ).to.be.revertedWith("Index out of bounds")
                      } else {
                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  .joinTerm(termId, true, { value: entrance })
                          )
                              .to.emit(takaturnDiamond, "OnCollateralDeposited")
                              .withArgs(termId, accounts[i].address, entrance)
                      }
                      let hasOptedIn = await takaturnDiamond.userHasoptedInYG(
                          termId,
                          accounts[i].address
                      )

                      assert.ok(hasOptedIn)
                  } else {
                      if (i == 1) {
                          await expect(
                              takaturnDiamond.connect(accounts[i]).toggleOptInYG(termId)
                          ).to.be.revertedWith("Pay the collateral security deposit first")

                          await expect(
                              takaturnDiamond.connect(accounts[i]).toggleAutoPay(termId)
                          ).to.be.revertedWith("Pay collateral security first")

                          await expect(
                              takaturnDiamond.connect(accounts[i]).joinTerm(termId, false, {
                                  value: entrance,
                              })
                          )
                              .to.emit(takaturnDiamond, "OnCollateralDeposited")
                              .withArgs(termId, accounts[i].address, entrance)

                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  .joinTerm(termId, false, { value: entrance })
                          ).to.be.revertedWith("Reentry")

                          let hasOptedIn = await takaturnDiamond.userHasoptedInYG(
                              termId,
                              accounts[i].address
                          )

                          assert.ok(!hasOptedIn)

                          await expect(takaturnDiamond.connect(accounts[i]).toggleOptInYG(termId))
                              .to.emit(takaturnDiamond, "OnYGOptInToggled")
                              .withArgs(termId, accounts[i].address, !hasOptedIn)

                          await expect(takaturnDiamond.connect(accounts[i]).toggleOptInYG(termId))
                              .to.emit(takaturnDiamond, "OnYGOptInToggled")
                              .withArgs(termId, accounts[i].address, hasOptedIn)
                      } else {
                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  .joinTerm(termId, false, { value: entrance })
                          )
                              .to.emit(takaturnDiamond, "OnCollateralDeposited")
                              .withArgs(termId, accounts[i].address, entrance)
                          let hasOptedIn = await takaturnDiamond.userHasoptedInYG(
                              termId,
                              accounts[i].address
                          )

                          assert.ok(!hasOptedIn)
                      }
                  }

                  let collateralDepositorSummary =
                      await takaturnDiamond.getDepositorCollateralSummary(
                          accounts[i].address,
                          termId
                      )
                  assert.equal(collateralDepositorSummary[0], true)
                  assert.equal(collateralDepositorSummary[1].toString(), entrance.toString())
                  assert.equal(collateralDepositorSummary[2], 0)
                  assert.equal(collateralDepositorSummary[3].toString(), entrance.toString())
              }

              // This term will expire
              await takaturnDiamond.createTerm(
                  totalParticipants,
                  registrationPeriod,
                  cycleTime,
                  contributionAmount,
                  contributionPeriod,
                  usdc.address
              )

              let secondEntrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                  termsIds[1],
                  0
              )

              await takaturnDiamond
                  .connect(participant_1)
                  .joinTerm(termsIds[1], true, { value: secondEntrance })

              // Expire term
              await expect(takaturnDiamond.expireTerm(termId)).to.be.revertedWith(
                  "Registration period not ended"
              )

              await expect(takaturnDiamond.startTerm(termId)).to.be.revertedWith(
                  "Term not ready to start"
              )

              await advanceTime(registrationPeriod + 1)

              await expect(takaturnDiamond.expireTerm(termId)).to.be.revertedWith(
                  "All spots are filled, can't expire"
              )

              await expect(takaturnDiamond.startTerm(termsIds[1])).to.be.revertedWith(
                  "All spots are not filled"
              )

              await expect(takaturnDiamond.expireTerm(termsIds[1]))
                  .to.emit(takaturnDiamond, "OnTermExpired")
                  .withArgs(termsIds[1])

              let secondTerm = await takaturnDiamond.getTermSummary(termsIds[1])
              let secondCollateral = await takaturnDiamond.getCollateralSummary(termsIds[1])
              let secondCollateralDepositorSummary =
                  await takaturnDiamond.getDepositorCollateralSummary(
                      participant_1.address,
                      termsIds[1]
                  )
              assert.equal(secondCollateralDepositorSummary[0], false)
              assert.equal(secondCollateralDepositorSummary[1], 0)
              assert.equal(secondCollateralDepositorSummary[2].toString(), secondEntrance)

              await expect(getTermStateFromIndex(secondTerm.state)).to.equal(TermStates.ExpiredTerm)

              expect(secondCollateral[0]).to.equal(false)
              await expect(getCollateralStateFromIndex(secondCollateral[1])).to.equal(
                  CollateralStates.Closed
              )

              //******************************************** First cycle *********************************************************/

              // Start term

              // Manipulate Eth price to test the revert
              await aggregator.setPrice("100000000")

              await expect(takaturnDiamond.startTerm(termId)).to.be.revertedWith(
                  "Eth prices dropped"
              )

              // Manipulate Eth price to the original price
              await aggregator.setPrice("200000000000")

              await expect(takaturnDiamond.startTerm(termId))
                  .to.emit(takaturnDiamond, "OnTermStart")
                  .withArgs(termId)

              let remainingContributionTime = await takaturnDiamond.getRemainingContributionTime(
                  termId
              )

              assert.equal(remainingContributionTime.toNumber(), contributionPeriod)

              let remainingCycleTime = await takaturnDiamond.getRemainingCycleTime(termId)

              assert.equal(remainingCycleTime.toNumber(), cycleTime)

              term = await takaturnDiamond.getTermSummary(termId)
              collateral = await takaturnDiamond.getCollateralSummary(termId)

              await expect(getCollateralStateFromIndex(collateral[1])).to.equal(
                  CollateralStates.CycleOngoing
              )
              await expect(getTermStateFromIndex(term.state)).to.equal(TermStates.ActiveTerm)

              let fund = await takaturnDiamond.getFundSummary(termId)
              let yield = await takaturnDiamond.getYieldSummary(termId)

              expect(fund[0]).to.equal(true)
              await expect(getFundStateFromIndex(fund[1])).to.equal(
                  FundStates.AcceptingContributions
              )
              expect(fund[2]).to.equal(term.stableTokenAddress)
              expect(fund[6]).to.equal(1)
              expect(fund[7]).to.equal(totalParticipants)
              expect(yield[0]).to.equal(true)
              assert(yield[2].toString() > 0)
              expect(yield[2]).to.equal(yield[3])
              for (let i = 1; i <= totalParticipants; i++) {
                  expect(fund[3][i - 1]).to.equal(accounts[i].address)
                  expect(collateral[4][i - 1]).to.equal(accounts[i].address)

                  let fundUserSummary = await takaturnDiamond.getParticipantFundSummary(
                      accounts[i].address,
                      termId
                  )
                  expect(fundUserSummary[0]).to.equal(true) // isParticipant
                  expect(fundUserSummary[2]).to.equal(false) // paidThisCycle
              }

              for (let i = 10; i <= totalParticipants; i++) {
                  await expect(takaturnDiamond.connect(accounts[i]).toggleAutoPay(termId))
                      .to.emit(takaturnDiamond, "OnAutoPayToggled")
                      .withArgs(termId, accounts[i].address, true)

                  let fundUserSummary = await takaturnDiamond.getParticipantFundSummary(
                      accounts[i].address,
                      termId
                  )
                  expect(fundUserSummary[3]).to.equal(true)
              }

              // Participants contribution:
              // Beneficiary does not pay
              // Participant 3 always pays for participant 7
              // Participants 7 and 8 always defaults
              // Participant 10, 11, 12 auto pay

              for (let i = 1; i <= totalParticipants; i++) {
                  if (i < 10) {
                      let fund = await takaturnDiamond.getFundSummary(termId)
                      if (i == fund[6]) {
                          await expect(
                              takaturnDiamond.connect(accounts[i]).payContribution(termId)
                          ).to.be.revertedWith("Beneficiary doesn't pay")
                      } else if (i == 3) {
                          await expect(takaturnDiamond.connect(accounts[i]).payContribution(termId))
                              .to.emit(takaturnDiamond, "OnPaidContribution")
                              .withArgs(termId, accounts[i].address, fund[6])

                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  .payContributionOnBehalfOf(termId, participant_7.address)
                          )
                              .to.emit(takaturnDiamond, "OnPaidContribution")
                              .withArgs(termId, participant_7.address, fund[6])

                          fundUserSummary = await takaturnDiamond.getParticipantFundSummary(
                              accounts[i].address,
                              termId
                          )
                          expect(fundUserSummary[2]).to.equal(true) // paidThisCycle
                      } else if (i == 7) {
                          await expect(
                              takaturnDiamond.connect(accounts[i]).payContribution(termId)
                          ).to.be.revertedWith("Already paid for cycle")

                          fundUserSummary = await takaturnDiamond.getParticipantFundSummary(
                              accounts[i].address,
                              termId
                          )
                          expect(fundUserSummary[2]).to.equal(true) // paidThisCycle
                      } else if (i == 8) {
                          await expect(
                              takaturnDiamond.connect(deployer).payContribution(termId)
                          ).to.be.revertedWith("Not a participant")
                      } else {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  } else {
                      fundUserSummary = await takaturnDiamond.getParticipantFundSummary(
                          accounts[i].address,
                          termId
                      )
                      expect(fundUserSummary[2]).to.equal(false) // paidThisCycle
                  }
              }

              await expect(takaturnDiamond.closeFundingPeriod(termId)).to.be.revertedWith(
                  "Still time to contribute"
              )

              await advanceTime(contributionPeriod + 1)

              remainingContributionTime = await takaturnDiamond.getRemainingContributionTime(termId)

              assert.equal(remainingContributionTime, 0)

              fund = await takaturnDiamond.getFundSummary(termId)

              let defaulter_collateralSummary_before =
                  await takaturnDiamond.getDepositorCollateralSummary(participant_8.address, termId)

              let closeFundingPeriodTx = takaturnDiamond.closeFundingPeriod(termId)

              let contributionAmountWei = BigNumber.from("25000000000000000") // ETH = 2000 USD

              await Promise.all([
                  expect(closeFundingPeriodTx)
                      .to.emit(takaturnDiamond, "OnPaidContribution")
                      .withArgs(termId, participant_10.address, fund[6]),
                  expect(closeFundingPeriodTx)
                      .to.emit(takaturnDiamond, "OnPaidContribution")
                      .withArgs(termId, participant_11.address, fund[6]),
                  expect(closeFundingPeriodTx)
                      .to.emit(takaturnDiamond, "OnPaidContribution")
                      .withArgs(termId, participant_12.address, fund[6]),
                  expect(closeFundingPeriodTx)
                      .to.emit(takaturnDiamond, "OnParticipantDefaulted")
                      .withArgs(termId, fund[6], participant_8.address),
                  expect(closeFundingPeriodTx)
                      .to.emit(takaturnDiamond, "OnCollateralLiquidated")
                      .withArgs(termId, participant_8.address, contributionAmountWei),
                  expect(closeFundingPeriodTx)
                      .to.emit(takaturnDiamond, "OnBeneficiaryAwarded")
                      .withArgs(termId, accounts[fund[6]].address),
              ])

              fund = await takaturnDiamond.getFundSummary(termId)

              await expect(getFundStateFromIndex(fund[1])).to.equal(FundStates.CycleOngoing)

              let participant_1_fundSummary = await takaturnDiamond.getParticipantFundSummary(
                  participant_1.address,
                  termId
              )

              let participant_1_collateralSummary =
                  await takaturnDiamond.getDepositorCollateralSummary(participant_1.address, termId)

              let defaulter_collateralSummary_after =
                  await takaturnDiamond.getDepositorCollateralSummary(participant_8.address, termId)

              assert.equal(participant_1_fundSummary[1], true)
              assert.equal(
                  participant_1_fundSummary[4].toNumber(),
                  contributionAmount * 10 * 10 ** 6
              )
              assert.equal(participant_1_fundSummary[5], false)
              assert.equal(
                  defaulter_collateralSummary_before[1].toString(),
                  defaulter_collateralSummary_after[3].toString()
              )
              assert(
                  defaulter_collateralSummary_before[1].toString() >
                      defaulter_collateralSummary_after[1].toString()
              )
              assert.equal(
                  participant_1_collateralSummary[2].toString(),
                  contributionAmountWei.toString()
              )

              await expect(takaturnDiamond.closeFundingPeriod(termId)).to.be.revertedWith(
                  "Wrong state"
              )

              // Check the auto payers
              for (let i = 10; i <= totalParticipants; i++) {
                  let fund = await takaturnDiamond.getFundSummary(termId)
                  if (i != fund[6]) {
                      let fundUserSummary = await takaturnDiamond.getParticipantFundSummary(
                          accounts[i].address,
                          termId
                      )
                      expect(fundUserSummary[2]).to.equal(true) // paidThisCycle
                  }
              }

              // Start new Cycle
              await expect(takaturnDiamond.startNewCycle(termId)).to.be.revertedWith(
                  "Too early to start new cycle"
              )

              await advanceTime(cycleTime - contributionPeriod + 1)

              remainingCycleTime = await takaturnDiamond.getRemainingCycleTime(termId)

              assert.equal(remainingCycleTime.toNumber(), 0)

              //******************************************** Second cycle *********************************************************/

              fund = await takaturnDiamond.getFundSummary(termId)

              let startNewCycleTx = takaturnDiamond.startNewCycle(termId)
              await Promise.all([
                  expect(startNewCycleTx).to.emit(takaturnDiamond, "OnPaidContribution"),
                  expect(startNewCycleTx).to.emit(takaturnDiamond, "OnPaidContribution"),
                  expect(startNewCycleTx).to.emit(takaturnDiamond, "OnPaidContribution"),
              ])

              for (let i = 1; i <= totalParticipants; i++) {
                  let participantFundSummary = await takaturnDiamond.getParticipantFundSummary(
                      accounts[i].address,
                      termId
                  )
                  if (i < 10) {
                      assert.equal(participantFundSummary[2], false) // paidThisCycle
                  } else {
                      assert.equal(participantFundSummary[2], true) // paidThisCycle auto payers
                  }
              }

              fund = await takaturnDiamond.getFundSummary(termId)

              await expect(getFundStateFromIndex(fund[1])).to.equal(
                  FundStates.AcceptingContributions
              )
              assert.equal(fund[6], 2)

              await expect(
                  takaturnDiamond.connect(participant_2).withdrawFund(termId)
              ).to.be.revertedWith("You must be a beneficiary")

              let withdrawFundTx = takaturnDiamond.connect(participant_1).withdrawFund(termId)
              await Promise.all([
                  expect(withdrawFundTx)
                      .to.emit(takaturnDiamond, "OnFundWithdrawn")
                      .withArgs(termId, participant_1.address, contributionAmount * 10 * 10 ** 6),
                  expect(withdrawFundTx)
                      .to.emit(takaturnDiamond, "OnReimbursementWithdrawn")
                      .withArgs(termId, participant_1.address, contributionAmountWei),
              ])

              await expect(
                  takaturnDiamond.connect(participant_1).withdrawFund(termId)
              ).to.be.revertedWith("Nothing to withdraw")

              participant_1_fundSummary = await takaturnDiamond.getParticipantFundSummary(
                  participant_1.address,
                  termId
              )
              participant_1_collateralSummary = await takaturnDiamond.getDepositorCollateralSummary(
                  participant_1.address,
                  termId
              )

              assert.equal(participant_1_fundSummary[4].toNumber(), 0)
              assert.equal(participant_1_collateralSummary[2].toString(), 0)

              let allowedWithdrawal = await takaturnDiamond.getWithdrawableUserBalance(
                  termId,
                  participant_1.address
              )

              await expect(takaturnDiamond.connect(participant_1).withdrawCollateral(termId))
                  .to.emit(takaturnDiamond, "OnCollateralWithdrawal")
                  .withArgs(termId, participant_1.address, allowedWithdrawal)

              await expect(
                  takaturnDiamond.connect(participant_1).withdrawCollateral(termId)
              ).to.be.revertedWith("Withdraw failed")

              // Participants contribution:
              // Beneficiary does not pay
              // Participant 3 always pays for participant 7
              // Participants 7 and 8 always defaults
              // Participant 10, 11, 12 auto pay

              for (let i = 1; i <= totalParticipants; i++) {
                  if (i < 10) {
                      let fund = await takaturnDiamond.getFundSummary(termId)
                      if (i == fund[6] || i == 7 || i == 8) {
                          continue
                      } else if (i == 3) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)

                          await takaturnDiamond
                              .connect(accounts[i])
                              .payContributionOnBehalfOf(termId, participant_7.address)
                      } else {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  } else {
                      continue
                  }
              }

              await advanceTime(cycleTime + 1)
              await takaturnDiamond.closeFundingPeriod(termId)

              //******************************************** Third cycle *********************************************************/
              await takaturnDiamond.startNewCycle(termId)

              fund = await takaturnDiamond.getFundSummary(termId)

              assert.equal(fund[6], 3)

              await takaturnDiamond.connect(participant_1).withdrawCollateral(termId)
              await takaturnDiamond.connect(participant_2).withdrawCollateral(termId)

              yield = await takaturnDiamond.getUserYieldSummary(participant_2.address, termId)

              let availableYield = yield[3]

              if (availableYield > 0) {
                  await expect(
                      takaturnDiamond["claimAvailableYield(uint256,address)"](
                          termId,
                          participant_2.address
                      )
                  )
                      .to.emit(takaturnDiamond, "OnYieldClaimed")
                      .withArgs(termId, participant_2.address, availableYield)
              } else {
                  await expect(
                      takaturnDiamond["claimAvailableYield(uint256,address)"](
                          termId,
                          participant_2.address
                      )
                  ).to.be.revertedWith("No yield to withdraw")
              }

              for (let i = 1; i <= totalParticipants; i++) {
                  if (i < 10) {
                      let fund = await takaturnDiamond.getFundSummary(termId)
                      if (i == fund[6] || i == 1 || i == 7 || i == 8) {
                          continue
                      } else if (i == 3) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)

                          await takaturnDiamond
                              .connect(accounts[i])
                              .payContributionOnBehalfOf(termId, participant_7.address)
                      } else {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  } else {
                      continue
                  }
              }

              await advanceTime(contributionPeriod + 1)

              closeFundingPeriodTx = takaturnDiamond.closeFundingPeriod(termId)

              await Promise.all([
                  expect(closeFundingPeriodTx)
                      .to.emit(takaturnDiamond, "OnParticipantDefaulted")
                      .withArgs(termId, fund[6], participant_1.address),
                  expect(closeFundingPeriodTx)
                      .to.emit(takaturnDiamond, "OnCollateralLiquidated")
                      .withArgs(termId, participant_1.address, contributionAmountWei),
              ])

              await advanceTime(cycleTime + 1)

              //******************************************** Fourth cycle *********************************************************/
              await takaturnDiamond.startNewCycle(termId)

              fund = await takaturnDiamond.getFundSummary(termId)

              assert.equal(fund[6], 4)

              await takaturnDiamond.connect(participant_1).withdrawCollateral(termId)
              await takaturnDiamond.connect(participant_2).withdrawCollateral(termId)

              yield = await takaturnDiamond.getUserYieldSummary(participant_2.address, termId)

              availableYield = yield[3]

              if (availableYield > 0) {
                  await takaturnDiamond
                      .connect(participant_2)
                      ["claimAvailableYield(uint256)"](termId)
              } else {
                  await expect(
                      takaturnDiamond.connect(participant_2)["claimAvailableYield(uint256)"](termId)
                  ).to.be.revertedWith("No yield to withdraw")
              }

              for (let i = 1; i <= totalParticipants; i++) {
                  if (i < 10) {
                      let fund = await takaturnDiamond.getFundSummary(termId)
                      if (i == fund[6] || i == 7 || i == 8) {
                          continue
                      } else if (i == 3) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)

                          await takaturnDiamond
                              .connect(accounts[i])
                              .payContributionOnBehalfOf(termId, participant_7.address)
                      } else {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  } else {
                      continue
                  }
              }

              await advanceTime(cycleTime + 1)

              await takaturnDiamond.closeFundingPeriod(termId)

              //******************************************** Fifth cycle *********************************************************/
              await takaturnDiamond.startNewCycle(termId)

              fund = await takaturnDiamond.getFundSummary(termId)

              assert.equal(fund[6], 5)

              await takaturnDiamond.connect(participant_1).withdrawCollateral(termId)
              await takaturnDiamond.connect(participant_2).withdrawCollateral(termId)

              for (let i = 1; i <= totalParticipants; i++) {
                  if (i < 10) {
                      let fund = await takaturnDiamond.getFundSummary(termId)
                      if (i == fund[6] || i == 7 || i == 8) {
                          continue
                      } else if (i == 3) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)

                          await takaturnDiamond
                              .connect(accounts[i])
                              .payContributionOnBehalfOf(termId, participant_7.address)
                      } else {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  } else {
                      continue
                  }
              }

              await advanceTime(contributionPeriod + 1)

              await aggregator.setPrice("146000000000")

              await takaturnDiamond.closeFundingPeriod(termId)

              let participant_5_fundSummary = await takaturnDiamond.getParticipantFundSummary(
                  participant_5.address,
                  termId
              )

              assert(participant_5_fundSummary[5]) // Frozen money pot

              await advanceTime(cycleTime + 1)

              //******************************************** Sixth cycle *********************************************************/
              await takaturnDiamond.startNewCycle(termId)

              fund = await takaturnDiamond.getFundSummary(termId)

              assert.equal(fund[6], 6)

              for (let i = 1; i <= totalParticipants; i++) {
                  if (i < 10) {
                      let fund = await takaturnDiamond.getFundSummary(termId)
                      if (i == fund[6] || i == 5 || i == 7 || i == 8) {
                          continue
                      } else if (i == 3) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)

                          await takaturnDiamond
                              .connect(accounts[i])
                              .payContributionOnBehalfOf(termId, participant_7.address)
                      } else {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  } else {
                      continue
                  }
              }

              await advanceTime(contributionPeriod + 1)

              closeFundingPeriodTx = takaturnDiamond.closeFundingPeriod(termId)

              await Promise.all([
                  expect(closeFundingPeriodTx).to.emit(takaturnDiamond, "OnParticipantDefaulted"),
                  expect(closeFundingPeriodTx).to.emit(takaturnDiamond, "OnCollateralLiquidated"),
              ])
          })
      })
