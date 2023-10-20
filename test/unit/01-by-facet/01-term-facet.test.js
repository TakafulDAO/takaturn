const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")
const {
    advanceTimeByDate,
    advanceTime,
    getTermStateFromIndex,
    TermStates,
} = require("../../../utils/_helpers")
const { BigNumber } = require("ethers")
const { hour } = require("../../../utils/units")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Term Facet unit tests", function () {
          const chainId = network.config.chainId

          const totalParticipants = BigNumber.from("12") // Create term param
          const cycleTime = BigNumber.from("60") // Create term param
          const contributionAmount = BigNumber.from("100") // Create term param
          const contributionPeriod = BigNumber.from("20") // Create term param
          const registrationPeriod = BigNumber.from("6000") // Create term param

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

          if (!isFork) {
              describe("Oracle unit tests", function () {
                  it("Should revert if the oracle does not met requires", async function () {
                      await advanceTimeByDate(1, hour)

                      await aggregator.setPrice(0)

                      const termId = await takaturnDiamondDeployer.getTermsId()
                      await expect(
                          takaturnDiamondDeployer.minCollateralToDeposit(termId[0], 0)
                      ).to.be.revertedWith("ChainlinkOracle: stale data")
                  })
              })
          }

          describe("Initialize a term", function () {
              it("Correct initialization", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      await takaturnDiamond
                          .connect(accounts[i])
                          .joinTerm(termId, false, { value: entrance })
                  }

                  await advanceTime(registrationPeriod.toNumber() + 1)

                  await takaturnDiamond.startTerm(termId)

                  const term = await takaturnDiamondDeployer.getTermSummary(termId)
                  const termState = term.state

                  await expect(getTermStateFromIndex(termState)).to.equal(TermStates.ActiveTerm)
              })
          })

          describe("Participant can join enable autoPay when they join", function () {
              it("Should allow autoPay", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]
                  const wrongTermId = termId + 1

                  // Get the collateral payment deposit
                  const term = await takaturnDiamondDeployer.getTermSummary(termId)
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                      term.termId,
                      0
                  )

                  await expect(
                      takaturnDiamond.connect(participant_1).toggleAutoPay(termId)
                  ).to.be.revertedWith("Pay collateral security first")

                  // Join
                  await expect(
                      takaturnDiamond
                          .connect(participant_1)
                          .joinTerm(wrongTermId, false, { value: entrance })
                  ).to.be.revertedWith("Term doesn't exist")

                  await takaturnDiamond
                      .connect(participant_1)
                      .joinTerm(termId, false, { value: entrance })

                  await expect(takaturnDiamond.connect(participant_1).toggleAutoPay(termId)).not.to
                      .be.reverted

                  const participantFundSummary =
                      await takaturnDiamondParticipant_1.getParticipantFundSummary(
                          participant_1.address,
                          termId
                      )

                  const participantCollateralSummary =
                      await takaturnDiamondParticipant_1.getDepositorCollateralSummary(
                          participant_1.address,
                          termId
                      )

                  const isParticipant = participantFundSummary[0]
                  const isCollateralMember = participantCollateralSummary[0]

                  assert.ok(!isParticipant)
                  assert.ok(isCollateralMember)
              })
              it("Should revert when the fund is closed", async function () {
                  // Create a term with only  two participants and close the two cycles
                  await takaturnDiamondParticipant_1.createTerm(
                      2,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      usdc.address
                  )
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // Get the collateral payment deposit
                  const term = await takaturnDiamondDeployer.getTermSummary(termId)
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                      term.termId,
                      0
                  )

                  await takaturnDiamond
                      .connect(participant_1)
                      .joinTerm(termId, false, { value: entrance })
                  await takaturnDiamond
                      .connect(participant_2)
                      .joinTerm(termId, false, { value: entrance })

                  await advanceTime(registrationPeriod.toNumber() + 1)
                  await takaturnDiamond.startTerm(termId)
                  await advanceTime(cycleTime.toNumber() + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)
                  await takaturnDiamond.startNewCycle(termId)

                  await advanceTime(cycleTime.toNumber() + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)

                  await expect(
                      takaturnDiamond.connect(participant_1).toggleAutoPay(termId)
                  ).to.be.revertedWith("Wrong state")

                  await expect(
                      takaturnDiamond.connect(participant_2).toggleAutoPay(termId)
                  ).to.be.revertedWith("Wrong state")
              })
          })

          describe("Participant can join multiple terms", function () {
              it("Should update the users mappings", async function () {
                  // Create five terms
                  for (let i = 0; i < 4; i++) {
                      await takaturnDiamondParticipant_1.createTerm(
                          totalParticipants,
                          registrationPeriod,
                          cycleTime,
                          contributionAmount,
                          contributionPeriod,
                          usdc.address
                      )
                  }

                  // Get the collateral payment deposit
                  const term = await takaturnDiamondDeployer.getTermSummary(0)
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                      term.termId,
                      0
                  )

                  // Participant 1 joins the the five terms
                  for (let i = 0; i < 5; i++) {
                      const termId = i

                      // Join
                      await expect(
                          takaturnDiamond
                              .connect(participant_1)
                              .joinTerm(termId, false, { value: entrance })
                      ).to.emit(takaturnDiamond, "OnCollateralDeposited")

                      const participantSummary =
                          await takaturnDiamond.getDepositorCollateralSummary(
                              participant_1.address,
                              termId
                          )

                      const isCollateralMember = participantSummary[0]

                      assert.ok(isCollateralMember)
                  }
              })

              it("Joined terms getters", async function () {
                  // Create five terms
                  for (let i = 0; i < 4; i++) {
                      await takaturnDiamondParticipant_1.createTerm(
                          totalParticipants,
                          registrationPeriod,
                          cycleTime,
                          contributionAmount,
                          contributionPeriod,
                          usdc.address
                      )
                  }

                  // Get the collateral payment deposit
                  const term = await takaturnDiamondDeployer.getTermSummary(0)
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                      term.termId,
                      0
                  )

                  // Participant 1 joins terms 2, 3 and 4
                  for (let i = 2; i < 5; i++) {
                      const termId = i

                      await takaturnDiamond
                          .connect(participant_1)
                          .joinTerm(termId, false, { value: entrance })
                  }

                  // Everyone joins term 3
                  for (let i = 2; i <= totalParticipants; i++) {
                      await takaturnDiamond
                          .connect(accounts[i + 1])
                          .joinTerm(3, false, { value: entrance })
                  }

                  // Start the term 3
                  await advanceTime(registrationPeriod.toNumber() + 1)

                  await takaturnDiamond.startTerm(3)

                  const joinedTerms = await takaturnDiamond.getAllJoinedTerms(participant_1.address)

                  const joinedInitializedTerms = await takaturnDiamond.getJoinedTermsByState(
                      participant_1.address,
                      0
                  )
                  const joinedActiveTerms = await takaturnDiamond.getJoinedTermsByState(
                      participant_1.address,
                      1
                  )

                  //   console.table(joinedTerms)
                  //   console.table(joinedInitializedTerms)
                  //   console.table(joinedActiveTerms)

                  assert.equal(joinedTerms[0].toString(), 2)
                  assert.equal(joinedTerms[1].toString(), 3)
                  assert.equal(joinedTerms[2].toString(), 4)
                  assert.equal(joinedTerms.length, 3)
                  assert.equal(joinedInitializedTerms[0].toString(), 2)
                  assert.equal(joinedInitializedTerms[1].toString(), 4)
                  assert.equal(joinedInitializedTerms.length, 2)
                  assert.equal(joinedActiveTerms[0].toString(), 3)
                  assert.equal(joinedActiveTerms.length, 1)
              })
          })

          describe("Participant can pay less as security deposit according their index order", function () {
              it("Last participant pays less than the first one", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      const failedEntrance = BigNumber.from(entrance).sub(1)

                      // Each participant fail to join the term with less than the min collateral

                      await expect(
                          takaturnDiamond
                              .connect(accounts[i])
                              .joinTerm(termId, false, { value: failedEntrance })
                      ).to.be.revertedWith("Eth payment too low")

                      await expect(
                          takaturnDiamond
                              .connect(accounts[i])
                              .joinTerm(termId, false, { value: entrance })
                      ).not.to.be.reverted
                  }

                  const participant_1_Summary = await takaturnDiamond.getDepositorCollateralSummary(
                      participant_1.address,
                      termId
                  )
                  const participant_1_Collateral = participant_1_Summary[3]

                  const participant_12_Summary =
                      await takaturnDiamond.getDepositorCollateralSummary(
                          participant_12.address,
                          termId
                      )
                  const participant_12_Collateral = participant_12_Summary[3]

                  expect(participant_1_Collateral).to.be.gt(participant_12_Collateral)
              })
          })

          describe("Registration period", function () {
              it("Should return the right registration period remaining", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(termId, 0)

                  await expect(
                      takaturnDiamond.getRemainingRegistrationTime(termId)
                  ).to.be.revertedWith("Nobody has deposited yet")

                  await takaturnDiamond
                      .connect(participant_1)
                      .joinTerm(termId, false, { value: entrance })

                  await advanceTime(registrationPeriod.toNumber() / 2)

                  let remainingTime = await takaturnDiamond.getRemainingRegistrationTime(termId)

                  assert.equal(remainingTime.toNumber(), registrationPeriod.toNumber() / 2)

                  await advanceTime(registrationPeriod.toNumber() + 1)

                  remainingTime = await takaturnDiamond.getRemainingRegistrationTime(termId)

                  assert.equal(remainingTime.toNumber(), 0)
              })
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

              it("Should assign the correct yield generation values", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      await takaturnDiamond
                          .connect(accounts[i])
                          .joinTerm(termId, false, { value: entrance })
                  }

                  await expect(takaturnDiamond.startTerm(termId)).to.be.revertedWith(
                      "Term not ready to start"
                  )

                  await advanceTime(registrationPeriod.toNumber() + 1)

                  await takaturnDiamond.startTerm(termId)
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

                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(termId, 0)

                  await takaturnDiamond
                      .connect(participant_1)
                      .joinTerm(termId, true, { value: entrance })

                  const userHasoptedInYG = await takaturnDiamond.userHasoptedInYG(
                      termId,
                      participant_1.address
                  )

                  await advanceTime(registrationPeriod.toNumber() / 2)

                  // Should be true as the lock is false, and the user joins with true
                  assert.ok(userHasoptedInYG)
              })

              it("Should not allow optedIn yield when lock is false, at joining", async function () {
                  // Lock true
                  await takaturnDiamondDeployer.toggleYieldLock()

                  const lastTerm = await takaturnDiamond.getTermsId()
                  const termId = lastTerm[0]

                  const entrance = await takaturnDiamond.minCollateralToDeposit(termId, 0)

                  await takaturnDiamond
                      .connect(participant_1)
                      .joinTerm(termId, true, { value: entrance })

                  const userHasoptedInYG = await takaturnDiamond.userHasoptedInYG(
                      termId,
                      participant_1.address
                  )

                  await advanceTime(registrationPeriod.toNumber() / 2)

                  // Should be false as the lock is true, Even if the user joins with true on yield generation
                  assert.ok(!userHasoptedInYG)
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

          describe("Expire term", function () {
              it("Should revert if the try to expire before time", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  await expect(takaturnDiamond.expireTerm(termId)).to.be.revertedWith(
                      "Registration period not ended"
                  )
              })

              it("Should revert if all the spots are filled", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      await takaturnDiamond
                          .connect(accounts[i])
                          .joinTerm(termId, false, { value: entrance })
                  }

                  await advanceTime(registrationPeriod.toNumber() + 1)

                  await expect(takaturnDiamond.expireTerm(termId)).to.be.revertedWith(
                      "All spots are filled, can't expire"
                  )
              })

              it("Should revert if all the spots are filled", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(termId, 0)

                  await takaturnDiamondParticipant_1.joinTerm(termId, false, { value: entrance })

                  await advanceTime(registrationPeriod.toNumber() + 1)

                  await expect(takaturnDiamond.expireTerm(termId)).to.not.be.reverted

                  const term = await takaturnDiamondDeployer.getTermSummary(termId)
                  const termState = term.state

                  await expect(getTermStateFromIndex(termState)).to.equal(TermStates.ExpiredTerm)
              })
          })
      })
