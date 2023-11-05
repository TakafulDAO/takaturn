const { assert, expect } = require("chai")
const { isFork, isMainnet, networkConfig } = require("../../utils/_networks")
const { network, ethers } = require("hardhat")
const { impersonateAccount, advanceTime } = require("../../utils/_helpers")
const { balanceForUser, registrationPeriod } = require("../utils/test-utils")
const { abi } = require("../../deployments/mainnet_arbitrum/TakaturnDiamond.json")

!isFork || isMainnet
    ? describe.skip
    : describe("Fork Mainnet test. Changing provider addresses", function () {
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

              // Get the contract instances

              const takaturnDiamondAddress = networkConfig[chainId]["takaturnDiamond"]
              const usdcAddress = networkConfig[chainId]["usdc"]
              const newZaynZapAddress = "0x1534c33FF68cFF9E0c5BABEe5bE72bf4cad0826b"

              takaturnDiamond = await ethers.getContractAt(abi, takaturnDiamondAddress)
              usdc = await ethers.getContractAt(
                  "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                  usdcAddress
              )
              zaynZap = await ethers.getContractAt(
                  "contracts/interfaces/IZaynZapV2TakaDAO.sol:IZaynZapV2TakaDAO",
                  newZaynZapAddress
              )
          })

          describe("Checking the current addresses", function () {
              it("Check the yield generation", async function () {
                  const deployConstants = await takaturnDiamond.getConstants(
                      "ETH/USD",
                      "USDC/USD",
                      "ZaynZap",
                      "ZaynVault"
                  )

                  assert.equal(deployConstants[2].toLowerCase(), zaynZap.address.toLowerCase())
              })
          })

          describe("Testing withdraw collateral", function () {
              beforeEach(async function () {
                  // Impersonate the accounts
                  participant_1 = "0x773D44a5F9FF345440565B26526E7b89c03f5418"
                  participant_2 = "0x92aE5285Ed66cF37B4A7A6F5DD345E2b11be90fd"
                  participant_3 = "0xA253ABb03A060b2C170ead2772D3171Cae484643"
                  participant_4 = accounts[4]

                  await impersonateAccount(participant_1)
                  await impersonateAccount(participant_2)
                  await impersonateAccount(participant_3)

                  participant_1_signer = await ethers.getSigner(participant_1)
                  participant_2_signer = await ethers.getSigner(participant_2)
                  participant_3_signer = await ethers.getSigner(participant_3)

                  takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1_signer)
              })

              describe("Current behaviour", function () {
                  it("Revert Only zap can call", async function () {
                      // Term Id to check
                      const termId = 2

                      await expect(
                          takaturnDiamondParticipant_1.withdrawCollateral(termId)
                      ).to.be.revertedWith("Only zap can call")
                  })
              })
              describe("New behaviour", function () {
                  beforeEach(async function () {
                      // Deploy new diamond
                      await deployments.fixture(["takaturn_upgrade"])
                      takaturnDiamond = await ethers.getContract("TakaturnDiamond")

                      takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1_signer)
                      takaturnDiamondParticipant_2 = takaturnDiamond.connect(participant_2_signer)
                      takaturnDiamondParticipant_3 = takaturnDiamond.connect(participant_3_signer)
                      takaturnDiamondParticipant_4 = takaturnDiamond.connect(participant_4)

                      usdcWhale = networkConfig[chainId]["usdcWhale"]
                      zapOwner = "0xff0C52AfD43CeCA4c5E674f61fa93BE32647f185"

                      await impersonateAccount(zapOwner)
                      await impersonateAccount(usdcWhale)

                      zapOwnerSigner = await ethers.getSigner(zapOwner)
                      whale = await ethers.getSigner(usdcWhale)

                      zaynZapOwner = zaynZap.connect(zapOwnerSigner)
                      usdcWhaleSigner = usdc.connect(whale)

                      await zaynZapOwner.toggleTrustedSender(takaturnDiamond.address, true, {
                          gasLimit: 1000000,
                      })

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
                  })
                  it("should allow to withdraw", async function () {
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

                      await advanceTime(contributionPeriod + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)

                      const yield = await takaturnDiamond.getYieldSummary(termId)

                      //   const withdrawable = await takaturnDiamond.getWithdrawableUserBalance(
                      //       termId,
                      //       participant_1
                      //   )

                      const withdrawTx = takaturnDiamondParticipant_1.withdrawCollateral(termId)

                      await Promise.all([
                          expect(withdrawTx)
                              .to.emit(takaturnDiamond, "OnCollateralWithdrawal")
                              .withArgs(termId, participant_1, "26842520729684912"),
                          expect(withdrawTx)
                              .to.emit(takaturnDiamond, "OnYieldClaimed")
                              .withArgs(termId, participant_1, "26891395531919808"),
                      ])

                      assert.equal(yield[7], zaynZap.address)
                  })

                  describe("Proposed solution", function () {
                      it("Should change the provider address", async function () {
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

                          let yield = await takaturnDiamond.getYieldSummary(termId)
                          const oldAddress = yield[7].toLowerCase()

                          await takaturnDiamond.updateProviderAddressOnTerms(
                              termId,
                              "ZaynZap",
                              deployer.address
                          )

                          yield = await takaturnDiamond.getYieldSummary(termId)
                          const newAddress = yield[7].toLowerCase()

                          assert.notEqual(oldAddress, newAddress)
                          assert.equal(newAddress, deployer.address.toLowerCase())
                      })
                  })
              })
          })
      })
