const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")
const {
    CollateralStates,
    getCollateralStateFromIndex,
    impersonateAccount,
} = require("../../../utils/_helpers")
const { hour, day, minute } = require("../../../utils/units")
const { advanceTimeByDate } = require("../../../utils/_helpers")

let takaturnDiamond

const withdrawCollateral = async (termId, address) => {
    await takaturnDiamond.connect(address).withdrawCollateral(termId)
}

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Takaturn Diamond unit tests", function () {
          const chainId = network.config.chainId

          const totalParticipants = "4"
          const cycleTime = 2 * day
          const contributionAmount = "10"
          const contributionPeriod = 2 * hour
          const collateralAmount = "60"
          const fixedCollateralEth = ethers.utils.parseEther("0.055")

          let accounts
          let contributionToPay = 10000000 //10$

          let deployer, participant_1, participant_2, participant_3, participant_4

          let takaturnDiamondDeployer, takaturnDiamondParticipant_1

          beforeEach(async () => {
              // Get the accounts
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              participant_1 = accounts[1]
              participant_2 = accounts[2]
              participant_3 = accounts[3]
              participant_4 = accounts[4]

              // Deploy contracts
              await deployments.fixture(["all"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")
              //   usdc = await ethers.getContract("FiatTokenV2_1")
              if (isDevnet && !isFork) {
                  aggregator = await ethers.getContract("MockV3Aggregator")
              } else {
                  const aggregatorAddress = networkConfig[chainId]["ethUsdPriceFeed"]
                  const usdcAddress = networkConfig[chainId]["usdc"]
                  aggregator = await ethers.getContractAt(
                      "AggregatorV3Interface",
                      aggregatorAddress
                  )
                  usdc = await ethers.getContractAt(
                      // contracts/mocks/USDC.sol:IERC20
                      "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                      usdcAddress
                  )
              }
              // Connect the accounts
              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)
              takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1)

              participants = []

              for (let i = 1; i <= totalParticipants; i++) {
                  participants.push(accounts[i])
              }

              // Create a new term where participant_1 is the term owner
              // This create the term and collateral
              await takaturnDiamondParticipant_1.createTerm(
                  totalParticipants,
                  cycleTime,
                  contributionAmount,
                  contributionPeriod,
                  fixedCollateralEth,
                  collateralAmount,
                  usdc.address,
                  aggregator.address
              )
          })
          describe("Collateral tests", function () {
              it("allows users to deposit a collateral and accepts them as participants", async () => {
                  const term = await takaturnDiamondDeployer.getTermsId()
                  const termId = term[0]

                  await takaturnDiamond
                      .connect(participant_2)
                      .joinTerm(termId, { value: fixedCollateralEth })

                  const participantSummary =
                      await takaturnDiamondDeployer.getDepositorCollateralSummary(
                          participant_2.address,
                          termId
                      )

                  const isCollaterized = participantSummary[0]
                  const collateralBank = participantSummary[1]

                  assert(isCollaterized)
                  assert(collateralBank >= fixedCollateralEth)
              })

              it("checks if a user is under collaterized", async () => {
                  const term = await takaturnDiamondDeployer.getTermsId()
                  const termId = term[0]

                  await takaturnDiamond
                      .connect(participant_2)
                      .joinTerm(termId, { value: fixedCollateralEth })

                  const status = await takaturnDiamondDeployer.isUnderCollaterized(
                      termId,
                      participant_2.address
                  )

                  assert(!status)
              })

              it("allows users to withdraw collateral in ReleasingCollateral state only", async () => {
                  const term = await takaturnDiamondDeployer.getTermsId()
                  const termId = term[0]

                  await takaturnDiamond
                      .connect(participant_2)
                      .joinTerm(termId, { value: fixedCollateralEth })

                  try {
                      await withdrawCollateral(termId, participant_2)
                      assert(false)
                  } catch (err) {
                      assert(err)
                  }
                  await takaturnDiamond.connect(participant_1).setStateOwner(termId, "2")
                  await withdrawCollateral(termId, participant_2)

                  const participantSummary =
                      await takaturnDiamondDeployer.getDepositorCollateralSummary(
                          participant_2.address,
                          termId
                      )

                  const balance = participantSummary[1]

                  assert(balance == 0)
              })

              it("closes the Collateral once all users withdraw", async () => {
                  const term = await takaturnDiamondDeployer.getTermsId()
                  const termId = term[0]

                  await takaturnDiamond
                      .connect(participant_1)
                      .joinTerm(termId, { value: fixedCollateralEth })
                  await takaturnDiamond
                      .connect(participant_2)
                      .joinTerm(termId, { value: fixedCollateralEth })
                  await takaturnDiamond
                      .connect(participant_3)
                      .joinTerm(termId, { value: fixedCollateralEth })
                  await takaturnDiamond
                      .connect(participant_4)
                      .joinTerm(termId, { value: fixedCollateralEth })

                  await takaturnDiamondParticipant_1.setStateOwner(termId, "2")

                  await withdrawCollateral(termId, participant_1)
                  await withdrawCollateral(termId, participant_2)
                  await withdrawCollateral(termId, participant_3)
                  await withdrawCollateral(termId, participant_4)

                  const collateral = await takaturnDiamondDeployer.getCollateralSummary(termId)
                  expect(getCollateralStateFromIndex(collateral[1])).to.equal(
                      CollateralStates.Closed
                  )
              })
          })

          describe("Collaterals & Fund Integration", () => {
              beforeEach(async () => {
                  const termId = await takaturnDiamondDeployer.getTermsId()
                  const lastTermId = termId[0]

                  const term = await takaturnDiamondDeployer.getTermSummary(lastTermId)
                  const entrance = term.fixedCollateralEth

                  for (let i = 1; i <= totalParticipants; i++) {
                      let depositor = accounts[i]

                      await takaturnDiamond
                          .connect(depositor)
                          .joinTerm(lastTermId, { value: entrance })
                  }

                  await takaturnDiamondParticipant_1.startTerm(lastTermId)

                  if (isFork) {
                      const usdcWhale = networkConfig[chainId]["usdcWhale"]
                      await impersonateAccount(usdcWhale)
                      const whale = await ethers.getSigner(usdcWhale)
                      usdcWhaleSigner = usdc.connect(whale)

                      let userAddress
                      for (let i = 1; i <= totalParticipants; i++) {
                          userAddress = accounts[i].address
                          await usdcWhaleSigner.transfer(userAddress, contributionAmount)

                          await usdc
                              .connect(accounts[i])
                              .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)
                      }
                  }
              })

              it("does not close a funding period before the deadline", async () => {
                  //Fund unit test
                  const term = await takaturnDiamondDeployer.getTermsId()
                  const termId = term[0]
                  await expect(
                      takaturnDiamondDeployer.closeFundingPeriod(termId)
                  ).to.be.revertedWith("TermOwnable: caller is not the owner")
                  await expect(
                      takaturnDiamondParticipant_1.closeFundingPeriod(termId)
                  ).to.be.revertedWith("Still time to contribute")
              })

              it("closes a funding period after the deadline", async () => {
                  //Fund unit test
                  const term = await takaturnDiamondDeployer.getTermsId()
                  const termId = term[0]
                  await advanceTimeByDate(150, minute)
                  await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                  const collateral = await takaturnDiamondDeployer.getCollateralSummary(termId)
                  expect(getCollateralStateFromIndex(collateral[1])).to.equal(
                      CollateralStates.ReleasingCollateral
                  )
                  // todo: Why on legacy test check that cycle is ongoing?
                  // currentState = await fund.methods.currentState().call()
                  // assert.equal(currentState, 3) //cycle ongoing. It feels like selecting ben is an internal state becaseu i cannot check for it
              })

              it("selects a beneficiary correctly", async () => {
                  const term = await takaturnDiamondDeployer.getTermsId()
                  const termId = term[0]
                  for (let i = 1; i <= totalParticipants; i++) {
                      await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                  }
                  await advanceTimeByDate(150, minute)
                  await takaturnDiamondParticipant_1.closeFundingPeriod(termId)
                  let count = 0
                  let bool = false
                  for (let i = 1; i <= totalParticipants; i++) {
                      let depositorSummary =
                          await takaturnDiamondDeployer.getParticipantFundSummary(
                              accounts[i].address,
                              termId
                          )
                      bool = depositorSummary[1]
                      if (bool) {
                          count++
                          lastSelectedBen = accounts[i]
                      }
                  }
                  assert.equal(count, 1)
                  let beneficiarySummary = await takaturnDiamondDeployer.getParticipantFundSummary(
                      lastSelectedBen.address,
                      termId
                  )
                  let balance = beneficiarySummary[4]
                  assert(balance >= 40) //atleast 40$
              })
          })
      })
