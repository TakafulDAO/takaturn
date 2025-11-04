const { assert, expect } = require("chai")
const { isFork, isMainnet, networkConfig } = require("../../utils/_networks")
const { network, ethers } = require("hardhat")
const {
    impersonateAccount,
    advanceTime,
    FundStates,
    CollateralStates,
    getFundStateFromIndex,
    getCollateralStateFromIndex,
} = require("../../utils/_helpers")
const { balanceForUser } = require("../utils/test-utils")
const { erc20UnitsFormat } = require("../../utils/units")

!isFork || isMainnet
    ? describe.skip
    : describe("Fork Mainnet test. Yield Getters", function () {
          const chainId = network.config.chainId

          let takaturnDiamond, usdc, zaynZap

          let deployer,
              participant_1,
              participant_2,
              participant_3,
              participant_4,
              zapOwner,
              usdcWhale

          const totalParticipants = 4
          const registrationPeriod = 604800
          const cycleTime = 2592002
          const contributionAmount = 50
          const contributionPeriod = 432000

          beforeEach(async function () {
              // Get the accounts
              accounts = await ethers.getSigners()

              deployer = accounts[0]
              participant_1 = accounts[1]
              participant_2 = accounts[2]
              participant_3 = accounts[3]
              participant_4 = accounts[4]
              usdcWhale = networkConfig[chainId]["usdcWhale"]
              zapOwner = "0xff0C52AfD43CeCA4c5E674f61fa93BE32647f185"

              // Deploy new diamond
              await deployments.fixture(["takaturn_upgrade"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")

              // Get the contract instances

              const usdcAddress = networkConfig[chainId]["usdc"]
              const newZaynZapAddress = "0x1534c33FF68cFF9E0c5BABEe5bE72bf4cad0826b"

              usdc = await ethers.getContractAt(
                  "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                  usdcAddress
              )
              zaynZap = await ethers.getContractAt(
                  "contracts/interfaces/IZaynZapV2TakaDAO.sol:IZaynZapV2TakaDAO",
                  newZaynZapAddress
              )

              await impersonateAccount(zapOwner)
              await impersonateAccount(usdcWhale)

              zapOwnerSigner = await ethers.getSigner(zapOwner)
              whale = await ethers.getSigner(usdcWhale)

              takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1)
              takaturnDiamondParticipant_2 = takaturnDiamond.connect(participant_2)
              takaturnDiamondParticipant_3 = takaturnDiamond.connect(participant_3)
              takaturnDiamondParticipant_4 = takaturnDiamond.connect(participant_4)
              zaynZapOwner = zaynZap.connect(zapOwnerSigner)
              usdcWhaleSigner = usdc.connect(whale)

              await deployer.sendTransaction({
                  to: zapOwner,
                  value: ethers.parseEther("1"),
              })

              await zaynZapOwner.toggleTrustedSender(takaturnDiamond, true, {
                  gasLimit: 1000000,
              })

              // Transfer USDC to the participants
              await usdcWhaleSigner.transfer(participant_1.address, balanceForUser, {
                  gasLimit: 1000000,
              })
              await usdcWhaleSigner.transfer(participant_2.address, balanceForUser, {
                  gasLimit: 1000000,
              })
              await usdcWhaleSigner.transfer(participant_3.address, balanceForUser, {
                  gasLimit: 1000000,
              })
              await usdcWhaleSigner.transfer(participant_4.address, balanceForUser, {
                  gasLimit: 1000000,
              })

              // Approve the USDC for the diamond
              await usdc
                  .connect(participant_1)
                  .approve(takaturnDiamond, contributionAmount * 10 ** 6)

              await usdc
                  .connect(participant_2)
                  .approve(takaturnDiamond, contributionAmount * 10 ** 6)

              await usdc
                  .connect(participant_3)
                  .approve(takaturnDiamond, contributionAmount * 10 ** 6)

              await usdc
                  .connect(participant_4)
                  .approve(takaturnDiamond, contributionAmount * 10 ** 6)

              for (let i = 0; i < 3; i++) {
                  await takaturnDiamond.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      usdc
                  )
              }
              // We simulate the exact behaviour from term 2
              const terms = await takaturnDiamond.getTermsId()
              const termId = terms[0]

              await takaturnDiamondParticipant_1["joinTerm(uint256,bool)"](termId, true, {
                  value: ethers.parseEther("0.19268"),
              })

              await takaturnDiamondParticipant_2["joinTerm(uint256,bool)"](termId, true, {
                  value: ethers.parseEther("0.14507"),
              })

              await takaturnDiamondParticipant_3["joinTerm(uint256,bool)"](termId, true, {
                  value: ethers.parseEther("0.09518"),
              })

              await takaturnDiamondParticipant_4["joinTerm(uint256,bool)"](termId, true, {
                  value: ethers.parseEther("0.04735"),
              })

              await advanceTime(registrationPeriod + 1)

              await takaturnDiamond.startTerm(termId)

              await takaturnDiamondParticipant_2.payContribution(termId)
              await takaturnDiamondParticipant_3.payContribution(termId)
              await takaturnDiamondParticipant_4.payContribution(termId)
          })

          describe("Yield Getters", function () {
              describe("User APY", function () {
                  it("Without any withdraws", async function () {
                      const terms = await takaturnDiamond.getTermsId()
                      const termId = terms[0]

                      const userAPYBefore = await takaturnDiamond.userAPY(
                          termId,
                          participant_1.address
                      )

                      await advanceTime(contributionPeriod + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)

                      const userAPYAfter = await takaturnDiamond.userAPY(
                          termId,
                          participant_1.address
                      )

                      assert(userAPYBefore.toString() > userAPYAfter.toString())
                  })
                  describe("After some withdraws", function () {
                      it("Without defaults", async function () {
                          const terms = await takaturnDiamond.getTermsId()
                          const termId = terms[0]

                          const userAPYBefore = await takaturnDiamond.userAPY(
                              termId,
                              participant_1.address
                          )

                          for (let i = 0; i < 3; i++) {
                              try {
                                  await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                              } catch (error) {}
                          }

                          await advanceTime(contributionPeriod + 1)

                          await takaturnDiamond.closeFundingPeriod(termId)

                          await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                          const userAPYAfter = await takaturnDiamond.userAPY(
                              termId,
                              participant_1.address
                          )

                          assert(userAPYBefore > userAPYAfter)
                      })
                      it("Defaulting", async function () {
                          const terms = await takaturnDiamond.getTermsId()
                          const termId = terms[0]

                          const userAPYBefore = await takaturnDiamond.userAPY(
                              termId,
                              participant_1.address
                          )

                          await advanceTime(contributionPeriod + 1)

                          await takaturnDiamond.closeFundingPeriod(termId)

                          await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                          const userAPYAfter = await takaturnDiamond.userAPY(
                              termId,
                              participant_1.address
                          )

                          assert(userAPYBefore > userAPYAfter)
                      })
                  })
              })

              describe("Term APY", function () {
                  it("Without any withdraws", async function () {
                      const terms = await takaturnDiamond.getTermsId()
                      const termId = terms[0]

                      const termAPYBefore = await takaturnDiamond.termAPY(termId)

                      await advanceTime(contributionPeriod + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)

                      const termAPYAfter = await takaturnDiamond.termAPY(termId)

                      assert(termAPYBefore > 0)
                      assert(termAPYBefore > termAPYAfter)
                  })
                  describe("After some withdraws", function () {
                      it("Without defaults", async function () {
                          const terms = await takaturnDiamond.getTermsId()
                          const termId = terms[0]

                          const termAPYBefore = await takaturnDiamond.termAPY(termId)

                          for (let i = 0; i < 3; i++) {
                              try {
                                  await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                              } catch (error) {}
                          }

                          await advanceTime(contributionPeriod + 1)

                          await takaturnDiamond.closeFundingPeriod(termId)

                          await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                          const termAPYAfter = await takaturnDiamond.termAPY(termId)

                          assert(termAPYBefore > termAPYAfter)
                      })
                      it("Defaulting", async function () {
                          const terms = await takaturnDiamond.getTermsId()
                          const termId = terms[0]

                          const termAPYBefore = await takaturnDiamond.termAPY(termId)

                          await advanceTime(contributionPeriod + 1)

                          await takaturnDiamond.closeFundingPeriod(termId)

                          await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                          const termAPYAfter = await takaturnDiamond.termAPY(termId)

                          assert(termAPYBefore > termAPYAfter)
                      })
                  })
              })

              describe("Total yield generated", function () {
                  it("Without any withdraws", async function () {
                      const terms = await takaturnDiamond.getTermsId()
                      const termId = terms[0]

                      const totalYieldGeneratedBefore = await takaturnDiamond.totalYieldGenerated(
                          termId
                      )

                      await advanceTime(contributionPeriod + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)

                      const totalYieldGeneratedAfter = await takaturnDiamond.totalYieldGenerated(
                          termId
                      )

                      assert.equal(
                          totalYieldGeneratedBefore.toString(),
                          totalYieldGeneratedAfter.toString()
                      )
                  })
                  describe("After some withdraws", function () {
                      it("Without defaults", async function () {
                          const terms = await takaturnDiamond.getTermsId()
                          const termId = terms[0]

                          const totalYieldGeneratedBefore =
                              await takaturnDiamond.totalYieldGenerated(termId)

                          for (let i = 0; i < 3; i++) {
                              try {
                                  await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                              } catch (error) {}
                          }

                          await advanceTime(contributionPeriod + 1)

                          await takaturnDiamond.closeFundingPeriod(termId)

                          await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                          const totalYieldGeneratedAfter =
                              await takaturnDiamond.totalYieldGenerated(termId)

                          const totalYieldGeneratedBeforeFormatted =
                              erc20UnitsFormat(totalYieldGeneratedBefore)

                          const totalYieldGeneratedAfterFormatted =
                              erc20UnitsFormat(totalYieldGeneratedAfter)

                          assert(totalYieldGeneratedBeforeFormatted > 0)
                          assert(totalYieldGeneratedBeforeFormatted < 0.44)
                          assert(totalYieldGeneratedAfterFormatted < 0.44)

                          assert(
                              totalYieldGeneratedBefore.toString() <
                                  totalYieldGeneratedAfter.toString()
                          )
                      })
                      it("Defaulting", async function () {
                          const terms = await takaturnDiamond.getTermsId()
                          const termId = terms[0]

                          const totalYieldGeneratedBefore =
                              await takaturnDiamond.totalYieldGenerated(termId)

                          await advanceTime(contributionPeriod + 1)

                          await takaturnDiamond.closeFundingPeriod(termId)

                          await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                          const totalYieldGeneratedAfter =
                              await takaturnDiamond.totalYieldGenerated(termId)

                          const totalYieldGeneratedBeforeFormatted =
                              erc20UnitsFormat(totalYieldGeneratedBefore)

                          const totalYieldGeneratedAfterFormatted =
                              erc20UnitsFormat(totalYieldGeneratedAfter)

                          assert(totalYieldGeneratedBeforeFormatted > 0)
                          assert(totalYieldGeneratedBeforeFormatted < 0.44)
                          assert(totalYieldGeneratedAfterFormatted < 0.44)

                          assert(
                              totalYieldGeneratedBefore.toString() <
                                  totalYieldGeneratedAfter.toString()
                          )
                      })
                  })
              })

              describe("User yield  generated", function () {
                  it("Without any withdraws", async function () {
                      const terms = await takaturnDiamond.getTermsId()
                      const termId = terms[0]

                      let userYieldSummary = await takaturnDiamond.getUserYieldSummary(
                          participant_1.address,
                          termId
                      )

                      const userYieldGeneratedBefore = userYieldSummary[1] + userYieldSummary[5]

                      await advanceTime(contributionPeriod + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)

                      userYieldSummary = await takaturnDiamond.getUserYieldSummary(
                          participant_1.address,
                          termId
                      )

                      const userYieldGeneratedAfter = userYieldSummary[1] + userYieldSummary[5]

                      assert.equal(
                          userYieldGeneratedBefore.toString(),
                          userYieldGeneratedAfter.toString()
                      )
                  })
                  describe("After some withdraws [ @skip-on-ci ]", function () {
                      xit("Without defaults", async function () {
                          const terms = await takaturnDiamond.getTermsId()
                          const termId = terms[0]

                          let userYieldSummary = await takaturnDiamond.getUserYieldSummary(
                              participant_1.address,
                              termId
                          )

                          const userYieldGeneratedBefore = userYieldSummary[1] + userYieldSummary[5]

                          for (let i = 0; i < 3; i++) {
                              try {
                                  await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                              } catch (error) {}
                          }

                          await advanceTime(contributionPeriod + 1)

                          await takaturnDiamond.closeFundingPeriod(termId)

                          await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                          userYieldSummary = await takaturnDiamond.getUserYieldSummary(
                              participant_1.address,
                              termId
                          )

                          const userYieldGeneratedAfter = userYieldSummary[1] + userYieldSummary[5]

                          const userYieldGeneratedBeforeFormatted =
                              erc20UnitsFormat(userYieldGeneratedBefore)

                          const userYieldGeneratedAfterFormatted =
                              erc20UnitsFormat(userYieldGeneratedAfter)

                          assert(userYieldGeneratedBefore > 0)
                          assert(userYieldGeneratedBeforeFormatted < 0.1218)
                          assert(userYieldGeneratedAfterFormatted < 0.11111)
                          assert(
                              userYieldGeneratedBefore.toString() >
                                  userYieldGeneratedAfter.toString()
                          )
                      })
                      xit("Defaulting", async function () {
                          const terms = await takaturnDiamond.getTermsId()
                          const termId = terms[0]

                          let userYieldSummary = await takaturnDiamond.getUserYieldSummary(
                              participant_1.address,
                              termId
                          )

                          const userYieldGeneratedBefore = userYieldSummary[1] + userYieldSummary[5]

                          await advanceTime(contributionPeriod + 1)

                          await takaturnDiamond.closeFundingPeriod(termId)

                          await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                          userYieldSummary = await takaturnDiamond.getUserYieldSummary(
                              participant_1.address,
                              termId
                          )

                          const userYieldGeneratedAfter = userYieldSummary[1] + userYieldSummary[5]

                          const userYieldGeneratedBeforeFormatted =
                              erc20UnitsFormat(userYieldGeneratedBefore)

                          const userYieldGeneratedAfterFormatted =
                              erc20UnitsFormat(userYieldGeneratedAfter)

                          assert(userYieldGeneratedBeforeFormatted > 0)
                          assert(userYieldGeneratedBeforeFormatted < 0.1218)
                          assert(userYieldGeneratedAfterFormatted < 0.1111)
                          assert(
                              userYieldGeneratedBefore.toString() >
                                  userYieldGeneratedAfter.toString()
                          )
                      })
                  })

                  describe("Join with yield unlocked", function () {
                      it("Should return if true the user has opted in yield generation", async function () {
                          const lastTerm = await takaturnDiamond.getTermsId()
                          const termId = lastTerm[0]

                          for (let i = 1; i <= 4; i++) {
                              let optedIn = await takaturnDiamond.userHasoptedInYG(
                                  termId,
                                  accounts[i].address
                              )

                              assert.ok(optedIn)
                          }
                      })
                  })
                  describe("Join with yield locked", function () {
                      beforeEach(async () => {
                          await takaturnDiamond.toggleYieldLock()

                          await takaturnDiamond.createTerm(
                              totalParticipants,
                              registrationPeriod,
                              cycleTime,
                              contributionAmount,
                              contributionPeriod,
                              usdc
                          )

                          const terms = await takaturnDiamond.getTermsId()
                          const termId = terms[0]

                          for (let i = 1; i <= 4; i++) {
                              let entrance = await takaturnDiamond.minCollateralToDeposit(
                                  termId,
                                  i - 1
                              )

                              await takaturnDiamond
                                  .connect(accounts[i])
                                  ["joinTerm(uint256,bool)"](termId, true, {
                                      value: entrance,
                                  })
                          }

                          await advanceTime(registrationPeriod + 1)

                          await takaturnDiamond.startTerm(termId)
                      })
                      it("Should return false, even if the user wants to opted in", async function () {
                          const lastTerm = await takaturnDiamond.getTermsId()
                          const termId = lastTerm[0]

                          for (let i = 1; i <= 4; i++) {
                              let optedIn = await takaturnDiamond.userHasoptedInYG(
                                  termId,
                                  accounts[i].address
                              )

                              assert.ok(!optedIn)
                          }
                      })
                  })
              })

              describe("Helper getters", function () {
                  describe("User related getter", function () {
                      beforeEach(async function () {
                          await takaturnDiamond.createTerm(
                              totalParticipants,
                              registrationPeriod,
                              cycleTime,
                              contributionAmount,
                              contributionPeriod,
                              usdc
                          )
                      })
                      describe("Not opted in yield generation", function () {
                          beforeEach(async function () {
                              const terms = await takaturnDiamond.getTermsId()
                              const termId = terms[0]

                              for (let i = 1; i <= totalParticipants; i++) {
                                  const entrance = await takaturnDiamond.minCollateralToDeposit(
                                      termId,
                                      i - 1
                                  )

                                  await takaturnDiamond
                                      .connect(accounts[i])
                                      ["joinTerm(uint256,bool)"](termId, false, { value: entrance })
                              }

                              await advanceTime(registrationPeriod + 1)
                              await takaturnDiamond.startTerm(termId)
                          })
                          it("Should get the correct values", async function () {
                              const terms = await takaturnDiamond.getTermsId()
                              const termId = terms[0]

                              const userSummary = await takaturnDiamond.getUserRelatedSummary(
                                  participant_1,
                                  termId
                              )

                              const deposited = await takaturnDiamond.minCollateralToDeposit(
                                  termId,
                                  0
                              )

                              assert.ok(userSummary.collateralMember)
                              assert.ok(userSummary.fundMember)
                              assert.ok(!userSummary.beneficiary)
                              assert.ok(!userSummary.currentCyclePaid)
                              assert.ok(!userSummary.nextCyclePaid)
                              assert.ok(!userSummary.autoPayer)
                              assert.ok(!userSummary.moneyPotFrozen)
                              assert.ok(!userSummary.yieldMember)
                              assert.equal(userSummary.membersBank, deposited)
                              assert.equal(userSummary.paymentBank, 0n)
                              assert.equal(userSummary.deposited, deposited)
                              assert(userSummary.expulsonLimit > 0)
                              assert(userSummary.expulsonLimit < deposited)
                              assert.equal(userSummary.pool, 0n)
                              assert.equal(userSummary.cycleExpelled, 0n)
                              assert.equal(userSummary.yieldWithdrawn, 0n)
                              assert.equal(userSummary.collateralWithdrawnFromYield, 0n)
                              assert.equal(userSummary.yieldAvailable, 0n)
                              assert.equal(userSummary.collateralDepositedInYield, 0n)
                              assert.equal(userSummary[21], 0n)
                          })
                      })
                      describe("Opted in yield generaion", function () {
                          beforeEach(async function () {
                              const terms = await takaturnDiamond.getTermsId()
                              const termId = terms[0]

                              for (let i = 1; i <= totalParticipants; i++) {
                                  const entrance = await takaturnDiamond.minCollateralToDeposit(
                                      termId,
                                      i - 1
                                  )

                                  await takaturnDiamond
                                      .connect(accounts[i])
                                      ["joinTerm(uint256,bool)"](termId, true, { value: entrance })
                              }
                          })
                          describe("Still accepting collateral", function () {
                              it("Should get the correct values", async function () {
                                  const terms = await takaturnDiamond.getTermsId()
                                  const termId = terms[0]

                                  const userSummary = await takaturnDiamond.getUserRelatedSummary(
                                      participant_1,
                                      termId
                                  )

                                  const deposited = await takaturnDiamond.minCollateralToDeposit(
                                      termId,
                                      0
                                  )

                                  assert.ok(userSummary.collateralMember)
                                  assert.ok(!userSummary.fundMember)
                                  assert.ok(!userSummary.beneficiary)
                                  assert.ok(!userSummary.currentCyclePaid)
                                  assert.ok(!userSummary.nextCyclePaid)
                                  assert.ok(!userSummary.autoPayer)
                                  assert.ok(!userSummary.moneyPotFrozen)
                                  assert.ok(userSummary.yieldMember)
                                  assert.equal(userSummary.membersBank, deposited)
                                  assert.equal(userSummary.paymentBank, 0n)
                                  assert.equal(userSummary.deposited, deposited)
                                  assert.equal(userSummary.expulsonLimit, 0n)
                                  assert.equal(userSummary.pool, 0n)
                                  assert.equal(userSummary.cycleExpelled, 0n)
                                  assert.equal(userSummary.yieldWithdrawn, 0n)
                                  assert.equal(userSummary.collateralWithdrawnFromYield, 0n)
                                  assert.equal(userSummary.yieldAvailable, 0n)
                                  assert.equal(userSummary.collateralDepositedInYield, 0n)
                                  assert.equal(userSummary[21], 0n)
                              })
                          })
                          describe("Term started", function () {
                              beforeEach(async function () {
                                  const terms = await takaturnDiamond.getTermsId()
                                  const termId = terms[0]

                                  await advanceTime(registrationPeriod + 1)
                                  await takaturnDiamond.startTerm(termId)
                              })
                              it("Should get the correct values", async function () {
                                  const terms = await takaturnDiamond.getTermsId()
                                  const termId = terms[0]

                                  const userSummary = await takaturnDiamond.getUserRelatedSummary(
                                      participant_1,
                                      termId
                                  )

                                  const deposited = await takaturnDiamond.minCollateralToDeposit(
                                      termId,
                                      0
                                  )

                                  const expectedDepositedOnYield = (deposited * 95n) / 100n

                                  assert.ok(userSummary.collateralMember) // collateral member
                                  assert.ok(userSummary.fundMember) // participant
                                  assert.ok(!userSummary.beneficiary) // beneficiary
                                  assert.ok(!userSummary.currentCyclePaid)
                                  assert.ok(!userSummary.nextCyclePaid)
                                  assert.ok(!userSummary.autoPayer)
                                  assert.ok(!userSummary.moneyPotFrozen)
                                  assert.ok(userSummary.yieldMember)
                                  assert.equal(userSummary.membersBank, deposited)
                                  assert.equal(userSummary.paymentBank, 0n)
                                  assert.equal(userSummary.deposited, deposited)
                                  assert(userSummary.expulsonLimit > 0)
                                  assert(userSummary.expulsonLimit < deposited)
                                  assert.equal(userSummary.pool, 0n)
                                  assert.equal(userSummary.cycleExpelled, 0n)
                                  assert.equal(userSummary.yieldWithdrawn, 0n)
                                  assert.equal(userSummary.collateralWithdrawnFromYield, 0n)
                                  assert.equal(userSummary.yieldAvailable, 0n)
                                  assert.equal(
                                      userSummary.collateralDepositedInYield,
                                      expectedDepositedOnYield
                                  )
                                  assert(userSummary[21] > 0n)
                              })
                          })
                      })
                  })

                  describe("Non user related getter", function () {
                      beforeEach(async function () {
                          await takaturnDiamond.createTerm(
                              totalParticipants,
                              registrationPeriod,
                              cycleTime,
                              contributionAmount,
                              contributionPeriod,
                              usdc
                          )
                      })
                      describe("Term not started", function () {
                          it("Should get the correct values", async function () {
                              const terms = await takaturnDiamond.getTermsId()
                              const termId = terms[0]
                              const termSummary = await takaturnDiamond.getTermRelatedSummary(
                                  termId
                              )

                              assert.ok(termSummary[0].initialized) // Term initialized
                              assert.equal(termSummary[0].stableTokenAddress, usdc.target) // Stable token
                              // States
                              expect(getCollateralStateFromIndex(termSummary[1])).to.equal(
                                  CollateralStates.AcceptingCollateral
                              )
                              expect(getFundStateFromIndex(termSummary[2])).to.equal(
                                  FundStates.InitializingFund
                              )
                              // Every position should be available
                              assert.equal(
                                  termSummary[3].availablePositions.length,
                                  totalParticipants
                              )
                              assert.equal(
                                  termSummary[3].securityDeposits.length,
                                  termSummary[3].availablePositions.length
                              )
                              // Every time related shoud be 0
                              assert.equal(termSummary[3].remainingRegistrationTime, 0n)
                              assert.equal(termSummary[3].remainingContributionTime, 0n)
                              assert.equal(termSummary[3].remainingCycleTime, 0n)
                              assert(termSummary[3].rcc > 0n)
                              assert(termSummary[3].latestPrice > 0n)
                              // Nobody has deposited in collateral
                              assert.ok(termSummary[3].collateralInitialized)
                              assert.equal(termSummary[3].collateralFirstDepositTime, 0n)
                              assert.equal(termSummary[3].collateralCounterMembers, 0n)
                              //   Fund neither yield has values
                              assert.ok(!termSummary[3].fundInitialized)
                              assert.equal(termSummary[3].fundStartTime, 0n)
                              assert.equal(termSummary[3].fundEndTime, 0n)
                              assert.equal(termSummary[3].fundCurrentCycle, 0n)
                              assert.equal(termSummary[3].fundExpellantsCount, 0n)
                              assert.equal(termSummary[3].fundTotalCycles, 0n)
                              assert.ok(!termSummary[3].yieldInitialized)
                              assert.equal(termSummary[3].yieldStartTime, 0n)
                              assert.equal(termSummary[3].yieldTotalDeposit, 0n)
                              assert.equal(termSummary[3].yieldCurrentTotalDeposit, 0n)
                              assert.equal(termSummary[3].yieldTotalShares, 0n)
                          })
                      })
                      describe("Term started", function () {
                          beforeEach(async function () {
                              const terms = await takaturnDiamond.getTermsId()
                              const termId = terms[0]

                              for (let i = 1; i <= totalParticipants; i++) {
                                  const entrance = await takaturnDiamond.minCollateralToDeposit(
                                      termId,
                                      i - 1
                                  )

                                  await takaturnDiamond
                                      .connect(accounts[i])
                                      ["joinTerm(uint256,bool)"](termId, true, { value: entrance })
                              }
                              await advanceTime(registrationPeriod + 1)
                              await takaturnDiamond.startTerm(termId)
                          })
                          it("Should get the correct values", async function () {
                              const terms = await takaturnDiamond.getTermsId()
                              const termId = terms[0]
                              const termSummary = await takaturnDiamond.getTermRelatedSummary(
                                  termId
                              )

                              assert.ok(termSummary[0].initialized) // Term initialized
                              assert.equal(termSummary[0].stableTokenAddress, usdc.target) // Stable token
                              // States
                              expect(getCollateralStateFromIndex(termSummary[1])).to.equal(
                                  CollateralStates.CycleOngoing
                              )
                              expect(getFundStateFromIndex(termSummary[2])).to.equal(
                                  FundStates.AcceptingContributions
                              )
                              // Every position should be available
                              assert.equal(termSummary[3].availablePositions.length, 0n)
                              assert.equal(
                                  termSummary[3].securityDeposits.length,
                                  termSummary[3].availablePositions.length
                              )
                              // Every time related shoud be 0
                              assert.equal(termSummary[3].remainingRegistrationTime, 0n)
                              assert(termSummary[3].remainingContributionTime > 0n)
                              assert(termSummary[3].remainingCycleTime > 0n)
                              assert.equal(termSummary[3].remainingCycles, totalParticipants)
                              assert(termSummary[3].rcc > 0n)
                              assert(termSummary[3].latestPrice > 0n)

                              // Collateral
                              assert.ok(termSummary[3].collateralInitialized)
                              assert(termSummary[3].collateralFirstDepositTime > 0n)
                              assert.equal(
                                  termSummary[3].collateralCounterMembers,
                                  totalParticipants
                              )

                              // Fund
                              assert.ok(termSummary[3].fundInitialized)
                              assert(termSummary[3].fundStartTime > 0n)
                              assert.equal(termSummary[3].fundEndTime, 0n)
                              assert.equal(termSummary[3].fundCurrentCycle, 1n)
                              assert.equal(termSummary[3].fundExpellantsCount, 0n)
                              assert.equal(termSummary[3].fundTotalCycles, totalParticipants)
                              assert.equal(
                                  termSummary[3].fundBeneficiariesOrder.length,
                                  totalParticipants
                              )
                              assert.equal(
                                  termSummary[3].fundBeneficiariesOrder[0],
                                  participant_1.address
                              )
                              assert.equal(
                                  termSummary[3].fundBeneficiariesOrder[1],
                                  participant_2.address
                              )
                              assert.equal(
                                  termSummary[3].fundBeneficiariesOrder[2],
                                  participant_3.address
                              )
                              assert.equal(
                                  termSummary[3].fundBeneficiariesOrder[3],
                                  participant_4.address
                              )

                              // Yield
                              assert.ok(termSummary[3].yieldInitialized)
                              assert(termSummary[3].yieldStartTime > 0n)
                              assert(termSummary[3].yieldTotalDeposit > 0n)
                              assert(termSummary[3].yieldCurrentTotalDeposit > 0n)
                              assert(termSummary[3].yieldTotalShares > 0n)
                          })
                      })
                  })
              })
          })
      })
