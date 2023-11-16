const { assert, expect } = require("chai")
const { isFork, isMainnet, networkConfig } = require("../../utils/_networks")
const { network, ethers } = require("hardhat")
const { impersonateAccount, advanceTime } = require("../../utils/_helpers")
const { balanceForUser } = require("../utils/test-utils")

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
              participant_1 = "0x773D44a5F9FF345440565B26526E7b89c03f5418"
              participant_2 = "0x92aE5285Ed66cF37B4A7A6F5DD345E2b11be90fd"
              participant_3 = "0xA253ABb03A060b2C170ead2772D3171Cae484643"
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

              await impersonateAccount(participant_1)
              await impersonateAccount(participant_2)
              await impersonateAccount(participant_3)
              await impersonateAccount(zapOwner)
              await impersonateAccount(usdcWhale)

              participant_1_signer = await ethers.getSigner(participant_1)
              participant_2_signer = await ethers.getSigner(participant_2)
              participant_3_signer = await ethers.getSigner(participant_3)
              zapOwnerSigner = await ethers.getSigner(zapOwner)
              whale = await ethers.getSigner(usdcWhale)

              takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1_signer)
              takaturnDiamondParticipant_2 = takaturnDiamond.connect(participant_2_signer)
              takaturnDiamondParticipant_3 = takaturnDiamond.connect(participant_3_signer)
              takaturnDiamondParticipant_4 = takaturnDiamond.connect(participant_4)
              zaynZapOwner = zaynZap.connect(zapOwnerSigner)
              usdcWhaleSigner = usdc.connect(whale)

              await zaynZapOwner.toggleTrustedSender(takaturnDiamond.address, true, {
                  gasLimit: 1000000,
              })

              // Transfer USDC to the participants
              await usdcWhaleSigner.transfer(participant_1, balanceForUser)
              await usdcWhaleSigner.transfer(participant_2, balanceForUser)
              await usdcWhaleSigner.transfer(participant_3, balanceForUser)
              await usdcWhaleSigner.transfer(participant_4.address, balanceForUser)

              // Approve the USDC for the diamond
              await usdc
                  .connect(participant_1_signer)
                  .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)

              await usdc
                  .connect(participant_2_signer)
                  .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)

              await usdc
                  .connect(participant_3_signer)
                  .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)

              await usdc
                  .connect(participant_4)
                  .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)

              for (let i = 0; i < 3; i++) {
                  await takaturnDiamond.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      usdc.address
                  )
              }
              // We simulate the exact behaviour from term 2
              const terms = await takaturnDiamond.getTermsId()
              const termId = terms[0]

              await takaturnDiamondParticipant_1.joinTerm(termId, true, {
                  value: ethers.utils.parseEther("0.19268"),
              })

              await takaturnDiamondParticipant_2.joinTerm(termId, true, {
                  value: ethers.utils.parseEther("0.14507"),
              })

              await takaturnDiamondParticipant_3.joinTerm(termId, true, {
                  value: ethers.utils.parseEther("0.09518"),
              })

              await takaturnDiamondParticipant_4.joinTerm(termId, true, {
                  value: ethers.utils.parseEther("0.04735"),
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

                      const userAPYBefore = await takaturnDiamond.userAPY(termId, participant_1)

                      await advanceTime(contributionPeriod + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)

                      const userAPYAfter = await takaturnDiamond.userAPY(termId, participant_1)

                      assert(userAPYBefore.toString() > userAPYAfter.toString())
                  })
                  describe("After some withdraws", function () {
                      it("Without defaults", async function () {
                          const terms = await takaturnDiamond.getTermsId()
                          const termId = terms[0]

                          const userAPYBefore = await takaturnDiamond.userAPY(termId, participant_1)

                          for (let i = 0; i < 3; i++) {
                              try {
                                  await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                              } catch (error) {}
                          }

                          await advanceTime(contributionPeriod + 1)

                          await takaturnDiamond.closeFundingPeriod(termId)

                          await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                          const userAPYAfter = await takaturnDiamond.userAPY(termId, participant_1)

                          assert(userAPYBefore.toString() > userAPYAfter.toString())
                      })
                      it("Defaulting", async function () {
                          const terms = await takaturnDiamond.getTermsId()
                          const termId = terms[0]

                          const userAPYBefore = await takaturnDiamond.userAPY(termId, participant_1)

                          await advanceTime(contributionPeriod + 1)

                          await takaturnDiamond.closeFundingPeriod(termId)

                          await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                          const userAPYAfter = await takaturnDiamond.userAPY(termId, participant_1)

                          assert(userAPYBefore.toString() > userAPYAfter.toString())
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

                      assert(termAPYBefore.toString() > 0)
                      assert(termAPYBefore.toString() < termAPYAfter.toString())
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

                          assert(termAPYBefore.toString() < termAPYAfter.toString())
                      })
                      it("Defaulting", async function () {
                          const terms = await takaturnDiamond.getTermsId()
                          const termId = terms[0]

                          const termAPYBefore = await takaturnDiamond.termAPY(termId)

                          await advanceTime(contributionPeriod + 1)

                          await takaturnDiamond.closeFundingPeriod(termId)

                          await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                          const termAPYAfter = await takaturnDiamond.termAPY(termId)

                          assert(termAPYBefore.toString() < termAPYAfter.toString())
                      })
                  })
              })

              describe("Yield distribution ratio", function () {
                  describe("When there is nothing deposited", function () {
                      it("Should be 0", async function () {
                          const termId = 0

                          // Nobody opted in to yield generation, so current total deposit is 0
                          await takaturnDiamondParticipant_1.joinTerm(termId, false, {
                              value: ethers.utils.parseEther("0.19268"),
                          })

                          await takaturnDiamondParticipant_2.joinTerm(termId, false, {
                              value: ethers.utils.parseEther("0.14507"),
                          })

                          await takaturnDiamondParticipant_3.joinTerm(termId, false, {
                              value: ethers.utils.parseEther("0.09518"),
                          })

                          await takaturnDiamondParticipant_4.joinTerm(termId, false, {
                              value: ethers.utils.parseEther("0.04735"),
                          })

                          await advanceTime(registrationPeriod + 1)

                          await takaturnDiamond.startTerm(termId)

                          const yieldDistributionRatio =
                              await takaturnDiamond.yieldDistributionRatio(termId, participant_1)

                          assert.equal(yieldDistributionRatio.toString(), 0)
                      })
                  })
                  describe("When there is something deposited", function () {
                      it("Without any withdraws", async function () {
                          const terms = await takaturnDiamond.getTermsId()
                          const termId = terms[0]

                          const yieldDistributionRatioBefore =
                              await takaturnDiamond.yieldDistributionRatio(termId, participant_1)

                          await advanceTime(contributionPeriod + 1)

                          const yieldDistributionRatioAfter =
                              await takaturnDiamond.yieldDistributionRatio(termId, participant_1)

                          assert.equal(
                              yieldDistributionRatioBefore.toString(),
                              yieldDistributionRatioAfter.toString()
                          )
                      })
                      describe("After some withdraws", function () {
                          it("Without defaults", async function () {
                              const terms = await takaturnDiamond.getTermsId()
                              const termId = terms[0]

                              const yieldDistributionRatioBefore =
                                  await takaturnDiamond.yieldDistributionRatio(
                                      termId,
                                      participant_1
                                  )

                              for (let i = 0; i < 3; i++) {
                                  try {
                                      await takaturnDiamond
                                          .connect(accounts[i])
                                          .payContribution(termId)
                                  } catch (error) {}
                              }

                              await advanceTime(contributionPeriod + 1)

                              await takaturnDiamond.closeFundingPeriod(termId)

                              await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                              const yieldDistributionRatioAfter =
                                  await takaturnDiamond.yieldDistributionRatio(
                                      termId,
                                      participant_1
                                  )

                              assert(
                                  yieldDistributionRatioBefore.toString() >
                                      yieldDistributionRatioAfter.toString()
                              )
                          })
                          it("Defaulting", async function () {
                              const terms = await takaturnDiamond.getTermsId()
                              const termId = terms[0]

                              const yieldDistributionRatioBefore =
                                  await takaturnDiamond.yieldDistributionRatio(
                                      termId,
                                      participant_1
                                  )

                              await advanceTime(contributionPeriod + 1)

                              await takaturnDiamond.closeFundingPeriod(termId)

                              await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                              const yieldDistributionRatioAfter =
                                  await takaturnDiamond.yieldDistributionRatio(
                                      termId,
                                      participant_1
                                  )

                              assert(
                                  yieldDistributionRatioBefore.toString() >
                                      yieldDistributionRatioAfter.toString()
                              )
                          })
                      })
                  })
              })

              describe("Total yield  generated", function () {
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

                      const userYieldGeneratedBefore = await takaturnDiamond.userYieldGenerated(
                          termId,
                          participant_1
                      )

                      await advanceTime(contributionPeriod + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)

                      const userYieldGeneratedAfter = await takaturnDiamond.userYieldGenerated(
                          termId,
                          participant_1
                      )

                      assert.equal(
                          userYieldGeneratedBefore.toString(),
                          userYieldGeneratedAfter.toString()
                      )
                  })
                  describe("After some withdraws", function () {
                      it("Without defaults", async function () {
                          const terms = await takaturnDiamond.getTermsId()
                          const termId = terms[0]

                          const userYieldGeneratedBefore = await takaturnDiamond.userYieldGenerated(
                              termId,
                              participant_1
                          )

                          for (let i = 0; i < 3; i++) {
                              try {
                                  await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                              } catch (error) {}
                          }

                          await advanceTime(contributionPeriod + 1)

                          await takaturnDiamond.closeFundingPeriod(termId)

                          await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                          const userYieldGeneratedAfter = await takaturnDiamond.userYieldGenerated(
                              termId,
                              participant_1
                          )

                          assert(
                              userYieldGeneratedBefore.toString() >
                                  userYieldGeneratedAfter.toString()
                          )
                      })
                      it("Defaulting", async function () {
                          const terms = await takaturnDiamond.getTermsId()
                          const termId = terms[0]

                          const userYieldGeneratedBefore = await takaturnDiamond.userYieldGenerated(
                              termId,
                              participant_1
                          )

                          await advanceTime(contributionPeriod + 1)

                          await takaturnDiamond.closeFundingPeriod(termId)

                          await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                          const userYieldGeneratedAfter = await takaturnDiamond.userYieldGenerated(
                              termId,
                              participant_1
                          )

                          assert(
                              userYieldGeneratedBefore.toString() >
                                  userYieldGeneratedAfter.toString()
                          )
                      })
                  })
              })
          })
      })
