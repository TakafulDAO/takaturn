const { expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")
const { advanceTimeByDate, advanceTime, impersonateAccount } = require("../../../utils/_helpers")
const { hour } = require("../../../utils/units")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Unit Tests. Yield Facet", function () {
          const chainId = network.config.chainId

          const totalParticipants = 6 // Create term param
          const cycleTime = 180 // Create term param
          const contributionAmount = 100 // Create term param
          const contributionPeriod = 120 // Create term param
          const registrationPeriod = 120 // Create term param

          let takaturnDiamond

          let deployer,
              participant_1,
              participant_2,
              participant_3,
              participant_4,
              participant_5,
              participant_6,
              usdcOwner,
              usdcMasterMinter,
              usdcRegularMinter,
              usdcLostAndFound,
              usdcWhaleSigner

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
              usdcOwner = accounts[13]
              usdcMasterMinter = accounts[14]
              usdcRegularMinter = accounts[15]
              usdcLostAndFound = accounts[16]

              // Deploy contracts
              await deployments.fixture(["takaturn_upgrade"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")
              const newZaynZapAddress = "0x1534c33FF68cFF9E0c5BABEe5bE72bf4cad0826b"
              zaynZap = await ethers.getContractAt(
                  "contracts/interfaces/IZaynZapV2TakaDAO.sol:IZaynZapV2TakaDAO",
                  newZaynZapAddress
              )
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
              takaturnDiamondParticipant_4 = takaturnDiamond.connect(participant_4)
              takaturnDiamondParticipant_5 = takaturnDiamond.connect(participant_5)
              takaturnDiamondParticipant_6 = takaturnDiamond.connect(participant_6)

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
              zapOwner = "0xff0C52AfD43CeCA4c5E674f61fa93BE32647f185"

              await impersonateAccount(zapOwner)
              zapOwnerSigner = await ethers.getSigner(zapOwner)
              zaynZapOwner = zaynZap.connect(zapOwnerSigner)

              await deployer.sendTransaction({
                  to: zapOwner,
                  value: ethers.parseEther("1"),
              })

              await zaynZapOwner.toggleTrustedSender(takaturnDiamond, true, {
                  gasLimit: 1000000,
              })

              const termIds = await takaturnDiamond.getTermsId()
              const termId = termIds[0]
              // The participants join the term
              for (let i = 1; i <= totalParticipants; i++) {
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                      termId,
                      i - 1
                  )

                  await takaturnDiamond
                      .connect(accounts[i])
                      ["joinTerm(uint256,bool)"](termId, true, { value: entrance })
              }

              await advanceTime(registrationPeriod + 1)

              // First cycle
              await takaturnDiamond.startTerm(termId)

              for (let i = 1; i <= totalParticipants; i++) {
                  try {
                      await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                  } catch (e) {}
              }

              await advanceTime(cycleTime + 1)
              await takaturnDiamond.closeFundingPeriod(termId)

              // Second cycle
              await takaturnDiamond.startNewCycle(termId)

              for (let i = 1; i <= totalParticipants; i++) {
                  try {
                      await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                  } catch (e) {}
              }

              await advanceTime(cycleTime + 1)
              await takaturnDiamond.closeFundingPeriod(termId)

              // Third cycle
              await takaturnDiamond.startNewCycle(termId)

              for (let i = 1; i <= totalParticipants; i++) {
                  try {
                      await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                  } catch (e) {}
              }

              await advanceTime(cycleTime + 1)
              await takaturnDiamond.closeFundingPeriod(termId)

              // Fourth cycle
              await takaturnDiamond.startNewCycle(termId)

              for (let i = 1; i <= totalParticipants; i++) {
                  try {
                      await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                  } catch (e) {}
              }

              await advanceTime(cycleTime + 1)
              await takaturnDiamond.closeFundingPeriod(termId)

              // Fifth cycle
              await takaturnDiamond.startNewCycle(termId)

              for (let i = 1; i <= totalParticipants; i++) {
                  try {
                      await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                  } catch (e) {}
              }

              await advanceTime(cycleTime + 1)
              await takaturnDiamond.closeFundingPeriod(termId)

              // Sixth cycle
              await takaturnDiamond.startNewCycle(termId)
          })

          describe("rescueStuckYields", function () {
              it("Negative reimbursement", async function () {
                  const termIds = await takaturnDiamond.getTermsId()
                  const termId = termIds[0]

                  const terms = [termId, termId]
                  const originalWithdrawals = [20080321285140562n, 20080321285140562n]
                  const originalShares = [19580031070729878n, 19580031070729878n]
                  const users = [participant_1.address, participant_3.address]

                  // send 0.5 ether
                  const valueToSend = ethers.parseEther("0.5")

                  const reimburseTx = takaturnDiamond.rescueStuckYields(
                      terms,
                      originalWithdrawals,
                      originalShares,
                      users,
                      {
                          value: valueToSend,
                      }
                  )

                  await Promise.all([
                      expect(reimburseTx).to.emit(takaturnDiamond, "OnYieldCompensated"),
                      expect(reimburseTx).to.emit(takaturnDiamond, "OnYieldCompensated"),
                  ])
              })

              it("Positive reimbursement", async function () {
                  const termIds = await takaturnDiamond.getTermsId()
                  const termId = termIds[0]

                  const terms = [termId, termId]
                  const originalWithdrawals = [20080321285140562n, 20080321285140562n]
                  const originalShares = [19580031070729878n, 19580031070729878n]
                  const users = [participant_1.address, participant_3.address]

                  for (let i = 0; i < terms.length; i++) {
                      await takaturnDiamond.testHelper_positiveReimbursement(
                          originalWithdrawals[i],
                          originalShares[i],
                          terms[i]
                      )
                  }

                  // send 0.5 ether
                  const valueToSend = ethers.parseEther("0.5")

                  const reimburseTx = takaturnDiamond.rescueStuckYields(
                      terms,
                      originalWithdrawals,
                      originalShares,
                      users,
                      {
                          value: valueToSend,
                      }
                  )

                  await Promise.all([
                      expect(reimburseTx).to.emit(takaturnDiamond, "OnYieldReimbursed"),
                      expect(reimburseTx).to.emit(takaturnDiamond, "OnYieldReimbursed"),
                  ])
              })
          })

          describe("reimburseExtraYield", function () {
              it("nothing needed to reimburse", async function () {
                  const termIds = await takaturnDiamond.getTermsId()
                  const termId = termIds[0]

                  const terms = [termId]

                  // send 0.5 ether
                  const valueToSend = ethers.parseEther("0.5")

                  await expect(takaturnDiamond.reimburseExtraYield(terms, { value: valueToSend }))
                      .to.not.be.reverted
              })

              it("Small amounts", async function () {
                  const termIds = await takaturnDiamond.getTermsId()
                  const termId = termIds[0]

                  const terms = [termId]

                  // send 0.5 ether
                  const valueToSend = ethers.parseEther("0.5")

                  await takaturnDiamond.testHelper_reimburseExtraYieldSmallAmounts(termId)

                  await expect(
                      takaturnDiamond.reimburseExtraYield(terms, {
                          value: valueToSend,
                      })
                  ).to.not.be.reverted
              })

              it("Reimburse", async function () {
                  const termIds = await takaturnDiamond.getTermsId()
                  const termId = termIds[0]

                  const terms = [termId]

                  // send 0.5 ether
                  const valueToSend = ethers.parseEther("0.5")

                  await takaturnDiamond.testHelper_reimburseExtraYield(termId)

                  const reimburseTx = takaturnDiamond.reimburseExtraYield(terms, {
                      value: valueToSend,
                  })

                  await Promise.all([
                      expect(reimburseTx).to.emit(takaturnDiamond, "OnYieldCompensated"),
                      expect(reimburseTx).to.emit(takaturnDiamond, "OnYieldCompensated"),
                      expect(reimburseTx).to.emit(takaturnDiamond, "OnYieldCompensated"),
                      expect(reimburseTx).to.emit(takaturnDiamond, "OnYieldCompensated"),
                      expect(reimburseTx).to.emit(takaturnDiamond, "OnYieldCompensated"),
                      expect(reimburseTx).to.emit(takaturnDiamond, "OnYieldCompensated"),
                  ])
              })
          })

          describe("restoreYieldBalance", function () {
              it("No problems", async function () {
                  const termIds = await takaturnDiamond.getTermsId()
                  const termId = termIds[0]

                  // send 0.5 ether
                  const valueToSend = ethers.parseEther("0.5")

                  const terms = [termId]

                  await expect(takaturnDiamond.restoreYieldBalance(terms, { value: valueToSend }))
                      .to.not.be.reverted
              })
          })
      })
