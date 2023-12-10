const { assert, expect } = require("chai")
const { isFork, isMainnet, networkConfig } = require("../../utils/_networks")
const { network, ethers } = require("hardhat")
const { impersonateAccount, advanceTime } = require("../../utils/_helpers")
const { balanceForUser } = require("../utils/test-utils")
const { erc20UnitsFormat } = require("../../utils/units")
const { BigNumber } = require("ethers")

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

              await zaynZapOwner.toggleTrustedSender(takaturnDiamond.address, true, {
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
                  .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)

              await usdc
                  .connect(participant_2)
                  .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)

              await usdc
                  .connect(participant_3)
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

                          assert(userAPYBefore.toString() > userAPYAfter.toString())
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

                      const userYieldGeneratedBefore = BigNumber.from(userYieldSummary[1]).add(
                          BigNumber.from(userYieldSummary[5])
                      )

                      await advanceTime(contributionPeriod + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)

                      userYieldSummary = await takaturnDiamond.getUserYieldSummary(
                          participant_1.address,
                          termId
                      )

                      const userYieldGeneratedAfter = BigNumber.from(userYieldSummary[1]).add(
                          BigNumber.from(userYieldSummary[5])
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

                          let userYieldSummary = await takaturnDiamond.getUserYieldSummary(
                              participant_1.address,
                              termId
                          )

                          const userYieldGeneratedBefore = BigNumber.from(userYieldSummary[1]).add(
                              BigNumber.from(userYieldSummary[5])
                          )

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

                          const userYieldGeneratedAfter = BigNumber.from(userYieldSummary[1]).add(
                              BigNumber.from(userYieldSummary[5])
                          )

                          const userYieldGeneratedBeforeFormatted =
                              erc20UnitsFormat(userYieldGeneratedBefore)

                          const userYieldGeneratedAfterFormatted =
                              erc20UnitsFormat(userYieldGeneratedAfter)

                          assert(userYieldGeneratedBefore > 0)
                          assert(userYieldGeneratedBeforeFormatted < 0.18)
                          assert(userYieldGeneratedAfterFormatted < 0.14)
                          assert(
                              userYieldGeneratedBefore.toString() >
                                  userYieldGeneratedAfter.toString()
                          )
                      })
                      it("Defaulting", async function () {
                          const terms = await takaturnDiamond.getTermsId()
                          const termId = terms[0]

                          let userYieldSummary = await takaturnDiamond.getUserYieldSummary(
                              participant_1.address,
                              termId
                          )

                          const userYieldGeneratedBefore = BigNumber.from(userYieldSummary[1]).add(
                              BigNumber.from(userYieldSummary[5])
                          )

                          await advanceTime(contributionPeriod + 1)

                          await takaturnDiamond.closeFundingPeriod(termId)

                          await takaturnDiamondParticipant_1.withdrawCollateral(termId)

                          userYieldSummary = await takaturnDiamond.getUserYieldSummary(
                              participant_1.address,
                              termId
                          )

                          const userYieldGeneratedAfter = BigNumber.from(userYieldSummary[1]).add(
                              BigNumber.from(userYieldSummary[5])
                          )

                          const userYieldGeneratedBeforeFormatted =
                              erc20UnitsFormat(userYieldGeneratedBefore)

                          const userYieldGeneratedAfterFormatted =
                              erc20UnitsFormat(userYieldGeneratedAfter)

                          assert(userYieldGeneratedBeforeFormatted > 0)
                          assert(userYieldGeneratedBeforeFormatted < 0.18)
                          assert(userYieldGeneratedAfterFormatted < 0.14)

                          assert(
                              userYieldGeneratedBefore.toString() >
                                  userYieldGeneratedAfter.toString()
                          )
                      })
                  })
              })
          })
      })
