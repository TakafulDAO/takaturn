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
    toWei,
} = require("../../../utils/_helpers")
const {
    totalParticipants,
    cycleTime,
    contributionAmount,
    contributionPeriod,
    registrationPeriod,
} = require("../utils/test-utils")
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants")

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
              await deployments.fixture(["takaturn_upgrade"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")
              aggregator = await ethers.getContract("MockV3Aggregator")

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
                  await usdcWhaleSigner.transfer(userAddress, contributionAmount * 10 ** 6)

                  await usdc
                      .connect(accounts[i])
                      .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)
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

              // Start term

              await expect(takaturnDiamond.startTerm(termId))
                  .to.emit(takaturnDiamond, "OnTermStart")
                  .withArgs(termId)
          })
      })
