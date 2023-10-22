const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")
const { advanceTimeByDate, advanceTime } = require("../../../utils/_helpers")
const { BigNumber } = require("ethers")
const { hour } = require("../../../utils/units")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Yield Facet unit tests", function () {
          const chainId = network.config.chainId

          const totalParticipants = BigNumber.from("12") // Create term param
          const cycleTime = BigNumber.from("60") // Create term param
          const contributionAmount = BigNumber.from("100") // Create term param
          const contributionPeriod = BigNumber.from("20") // Create term param
          const registrationPeriod = BigNumber.from("60") // Create term param

          let takaturnDiamond

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
              participant_7 = accounts[7]
              participant_8 = accounts[8]
              participant_9 = accounts[9]
              participant_10 = accounts[10]
              participant_11 = accounts[11]
              participant_12 = accounts[12]
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
                  usdc.address
              )
          })

          describe("Joins with yield generation", function () {
              it("Should update the mapping", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(termId, 0)

                  await takaturnDiamond
                      .connect(participant_1)
                      .joinTerm(termId, true, { value: entrance })

                  const userHasoptedInYG = await takaturnDiamond.userHasoptedInYG(
                      termId,
                      participant_1.address
                  )

                  await advanceTime(registrationPeriod.toNumber() / 2)

                  assert.ok(userHasoptedInYG)
              })

              it("Should revert to toggle optIn if has not payed", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  await expect(
                      takaturnDiamondParticipant_1.toggleOptInYG(termId)
                  ).to.be.revertedWith("Pay the collateral security deposit first")
              })

              it("Should allow to opt out from yield generation if the term has not started", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(termId, 0)

                  await takaturnDiamondParticipant_1.joinTerm(termId, true, { value: entrance })

                  const userHasoptedInYGBefore = await takaturnDiamond.userHasoptedInYG(
                      termId,
                      participant_1.address
                  )

                  await advanceTime(registrationPeriod.toNumber() / 2)

                  await expect(takaturnDiamondParticipant_1.toggleOptInYG(termId))
                      .to.emit(takaturnDiamond, "OnYGOptInToggled")
                      .withArgs(termId, participant_1.address, false)

                  const userHasoptedInYGAfter = await takaturnDiamond.userHasoptedInYG(
                      termId,
                      participant_1.address
                  )

                  assert.ok(userHasoptedInYGBefore)
                  assert.ok(!userHasoptedInYGAfter)
              })
          })

          describe("Lock yield generation", function () {
              it("Only the contract owner can lock the yield", async function () {
                  // Only the owner can toggle the lock
                  await expect(takaturnDiamondParticipant_1.toggleYieldLock()).to.be.revertedWith(
                      "LibDiamond: Must be contract owner"
                  )
                  // Lock true
                  await expect(takaturnDiamondDeployer.toggleYieldLock()).not.to.be.reverted
              })
              it("Should allow optedIn yield when lock is false", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      if (i < totalParticipants) {
                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  .joinTerm(termId, true, { value: entrance })
                          )
                              .to.emit(takaturnDiamond, "OnCollateralDeposited")
                              .withArgs(termId, accounts[i].address, entrance)
                      } else {
                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  .joinTerm(termId, true, { value: entrance })
                          )
                              .to.emit(takaturnDiamond, "OnTermFilled")
                              .withArgs(termId)
                      }

                      let hasOptedIn = await takaturnDiamond.userHasoptedInYG(
                          termId,
                          accounts[i].address
                      )

                      assert.ok(hasOptedIn)
                  }
              })

              it("Should not allow optedIn yield when lock is false, at joining", async function () {
                  // Lock true
                  await takaturnDiamondDeployer.toggleYieldLock()

                  const lastTerm = await takaturnDiamond.getTermsId()
                  const termId = lastTerm[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      if (i < totalParticipants) {
                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  .joinTerm(termId, true, { value: entrance })
                          )
                              .to.emit(takaturnDiamond, "OnCollateralDeposited")
                              .withArgs(termId, accounts[i].address, entrance)
                      } else {
                          await expect(
                              takaturnDiamond
                                  .connect(accounts[i])
                                  .joinTerm(termId, true, { value: entrance })
                          )
                              .to.emit(takaturnDiamond, "OnTermFilled")
                              .withArgs(termId)
                      }
                  }

                  await advanceTime(registrationPeriod.toNumber() / 2)

                  for (let i = 1; i <= totalParticipants; i++) {
                      let hasOptedIn = await takaturnDiamond.userHasoptedInYG(
                          termId,
                          accounts[i].address
                      )

                      assert.ok(!hasOptedIn)
                      // Should be false as the lock is true, Even if the user joins with true on yield generation
                  }
              })

              it("Should not allow optedIn yield when lock is false, before joining at start term", async function () {
                  const lastTerm = await takaturnDiamond.getTermsId()
                  const termId = lastTerm[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamond.minCollateralToDeposit(termId, i - 1)

                      await takaturnDiamond
                          .connect(accounts[i])
                          .joinTerm(termId, true, { value: entrance })

                      let userHasoptedInYGAtJoining = await takaturnDiamond.userHasoptedInYG(
                          termId,
                          accounts[i].address
                      )
                      assert.ok(userHasoptedInYGAtJoining)
                  }

                  // Lock true
                  await takaturnDiamondDeployer.toggleYieldLock()

                  await advanceTime(registrationPeriod.toNumber() + 1)

                  await takaturnDiamond.startTerm(termId)

                  for (let i = 1; i <= totalParticipants; i++) {
                      const userHasoptedInYGAtStart = await takaturnDiamond.userHasoptedInYG(
                          termId,
                          accounts[i].address
                      )

                      // Should be false as the lock is true, Even if the user joins with true on yield generation

                      assert.ok(!userHasoptedInYGAtStart)
                  }
              })
          })

          describe("Update yield providers", function () {
              it("Only the contract owner can update the yield providers", async function () {
                  // Only the owner can toggle the lock
                  await expect(
                      takaturnDiamondParticipant_1.updateYieldProvider(
                          "test",
                          participant_2.address
                      )
                  ).to.be.revertedWith("LibDiamond: Must be contract owner")
                  // Lock true
                  await expect(
                      takaturnDiamondDeployer.updateYieldProvider("test", participant_2.address)
                  ).not.to.be.reverted
              })
          })
      })
