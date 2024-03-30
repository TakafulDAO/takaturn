const { assert, expect } = require("chai")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../utils/_networks")
const { network, ethers } = require("hardhat")
const {
    advanceTime,
    advanceTimeByDate,
    impersonateAccount,
    getTermStateFromIndex,
    TermStates,
    getCollateralStateFromIndex,
    CollateralStates,
    getFundStateFromIndex,
    FundStates,
} = require("../../utils/_helpers")
const { day } = require("../../utils/units")
const {
    totalParticipants,
    cycleTime,
    contributionAmount,
    contributionPeriod,
    registrationPeriod,
    moneyPot,
} = require("../utils/test-utils")
const { ZeroAddress } = require("ethers")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Integration tests. End to end", function () {
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

              await deployer.sendTransaction({
                  to: zapOwner,
                  value: ethers.parseEther("1"),
              })

              await zaynZapOwner.toggleTrustedSender(takaturnDiamond, true, {
                  gasLimit: 1000000,
              })

              let userAddress
              for (let i = 1; i <= totalParticipants; i++) {
                  userAddress = accounts[i].address

                  if (i == 3) {
                      const amount = moneyPot * 2
                      await usdcWhaleSigner.transfer(userAddress, amount * 10 ** 6, {
                          gasLimit: 1000000,
                      })

                      await usdc.connect(accounts[i]).approve(takaturnDiamond, amount * 10 ** 6)
                  } else {
                      await usdcWhaleSigner.transfer(userAddress, moneyPot * 10 ** 6, {
                          gasLimit: 1000000,
                      })

                      await usdc.connect(accounts[i]).approve(takaturnDiamond, moneyPot * 10 ** 6)
                  }
              }
          })

          it("End to end test", async function () {
              this.timeout(200000)
              //   Reverts for create term
              await expect(
                  takaturnDiamond.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      0,
                      contributionAmount,
                      contributionPeriod,
                      usdc
                  )
              ).to.be.revertedWith("TT-TF-01") // Invalid inputs
              await expect(
                  takaturnDiamond.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      cycleTime,
                      0,
                      contributionPeriod,
                      usdc
                  )
              ).to.be.revertedWith("TT-TF-01") // Invalid inputs
              await expect(
                  takaturnDiamond.createTerm(
                      0,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      usdc
                  )
              ).to.be.revertedWith("TT-TF-01") // Invalid inputs
              await expect(
                  takaturnDiamond.createTerm(
                      totalParticipants,
                      0,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      usdc
                  )
              ).to.be.revertedWith("TT-TF-01") // Invalid inputs
              await expect(
                  takaturnDiamond.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      0,
                      usdc
                  )
              ).to.be.revertedWith("TT-TF-01") // Invalid inputs
              await expect(
                  takaturnDiamond.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      ZeroAddress
                  )
              ).to.be.revertedWith("TT-TF-01") // Invalid inputs
              // Create term
              await expect(
                  takaturnDiamond.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      usdc
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
              expect(term.stableTokenAddress).to.equal(usdc.target)

              expect(collateral[0]).to.equal(true)
              await expect(getCollateralStateFromIndex(collateral[1])).to.equal(
                  CollateralStates.AcceptingCollateral
              )

              // A participant try to join an uninitialized term
              const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(termId, 0)
              await expect(
                  takaturnDiamond
                      .connect(participant_1)
                      ["joinTerm(uint256,bool)"](termsIds[1], false, { value: entrance })
              ).to.be.revertedWith("TT-TF-02") // Term doesn't exist

              // Participants join
              for (let i = 1; i <= totalParticipants; i++) {
                  let entrance = await takaturnDiamondDeployer.minCollateralToDeposit(termId, i - 1)

                  if (i % 2 == 0) {
                      if (i == totalParticipants) {
                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  ["joinTerm(uint256,bool)"](termId, true, { value: 0 })
                          ).to.be.revertedWith("TT-TF-08") // Eth payment too low

                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  ["joinTerm(uint256,bool)"](termId, true, { value: entrance })
                          )
                              .to.emit(takaturnDiamond, "OnTermFilled")
                              .withArgs(termId)

                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  ["joinTerm(uint256,bool)"](termId, true, { value: 0 })
                          ).to.be.revertedWith("TT-TF-04") //  No space

                          await expect(
                              takaturnDiamondDeployer.minCollateralToDeposit(termId, i)
                          ).to.be.revertedWith("TT-GF-01") // Index out of bounds
                      } else {
                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  ["joinTerm(uint256,bool)"](termId, true, { value: entrance })
                          )
                              .to.emit(takaturnDiamond, "OnCollateralDepositedNext")
                              .withArgs(
                                  termId,
                                  accounts[i].address,
                                  accounts[i].address,
                                  entrance,
                                  i - 1
                              )
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
                          ).to.be.revertedWith("TT-YF-03") // Pay the collateral security deposit first

                          await expect(
                              takaturnDiamond.connect(accounts[i]).toggleAutoPay(termId)
                          ).to.be.revertedWith("TT-FF-05") // Reentry

                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  ["joinTerm(uint256,bool)"](termId, false, {
                                      value: entrance,
                                  })
                          )
                              .to.emit(takaturnDiamond, "OnCollateralDepositedNext")
                              .withArgs(
                                  termId,
                                  accounts[i].address,
                                  accounts[i].address,
                                  entrance,
                                  i - 1
                              )

                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  ["joinTerm(uint256,bool)"](termId, false, { value: entrance })
                          ).to.be.revertedWith("TT-TF-05") // Reentry

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
                                  ["joinTerm(uint256,bool)"](termId, false, { value: entrance })
                          )
                              .to.emit(takaturnDiamond, "OnCollateralDepositedNext")
                              .withArgs(
                                  termId,
                                  accounts[i].address,
                                  accounts[i].address,
                                  entrance,
                                  i - 1
                              )
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
                  usdc
              )

              let secondEntrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                  termsIds[1],
                  0
              )

              await takaturnDiamond
                  .connect(participant_1)
                  ["joinTerm(uint256,bool)"](termsIds[1], true, { value: secondEntrance })

              // Expire term
              await expect(takaturnDiamond.expireTerm(termId)).to.be.revertedWith("TT-TF-13") // Registration period not ended

              await expect(takaturnDiamond.startTerm(termId)).to.be.revertedWith("TT-TF-09") // Term not ready to start

              await advanceTime(registrationPeriod + 1)

              await expect(takaturnDiamond.expireTerm(termId)).to.be.revertedWith("TT-TF-14") // All spots are filled, can't expire

              await expect(takaturnDiamond.startTerm(termsIds[1])).to.be.revertedWith("TT-TF-10") // All spots are not filled

              await expect(takaturnDiamond.expireTerm(termsIds[1]))
                  .to.emit(takaturnDiamond, "OnTermExpired")
                  .withArgs(termsIds[1])

              await takaturnDiamond.connect(participant_1).withdrawCollateral(termsIds[1])

              let secondTerm = await takaturnDiamond.getTermSummary(termsIds[1])
              let secondCollateral = await takaturnDiamond.getCollateralSummary(termsIds[1])
              secondCollateralDepositorSummary =
                  await takaturnDiamond.getDepositorCollateralSummary(
                      participant_1.address,
                      termsIds[1]
                  )
              assert.equal(secondCollateralDepositorSummary[1], 0)

              await expect(getTermStateFromIndex(secondTerm.state)).to.equal(TermStates.ExpiredTerm)

              await expect(getCollateralStateFromIndex(secondCollateral[1])).to.equal(
                  CollateralStates.ReleasingCollateral
              )

              //   //******************************************** First cycle *********************************************************/

              // Start term

              // Manipulate Eth price to test the revert
              await aggregator.setPrice("100000000")

              await expect(takaturnDiamond.startTerm(termId)).to.be.revertedWith("TT-TF-11") //  Eth prices dropped

              const neededAllowance_participant_1 =
                  await takaturnDiamondDeployer.getNeededAllowance(participant_1.address)

              const neededAllowance_participant_12 =
                  await takaturnDiamondDeployer.getNeededAllowance(participant_12.address)

              assert.equal(neededAllowance_participant_1.toString(), moneyPot * 10 ** 6)
              assert.equal(
                  neededAllowance_participant_12.toString(),
                  neededAllowance_participant_1.toString()
              )

              // Manipulate Eth price to the original price
              await aggregator.setPrice("200000000000")

              await expect(takaturnDiamond.startTerm(termId))
                  .to.emit(takaturnDiamond, "OnTermStart")
                  .withArgs(termId)

              let underCollaterized = await takaturnDiamondDeployer.isUnderCollaterized(
                  termId,
                  participant_1.address
              )

              assert.equal(underCollaterized, false)

              let remainingContributionTime = await takaturnDiamond.getRemainingContributionTime(
                  termId
              )

              assert.equal(remainingContributionTime, contributionPeriod)

              let remainingCycleTime = await takaturnDiamond.getRemainingCycleTime(termId)

              assert.equal(remainingCycleTime, cycleTime)

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

              for (let i = 1; i <= totalParticipants; i++) {
                  if (i < 10) {
                      let fund = await takaturnDiamond.getFundSummary(termId)
                      if (i == fund[6]) {
                          await expect(
                              takaturnDiamond.connect(accounts[i]).payContribution(termId)
                          ).to.be.revertedWith("TT-FF-14") // Beneficiary doesn't pay
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
                          ).to.be.revertedWith("TT-FF-13") // Already paid for cycle

                          fundUserSummary = await takaturnDiamond.getParticipantFundSummary(
                              accounts[i].address,
                              termId
                          )
                          expect(fundUserSummary[2]).to.equal(true) // paidThisCycle
                      } else if (i == 8) {
                          await expect(
                              takaturnDiamond.connect(deployer).payContribution(termId)
                          ).to.be.revertedWith("TT-FF-12") // Not a participant
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
                  "TT-FF-01"
              ) // Still time to contribute

              await advanceTime(contributionPeriod + 1)

              remainingContributionTime = await takaturnDiamond.getRemainingContributionTime(termId)

              assert.equal(remainingContributionTime, 0)

              fund = await takaturnDiamond.getFundSummary(termId)

              let defaulter_collateralSummary_before =
                  await takaturnDiamond.getDepositorCollateralSummary(participant_8.address, termId)

              let closeFundingPeriodTx = takaturnDiamond.closeFundingPeriod(termId)

              let contributionAmountWei = 25000000000000000n // ETH = 2000 USD

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
              assert.equal(participant_1_fundSummary[4], contributionAmount * 10 * 10 ** 6)
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
                  "TT-FF-02"
              ) // Wrong state

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
              await expect(takaturnDiamond.startNewCycle(termId)).to.be.revertedWith("TT-LF-01") // Too early to start new cycle

              await advanceTime(cycleTime - contributionPeriod + 1)

              remainingCycleTime = await takaturnDiamond.getRemainingCycleTime(termId)

              assert.equal(remainingCycleTime, 0)

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
              ).to.be.revertedWith("TT-FF-08") // The caller must be a participant

              let withdrawFundTx = takaturnDiamond.connect(participant_1).withdrawFund(termId)
              await Promise.all([
                  expect(withdrawFundTx)
                      .to.emit(takaturnDiamond, "OnFundWithdrawn")
                      .withArgs(
                          termId,
                          participant_1.address,
                          participant_1.address,
                          contributionAmount * 10 * 10 ** 6
                      ),
                  expect(withdrawFundTx)
                      .to.emit(takaturnDiamond, "OnReimbursementWithdrawn")
                      .withArgs(
                          termId,
                          participant_1.address,
                          participant_1.address,
                          contributionAmountWei
                      ),
              ])

              await expect(
                  takaturnDiamond.connect(participant_1).withdrawFund(termId)
              ).to.be.revertedWith("TT-FF-09") // Nothing to withdraw

              participant_1_fundSummary = await takaturnDiamond.getParticipantFundSummary(
                  participant_1.address,
                  termId
              )
              participant_1_collateralSummary = await takaturnDiamond.getDepositorCollateralSummary(
                  participant_1.address,
                  termId
              )

              assert.equal(participant_1_fundSummary[4], 0)
              assert.equal(participant_1_collateralSummary[2].toString(), 0)

              await expect(takaturnDiamond.connect(participant_1).withdrawCollateral(termId))
                  .to.emit(takaturnDiamond, "OnCollateralWithdrawal")
                  .withArgs(
                      termId,
                      participant_1.address,
                      participant_1.address,
                      "37500000000000000"
                  )

              await expect(
                  takaturnDiamond.connect(participant_1).withdrawCollateral(termId)
              ).to.be.revertedWith("TT-CF-04") // Nothing to withdraw

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
                  //   console.log("availableYield", availableYield.toString())
                  await expect(
                      takaturnDiamond
                          .connect(participant_2)
                          .claimAvailableYield(termId, participant_2.address)
                  )
                      .to.emit(takaturnDiamond, "OnYieldClaimed")
                      .withArgs(termId, participant_2.address, availableYield)
              } else {
                  //   console.log("No yield")
                  await expect(
                      takaturnDiamond
                          .connect(participant_2)
                          .claimAvailableYield(termId, participant_2.address)
                  ).to.be.revertedWith("TT-LYG-01") // No yield to withdraw
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
                  //   console.log("availableYield", availableYield.toString())
                  await takaturnDiamond
                      .connect(participant_2)
                      .claimAvailableYield(termId, participant2.address)
              } else {
                  //   console.log("No yield")
                  await expect(
                      takaturnDiamond
                          .connect(participant_2)
                          .claimAvailableYield(termId, participant_2.address)
                  ).to.be.revertedWith("TT-LYG-01") // No yield to withdraw
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

              await advanceTime(cycleTime + 1)

              //******************************************** Seventh cycle *********************************************************/
              await takaturnDiamond.startNewCycle(termId)

              fund = await takaturnDiamond.getFundSummary(termId)

              assert.equal(fund[6], 7)

              for (let i = 1; i <= totalParticipants; i++) {
                  if (i < 10) {
                      let fund = await takaturnDiamond.getFundSummary(termId)
                      if (i == fund[6] || i == 4 || i == 5 || i == 6 || i == 8) {
                          continue
                      } else if (i == 3) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      } else {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                  } else {
                      continue
                  }
              }

              await advanceTime(contributionPeriod + 1)

              await aggregator.setPrice("10000000000")

              underCollaterized = await takaturnDiamondDeployer.isUnderCollaterized(
                  termId,
                  participant_8.address
              )

              assert.equal(underCollaterized, true)

              closeFundingPeriodTx = takaturnDiamond.closeFundingPeriod(termId)

              await Promise.all([
                  expect(closeFundingPeriodTx).to.emit(takaturnDiamond, "OnParticipantDefaulted"),
                  expect(closeFundingPeriodTx).to.emit(takaturnDiamond, "OnCollateralLiquidated"),
                  expect(closeFundingPeriodTx)
                      .to.emit(takaturnDiamond, "OnDefaulterExpelled")
                      .withArgs(termId, fund[6], participant_4.address),
                  expect(closeFundingPeriodTx)
                      .to.emit(takaturnDiamond, "OnDefaulterExpelled")
                      .withArgs(termId, fund[6], participant_8.address),
                  expect(closeFundingPeriodTx).to.emit(
                      takaturnDiamond,
                      "OnFrozenMoneyPotLiquidated"
                  ),
              ])

              let expelled = await takaturnDiamond.wasExpelled(termId, participant_4.address)
              assert(expelled)

              expelled = await takaturnDiamond.wasExpelled(termId, participant_8.address)
              assert(expelled)

              await advanceTime(cycleTime + 1)

              //******************************************** Eight cycle *********************************************************/
              await takaturnDiamond.startNewCycle(termId)

              fund = await takaturnDiamond.getFundSummary(termId)

              assert.equal(fund[6], 8)

              const expelledTerms = await takaturnDiamond.getExpelledTerms(participant_4.address)

              assert.equal(expelledTerms[0].toString(), termId.toString())

              for (let i = 1; i <= totalParticipants; i++) {
                  if (i == 4 || i == 8) {
                      await expect(
                          takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      ).to.be.revertedWith("TT-FF-12") // Not a participant
                  }
                  if (i == 7 || i > 8) {
                      await expect(
                          takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      ).to.be.revertedWith("TT-FF-15") // Participant is exempted this cycle

                      let isExempted = await takaturnDiamond.isExempted(
                          termId,
                          fund[6],
                          accounts[i].address
                      )
                      assert(isExempted)
                  }
                  if (i < 4 || i == 5) {
                      await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      let isExempted = await takaturnDiamond.isExempted(
                          termId,
                          fund[6],
                          accounts[i].address
                      )
                      assert(!isExempted)
                  }
              }

              await advanceTime(contributionPeriod + 1)

              await takaturnDiamond.closeFundingPeriod(termId)

              await advanceTime(cycleTime + 1)

              //******************************************** Ninth cycle *********************************************************/
              await takaturnDiamond.startNewCycle(termId)

              fund = await takaturnDiamond.getFundSummary(termId)

              assert.equal(fund[6], 9)

              for (let i = 1; i <= totalParticipants; i++) {
                  if (i < 10) {
                      if (i == 4 || i == 8 || i == fund[6]) {
                          continue
                      }
                      await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                  }
              }

              await advanceTime(contributionPeriod + 1)

              await takaturnDiamond.closeFundingPeriod(termId)

              await advanceTime(cycleTime + 1)

              //******************************************** Tenth cycle *********************************************************/
              await takaturnDiamond.startNewCycle(termId)

              fund = await takaturnDiamond.getFundSummary(termId)

              assert.equal(fund[6], 10)

              await expect(
                  takaturnDiamond.connect(participant_9).withdrawFund(termId)
              ).to.be.revertedWith("TT-FF-10") // Need at least 1.1RCC collateral to unfreeze your fund

              await aggregator.setPrice("9000000000")

              for (let i = 1; i <= totalParticipants; i++) {
                  if (i == 4 || 8 <= i <= 10) {
                      continue
                  }
                  if (i < 10) {
                      await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                  }
              }

              await advanceTime(contributionPeriod + 1)

              await takaturnDiamond.closeFundingPeriod(termId)

              await advanceTime(cycleTime + 1)

              //******************************************** Eleventh cycle *********************************************************/
              await takaturnDiamond.startNewCycle(termId)

              fund = await takaturnDiamond.getFundSummary(termId)

              assert.equal(fund[6], 11)

              for (let i = 1; i <= totalParticipants; i++) {
                  if (i < 5 || i >= 8) {
                      continue
                  }

                  await takaturnDiamond.connect(accounts[i]).payContribution(termId)
              }

              await advanceTime(contributionPeriod + 1)

              await takaturnDiamond.closeFundingPeriod(termId)

              await advanceTime(cycleTime + 1)

              //******************************************** Twelfth cycle *********************************************************/
              await takaturnDiamond.startNewCycle(termId)

              fund = await takaturnDiamond.getFundSummary(termId)

              assert.equal(fund[6], 12)

              for (let i = 1; i <= totalParticipants; i++) {
                  if (i < 5 || i >= 8) {
                      continue
                  }

                  await takaturnDiamond.connect(accounts[i]).payContribution(termId)
              }

              await advanceTime(contributionPeriod + 1)

              await takaturnDiamond.closeFundingPeriod(termId)

              term = await takaturnDiamond.getTermSummary(termId)
              collateral = await takaturnDiamond.getCollateralSummary(termId)
              fund = await takaturnDiamond.getFundSummary(termId)

              await expect(getTermStateFromIndex(term.state)).to.equal(TermStates.ClosedTerm)
              await expect(getCollateralStateFromIndex(collateral[1])).to.equal(
                  CollateralStates.ReleasingCollateral
              )
              await expect(getFundStateFromIndex(fund[1])).to.equal(FundStates.FundClosed)
              assert(fund[5] > 0)

              await advanceTime(cycleTime + 1)

              await expect(takaturnDiamond.startNewCycle(termId)).to.be.revertedWith("TT-LF-02") // Wrong state

              //******************************************** After End *********************************************************/

              await expect(takaturnDiamond.emptyFundAfterEnd(termId)).to.be.revertedWith("TT-FF-03") // Can’t empty yet
              await expect(takaturnDiamond.emptyCollateralAfterEnd(termId)).to.be.revertedWith(
                  "TT-CF-03"
              ) // Can’t empty yet

              await advanceTimeByDate(180, day)

              await takaturnDiamond.emptyFundAfterEnd(termId)
          })
      })
