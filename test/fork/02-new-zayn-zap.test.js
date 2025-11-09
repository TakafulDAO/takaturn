const { assert, expect } = require("chai")
const { isFork, isMainnet, networkConfig } = require("../../utils/_networks")
const { network, ethers } = require("hardhat")
const { impersonateAccount, advanceTime } = require("../../utils/_helpers")
const { balanceForUser } = require("../utils/test-utils")
const { abi } = require("../../deployments/localhost/TakaturnDiamond.json")

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

                  assert.equal(deployConstants[2], zaynZap.target)
              })
          })

          describe("Testing withdraw collateral", function () {
              describe("New behaviour", function () {
                  beforeEach(async function () {
                      participant_1 = accounts[1]
                      participant_2 = accounts[2]
                      participant_3 = accounts[3]
                      participant_4 = accounts[4]

                      // Deploy new diamond
                      await deployments.fixture(["takaturn_upgrade"])
                      takaturnDiamond = await ethers.getContract("TakaturnDiamond")

                      takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1)
                      takaturnDiamondParticipant_2 = takaturnDiamond.connect(participant_2)
                      takaturnDiamondParticipant_3 = takaturnDiamond.connect(participant_3)
                      takaturnDiamondParticipant_4 = takaturnDiamond.connect(participant_4)

                      usdcWhale = networkConfig[chainId]["usdcWhale"]
                      zapOwner = "0xff0C52AfD43CeCA4c5E674f61fa93BE32647f185"

                      await impersonateAccount(zapOwner)
                      await impersonateAccount(usdcWhale)

                      zapOwnerSigner = await ethers.getSigner(zapOwner)
                      whale = await ethers.getSigner(usdcWhale)

                      zaynZapOwner = zaynZap.connect(zapOwnerSigner)
                      usdcWhaleSigner = usdc.connect(whale)

                      await deployer.sendTransaction({
                          to: zapOwner,
                          value: ethers.parseEther("1"),
                      })

                      await zaynZapOwner.toggleTrustedSender(takaturnDiamond, true, {
                          gasLimit: 1000000,
                      })

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
                  })
                  xit("should allow to withdraw [ @skip-on-ci ]", async function () {
                      // todo: correct ethers v6 migration
                      // We simulate the exact behaviour from term 2
                      const terms = await takaturnDiamond.getTermsId()
                      const termId = terms[0]

                      await takaturnDiamondParticipant_1.joinTerm(termId, true, {
                          value: ethers.parseEther("0.19268"),
                      })

                      await takaturnDiamondParticipant_2.joinTerm(termId, true, {
                          value: ethers.parseEther("0.14507"),
                      })

                      await takaturnDiamondParticipant_3.joinTerm(termId, true, {
                          value: ethers.parseEther("0.09518"),
                      })

                      await takaturnDiamondParticipant_4.joinTerm(termId, true, {
                          value: ethers.parseEther("0.04735"),
                      })

                      await advanceTime(registrationPeriod + 1)

                      await takaturnDiamond.startTerm(termId)

                      await takaturnDiamondParticipant_2.payContribution(termId)
                      await takaturnDiamondParticipant_3.payContribution(termId)
                      await takaturnDiamondParticipant_4.payContribution(termId)

                      await advanceTime(contributionPeriod + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)

                      const yield = await takaturnDiamond.getYieldSummary(termId)

                      let yieldUserSummary = await takaturnDiamond.getUserYieldSummary(
                          participant_1.address,
                          termId
                      )

                      const withdrawnYieldBefore = yieldUserSummary[1]
                      const withdrawnCollateralBefore = yieldUserSummary[2]

                      const withdrawTx = takaturnDiamondParticipant_1.withdrawCollateral(termId)

                      yieldUserSummary = await takaturnDiamond.getUserYieldSummary(
                          participant_1.address,
                          termId
                      )

                      const withdrawnYieldAfter = yieldUserSummary[1]
                      const withdrawnCollateralAfter = yieldUserSummary[2]

                      await Promise.all([
                          expect(withdrawTx)
                              .to.emit(takaturnDiamond, "OnCollateralWithdrawal")
                              .withArgs(
                                  termId,
                                  participant_1.address,
                                  participant_1.address,
                                  withdrawnCollateralAfter
                              ),
                          expect(withdrawTx)
                              .to.emit(takaturnDiamond, "OnYieldClaimed")
                              .withArgs(
                                  termId,
                                  participant_1.address,
                                  participant_1.address,
                                  withdrawnYieldAfter
                              ),
                      ])

                      assert.equal(withdrawnYieldBefore, "0")
                      assert.equal(withdrawnCollateralBefore, "0")
                      assert(withdrawnYieldAfter > withdrawnYieldBefore)
                      assert(withdrawnCollateralAfter > withdrawnCollateralBefore)

                      assert.equal(yield[7], zaynZap.target)
                  })

                  describe("Proposed solution", function () {
                      it("Should change the provider address", async function () {
                          const terms = await takaturnDiamond.getTermsId()
                          const termId = terms[0]

                          await takaturnDiamondParticipant_1["joinTerm(uint256,bool)"](
                              termId,
                              true,
                              {
                                  value: ethers.parseEther("0.19268"),
                              }
                          )

                          await takaturnDiamondParticipant_2["joinTerm(uint256,bool)"](
                              termId,
                              true,
                              {
                                  value: ethers.parseEther("0.14507"),
                              }
                          )

                          await takaturnDiamondParticipant_3["joinTerm(uint256,bool)"](
                              termId,
                              true,
                              {
                                  value: ethers.parseEther("0.09518"),
                              }
                          )

                          await takaturnDiamondParticipant_4["joinTerm(uint256,bool)"](
                              termId,
                              true,
                              {
                                  value: ethers.parseEther("0.04735"),
                              }
                          )

                          await advanceTime(registrationPeriod + 1)

                          await takaturnDiamond.startTerm(termId)

                          let yield = await takaturnDiamond.getYieldSummary(termId)
                          const oldAddress = yield[7]

                          await takaturnDiamond.updateProviderAddressOnTerms(
                              termId,
                              "ZaynZap",
                              deployer.address
                          )

                          yield = await takaturnDiamond.getYieldSummary(termId)
                          const newAddress = yield[7]

                          assert.notEqual(oldAddress, newAddress)
                          assert.equal(newAddress, deployer.address)
                      })
                  })
              })
          })
      })
