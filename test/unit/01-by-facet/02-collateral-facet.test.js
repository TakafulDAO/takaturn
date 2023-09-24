const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")
const { advanceTimeByDate, advanceTime, impersonateAccount } = require("../../../utils/_helpers")
const { BigNumber } = require("ethers")
const { hour } = require("../../../utils/units")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Collateral facet tests", function () {
          const chainId = network.config.chainId

          const totalParticipants = BigNumber.from("3") // Create term param
          const cycleTime = BigNumber.from("180") // Create term param
          const contributionAmount = BigNumber.from("10") // Create term param
          const contributionPeriod = BigNumber.from("120") // Create term param
          const registrationPeriod = BigNumber.from("120") // Create term param

          let takaturnDiamond

          let deployer, participant_1, participant_2, participant_3

          let takaturnDiamondDeployer,
              takaturnDiamondParticipant_1,
              takaturnDiamondParticipant_2,
              takaturnDiamondParticipant_3

          beforeEach(async () => {
              // Get the accounts
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              participant_1 = accounts[1]
              participant_2 = accounts[2]
              participant_3 = accounts[3]
              usdcOwner = accounts[13]
              usdcMasterMinter = accounts[14]
              usdcRegularMinter = accounts[15]
              usdcLostAndFound = accounts[16]

              // Deploy contracts
              await deployments.fixture(["takaturn_upgrade"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")
              if (isDevnet && !isFork) {
                  aggregator = await ethers.getContract("MockEthUsdAggregator")
                  sequencer = await ethers.getContract("MockSequencer")
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
              takaturnDiamondParticipant_2 = takaturnDiamond.connect(participant_2)
              takaturnDiamondParticipant_3 = takaturnDiamond.connect(participant_3)

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

              const balanceForUser = contributionAmount * totalParticipants * 10 ** 6

              if (isFork) {
                  const usdcWhale = networkConfig[chainId]["usdcWhale"]
                  await impersonateAccount(usdcWhale)
                  const whale = await ethers.getSigner(usdcWhale)
                  usdcWhaleSigner = usdc.connect(whale)

                  let userAddress
                  for (let i = 1; i <= totalParticipants; i++) {
                      userAddress = accounts[i].address
                      await usdcWhaleSigner.transfer(userAddress, balanceForUser)

                      await usdc
                          .connect(accounts[i])
                          .approve(takaturnDiamond.address, balanceForUser * 10 ** 6)
                  }
              } else {
                  // Initialize USDC
                  const tokenName = "USD Coin"
                  const tokenSymbol = "USDC"
                  const tokenCurrency = "USD"
                  const tokenDecimals = 6

                  await usdc
                      .connect(usdcOwner)
                      .initialize(
                          tokenName,
                          tokenSymbol,
                          tokenCurrency,
                          tokenDecimals,
                          usdcMasterMinter.address,
                          usdcOwner.address,
                          usdcOwner.address,
                          usdcOwner.address
                      )

                  await usdc
                      .connect(usdcMasterMinter)
                      .configureMinter(usdcRegularMinter.address, 10000000000000)

                  await usdc.connect(usdcOwner).initializeV2(tokenName)

                  await usdc.connect(usdcOwner).initializeV2_1(usdcLostAndFound.address)

                  for (let i = 1; i <= totalParticipants; i++) {
                      let depositor = accounts[i]

                      // Mint USDC for depositor
                      await usdc.connect(usdcRegularMinter).mint(depositor.address, balanceForUser)

                      await usdc
                          .connect(depositor)
                          .approve(takaturnDiamond.address, balanceForUser * 10 ** 6)
                  }

                  // Wait for the sequencer
                  await advanceTimeByDate(1, hour)
              }
          })

          describe("Participant can withdraw collateral", function () {
              describe("Participant joins without yield generation", function () {
                  beforeEach(async () => {
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]
                      for (let i = 0; i < totalParticipants; i++) {
                          // Get the collateral payment deposit
                          const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                              termId,
                              i
                          )
                          // Each participant joins the term
                          await takaturnDiamondParticipant_1
                              .connect(accounts[i + 1])
                              .joinTerm(termId, false, { value: entrance })
                      }

                      await advanceTime(registrationPeriod.toNumber() + 1)
                      await takaturnDiamond.startTerm(termId)
                  })
                  it.only("Should withdraw", async function () {
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      // Pay the contribution for the first cycle
                      for (let i = 0; i < totalParticipants; i++) {
                          try {
                              await takaturnDiamondParticipant_1
                                  .connect(accounts[i + 1])
                                  .payContribution(termId)
                          } catch (e) {}
                      }

                      await advanceTime(cycleTime.toNumber() + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)

                      await takaturnDiamond.startNewCycle(termId)

                      // Pay the contribution for the second cycle
                      for (let i = 0; i < totalParticipants; i++) {
                          try {
                              await takaturnDiamondParticipant_1
                                  .connect(accounts[i + 1])
                                  .payContribution(termId)
                          } catch (e) {}
                      }

                      await advanceTime(cycleTime.toNumber() + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)

                      await takaturnDiamond.startNewCycle(termId)

                      // Pay the contribution for the third cycle
                      for (let i = 0; i < totalParticipants; i++) {
                          try {
                              await takaturnDiamondParticipant_1
                                  .connect(accounts[i + 1])
                                  .payContribution(termId)
                          } catch (e) {}
                      }

                      await advanceTime(cycleTime.toNumber() + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)

                      // Withdraw the collateral
                      for (let i = 0; i < totalParticipants; i++) {
                          await expect(
                              takaturnDiamondParticipant_1
                                  .connect(accounts[i + 1])
                                  .withdrawCollateral(termId)
                          ).not.to.be.reverted
                      }
                  })
              })
          })
      })
