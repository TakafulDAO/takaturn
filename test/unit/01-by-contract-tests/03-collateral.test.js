const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")
const { constants } = require("@openzeppelin/test-helpers")
const {
    CollateralStates,
    FundStates,
    getCollateralStateFromIndex,
    getFundStateFromIndex,
} = require("../../../utils/_helpers")
const { BigNumber } = require("ethers")
const { hour, erc20Units, day } = require("../../../utils/units")
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

          describe("Collateral tests", function () {
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
                  const currentStage = collateral[1]

                  assert.equal(currentStage, 3) //closed stage
              })

              it("prevents re-enterency to collateral", async () => {
                  const term = await takaturnDiamondDeployer.getTermsId()
                  const termId = term[0]
                  await takaturnDiamond
                      .connect(participant_2)
                      .joinTerm(termId, { value: fixedCollateralEth })

                  try {
                      await depositCollateral(termId, participant_2)
                      assert(false)
                  } catch (err) {
                      assert(err)
                  }
              })

              xit("switchs to CycleOngoing state when members are complete", async () => {
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

                  try {
                      awa
                      await takaturnDiamond
                          .connect(participant_5)
                          .joinTerm(termId, { value: fixedCollateralEth })
                      assert(false)
                  } catch (err) {
                      assert(err)
                  }
                  await takaturnDiamondParticipant_1.setStateOwner(termId, "2")
                  let collateral = await takaturnDiamondDeployer.getCollateralSummary(termId)

                  collateral = await takaturnDiamondDeployer.getCollateralSummary(termId)
                  const currentStage = collateral[1]
                  assert.equal(currentStage, 1) //cycle ongoing stage
              })
          })

          xdescribe("Collaterals & Fund Integration", () => {
              before(async () => {
                  //run once only
                  //4 users, 2 day cycle, 10$ contribution per cycle, 2 hour funding period, 60$ collateral
                  // await factory.methods
                  //     .createCollateral(
                  //         "4",
                  //         "172800",
                  //         "10",
                  //         "7200",
                  //         "60",
                  //         web3.utils.toWei("0.055", "ether"),
                  //         "0x07865c6E87B9F70255377e024ace6630C1Eaa37F",
                  //         "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e"
                  //     )
                  //     .send({
                  //         from: accounts[0],
                  //         gas: "10000000",
                  //     })
                  // const addresses = await factory.methods.getDeployedCollaterals().call()
                  // collateralAddress = addresses[1] //second collateral contract
                  // collateral = await new web3.eth.Contract(compiledCollateral.abi, collateralAddress)
                  // await depositCollateral(accounts[5], "0.055")
                  // await depositCollateral(accounts[6], "0.055")
                  // await depositCollateral(accounts[7], "0.055")
                  // await depositCollateral(accounts[8], "0.055")
                  // await collateral.methods.initiateFundContract().send({
                  //     from: accounts[0],
                  // })
                  // let newFundAddress = await collateral.methods.fundContract().call()
                  // fund = await new web3.eth.Contract(compiledFund.abi, newFundAddress)
                  // // web3.eth.defaultAccount = accounts[0];
                  // // web3.eth.personal.unlockAccount(web3.eth.defaultAccount);
                  // USDcInstance = new web3.eth.Contract(ERC20abi, USDC_ADDRESS)
              })

              xit("Changes USDC user balance for participants", async () => {
                  // const locallyManipulatedBalance = 100000000 //100$
                  // let userAddress
                  // let balance
                  // for (let i = 5; i < 9; i++) {
                  //     userAddress = accounts[i]
                  //     // Get storage slot index
                  //     const index = web3.utils.soliditySha3(
                  //         { type: "uint256", value: userAddress },
                  //         { type: "uint256", value: USDC_SLOT }
                  //     )
                  //     // Manipulate local balance (needs to be bytes32 string)
                  //     await hre.network.provider.send(
                  //         //is there a web3 eq?
                  //         "hardhat_setStorageAt",
                  //         [
                  //             USDC_ADDRESS, //USDcInstance.options.address
                  //             index, //.toString(),
                  //             web3.utils.toHex(web3.utils.padLeft(locallyManipulatedBalance, 64)),
                  //         ]
                  //     )
                  //     // check that the user balance is equal to the expected value
                  //     balance = await USDcInstance.methods.balanceOf(userAddress).call()
                  //     assert.equal(balance, locallyManipulatedBalance.toString())
                  // }
              })

              xit("deploys a Fund instance & creates the USDc JS interface", () => {
                  // assert.ok(fund.options.address)
                  // assert.ok(USDcInstance.options.address)
              })

              xit("deploys a Fund instance with correct parameters", async () => {
                  // let colateralValue = await fund.methods.collateral().call()
                  // assert.equal(colateralValue, collateral.options.address)
                  // let fundValue = await fund.methods.totalParticipants().call()
                  // colateralValue = await collateral.methods.totalParticipants().call()
                  // assert.equal(fundValue, colateralValue)
                  // //check for other variables here
              })

              xit("starts a cycle after fund deployment and sets state to AcceptingContributions", async () => {
                  // currentCycle = await fund.methods.currentCycle().call()
                  // assert.equal(currentCycle, 1) //must be the first cycle.
                  // currentState = await fund.methods.currentState().call()
                  // assert.equal(currentState, 1) //AcceptingContributions
              })

              xit("accepts participants contributions", async () => {
                  // //Fund Unit Test
                  // for (let i = 5; i < 9; i++) {
                  //     await USDcInstance.methods.approve(fund.options.address, contributionToPay).send({
                  //         //approve 10$
                  //         from: accounts[i],
                  //         gas: "10000000",
                  //     })
                  //     await depositContribution(accounts[i]) //deposit 10$
                  //     const isPaid = await fund.methods.paidThisCycle(accounts[i]).call()
                  //     assert.equal(isPaid, true)
                  // }
              })

              xit("does not accept contribution from non-participants", async () => {
                  //Fund unit Test
                  // await USDcInstance.methods.approve(fund.options.address, contributionToPay).send({
                  //     from: accounts[9],
                  //     gas: "10000000",
                  // })
                  // try {
                  //     await depositContribution(accounts[9])
                  //     assert(false)
                  // } catch (err) {
                  //     assert(err)
                  // }
              })

              xit("does not allow starting a new cycle before the funding period ends", async () => {
                  // //Fund unit Test
                  // try {
                  //     await fund.methods.startNewCycle().send({
                  //         from: accounts[0], //TODO: FIX ONWER OF FUND
                  //     })
                  //     assert(false)
                  // } catch (err) {
                  //     assert(err)
                  // }
              })

              xit("does not close a funding period before the deadline", async () => {
                  // //Fund unit test
                  // try {
                  //     await fund.methods.closeFundingPeriod().send({
                  //         from: accounts[0], //TODO: FIX ONWER OF FUND
                  //     })
                  //     assert(false)
                  // } catch (err) {
                  //     assert(err)
                  // }
              })

              xit("closes a funding period after the deadline", async () => {
                  // //Fund unit test
                  // let hours = 2.5 * 3600 + 60 //2.5 hours
                  // await network.provider.send("evm_increaseTime", [hours])
                  // await network.provider.send("evm_mine")
                  // await fund.methods.closeFundingPeriod().send({
                  //     from: accounts[0], //TODO: FIX ONWER OF FUND
                  // })
                  // currentState = await fund.methods.currentState().call()
                  // assert.equal(currentState, 3) //cycle ongoing. It feels like selecting ben is an internal state becaseu i cannot check for it
              })

              xit("selects a beneficiary correctly", async () => {
                  // let count = 0
                  // let bool = false
                  // for (let i = 5; i < 9; i++) {
                  //     bool = await fund.methods.isBeneficiary(accounts[i]).call()
                  //     if (bool) {
                  //         count++
                  //         lastSelectedBen = accounts[i]
                  //     }
                  // }
                  // assert.equal(count, 1)
                  // let balance = await fund.methods.beneficiariesPool(lastSelectedBen).call()
                  // assert(balance >= 40) //atleast 40$
              })

              xit("allows the selected beneficiary to withdraw the contribution", async () => {
                  const collateral = await takaturnDiamondDeployer.getCollateralSummary(termId)
                  const currentStage = collateral[1]
              })

              xit("does not allow non-selected participants to withdraw the contribution", async () => {
                  // try {
                  //     await fund.methods.claimFund().send({
                  //         from: accounts[6], //I know that account 5 is the selected account
                  //     })
                  //     assert(false)
                  // } catch (err) {
                  //     assert(err)
                  // }
              })

              xit("only starts a new cycle after cycle duration has passed", async () => {
                  //Fund unit Test
                  // let days = 48.5 * 3600 //> 2 day
                  // await network.provider.send("evm_increaseTime", [days])
                  // await network.provider.send("evm_mine")
                  // await fund.methods.startNewCycle().send({
                  //     from: accounts[0], //TODO: FIX ONWER OF FUND
                  // })
                  // currentCycle = await fund.methods.currentCycle().call()
                  // assert(currentCycle, 2)
              })
          })
      })
