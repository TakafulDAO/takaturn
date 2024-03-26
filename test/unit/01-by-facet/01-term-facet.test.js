const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")
const {
    advanceTimeByDate,
    advanceTime,
    getTermStateFromIndex,
    TermStates,
} = require("../../../utils/_helpers")
const { hour } = require("../../../utils/units")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Unit tests. Term Facet", function () {
          const chainId = network.config.chainId

          const totalParticipants = 12 // Create term param
          const cycleTime = 60 // Create term param
          const contributionAmount = 100 // Create term param
          const contributionPeriod = 20 // Create term param
          const registrationPeriod = 6000 // Create term param

          let takaturnDiamond

          let deployer, participant_1, participant_2, participant_12

          let takaturnDiamondDeployer, takaturnDiamondParticipant_1

          beforeEach(async () => {
              // Get the accounts
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              participant_1 = accounts[1]
              participant_2 = accounts[2]
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
                  usdc
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
                      ).to.be.revertedWith("TT-GF-02")
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
                          ["joinTerm(uint256,bool)"](termId, false, { value: entrance })
                  }

                  await advanceTime(registrationPeriod + 1)
                  await takaturnDiamond.startTerm(termId)

                  const term = await takaturnDiamondDeployer.getTermSummary(termId)
                  const termState = term.state

                  await expect(getTermStateFromIndex(termState)).to.equal(TermStates.ActiveTerm)
              })
          })

          describe("Join a term", function () {
              it("Should join term", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]
                  const wrongTermId = termId + 1n

                  // Get the collateral payment deposit
                  const term = await takaturnDiamondDeployer.getTermSummary(termId)
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                      term.termId,
                      0
                  )

                  // Join
                  await expect(
                      takaturnDiamond
                          .connect(participant_1)
                          ["joinTerm(uint256,bool)"](wrongTermId, false, { value: entrance })
                  ).to.be.revertedWith("TT-TF-02") // Term doesn't exist

                  await takaturnDiamond
                      .connect(participant_1)
                      ["joinTerm(uint256,bool)"](termId, false, { value: entrance })

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

              it("Should be able to join multiple terms", async function () {
                  // Create five terms
                  for (let i = 0; i < 4; i++) {
                      await takaturnDiamondParticipant_1.createTerm(
                          totalParticipants,
                          registrationPeriod,
                          cycleTime,
                          contributionAmount,
                          contributionPeriod,
                          usdc
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
                              ["joinTerm(uint256,bool)"](termId, false, { value: entrance })
                      ).to.emit(takaturnDiamond, "OnCollateralDepositedNext")

                      const participantSummary =
                          await takaturnDiamond.getDepositorCollateralSummary(participant_1, termId)

                      const isCollateralMember = participantSummary[0]

                      assert.ok(isCollateralMember)
                  }
              })

              it("Check joined terms getters", async function () {
                  // Create five terms
                  for (let i = 0; i < 4; i++) {
                      await takaturnDiamondParticipant_1.createTerm(
                          totalParticipants,
                          registrationPeriod,
                          cycleTime,
                          contributionAmount,
                          contributionPeriod,
                          usdc
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
                          ["joinTerm(uint256,bool)"](termId, false, { value: entrance })
                  }

                  // Everyone joins term 3
                  for (let i = 2; i <= totalParticipants; i++) {
                      await takaturnDiamond
                          .connect(accounts[i + 1])
                          ["joinTerm(uint256,bool)"](3, false, { value: entrance })
                  }

                  // Start the term 3
                  await advanceTime(registrationPeriod + 1)

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

              it("Participant pay less security deposit according their index order", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      const failedEntrance = entrance - 1n

                      // Each participant fail to join the term with less than the min collateral

                      await expect(
                          takaturnDiamond
                              .connect(accounts[i])
                              ["joinTerm(uint256,bool)"](termId, false, { value: failedEntrance })
                      ).to.be.revertedWith("TT-TF-08") // Eth payment too low

                      await expect(
                          takaturnDiamond
                              .connect(accounts[i])
                              ["joinTerm(uint256,bool)"](termId, false, { value: entrance })
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

              it("Should join a term selecting the position", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]
                  const position = 7

                  // Get the collateral payment deposit
                  const term = await takaturnDiamondDeployer.getTermSummary(termId)
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                      term.termId,
                      position
                  )

                  // Join
                  await takaturnDiamond
                      .connect(participant_1)
                      ["joinTermOnPosition(uint256,bool,uint256)"](termId, false, position, {
                          value: entrance,
                      })

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

                  const collateralSummary = await takaturnDiamond.getCollateralSummary(termId)

                  const isParticipant = participantFundSummary[0]
                  const isCollateralMember = participantCollateralSummary[0]
                  const collateralDepositors = collateralSummary[4]

                  assert.ok(!isParticipant)
                  assert.ok(isCollateralMember)
                  for (let i = 0; i < totalParticipants; i++) {
                      if (i === position) {
                          assert.equal(collateralDepositors[i], participant_1.address)
                      } else {
                          assert.equal(collateralDepositors[i], ethers.ZeroAddress)
                      }
                  }
              })

              it("Should get available positions", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]
                  const position = 7n

                  let positionsAndDeposits =
                      await takaturnDiamond.getAvailablePositionsAndSecurityAmount(termId)

                  const availablePositionsBefore = positionsAndDeposits[0]

                  const positionIndex = availablePositionsBefore.indexOf(position)
                  const entrance = positionsAndDeposits[1][positionIndex]

                  await expect(
                      takaturnDiamond
                          .connect(participant_1)
                          ["joinTermOnPosition(uint256,bool,uint256)"](termId, false, position, {
                              value: positionsAndDeposits[1][positionIndex + 1],
                          })
                  ).to.be.revertedWith("TT-TF-08") // Eth payment too low

                  await takaturnDiamond
                      .connect(participant_1)
                      ["joinTermOnPosition(uint256,bool,uint256)"](termId, false, position, {
                          value: entrance,
                      })

                  await expect(
                      takaturnDiamond
                          .connect(participant_12)
                          ["joinTermOnPosition(uint256,bool,uint256)"](termId, false, position, {
                              value: entrance,
                          })
                  ).to.be.revertedWith("TT-TF-07") // Position already taken

                  positionsAndDeposits =
                      await takaturnDiamond.getAvailablePositionsAndSecurityAmount(termId)

                  const availablePositionsAfter = positionsAndDeposits[0]

                  assert.ok(availablePositionsBefore.includes(position))
                  assert.ok(!availablePositionsAfter.includes(position))
              })

              it("Should allow to join every position", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  for (let i = 0; i < totalParticipants; i++) {
                      let entrance = await takaturnDiamondDeployer.minCollateralToDeposit(termId, i)

                      const joinTx = takaturnDiamond
                          .connect(accounts[i + 1])
                          ["joinTermOnPosition(uint256,bool,uint256)"](termId, false, i, {
                              value: entrance,
                          })

                      if (i === totalParticipants - 1) {
                          await Promise.all([
                              expect(joinTx)
                                  .to.emit(takaturnDiamond, "OnCollateralDepositedNext")
                                  .withArgs(
                                      termId,
                                      accounts[i + 1].address,
                                      accounts[i + 1].address,
                                      entrance,
                                      i
                                  ),
                              expect(joinTx)
                                  .to.emit(takaturnDiamond, "OnTermFilled")
                                  .withArgs(termId),
                          ])
                      } else {
                          await Promise.all([
                              expect(joinTx)
                                  .to.emit(takaturnDiamond, "OnCollateralDepositedNext")
                                  .withArgs(
                                      termId,
                                      accounts[i + 1].address,
                                      accounts[i + 1].address,
                                      entrance,
                                      i
                                  ),
                          ])
                      }
                  }
              })

              it("Should revert if the position is invalid", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // Get the collateral payment deposit
                  const term = await takaturnDiamondDeployer.getTermSummary(termId)
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                      term.termId,
                      0
                  )

                  await expect(
                      takaturnDiamond
                          .connect(participant_12)
                          ["joinTermOnPosition(uint256,bool,uint256)"](
                              termId,
                              false,
                              totalParticipants,
                              {
                                  value: entrance,
                              }
                          )
                  ).to.be.revertedWith("TT-TF-06") // Invalid position
              })

              it("Should revert if the position is already taken", async function () {
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
                      ["joinTerm(uint256,bool)"](termId, false, { value: entrance })

                  await expect(
                      takaturnDiamond
                          .connect(participant_12)
                          ["joinTermOnPosition(uint256,bool,uint256)"](termId, false, 0, {
                              value: entrance,
                          })
                  ).to.be.revertedWith("TT-TF-07") // Position already taken
              })
          })

          describe("Pay security on behalf of", function () {
              it("Should pay security for someone else", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]
                  const wrongTermId = termId + 1n

                  // Get the collateral payment deposit
                  const term = await takaturnDiamondDeployer.getTermSummary(termId)
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                      term.termId,
                      0
                  )

                  // Join
                  await expect(
                      takaturnDiamond["paySecurityOnBehalfOf(uint256,bool,address)"](
                          wrongTermId,
                          false,
                          participant_1,
                          { value: entrance }
                      )
                  ).to.be.revertedWith("TT-TF-02") // Term doesn't exist

                  await takaturnDiamond["paySecurityOnBehalfOf(uint256,bool,address)"](
                      termId,
                      false,
                      participant_1,
                      { value: entrance }
                  )

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

              it("Should be able to pay security deposit for someone else on multiple terms", async function () {
                  // Create five terms
                  for (let i = 0; i < 4; i++) {
                      await takaturnDiamond.createTerm(
                          totalParticipants,
                          registrationPeriod,
                          cycleTime,
                          contributionAmount,
                          contributionPeriod,
                          usdc
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
                          takaturnDiamond["paySecurityOnBehalfOf(uint256,bool,address)"](
                              termId,
                              false,
                              participant_1,
                              { value: entrance }
                          )
                      ).to.emit(takaturnDiamond, "OnCollateralDepositedNext")

                      const participantSummary =
                          await takaturnDiamond.getDepositorCollateralSummary(participant_1, termId)

                      const isCollateralMember = participantSummary[0]

                      assert.ok(isCollateralMember)
                  }
              })

              it("Check joined terms getters", async function () {
                  // Create five terms
                  for (let i = 0; i < 4; i++) {
                      await takaturnDiamond.createTerm(
                          totalParticipants,
                          registrationPeriod,
                          cycleTime,
                          contributionAmount,
                          contributionPeriod,
                          usdc
                      )
                  }

                  // Get the collateral payment deposit
                  const term = await takaturnDiamondDeployer.getTermSummary(0)
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                      term.termId,
                      0
                  )

                  // Pary for participant 1 on terms 2, 3 and 4
                  for (let i = 2; i < 5; i++) {
                      const termId = i

                      await takaturnDiamond["paySecurityOnBehalfOf(uint256,bool,address)"](
                          termId,
                          false,
                          participant_1,
                          { value: entrance }
                      )
                  }

                  // Pay for everyone on term 3
                  for (let i = 2; i <= totalParticipants; i++) {
                      await takaturnDiamond["paySecurityOnBehalfOf(uint256,bool,address)"](
                          3,
                          false,
                          accounts[i + 1].address,
                          { value: entrance }
                      )
                  }

                  // Start the term 3
                  await advanceTime(registrationPeriod + 1)

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

              it("Participant pay less security deposit according their index order", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  for (let i = 1; i <= totalParticipants; i++) {
                      const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                          termId,
                          i - 1
                      )

                      const failedEntrance = entrance - 1n

                      // Each participant fail to join the term with less than the min collateral

                      await expect(
                          takaturnDiamond["paySecurityOnBehalfOf(uint256,bool,address)"](
                              termId,
                              false,
                              accounts[i].address,
                              { value: failedEntrance }
                          )
                      ).to.be.revertedWith("TT-TF-08") // Eth payment too low

                      await expect(
                          takaturnDiamond["paySecurityOnBehalfOf(uint256,bool,address)"](
                              termId,
                              false,
                              accounts[i].address,
                              { value: entrance }
                          )
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

              it("Should pay for someone else selecting the position", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]
                  const position = 7

                  // Get the collateral payment deposit
                  const term = await takaturnDiamondDeployer.getTermSummary(termId)
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                      term.termId,
                      position
                  )

                  // Join
                  await takaturnDiamond["paySecurityOnBehalfOf(uint256,bool,address,uint256)"](
                      termId,
                      false,
                      participant_1,
                      position,
                      {
                          value: entrance,
                      }
                  )

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

                  const collateralSummary = await takaturnDiamond.getCollateralSummary(termId)

                  const isParticipant = participantFundSummary[0]
                  const isCollateralMember = participantCollateralSummary[0]
                  const collateralDepositors = collateralSummary[4]

                  assert.ok(!isParticipant)
                  assert.ok(isCollateralMember)
                  for (let i = 0; i < totalParticipants; i++) {
                      if (i === position) {
                          assert.equal(collateralDepositors[i], participant_1.address)
                      } else {
                          assert.equal(collateralDepositors[i], ethers.ZeroAddress)
                      }
                  }
              })

              it("Should get available positions", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]
                  const position = 7n

                  let positionsAndDeposits =
                      await takaturnDiamond.getAvailablePositionsAndSecurityAmount(termId)

                  const availablePositionsBefore = positionsAndDeposits[0]

                  const positionIndex = availablePositionsBefore.indexOf(position)
                  const entrance = positionsAndDeposits[1][positionIndex]

                  await expect(
                      takaturnDiamond["paySecurityOnBehalfOf(uint256,bool,address,uint256)"](
                          termId,
                          false,
                          participant_1,
                          position,
                          {
                              value: positionsAndDeposits[1][positionIndex + 1],
                          }
                      )
                  ).to.be.revertedWith("TT-TF-08") // Eth payment too low

                  await takaturnDiamond["paySecurityOnBehalfOf(uint256,bool,address,uint256)"](
                      termId,
                      false,
                      participant_1,
                      position,
                      {
                          value: entrance,
                      }
                  )

                  await expect(
                      takaturnDiamond["paySecurityOnBehalfOf(uint256,bool,address,uint256)"](
                          termId,
                          false,
                          participant_12,
                          position,
                          {
                              value: entrance,
                          }
                      )
                  ).to.be.revertedWith("TT-TF-07") // Position already taken

                  positionsAndDeposits =
                      await takaturnDiamond.getAvailablePositionsAndSecurityAmount(termId)

                  const availablePositionsAfter = positionsAndDeposits[0]

                  assert.ok(availablePositionsBefore.includes(position))
                  assert.ok(!availablePositionsAfter.includes(position))
              })

              it("Should allow to join every position", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  for (let i = 0; i < totalParticipants; i++) {
                      let entrance = await takaturnDiamondDeployer.minCollateralToDeposit(termId, i)

                      const joinTx = takaturnDiamond[
                          "paySecurityOnBehalfOf(uint256,bool,address,uint256)"
                      ](termId, false, accounts[i + 1], i, {
                          value: entrance,
                      })

                      if (i === totalParticipants - 1) {
                          await Promise.all([
                              expect(joinTx)
                                  .to.emit(takaturnDiamond, "OnCollateralDepositedNext")
                                  .withArgs(
                                      termId,
                                      deployer.address,
                                      accounts[i + 1].address,
                                      entrance,
                                      i
                                  ),
                              expect(joinTx)
                                  .to.emit(takaturnDiamond, "OnTermFilled")
                                  .withArgs(termId),
                          ])
                      } else {
                          await Promise.all([
                              expect(joinTx)
                                  .to.emit(takaturnDiamond, "OnCollateralDepositedNext")
                                  .withArgs(
                                      termId,
                                      deployer.address,
                                      accounts[i + 1].address,
                                      entrance,
                                      i
                                  ),
                          ])
                      }
                  }
              })

              it("Should revert if the position is invalid", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // Get the collateral payment deposit
                  const term = await takaturnDiamondDeployer.getTermSummary(termId)
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                      term.termId,
                      0
                  )

                  await expect(
                      takaturnDiamond["paySecurityOnBehalfOf(uint256,bool,address,uint256)"](
                          termId,
                          false,
                          participant_12,
                          totalParticipants,
                          {
                              value: entrance,
                          }
                      )
                  ).to.be.revertedWith("TT-TF-06") // Invalid position
              })

              it("Should revert if the position is already taken", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // Get the collateral payment deposit
                  const term = await takaturnDiamondDeployer.getTermSummary(termId)
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                      term.termId,
                      0
                  )

                  await takaturnDiamond["paySecurityOnBehalfOf(uint256,bool,address)"](
                      termId,
                      false,
                      participant_1,
                      { value: entrance }
                  )

                  await expect(
                      takaturnDiamond["paySecurityOnBehalfOf(uint256,bool,address,uint256)"](
                          termId,
                          false,
                          participant_12,
                          0,
                          {
                              value: entrance,
                          }
                      )
                  ).to.be.revertedWith("TT-TF-07") // Position already taken
              })
          })

          describe("AutoPay", function () {
              it("Should allow autoPay", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // Get the collateral payment deposit
                  const term = await takaturnDiamondDeployer.getTermSummary(termId)
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                      term.termId,
                      0
                  )

                  await expect(
                      takaturnDiamond.connect(participant_1).toggleAutoPay(termId)
                  ).to.be.revertedWith("TT-FF-05") // Pay collateral security first

                  // Join

                  await takaturnDiamond
                      .connect(participant_1)
                      ["joinTerm(uint256,bool)"](termId, false, { value: entrance })

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
                      usdc
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
                      ["joinTerm(uint256,bool)"](termId, false, { value: entrance })
                  await takaturnDiamond
                      .connect(participant_2)
                      ["joinTerm(uint256,bool)"](termId, false, { value: entrance })

                  await advanceTime(registrationPeriod + 1)
                  await takaturnDiamond.startTerm(termId)
                  await advanceTime(cycleTime + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)
                  await takaturnDiamond.startNewCycle(termId)

                  await advanceTime(cycleTime + 1)
                  await takaturnDiamond.closeFundingPeriod(termId)

                  await expect(
                      takaturnDiamond.connect(participant_1).toggleAutoPay(termId)
                  ).to.be.revertedWith("TT-FF-02") // Wrong state

                  await expect(
                      takaturnDiamond.connect(participant_2).toggleAutoPay(termId)
                  ).to.be.revertedWith("TT-FF-02") // Wrong state
              })
          })

          describe("Registration period", function () {
              it("Should return the right registration period remaining [ @skip-on-ci ]", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(termId, 0)

                  await expect(
                      takaturnDiamond.getRemainingRegistrationTime(termId)
                  ).to.be.revertedWith("Nobody has deposited yet")

                  await takaturnDiamond
                      .connect(participant_1)
                      ["joinTerm(uint256,bool)"](termId, false, { value: entrance })

                  await advanceTime(registrationPeriod / 2)

                  let remainingTime = await takaturnDiamond.getRemainingRegistrationTime(termId)

                  assert.equal(remainingTime, registrationPeriod / 2)

                  await advanceTime(registrationPeriod + 1)

                  remainingTime = await takaturnDiamond.getRemainingRegistrationTime(termId)

                  assert.equal(remainingTime, 0)
              })
          })

          describe("Expire term", function () {
              it("Should revert if the try to expire before time", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  await expect(takaturnDiamond.expireTerm(termId)).to.be.revertedWith("TT-TF-13") // Registration period not ended
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
                          ["joinTerm(uint256,bool)"](termId, false, { value: entrance })
                  }

                  await advanceTime(registrationPeriod + 1)

                  await expect(takaturnDiamond.expireTerm(termId)).to.be.revertedWith("TT-TF-14") // All spots are filled, can't expire
              })

              it("Should revert if all the spots are filled", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(termId, 0)

                  await takaturnDiamondParticipant_1["joinTerm(uint256,bool)"](termId, false, {
                      value: entrance,
                  })

                  await advanceTime(registrationPeriod + 1)

                  await expect(takaturnDiamond.expireTerm(termId)).to.not.be.reverted

                  const term = await takaturnDiamondDeployer.getTermSummary(termId)
                  const termState = term.state

                  await expect(getTermStateFromIndex(termState)).to.equal(TermStates.ExpiredTerm)
              })
          })
      })
