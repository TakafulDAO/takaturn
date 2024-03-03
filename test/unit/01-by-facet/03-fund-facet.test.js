const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")
const { advanceTime, impersonateAccount } = require("../../../utils/_helpers")
const { hour } = require("../../../utils/units")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Unit tests. Fund Facet", function () {
          const chainId = network.config.chainId

          const totalParticipants = 3 // Create term param
          const cycleTime = 180 // Create term param
          const contributionAmount = 10 // Create term param
          const contributionPeriod = 120 // Create term param
          const registrationPeriod = 120 // Create term param

          let takaturnDiamond

          let deployer, participant_1, participant_2, participant_3

          let takaturnDiamondDeployer, takaturnDiamondParticipant_1

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

              // Create the first term
              await takaturnDiamondParticipant_1.createTerm(
                  totalParticipants,
                  registrationPeriod,
                  cycleTime,
                  contributionAmount,
                  contributionPeriod,
                  usdc
              )

              const lastTerm = await takaturnDiamondDeployer.getTermsId()
              const termId = lastTerm[0]
              for (let i = 0; i < totalParticipants; i++) {
                  // Get the collateral payment deposit
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(termId, i)
                  // Each participant joins the term
                  await takaturnDiamondParticipant_1
                      .connect(accounts[i + 1])
                      .joinTerm(termId, false, { value: entrance })
              }

              await advanceTime(registrationPeriod + 1)
              await takaturnDiamond.startTerm(termId)

              const balanceForUser = contributionAmount * totalParticipants * 10 ** 6

              if (isFork) {
                  const usdcWhale = networkConfig[chainId]["usdcWhale"]
                  await impersonateAccount(usdcWhale)
                  const whale = await ethers.getSigner(usdcWhale)
                  usdcWhaleSigner = usdc.connect(whale)

                  let userAddress
                  for (let i = 1; i <= totalParticipants; i++) {
                      userAddress = accounts[i].address
                      await usdcWhaleSigner.transfer(userAddress, balanceForUser, {
                          gasLimit: 1000000,
                      })

                      await usdc
                          .connect(accounts[i])
                          .approve(takaturnDiamond, balanceForUser * 10 ** 6)
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
                          .approve(takaturnDiamond, balanceForUser * 10 ** 6)
                  }
              }
          })

          describe("Withdraw funding", function () {
              it("Revert if the contract does not have enough USDC", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // Pay the contribution for the first cycle
                  for (let i = 0; i < totalParticipants; i++) {
                      if (i == 0) {
                          await expect(
                              takaturnDiamondParticipant_1
                                  .connect(accounts[i + 1])
                                  .payContribution(termId)
                          ).to.be.revertedWith("Beneficiary doesn't pay")
                      } else {
                          await takaturnDiamondParticipant_1
                              .connect(accounts[i + 1])
                              .payContribution(termId)
                      }
                  }

                  await advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)

                  await takaturnDiamond.startNewCycle(termId)

                  await takaturnDiamondDeployer.testInsufficientBalance(termId)

                  await expect(
                      takaturnDiamondParticipant_1.withdrawFund(termId)
                  ).to.be.revertedWithCustomError(takaturnDiamond, "InsufficientBalance")
              })
          })

          describe("isBeneficiary function", function () {
              it("Check the isBeneficiary return vale", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  let isBeneficiary = await takaturnDiamondDeployer.isBeneficiary(
                      termId,
                      participant_1.address
                  )
                  assert.equal(isBeneficiary, false, "The participant is not a beneficiary")

                  // Pay the contribution for the first cycle
                  for (let i = 0; i < totalParticipants; i++) {
                      if (i == 0) {
                          await expect(
                              takaturnDiamondParticipant_1
                                  .connect(accounts[i + 1])
                                  .payContribution(termId)
                          ).to.be.revertedWith("Beneficiary doesn't pay")
                      } else {
                          await takaturnDiamondParticipant_1
                              .connect(accounts[i + 1])
                              .payContribution(termId)
                      }
                  }

                  await advanceTime(cycleTime + 1)

                  await takaturnDiamond.closeFundingPeriod(termId)

                  await takaturnDiamond.startNewCycle(termId)

                  isBeneficiary = await takaturnDiamondDeployer.isBeneficiary(
                      termId,
                      participant_1.address
                  )
                  assert.equal(isBeneficiary, true, "The participant is a beneficiary")
              })
          })

          describe("payContributionOnBehalfOf function", function () {
              it("Check the payContributionOnBehalfOf functionality", async function () {
                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  await expect(
                      takaturnDiamondParticipant_1
                          .connect(participant_1)
                          .payContributionOnBehalfOf(termId, participant_2.address)
                  ).not.to.be.reverted
              })
          })
      })
