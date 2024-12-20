const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../../utils/_networks")
const {
    advanceTime,
    impersonateAccount,
    getCollateralStateFromIndex,
    CollateralStates,
} = require("../../../utils/_helpers")

const totalParticipants = 4 // Create term param
const cycleTime = 180 // Create term param
const contributionAmount = 10 // Create term param
const contributionPeriod = 120 // Create term param
const registrationPeriod = 120 // Create term param

let takaturnDiamond

async function payTestContribution(termId, defaulterIndex) {
    for (let i = 1; i <= totalParticipants; i++) {
        try {
            if (i != defaulterIndex) {
                await takaturnDiamond.connect(accounts[i]).payContribution(termId)
            }
        } catch (error) {}
    }
}

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Unit tests. Getters Facet", function () {
          const chainId = network.config.chainId

          let deployer, participant_1, participant_2, participant_3

          let takaturnDiamondDeployer, takaturnDiamondParticipant_1

          beforeEach(async () => {
              // Get the accounts
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              participant_1 = accounts[1]
              participant_2 = accounts[2]
              participant_3 = accounts[3]
              participant_4 = accounts[4]
              usdcOwner = accounts[13]
              usdcMasterMinter = accounts[14]
              usdcRegularMinter = accounts[15]
              usdcLostAndFound = accounts[16]

              // Deploy contracts
              await deployments.fixture(["mocks"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")
              aggregator = await ethers.getContract("MockEthUsdAggregator")

              const usdcAddress = networkConfig[chainId]["usdc"]

              usdc = await ethers.getContractAt(
                  "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                  usdcAddress
              )

              // Connect the accounts
              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)
              takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1)
              takaturnDiamondParticipant_2 = takaturnDiamond.connect(participant_2)
              takaturnDiamondParticipant_3 = takaturnDiamond.connect(participant_3)
              takaturnDiamondParticipant_4 = takaturnDiamond.connect(participant_4)

              // Create three terms
              for (let i = 0; i < 3; i++) {
                  await takaturnDiamondParticipant_1.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      usdc
                  )
              }

              const lastTerm = await takaturnDiamondDeployer.getTermsId()
              const termId = lastTerm[0]
              for (let i = 1; i <= totalParticipants; i++) {
                  // Get the collateral payment deposit
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                      termId,
                      i - 1
                  )
                  // Each participant joins the term
                  await takaturnDiamond
                      .connect(accounts[i])
                      ["joinTerm(uint256,bool)"](1, false, { value: entrance })
                  await takaturnDiamond
                      .connect(accounts[i])
                      ["joinTerm(uint256,bool)"](2, false, { value: entrance })
              }

              await advanceTime(registrationPeriod + 1)
              await takaturnDiamond.startTerm(1)
              await takaturnDiamond.startTerm(2)

              const balanceForUser = contributionAmount * totalParticipants * 10 ** 6

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

                  await usdc.connect(accounts[i]).approve(takaturnDiamond, balanceForUser * 10 ** 6)
              }
          })

          describe("Allowance", function () {
              it("Calculate the correct allowance", async function () {
                  const neededAllowanceAtBeginning =
                      await takaturnDiamondDeployer.getNeededAllowance(participant_1.address)
                  const expectedAllowanceAtBeginning =
                      contributionAmount * totalParticipants * 2 * 10 ** 6

                  await advanceTime(cycleTime + 1)
                  await takaturnDiamond.closeFundingPeriod(1)
                  await takaturnDiamond.startNewCycle(1)

                  const neededNewAllowance = await takaturnDiamondDeployer.getNeededAllowance(
                      participant_1.address
                  )
                  const expectedNewAllowance =
                      expectedAllowanceAtBeginning - contributionAmount * 10 ** 6

                  assert.equal(
                      neededAllowanceAtBeginning.toString(),
                      expectedAllowanceAtBeginning.toString()
                  )
                  assert(neededNewAllowance.toString() < neededAllowanceAtBeginning.toString())
                  assert.equal(neededNewAllowance.toString(), expectedNewAllowance.toString())
              })
          })
          describe("Withdrawable amount", function () {
              describe("When the collateral state is AcceptingCollateral", function () {
                  it("There is no withdrawable amount", async function () {
                      // The termId 0 is the first term and nobody has joined yet
                      const termId = 0

                      // Participant 1 joins the term
                      const entrance = await takaturnDiamond.minCollateralToDeposit(termId, 0)

                      await takaturnDiamondParticipant_1["joinTerm(uint256,bool)"](0, false, {
                          value: entrance,
                      })

                      const withdrawable =
                          await takaturnDiamondParticipant_1.getWithdrawableUserBalance(
                              termId,
                              participant_1.address
                          )

                      const collateral = await takaturnDiamondDeployer.getCollateralSummary(termId)

                      await expect(getCollateralStateFromIndex(collateral[1])).to.equal(
                          CollateralStates.AcceptingCollateral
                      )
                      assert.equal(collateral[4][0], participant_1.address) // The participant 1 is on the collateral depositors array

                      assert.equal(withdrawable.toString(), "0")
                  })
              })
              describe("When the collateral state is ReleasingCollateral", function () {
                  it("When the term expires, withdrawable should be equal to locked balance", async function () {
                      // The termId 0 is the first term and nobody has joined yet
                      const termId = 0

                      // Participant 1 joins the term
                      const entrance = await takaturnDiamond.minCollateralToDeposit(termId, 0)

                      await takaturnDiamondParticipant_1["joinTerm(uint256,bool)"](0, false, {
                          value: entrance,
                      })

                      await advanceTime(registrationPeriod + 1)

                      await takaturnDiamond.expireTerm(termId)

                      const withdrawable =
                          await takaturnDiamondParticipant_1.getWithdrawableUserBalance(
                              termId,
                              participant_1.address
                          )

                      const collateralParticipantSummary =
                          await takaturnDiamondParticipant_1.getDepositorCollateralSummary(
                              participant_1.address,
                              termId
                          )

                      const collateral = await takaturnDiamondDeployer.getCollateralSummary(termId)

                      await expect(takaturnDiamondParticipant_1.withdrawCollateral(termId))
                          .to.emit(takaturnDiamond, "OnCollateralWithdrawal")
                          .withArgs(
                              termId,
                              participant_1.address,
                              participant_1.address,
                              withdrawable
                          )

                      assert.equal(
                          collateralParticipantSummary[1].toString(),
                          collateralParticipantSummary[3].toString()
                      ) // Collateral members bank and collateral deposited by user are the same
                      assert.equal(collateralParticipantSummary[2].toString(), "0") // Collateral payment bank is 0

                      await expect(getCollateralStateFromIndex(collateral[1])).to.equal(
                          CollateralStates.ReleasingCollateral
                      )

                      assert.equal(
                          withdrawable.toString(),
                          collateralParticipantSummary[1].toString()
                      )
                  })

                  it("When the term finish, withdrawable should be equal to locked balance, can withdraw collateral", async function () {
                      // The termId 1 already started on the before each
                      const termId = 1

                      // First cycle
                      for (let i = 1; i <= totalParticipants; i++) {
                          try {
                              await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                          } catch (error) {}
                      }

                      advanceTime(cycleTime + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)

                      await takaturnDiamond.startNewCycle(termId)

                      // Second cycle
                      for (let i = 1; i <= totalParticipants; i++) {
                          try {
                              await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                          } catch (error) {}
                      }

                      advanceTime(cycleTime + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)
                      await takaturnDiamond.startNewCycle(termId)

                      // Third cycle
                      for (let i = 1; i <= totalParticipants; i++) {
                          try {
                              await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                          } catch (error) {}
                      }

                      advanceTime(cycleTime + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)
                      await takaturnDiamond.startNewCycle(termId)

                      // Fourth and last cycle
                      for (let i = 1; i <= totalParticipants; i++) {
                          try {
                              await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                          } catch (error) {}
                      }

                      advanceTime(cycleTime + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)

                      for (let i = 1; i <= totalParticipants; i++) {
                          const withdrawable = await takaturnDiamond.getWithdrawableUserBalance(
                              termId,
                              accounts[i].address
                          )

                          const participantCollateralSummary =
                              await takaturnDiamond.getDepositorCollateralSummary(
                                  accounts[i].address,
                                  termId
                              )

                          await expect(
                              takaturnDiamond.connect(accounts[i]).withdrawCollateral(termId)
                          )
                              .to.emit(takaturnDiamond, "OnCollateralWithdrawal")
                              .withArgs(
                                  termId,
                                  accounts[i].address,
                                  accounts[i].address,
                                  withdrawable
                              )

                          assert.equal(
                              withdrawable.toString(),
                              participantCollateralSummary[1].toString()
                          )
                      }

                      const collateral = await takaturnDiamondDeployer.getCollateralSummary(termId)

                      await expect(getCollateralStateFromIndex(collateral[1])).to.equal(
                          CollateralStates.ReleasingCollateral
                      )
                  })
              })
              describe("When the cycle is ongoing and there are payments", function () {
                  it("Should increase with payments", async function () {
                      const termId = 1

                      await advanceTime(cycleTime + 1)
                      await takaturnDiamond.closeFundingPeriod(termId)
                      await takaturnDiamond.startNewCycle(termId)

                      const withdrawable1 = await takaturnDiamond.getWithdrawableUserBalance(
                          termId,
                          participant_1.address
                      )

                      await takaturnDiamondParticipant_1.payContribution(termId)

                      const withdrawable2 = await takaturnDiamond.getWithdrawableUserBalance(
                          termId,
                          participant_1.address
                      )

                      await advanceTime(contributionPeriod + 1)
                      await takaturnDiamond.closeFundingPeriod(termId)

                      await takaturnDiamondParticipant_1.payContribution(termId)

                      const withdrawable3 = await takaturnDiamond.getWithdrawableUserBalance(
                          termId,
                          participant_1.address
                      )

                      await assert(withdrawable2 > withdrawable1)
                      await assert(withdrawable3 > withdrawable2)
                  })
              })
              describe("When the term is on going or ended and somebody is expelled before being beneficiary", function () {
                  beforeEach(async () => {
                      const termId = 1

                      // Pay contributions first cycle, participant 3 defaults
                      await payTestContribution(termId, 3)

                      // Manipulate ETH price to expel participant 3
                      await aggregator.setPrice("100000000000")

                      advanceTime(cycleTime + 1)

                      // Close funding period for first cycle
                      await takaturnDiamond.closeFundingPeriod(termId)

                      // Starts second cycle
                      await takaturnDiamond.startNewCycle(termId)

                      // Pay contributions second cycle, participant 3 defaults
                      await payTestContribution(termId, 3)

                      advanceTime(cycleTime + 1)

                      // Close funding period for second cycle
                      await takaturnDiamond.closeFundingPeriod(termId)
                      // The participant 3 is expelled here, second cycle, before being beneficiary
                  })
                  it("Checks, expelled before being beneficiary", async function () {
                      const termId = 1

                      const expelled = await takaturnDiamond.wasExpelled(
                          termId,
                          participant_3.address
                      )

                      const expelledBeforeBeneficiary =
                          await takaturnDiamond.expelledBeforeBeneficiary(
                              termId,
                              participant_3.address
                          )

                      const participantCollateralSummary =
                          await takaturnDiamond.getDepositorCollateralSummary(
                              participant_3.address,
                              termId
                          )

                      const participantFundSummary =
                          await takaturnDiamond.getParticipantFundSummary(
                              participant_3.address,
                              termId
                          )

                      assert.ok(expelled) // Expelled
                      assert.ok(expelledBeforeBeneficiary) // Expelled before being beneficiary
                      assert.ok(!participantCollateralSummary[0]) // Not a collateral member
                      assert.ok(!participantFundSummary[0]) // Not a participant
                      assert.ok(!participantFundSummary[1]) // Not a beneficiary
                  })

                  it("Before cycle expelled one will be beneficiary, withdrawable collateral equal to locked balance", async function () {
                      const termId = 1

                      const withdrawable =
                          await takaturnDiamondParticipant_1.getWithdrawableUserBalance(
                              termId,
                              participant_3.address
                          )

                      const participantCollateralSummary =
                          await takaturnDiamond.getDepositorCollateralSummary(
                              participant_3.address,
                              termId
                          )

                      // Can withdraw collateral
                      await expect(takaturnDiamondParticipant_3.withdrawCollateral(termId))
                          .to.emit(takaturnDiamond, "OnCollateralWithdrawal")
                          .withArgs(
                              termId,
                              participant_3.address,
                              participant_3.address,
                              withdrawable
                          )

                      await expect(
                          takaturnDiamondParticipant_3.withdrawFund(termId)
                      ).to.be.revertedWith("TT-FF-09") // Nothing to withdraw

                      // Withdrawable is equal to collateral locked
                      assert.equal(
                          withdrawable.toString(),
                          participantCollateralSummary[1].toString()
                      )
                  })

                  it("Cycle expelled one become beneficiary, withdrawable collateral equal to locked balance, withdraw fund allowed", async function () {
                      const termId = 1

                      // Starts third cycle
                      await takaturnDiamond.startNewCycle(termId)

                      // Pay contributions third cycle
                      await payTestContribution(termId, 3)

                      advanceTime(cycleTime + 1)

                      // Close funding period for third cycle
                      await takaturnDiamond.closeFundingPeriod(termId)

                      const withdrawable =
                          await takaturnDiamondParticipant_1.getWithdrawableUserBalance(
                              termId,
                              participant_3.address
                          )

                      const participantCollateralSummary =
                          await takaturnDiamond.getDepositorCollateralSummary(
                              participant_3.address,
                              termId
                          )

                      const participantFundSummary =
                          await takaturnDiamond.getParticipantFundSummary(
                              participant_3.address,
                              termId
                          )

                      const expelledBeforeBeneficiary =
                          await takaturnDiamond.expelledBeforeBeneficiary(
                              termId,
                              participant_3.address
                          )

                      // Can withdraw collateral and fund
                      await expect(takaturnDiamondParticipant_3.withdrawCollateral(termId))
                          .to.emit(takaturnDiamond, "OnCollateralWithdrawal")
                          .withArgs(
                              termId,
                              participant_3.address,
                              participant_3.address,
                              withdrawable
                          )

                      await expect(takaturnDiamondParticipant_3.withdrawFund(termId))
                          .to.emit(takaturnDiamond, "OnFundWithdrawn")
                          .withArgs(
                              termId,
                              participant_3.address,
                              participant_3.address,
                              participantFundSummary[4]
                          )

                      // Withdrawable is equal to collateral locked
                      assert.equal(
                          withdrawable.toString(),
                          participantCollateralSummary[1].toString()
                      )

                      assert.ok(!participantFundSummary[5]) // Money pot is never frozen if it is expelled before being beneficiary
                      assert.ok(participantFundSummary[1]) // Become a beneficiary
                      assert.ok(expelledBeforeBeneficiary) // But it was expelled before being beneficiary
                  })

                  describe("Cycle after the one that expelled participant become beneficiary", function () {
                      // Have not withdraw collateral nor fund yet

                      beforeEach(async () => {
                          const termId = 1

                          // Starts third cycle
                          await takaturnDiamond.startNewCycle(termId)

                          // Pay contributions third cycle
                          await payTestContribution(termId, 3)

                          advanceTime(cycleTime + 1)

                          // Close funding period for third cycle
                          await takaturnDiamond.closeFundingPeriod(termId)

                          // Starts fourth and last cycle
                          await takaturnDiamond.startNewCycle(termId)
                      })
                      it("Cycle ongoing, withdrawable collateral equal to locked balance, withdraw fund allowed", async function () {
                          const termId = 1

                          const withdrawable = await takaturnDiamond.getWithdrawableUserBalance(
                              termId,
                              participant_3.address
                          )

                          const participantCollateralSummary =
                              await takaturnDiamond.getDepositorCollateralSummary(
                                  participant_3.address,
                                  termId
                              )

                          const participantFundSummary =
                              await takaturnDiamond.getParticipantFundSummary(
                                  participant_3.address,
                                  termId
                              )

                          // Can withdraw collateral and fund
                          await expect(takaturnDiamondParticipant_3.withdrawCollateral(termId))
                              .to.emit(takaturnDiamond, "OnCollateralWithdrawal")
                              .withArgs(
                                  termId,
                                  participant_3.address,
                                  participant_3.address,
                                  withdrawable
                              )

                          await expect(takaturnDiamondParticipant_3.withdrawFund(termId))
                              .to.emit(takaturnDiamond, "OnFundWithdrawn")
                              .withArgs(
                                  termId,
                                  participant_3.address,
                                  participant_3.address,
                                  participantFundSummary[4]
                              )

                          // Withdrawable is equal to collateral members bank
                          assert.equal(
                              withdrawable.toString(),
                              participantCollateralSummary[1].toString()
                          )
                      })
                      it("Term ended", async function () {
                          const termId = 1

                          // Pay contributions fourth cycle
                          await payTestContribution(termId, 3)

                          await advanceTime(cycleTime + 1)

                          // Close funding period for fourth cycle. Term ended
                          await takaturnDiamond.closeFundingPeriod(termId)

                          const withdrawable = await takaturnDiamond.getWithdrawableUserBalance(
                              termId,
                              participant_3.address
                          )

                          const participantCollateralSummary =
                              await takaturnDiamond.getDepositorCollateralSummary(
                                  participant_3.address,
                                  termId
                              )

                          const participantFundSummary =
                              await takaturnDiamond.getParticipantFundSummary(
                                  participant_3.address,
                                  termId
                              )

                          // Can withdraw collateral and fund
                          await expect(takaturnDiamondParticipant_3.withdrawCollateral(termId))
                              .to.emit(takaturnDiamond, "OnCollateralWithdrawal")
                              .withArgs(
                                  termId,
                                  participant_3.address,
                                  participant_3.address,
                                  withdrawable
                              )

                          await expect(takaturnDiamondParticipant_3.withdrawFund(termId))
                              .to.emit(takaturnDiamond, "OnFundWithdrawn")
                              .withArgs(
                                  termId,
                                  participant_3.address,
                                  participant_3.address,
                                  participantFundSummary[4]
                              )

                          // Withdrawable is equal to collateral members bank
                          assert.equal(
                              withdrawable.toString(),
                              participantCollateralSummary[1].toString()
                          )
                      })
                  })
              })
          })
          describe("User's sets", function () {
              it("All users are in the participant set when the term start", async function () {
                  const termId = 1

                  for (let i = 1; i <= totalParticipants; i++) {
                      const participantSets = await takaturnDiamond
                          .connect(accounts[i])
                          .getUserSet(accounts[i].address, termId)

                      assert.ok(participantSets[0]) // On participant set
                      assert.ok(!participantSets[1]) // On beneficiary set
                      assert.ok(!participantSets[2]) // On defaulter set
                  }
              })

              it("The beneficiary is set on the beneficiary set", async function () {
                  const termId = 1

                  for (let i = 1; i <= totalParticipants; i++) {
                      try {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      } catch (error) {}
                  }

                  const participant_1_setsBefore = await takaturnDiamond.getUserSet(
                      participant_1.address,
                      termId
                  )

                  advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)

                  const participant_1_setsAfter = await takaturnDiamond.getUserSet(
                      participant_1.address,
                      termId
                  )

                  assert.ok(!participant_1_setsBefore[1]) // Not on beneficiary set before closing funding period
                  assert.ok(participant_1_setsAfter[1]) // On beneficiary set After closing funding period
              })

              it("The defaulters are set on the defaulters set", async function () {
                  const termId = 1

                  const participant_2_setsBefore = await takaturnDiamond.getUserSet(
                      participant_2.address,
                      termId
                  )

                  advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)

                  const participant_2_setsAfter = await takaturnDiamond.getUserSet(
                      participant_2.address,
                      termId
                  )

                  assert.ok(!participant_2_setsBefore[2]) // Not on defaulter set before closing funding period
                  assert.ok(participant_2_setsAfter[2]) // On defaulter set after closing funding period
              })

              it("Previous beneficiaries are set on the defaulters set when defaults", async function () {
                  const termId = 1

                  // First cycle participant 1 is beneficiary
                  for (let i = 1; i <= totalParticipants; i++) {
                      try {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      } catch (error) {}
                  }

                  advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)

                  // Second cycle participant 1 defaults
                  await takaturnDiamond.startNewCycle(termId)

                  const participant_1_setsBefore = await takaturnDiamond.getUserSet(
                      participant_1.address,
                      termId
                  )

                  advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)

                  const participant_1_setsAfter = await takaturnDiamond.getUserSet(
                      participant_1.address,
                      termId
                  )
                  assert.ok(participant_1_setsBefore[1]) // On beneficiary set before closing funding period
                  assert.ok(!participant_1_setsBefore[2]) // Not on defaulter set before closing funding period

                  assert.ok(!participant_1_setsAfter[1]) // Not on beneficiary set after closing funding period
                  assert.ok(participant_1_setsAfter[2]) // On Defaulter after closing funding period
              })

              it("Previous defaulters, non beneficiaries, are set on the participant set when pays after defaults", async function () {
                  const termId = 1

                  // First cycle, participant 3 defaults

                  advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)

                  // Second cycle, participant 3 pays
                  await takaturnDiamond.startNewCycle(termId)

                  const participant_3_setsBefore = await takaturnDiamond.getUserSet(
                      participant_3.address,
                      termId
                  )

                  for (let i = 1; i <= totalParticipants; i++) {
                      try {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      } catch (error) {}
                  }

                  advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)

                  const participant_3_setsAfter = await takaturnDiamond.getUserSet(
                      participant_3.address,
                      termId
                  )
                  assert.ok(participant_3_setsBefore[2]) // On defaulters set before closing funding period
                  assert.ok(!participant_3_setsBefore[0]) // Not on participant set before closing funding period

                  assert.ok(!participant_3_setsAfter[2]) // Not on defaulters set after closing funding period
                  assert.ok(participant_3_setsAfter[0]) // On participants after closing funding period
              })

              it("Previous defaulters, already beneficiaries, are set on the beneficiaries set when pays after defaults", async function () {
                  const termId = 1

                  // First cycle, participant 1 is beneficiary
                  for (let i = 1; i <= totalParticipants; i++) {
                      try {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      } catch (error) {}
                  }

                  advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)

                  // Second cycle, participant 1 defaults
                  await takaturnDiamond.startNewCycle(termId)

                  advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)

                  // Third cycle, participant 1 pays
                  await takaturnDiamond.startNewCycle(termId)

                  const participant_1_setsBefore = await takaturnDiamond.getUserSet(
                      participant_1.address,
                      termId
                  )

                  for (let i = 1; i <= totalParticipants; i++) {
                      try {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      } catch (error) {}
                  }

                  advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)

                  const participant_1_setsAfter = await takaturnDiamond.getUserSet(
                      participant_1.address,
                      termId
                  )
                  assert.ok(participant_1_setsBefore[2]) // On defaulters set before closing funding period
                  assert.ok(!participant_1_setsBefore[1]) // Not on beneficiaries set before closing funding period

                  assert.ok(!participant_1_setsAfter[2]) // Not on defaulters set after closing funding period
                  assert.ok(participant_1_setsAfter[1]) // On beneficiaries after closing funding period
              })

              it("Expelled participants are not in any set", async function () {
                  const termId = 1

                  await payTestContribution(termId, 3)

                  await aggregator.setPrice("100000000000")

                  advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)

                  await takaturnDiamond.startNewCycle(termId)

                  await payTestContribution(termId, 3)

                  advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)

                  const participant_3_sets = await takaturnDiamond.getUserSet(
                      participant_3.address,
                      termId
                  )

                  assert.ok(!participant_3_sets[0]) // Not on participant set
                  assert.ok(!participant_3_sets[1]) // Not on beneficiary set
                  assert.ok(!participant_3_sets[2]) // Not on defaulter set
              })

              it("Expelled participants are not in any set, even on their beneficiary cycle", async function () {
                  const termId = 1

                  await payTestContribution(termId, 3)

                  await aggregator.setPrice("100000000000")

                  advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)

                  await takaturnDiamond.startNewCycle(termId)

                  await payTestContribution(termId, 3)

                  advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)

                  await takaturnDiamond.startNewCycle(termId)

                  advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)

                  const participant_3_sets = await takaturnDiamond.getUserSet(
                      participant_3.address,
                      termId
                  )

                  assert.ok(!participant_3_sets[0]) // Not on participant set
                  assert.ok(!participant_3_sets[1]) // Not on beneficiary set
                  assert.ok(!participant_3_sets[2]) // Not on defaulter set
              })
          })
          describe("Beneficiaries", function () {
              it("Should return the current beneficiary", async function () {
                  const termId = 1

                  const currentBeneficiary = await takaturnDiamond.getCurrentBeneficiary(termId)

                  assert.equal(currentBeneficiary, participant_1.address)
              })

              it("Should return the next beneficiary", async function () {
                  const termId = 1

                  const nextBeneficiary = await takaturnDiamond.getNextBeneficiary(termId)

                  assert.equal(nextBeneficiary, participant_2.address)
              })
          })
          describe("Current or next cycle paid", function () {
              it("Nothing paid", async function () {
                  const termId = 1

                  // First cycle

                  const participant1Payments = await takaturnDiamond.currentOrNextCyclePaid(
                      participant_1,
                      termId
                  )
                  const participant3Payments = await takaturnDiamond.currentOrNextCyclePaid(
                      participant_3,
                      termId
                  )

                  assert.ok(!participant1Payments[0])
                  assert.ok(!participant1Payments[1])
                  assert.ok(!participant3Payments[0])
                  assert.ok(!participant3Payments[1])
              })
              it("Pay current cycle", async function () {
                  const termId = 1

                  // First cycle
                  await takaturnDiamondParticipant_3.payContribution(termId)

                  const participant1Payments = await takaturnDiamond.currentOrNextCyclePaid(
                      participant_1,
                      termId
                  )
                  const participant3Payments = await takaturnDiamond.currentOrNextCyclePaid(
                      participant_3,
                      termId
                  )

                  assert.ok(!participant1Payments[0])
                  assert.ok(!participant1Payments[1])
                  assert.ok(participant3Payments[0]) // Current cycle paid
                  assert.ok(!participant3Payments[1])
              })
              it("Pay current cycle and close funding period", async function () {
                  const termId = 1

                  await takaturnDiamondParticipant_3.payContribution(termId)

                  await advanceTime(contributionPeriod + 1)
                  // Close funding period
                  await takaturnDiamond.closeFundingPeriod(termId)

                  const participant1Payments = await takaturnDiamond.currentOrNextCyclePaid(
                      participant_1,
                      termId
                  )
                  const participant3Payments = await takaturnDiamond.currentOrNextCyclePaid(
                      participant_3,
                      termId
                  )

                  assert.ok(!participant1Payments[0])
                  assert.ok(!participant1Payments[1])
                  assert.ok(participant3Payments[0]) // Current cycle paid
                  assert.ok(!participant3Payments[1])
              })
              it("Pay next cycle, and emits event", async function () {
                  const termId = 1

                  await takaturnDiamondParticipant_3.payContribution(termId)

                  await advanceTime(contributionPeriod + 1)
                  // Close funding period
                  await takaturnDiamond.closeFundingPeriod(termId)

                  // Pay next cycle
                  const fundSummary = await takaturnDiamond.getFundSummary(termId)
                  const currentCycle = fundSummary[6]
                  const nextCycle = currentCycle + 1n

                  await expect(takaturnDiamondParticipant_1.payContribution(termId))
                      .to.emit(takaturnDiamond, "OnPaidContribution")
                      .withArgs(termId, participant_1.address, nextCycle)
                  await expect(takaturnDiamondParticipant_3.payContribution(termId))
                      .to.emit(takaturnDiamond, "OnPaidContribution")
                      .withArgs(termId, participant_3.address, nextCycle)

                  const participant1Payments = await takaturnDiamond.currentOrNextCyclePaid(
                      participant_1,
                      termId
                  )
                  const participant3Payments = await takaturnDiamond.currentOrNextCyclePaid(
                      participant_3,
                      termId
                  )

                  assert.ok(!participant1Payments[0])
                  assert.ok(participant1Payments[1]) // Next cycle paid
                  assert.ok(participant3Payments[0]) // Current cycle paid
                  assert.ok(participant3Payments[1]) // Next cycle paid
              })
              it("New cycle starts and some payments are in advanced", async function () {
                  const termId = 1

                  await takaturnDiamondParticipant_3.payContribution(termId)

                  await advanceTime(contributionPeriod + 1)
                  // Close funding period
                  await takaturnDiamond.closeFundingPeriod(termId)

                  // Pay next cycle
                  await takaturnDiamondParticipant_1.payContribution(termId)
                  await takaturnDiamondParticipant_3.payContribution(termId)

                  await advanceTime(cycleTime + 1)

                  // Second cycle
                  await takaturnDiamond.startNewCycle(termId)

                  const participant1Payments = await takaturnDiamond.currentOrNextCyclePaid(
                      participant_1,
                      termId
                  )
                  const participant3Payments = await takaturnDiamond.currentOrNextCyclePaid(
                      participant_3,
                      termId
                  )

                  assert.ok(participant1Payments[0]) // Current cycle paid
                  assert.ok(!participant1Payments[1])
                  assert.ok(participant3Payments[0]) // Current cycle paid
                  assert.ok(!participant3Payments[1])
              })
          })

          describe("Conversions", function () {
              it("Converts from collateral to stablecoin", async function () {
                  const expectedPrice = networkConfig[chainId]["initialPriceEthUsd"]
                  const actualPrice = await takaturnDiamond.getToStableConversionRate(1)

                  assert.equal(expectedPrice / 10 ** 8, actualPrice)
              })

              it("Converts from stablecoin to collateral", async function () {
                  const expectedPrice = 1
                  const actualPrice = await takaturnDiamond.getToCollateralConversionRate(2000)

                  assert.equal(expectedPrice, actualPrice)
              })
          })
          describe("Remaining cycles contribution in wei", function () {
              beforeEach(async () => {
                  await takaturnDiamondParticipant_1.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      usdc
                  )

                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]
                  for (let i = 1; i <= totalParticipants; i++) {
                      // Get the collateral payment deposit
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )
                      // Each participant joins the term
                      await takaturnDiamond
                          .connect(accounts[i])
                          ["joinTerm(uint256,bool)"](termId, false, { value: entrance })
                  }
              })
              it("Should return the correct amount at every point", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  const rccWei_Initializing =
                      await takaturnDiamond.getRemainingCyclesContributionWei(termId)

                  await advanceTime(registrationPeriod + 1)

                  // First cycle
                  await takaturnDiamond.startTerm(termId)

                  const rccWei_AcceptingContributionsFirstCycle =
                      await takaturnDiamond.getRemainingCyclesContributionWei(termId)

                  for (let i = 1; i <= totalParticipants; i++) {
                      try {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      } catch {}
                  }

                  await advanceTime(contributionPeriod + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)

                  const rccWei_CycleOnGoingFirstCycle =
                      await takaturnDiamond.getRemainingCyclesContributionWei(termId)

                  await advanceTime(cycleTime + 1)

                  // Second cycle
                  await takaturnDiamond.startNewCycle(termId)

                  const rccWei_AcceptingContributionsSecondCycle =
                      await takaturnDiamond.getRemainingCyclesContributionWei(termId)

                  for (let i = 1; i <= totalParticipants; i++) {
                      try {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      } catch {}
                  }

                  await advanceTime(contributionPeriod + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)

                  const rccWei_CycleOnGoingSecondCycle =
                      await takaturnDiamond.getRemainingCyclesContributionWei(termId)

                  await advanceTime(cycleTime + 1)

                  // Third cycle
                  await takaturnDiamond.startNewCycle(termId)

                  const rccWei_AcceptingContributionsThirdCycle =
                      await takaturnDiamond.getRemainingCyclesContributionWei(termId)

                  for (let i = 1; i <= totalParticipants; i++) {
                      try {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      } catch {}
                  }

                  await advanceTime(contributionPeriod + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)

                  const rccWei_CycleOnGoingThirdCycle =
                      await takaturnDiamond.getRemainingCyclesContributionWei(termId)

                  await advanceTime(cycleTime + 1)

                  // Fourth cycle
                  await takaturnDiamond.startNewCycle(termId)

                  const rccWei_AcceptingContributionsFourthCycle =
                      await takaturnDiamond.getRemainingCyclesContributionWei(termId)

                  for (let i = 1; i <= totalParticipants; i++) {
                      try {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      } catch {}
                  }

                  await advanceTime(contributionPeriod + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)

                  const rccWei_CycleOnGoingFourthCycle =
                      await takaturnDiamond.getRemainingCyclesContributionWei(termId)

                  await advanceTime(cycleTime + 1)
                  await expect(takaturnDiamond.startNewCycle(termId)).to.be.revertedWith("TT-LF-02")

                  assert.equal(rccWei_Initializing, rccWei_AcceptingContributionsFirstCycle)
                  assert(rccWei_AcceptingContributionsFirstCycle > rccWei_CycleOnGoingFirstCycle)
                  assert.equal(
                      rccWei_CycleOnGoingFirstCycle,
                      rccWei_AcceptingContributionsSecondCycle
                  )
                  assert(rccWei_AcceptingContributionsSecondCycle > rccWei_CycleOnGoingSecondCycle)
                  assert.equal(
                      rccWei_CycleOnGoingSecondCycle,
                      rccWei_AcceptingContributionsThirdCycle
                  )
                  assert(rccWei_AcceptingContributionsThirdCycle > rccWei_CycleOnGoingThirdCycle)
                  assert.equal(
                      rccWei_CycleOnGoingThirdCycle,
                      rccWei_AcceptingContributionsFourthCycle
                  )
                  assert(rccWei_AcceptingContributionsFourthCycle > rccWei_CycleOnGoingFourthCycle)
                  assert.equal(rccWei_CycleOnGoingFourthCycle, 0n)
              })
          })
      })
