const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")
const {
    advanceTime,
    impersonateAccount,
    getCollateralStateFromIndex,
    CollateralStates,
} = require("../../../utils/_helpers")
const { BigNumber } = require("ethers")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Getters facet tests", function () {
          const chainId = network.config.chainId

          const totalParticipants = BigNumber.from("4") // Create term param
          const cycleTime = BigNumber.from("180") // Create term param
          const contributionAmount = BigNumber.from("10") // Create term param
          const contributionPeriod = BigNumber.from("120") // Create term param
          const registrationPeriod = BigNumber.from("120") // Create term param

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
              participant_4 = accounts[4]
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
              takaturnDiamondParticipant_4 = takaturnDiamond.connect(participant_4)

              // Create three terms
              for (let i = 0; i < 3; i++) {
                  await takaturnDiamondParticipant_1.createTerm(
                      totalParticipants,
                      registrationPeriod,
                      cycleTime,
                      contributionAmount,
                      contributionPeriod,
                      usdc.address
                  )
              }

              const lastTerm = await takaturnDiamondDeployer.getTermsId()
              const termId = lastTerm[0]
              for (let i = 1; i <= totalParticipants; i++) {
                  // Get the collateral payment deposit
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                      termId,
                      i - 1
                  )
                  // Each participant joins the term
                  await takaturnDiamond.connect(accounts[i]).joinTerm(1, false, { value: entrance })
                  await takaturnDiamond.connect(accounts[i]).joinTerm(2, false, { value: entrance })
              }

              await advanceTime(registrationPeriod.toNumber() + 1)
              await takaturnDiamond.startTerm(1)
              await takaturnDiamond.startTerm(2)

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
              }
          })

          describe("Allowance", function () {
              it("Calculate the correct allowance", async function () {
                  const neededAllowanceAtBeginning =
                      await takaturnDiamondDeployer.getNeededAllowance(participant_1.address)
                  const expectedAllowanceAtBeginning =
                      contributionAmount * totalParticipants * 2 * 10 ** 6

                  await advanceTime(cycleTime.toNumber() + 1)
                  await takaturnDiamond.closeFundingPeriod(1)
                  await takaturnDiamond.startNewCycle(1)

                  const neededNewAllowance = await takaturnDiamondDeployer.getNeededAllowance(
                      participant_1.address
                  )
                  const expectedNewAllowance =
                      expectedAllowanceAtBeginning - contributionAmount * 10 ** 6

                  assert.equal(
                      neededAllowanceAtBeginning.toString(),
                      expectedAllowanceAtBeginning.toString()
                  )
                  assert(neededNewAllowance.toString() < neededAllowanceAtBeginning.toString())
                  assert.equal(neededNewAllowance.toString(), expectedNewAllowance.toString())
              })
          })
          describe("Withdrawable amount", function () {
              it("There is no withdrawable amount when accepting collateral", async function () {
                  // The termId 0 is the first term and nobody has joined yet
                  const termId = 0

                  // Participant 1 joins the term
                  const entrance = await takaturnDiamond.minCollateralToDeposit(termId, 0)

                  await takaturnDiamondParticipant_1.joinTerm(0, false, { value: entrance })

                  const withdrawable =
                      await takaturnDiamondParticipant_1.getWithdrawableUserBalance(
                          termId,
                          participant_1.address
                      )

                  const collateral = await takaturnDiamondDeployer.getCollateralSummary(termId)

                  await expect(getCollateralStateFromIndex(collateral[1])).to.equal(
                      CollateralStates.AcceptingCollateral
                  )
                  assert.equal(collateral[4][0], participant_1.address) // The participant 1 is on the collateral depositors array

                  assert.equal(withdrawable.toString(), "0")
              })
              describe("When the collateral state is ReleasingCollateral", function () {
                  it("When the term expires, withdrawable should be equal to locked balance", async function () {
                      // The termId 0 is the first term and nobody has joined yet
                      const termId = 0

                      // Participant 1 joins the term
                      const entrance = await takaturnDiamond.minCollateralToDeposit(termId, 0)

                      await takaturnDiamondParticipant_1.joinTerm(0, false, { value: entrance })

                      await advanceTime(registrationPeriod.toNumber() + 1)

                      await takaturnDiamond.expireTerm(termId)

                      const withdrawable =
                          await takaturnDiamondParticipant_1.getWithdrawableUserBalance(
                              termId,
                              participant_1.address
                          )

                      const collateralParticipantSummary =
                          await takaturnDiamondParticipant_1.getDepositorCollateralSummary(
                              participant_1.address,
                              termId
                          )

                      const collateral = await takaturnDiamondDeployer.getCollateralSummary(termId)

                      assert.equal(
                          collateralParticipantSummary[1].toString(),
                          collateralParticipantSummary[3].toString()
                      ) // Collateral members bank and collateral deposited by user are the same
                      assert.equal(collateralParticipantSummary[2].toString(), "0") // Collateral payment bank is 0

                      await expect(getCollateralStateFromIndex(collateral[1])).to.equal(
                          CollateralStates.ReleasingCollateral
                      )

                      assert.equal(
                          withdrawable.toString(),
                          collateralParticipantSummary[1].toString()
                      )
                  })

                  it.only("When the term finish, withdrawable should be equal to locked balance", async function () {
                      // The termId 1 already started on the before each
                      const termId = 1

                      // First cycle
                      for (let i = 1; i <= totalParticipants; i++) {
                          try {
                              await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                          } catch (error) {}
                      }

                      advanceTime(cycleTime.toNumber() + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)
                      await takaturnDiamond.startNewCycle(termId)

                      // Second cycle
                      for (let i = 1; i <= totalParticipants; i++) {
                          try {
                              await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                          } catch (error) {}
                      }

                      advanceTime(cycleTime.toNumber() + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)
                      await takaturnDiamond.startNewCycle(termId)

                      // Third cycle
                      for (let i = 1; i <= totalParticipants; i++) {
                          try {
                              await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                          } catch (error) {}
                      }

                      advanceTime(cycleTime.toNumber() + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)
                      await takaturnDiamond.startNewCycle(termId)

                      // Fourth and last cycle
                      for (let i = 1; i <= totalParticipants; i++) {
                          try {
                              await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                          } catch (error) {}
                      }

                      advanceTime(cycleTime.toNumber() + 1)

                      await takaturnDiamond.closeFundingPeriod(termId)

                      const withdrawableParticipant_1 =
                          await takaturnDiamondParticipant_1.getWithdrawableUserBalance(
                              termId,
                              participant_1.address
                          )
                      const withdrawableParticipant_2 =
                          await takaturnDiamondParticipant_1.getWithdrawableUserBalance(
                              termId,
                              participant_1.address
                          )
                      const withdrawableParticipant_3 =
                          await takaturnDiamondParticipant_1.getWithdrawableUserBalance(
                              termId,
                              participant_1.address
                          )
                      const withdrawableParticipant_4 =
                          await takaturnDiamondParticipant_1.getWithdrawableUserBalance(
                              termId,
                              participant_1.address
                          )

                      const collateralParticipant_1_Summary =
                          await takaturnDiamondParticipant_1.getDepositorCollateralSummary(
                              participant_1.address,
                              termId
                          )
                      const collateralParticipant_2_Summary =
                          await takaturnDiamondParticipant_1.getDepositorCollateralSummary(
                              participant_1.address,
                              termId
                          )
                      const collateralParticipant_3_Summary =
                          await takaturnDiamondParticipant_1.getDepositorCollateralSummary(
                              participant_1.address,
                              termId
                          )
                      const collateralParticipant_4_Summary =
                          await takaturnDiamondParticipant_1.getDepositorCollateralSummary(
                              participant_1.address,
                              termId
                          )

                      const collateral = await takaturnDiamondDeployer.getCollateralSummary(termId)

                      await expect(getCollateralStateFromIndex(collateral[1])).to.equal(
                          CollateralStates.ReleasingCollateral
                      )

                      assert.equal(
                          withdrawableParticipant_1.toString(),
                          collateralParticipant_1_Summary[1].toString()
                      )
                      assert.equal(
                          withdrawableParticipant_2.toString(),
                          collateralParticipant_2_Summary[1].toString()
                      )
                      assert.equal(
                          withdrawableParticipant_3.toString(),
                          collateralParticipant_3_Summary[1].toString()
                      )
                      assert.equal(
                          withdrawableParticipant_4.toString(),
                          collateralParticipant_4_Summary[1].toString()
                      )
                  })
              })
          })
      })
