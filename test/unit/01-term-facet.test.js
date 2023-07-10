const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../utils/_networks")
const { constants } = require("@openzeppelin/test-helpers")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Term Facet unit tests", function () {
          const chainId = network.config.chainId

          const totalParticipants = 12
          const cycleTime = 60
          const contributionAmount = 100
          const contributionPeriod = 20
          const fixedCollateralEth = ethers.utils.parseEther("3")
          const collateralFundingPeriod = 604800
          const collateralAmount = 60

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
              participant_12,
              usdcOwner,
              usdcMasterMinter,
              usdcRegularMinterMinter,
              usdcLostAndFound

          let takaturnDiamondDeployer,
              takaturnParticipant_1,
              takaturnParticipant_2,
              takaturnParticipant_3,
              takaturnParticipant_4,
              takaturnParticipant_5,
              takaturnParticipant_6,
              takaturnParticipant_7,
              takaturnParticipant_8,
              takaturnParticipant_9,
              takaturnParticipant_10,
              takaturnParticipant_11,
              takaturnParticipant_12

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
              usdcRegularMinterMinter = accounts[15]
              usdcLostAndFound = accounts[16]

              // Deploy contracts
              await deployments.fixture(["all"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")
              usdc = await ethers.getContract("FiatTokenV2_1")
              if (isDevnet && !isFork) {
                  aggregator = await ethers.getContract("MockV3Aggregator")
              } else {
                  const aggregatorAddress = networkConfig[chainId]["ethUsdPriceFeed"]
                  aggregator = await ethers.getContractAt("MockV3Aggregator", aggregatorAddress)
              }
              // Connect the accounts
              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)
              takaturnParticipant_1 = takaturnDiamond.connect(participant_1)
              takaturnParticipant_2 = takaturnDiamond.connect(participant_2)
              takaturnParticipant_3 = takaturnDiamond.connect(participant_3)
              takaturnParticipant_4 = takaturnDiamond.connect(participant_4)
              takaturnParticipant_5 = takaturnDiamond.connect(participant_1)
              takaturnParticipant_6 = takaturnDiamond.connect(participant_2)
              takaturnParticipant_7 = takaturnDiamond.connect(participant_3)
              takaturnParticipant_8 = takaturnDiamond.connect(participant_4)
              takaturnParticipant_9 = takaturnDiamond.connect(participant_1)
              takaturnParticipant_10 = takaturnDiamond.connect(participant_2)
              takaturnParticipant_11 = takaturnDiamond.connect(participant_3)
              takaturnParticipant_12 = takaturnDiamond.connect(participant_4)

              participants = []

              for (let i = 1; i <= totalParticipants; i++) {
                  participants.push(accounts[i])
              }
          })

          describe("Revert error tests", function () {
              it("Should revert to create a new term if the inputs are incorrect", async function () {
                  // total participants is 0
                  await expect(
                      takaturnDiamondDeployer.createTerm(
                          0,
                          cycleTime,
                          contributionAmount,
                          contributionPeriod,
                          fixedCollateralEth,
                          usdc.address,
                          aggregator.address
                      )
                  ).to.be.revertedWith("Invalid inputs")

                  // cycle time is 0
                  await expect(
                      takaturnDiamondDeployer.createTerm(
                          totalParticipants,
                          0,
                          contributionAmount,
                          contributionPeriod,
                          fixedCollateralEth,
                          usdc.address,
                          aggregator.address
                      )
                  ).to.be.revertedWith("Invalid inputs")

                  // contribution amount is 0
                  await expect(
                      takaturnDiamondDeployer.createTerm(
                          totalParticipants,
                          cycleTime,
                          0,
                          contributionPeriod,
                          fixedCollateralEth,
                          usdc.address,
                          aggregator.address
                      )
                  ).to.be.revertedWith("Invalid inputs")

                  // contribution period is 0
                  await expect(
                      takaturnDiamondDeployer.createTerm(
                          totalParticipants,
                          cycleTime,
                          contributionAmount,
                          0,
                          fixedCollateralEth,
                          usdc.address,
                          aggregator.address
                      )
                  ).to.be.revertedWith("Invalid inputs")

                  // contribution period is less than cycle time
                  await expect(
                      takaturnDiamondDeployer.createTerm(
                          totalParticipants,
                          cycleTime,
                          contributionAmount,
                          cycleTime + 1,
                          fixedCollateralEth,
                          usdc.address,
                          aggregator.address
                      )
                  ).to.be.revertedWith("Invalid inputs")

                  // stable token address is the address 0
                  await expect(
                      takaturnDiamondDeployer.createTerm(
                          totalParticipants,
                          cycleTime,
                          contributionAmount,
                          contributionPeriod,
                          fixedCollateralEth,
                          constants.ZERO_ADDRESS,
                          aggregator.address
                      )
                  ).to.be.revertedWith("Invalid inputs")

                  // aggregator address is the address 0
                  await expect(
                      takaturnDiamondDeployer.createTerm(
                          totalParticipants,
                          cycleTime,
                          contributionAmount,
                          contributionPeriod,
                          fixedCollateralEth,
                          usdc.address,
                          constants.ZERO_ADDRESS
                      )
                  ).to.be.revertedWith("Invalid inputs")
              })
          })

          describe("Create term tests", function () {
              it("Should create a new term with the default values", async function () {
                  const termId = await takaturnDiamondDeployer.getLastTermId()
                  await takaturnDiamondDeployer.createTerm(
                      totalParticipants,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      fixedCollateralEth,
                      usdc.address,
                      aggregator.address
                  )
                  const newTermId = await takaturnDiamondDeployer.getLastTermId()

                  const newTerm = await takaturnDiamondDeployer.getTermSummary(termId)

                  expect(newTermId).to.equal(termId.add(1))
                  assert.equal(newTerm.initialized, true)
                  assert.equal(newTerm.totalParticipants.toString(), totalParticipants)
                  assert.equal(newTerm.cycleTime.toString(), cycleTime)
                  assert.equal(newTerm.contributionAmount.toString(), contributionAmount)
                  assert.equal(newTerm.contributionPeriod.toString(), contributionPeriod)
                  assert.equal(newTerm.fixedCollateralEth.toString(), fixedCollateralEth)
                  assert.equal(newTerm.stableTokenAddress, usdc.address)
                  assert.equal(newTerm.aggregatorAddress, aggregator.address)
              })
          })
      })
