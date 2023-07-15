const { assert, expect } = require("chai")
const { developmentChains, isDevnet, isFork, networkConfig } = require("../../../utils/_networks")
const { network, ethers } = require("hardhat")
const {
    FundStates,
    getFundStateFromIndex,
    advanceTime,
    advanceTimeByDate,
    impersonateAccount,
} = require("../../../utils/_helpers")
const { hour } = require("../../../utils/units")

const {
    totalParticipants,
    cycleTime,
    contributionAmount,
    contributionPeriod,
    fixedCollateralEth,
    collateralAmount,
    // USDC_SLOT,
    // locallyManipulatedBalance,
    balanceForUser,
} = require("./combined-utils")

let takaturnDiamond

async function everyonePaysAndCloseCycle(termId) {
    for (let i = 1; i <= totalParticipants; i++) {
        await takaturnDiamond.connect(accounts[i]).payContribution(termId)
        await expect(takaturnDiamond.connect(accounts[i]).withdrawFund(termId)).to.be.revertedWith(
            "Nothing to withdraw"
        )
    }

    // Artifically increase time to skip the wait
    await advanceTime(contributionPeriod + 1)
    await takaturnDiamondParticipant_1.closeFundingPeriod(termId)
}

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Takaturn Collateral & Fund Part 1", function () {
          const chainId = network.config.chainId

          let aggregator, usdc

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

          beforeEach(async function () {
              // Get the accounts
              accounts = await ethers.getSigners()

              // accounts used:
              // 0: deployer
              // 1 - 12: participants

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

              // Deploy contracts
              await deployments.fixture(["all"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")

              if (isDevnet && !isFork) {
                  aggregator = await ethers.getContract("MockV3Aggregator")
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
                      "contracts/mocks/USDC.sol:IERC20",
                      //"@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                      usdcAddress
                  )
              }
              // Connect the accounts
              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)
              takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1)

              participants = []
              // From account[1] to account[12]
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

              // Get the correct term id
              const ids = await takaturnDiamondDeployer.getTermsId()
              const termId = ids[0]

              //   const term = await takaturnDiamondDeployer.getTermSummary(termId)
              //   const entrance = term.fixedCollateralEth

              for (let i = 1; i <= totalParticipants; i++) {
                  //   await takaturnDiamond.connect(accounts[i]).joinTerm(termId, { value: entrance })
                  await takaturnDiamond
                      .connect(accounts[i])
                      .joinTerm(termId, { value: fixedCollateralEth })
              }

              await advanceTimeByDate(1, hour)

              await takaturnDiamondParticipant_1.startTerm(termId)

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
                      .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)
              }
          })

          it("changes USDC user balance for participants", async function () {
              let balance
              for (let i = 1; i <= totalParticipants; i++) {
                  balance = await usdc.balanceOf(accounts[i].address)
                  assert.equal(balance, balanceForUser.toString())
              }
          })

          it("enables participants to pay in USDC and the payments are succesful", async function () {
              const lastTerm = await takaturnDiamondDeployer.getTermsId()
              const termId = lastTerm[0]

              const term = await takaturnDiamondDeployer.getTermSummary(termId)
              const contributionAmount = term.contributionAmount

              await expect(takaturnDiamondDeployer.payContribution(termId)).to.be.revertedWith(
                  "Not a participant"
              )
              for (let i = 1; i <= totalParticipants; i++) {
                  let takaturnBalanceBefore = await usdc.balanceOf(takaturnDiamond.address)
                  let participantBalanceBefore = await usdc.balanceOf(accounts[i].address)

                  await expect(
                      takaturnDiamond.connect(accounts[i]).payContribution(termId)
                  ).to.emit(takaturnDiamond, "OnPaidContribution")

                  await expect(
                      takaturnDiamond.connect(accounts[i]).payContribution(termId)
                  ).to.be.revertedWith("Already paid for cycle")

                  let takaturnBalanceAfter = await usdc.balanceOf(takaturnDiamond.address)
                  let participantBalanceAfter = await usdc.balanceOf(accounts[i].address)

                  let depositorSummary = await takaturnDiamondDeployer.getDepositorFundSummary(
                      accounts[i].address,
                      termId
                  )

                  assert.equal(depositorSummary[2], true)
                  assert(takaturnBalanceAfter.toNumber() > takaturnBalanceBefore.toNumber())
                  assert(participantBalanceBefore.toNumber() > participantBalanceAfter.toNumber())
                  assert.equal(takaturnBalanceAfter - takaturnBalanceBefore, contributionAmount)
                  assert.equal(
                      participantBalanceBefore - participantBalanceAfter,
                      contributionAmount
                  )
              }
          })

          it("can close the funding period after the given time", async function () {
              const lastTerm = await takaturnDiamondDeployer.getTermsId()
              const termId = lastTerm[0]

              for (let i = 1; i <= totalParticipants; i++) {
                  await takaturnDiamond.connect(accounts[i]).payContribution(termId)
              }

              let fund = await takaturnDiamondDeployer.getFundSummary(termId)
              expect(getFundStateFromIndex(fund[1])).to.equal(FundStates.AcceptingContributions)

              await expect(takaturnDiamondDeployer.closeFundingPeriod(termId)).to.be.revertedWith(
                  "TermOwnable: caller is not the owner"
              )

              await expect(
                  takaturnDiamondParticipant_1.closeFundingPeriod(termId)
              ).to.be.revertedWith("Still time to contribute")

              // Artifically increase time to skip the wait
              await advanceTime(contributionPeriod + 1)

              fund = await takaturnDiamondDeployer.getFundSummary(termId)
              expect(getFundStateFromIndex(fund[1])).to.equal(FundStates.AcceptingContributions)

              await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

              fund = await takaturnDiamondDeployer.getFundSummary(termId)
              expect(getFundStateFromIndex(fund[1])).to.equal(FundStates.FundClosed)
          })

          it("can have participants autopay at the end of the funding period", async function () {
              const lastTerm = await takaturnDiamondDeployer.getTermsId()
              const termId = lastTerm[0]

              for (let i = 1; i <= totalParticipants; i++) {
                  await takaturnDiamond.connect(accounts[i]).toggleAutoPay(termId)
              }

              // Artifically increase time to skip the wait
              await advanceTime(contributionPeriod + 1)

              await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

              for (let i = 1; i <= totalParticipants; i++) {
                  const participantSummary = await takaturnDiamondDeployer.getDepositorFundSummary(
                      accounts[i].address,
                      termId
                  )
                  assert.equal(participantSummary[2], true)
              }
          })

          // This happens in the 1st cycle
          it("rewards beneficiaries based on a first come first served basis", async function () {
              const lastTerm = await takaturnDiamondDeployer.getTermsId()
              const termId = lastTerm[0]

              await everyonePaysAndCloseCycle(termId)

              const fund = await takaturnDiamondDeployer.getFundSummary(termId)
              let supposedBeneficiary = fund[4][0]
              let actualBeneficiary = fund[7]

              assert.ok(supposedBeneficiary == actualBeneficiary)
          })

          // This happens in the 1st cycle
          it("allows the beneficiary to claim the fund", async function () {
              const lastTerm = await takaturnDiamondDeployer.getTermsId()
              const termId = lastTerm[0]

              await expect(takaturnDiamondParticipant_1.withdrawFund(termId)).to.be.revertedWith(
                  "You must pay your cycle before withdrawing"
              )

              await everyonePaysAndCloseCycle(termId)
              await expect(takaturnDiamondParticipant_1.withdrawFund(termId)).to.emit(
                  takaturnDiamond,
                  "OnFundWithdrawn"
              )
          })

          // This happens in the 1st cycle
          it("allows the beneficiary to claim the collateral from defaulters", async function () {
              const lastTerm = await takaturnDiamondDeployer.getTermsId()
              const termId = lastTerm[0]

              // Everyone pays but last 2 participants
              for (let i = 1; i <= totalParticipants - 2; i++) {
                  await takaturnDiamond.connect(accounts[i]).payContribution(termId)
              }

              // Artifically increase time to skip the wait
              await advanceTime(contributionPeriod + 1)
              await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

              currentBalance = await ethers.provider.getBalance(participant_1.address)

              await takaturnDiamondParticipant_1.withdrawFund(termId)

              newBalance = await ethers.provider.getBalance(participant_1.address)

              assert.ok(newBalance > currentBalance)
          })

          it.only("does not move the order of beneficiaries of previous cycles if they default in future cycles", async function () {
              this.timeout(200000)

              const lastTerm = await takaturnDiamondDeployer.getTermsId()
              const termId = lastTerm[0]

              await everyonePaysAndCloseCycle(termId)
              await advanceTime(cycleTime + 1)

              //   await fund.methods.startNewCycle().send({
              //       from: accounts[12],
              //   })
              //   let firstBeneficiary = await fund.methods.beneficiariesOrder(0).call()
              //   await executeCycle(1, [0])
              //   let firstBeneficiaryAfterDefault = await fund.methods.beneficiariesOrder(0).call()
              //   assert.ok(firstBeneficiary == firstBeneficiaryAfterDefault)
          })

          // This happens in the 1st cycle
          xit("moves the order of beneficiaries if the supposed beneficiary of this cycle defaults", async function () {
              this.timeout(200000)
              let supposedBeneficiary = await fund.methods.beneficiariesOrder(0).call()

              // Everyone pays but the first participant, which should be the first beneficiary
              for (let i = 1; i < totalParticipants; i++) {
                  await usdc.methods
                      .approve(fund.options.address, contributionAmount * 10 ** 6)
                      .send({ from: accounts[i] })
                  await fund.methods.payContribution().send({ from: accounts[i] })
              }
              // Artifically increase time to skip the wait
              await network.provider.send("evm_increaseTime", [contributionPeriod + 1])
              await network.provider.send("evm_mine")
              await fund.methods.closeFundingPeriod().send({
                  from: accounts[12],
              })

              let supposedBeneficiaryAfterDefault = await fund.methods.beneficiariesOrder(0).call()
              let supposedBeneficiaryNewPosition = await fund.methods.beneficiariesOrder(1).call()
              assert.ok(supposedBeneficiary != supposedBeneficiaryAfterDefault)
              assert.ok(supposedBeneficiary == supposedBeneficiaryNewPosition)
          })

          // This happens in the 1st cycle
          xit("moves multiple defaulters in a row to after the first elligible beneficiary", async function () {
              this.timeout(200000)
              let supposedBeneficiaryOrder = [
                  accounts[3],
                  accounts[0],
                  accounts[1],
                  accounts[2],
                  accounts[4],
              ]

              // Everyone pays but the first participant, which should be the first beneficiary
              for (let i = 3; i < totalParticipants; i++) {
                  await usdc.methods
                      .approve(fund.options.address, contributionAmount * 10 ** 6)
                      .send({ from: accounts[i] })
                  await fund.methods.payContribution().send({ from: accounts[i] })
              }
              // Artifically increase time to skip the wait
              await network.provider.send("evm_increaseTime", [contributionPeriod + 1])
              await network.provider.send("evm_mine")
              await fund.methods.closeFundingPeriod().send({
                  from: accounts[12],
              })

              for (let i = 0; i < supposedBeneficiaryOrder.length; i++) {
                  assert.ok(
                      supposedBeneficiaryOrder[i] ==
                          (await fund.methods.beneficiariesOrder(i).call())
                  )
              }

              // Check if the moved order is actually applied as well
              assert.ok(accounts[3] == (await fund.methods.lastBeneficiary().call()))
          })

          // This happens in the 1st cycle
          xit("does not permit a graced defaulter to withdraw their fund in the current cycle", async function () {
              this.timeout(200000)
              let supposedBeneficiary = await fund.methods.beneficiariesOrder(0).call()

              // Everyone pays but the first participant, which should be the first beneficiary
              for (let i = 1; i < totalParticipants; i++) {
                  await usdc.methods
                      .approve(fund.options.address, contributionAmount * 10 ** 6)
                      .send({ from: accounts[i] })
                  await fund.methods.payContribution().send({ from: accounts[i] })
              }
              // Artifically increase time to skip the wait
              await network.provider.send("evm_increaseTime", [contributionPeriod + 1])
              await network.provider.send("evm_mine")
              await fund.methods.closeFundingPeriod().send({
                  from: accounts[12],
              })

              let supposedBeneficiaryAfterDefault = await fund.methods.beneficiariesOrder(0).call()
              let supposedBeneficiaryNewPosition = await fund.methods.beneficiariesOrder(1).call()
              assert.ok(supposedBeneficiary != supposedBeneficiaryAfterDefault)
              assert.ok(supposedBeneficiary == supposedBeneficiaryNewPosition)
          })

          xit("simulates a whole fund cycle and allows everyone to withdraw after the fund is closed", async function () {
              this.timeout(200000)

              await everyonePaysAndCloseCycle()
              await network.provider.send("evm_increaseTime", [cycleTime + 1])
              await network.provider.send("evm_mine")
              await fund.methods.startNewCycle().send({
                  from: accounts[12],
              })

              await executeCycle(1)
              await executeCycle(6)

              await executeCycle(1)
              await executeCycle(6)

              await executeCycle(5)
              await executeCycle(3)

              await executeCycle(2)
              await executeCycle(6)

              await executeCycle(6)
              await executeCycle(8)

              await executeCycle(6)

              for (let i = 0; i < totalParticipants; i++) {
                  try {
                      await fund.methods.withdrawFund().send({
                          from: accounts[i],
                      })
                      //console.log("Fund claimed by: " + accounts[i]);
                  } catch (e) {}
              }

              assert.ok((await usdc.methods.balanceOf(fund.options.address).call()) == 0)
          })

          xit("makes sure the fund is closed correctly", async function () {
              this.timeout(200000)

              await everyonePaysAndCloseCycle()
              await network.provider.send("evm_increaseTime", [cycleTime + 1])
              await network.provider.send("evm_mine")
              await fund.methods.startNewCycle().send({
                  from: accounts[12],
              })

              // Close remaining cycles
              while (parseInt(await fund.methods.currentState().call()) < 4) {
                  await executeCycle()
              }

              let fundClosed = (await fund.methods.currentState().call()) == 4
              assert.ok(fundClosed)
          })

          xit("allows owner to withdraw any unclaimed funds after 180 days, but not earlier", async function () {
              this.timeout(200000)

              await everyonePaysAndCloseCycle()
              await network.provider.send("evm_increaseTime", [cycleTime + 1])
              await network.provider.send("evm_mine")
              await fund.methods.startNewCycle().send({
                  from: accounts[12],
              })

              let balance = 0
              // Attempt to withdraw while cycles are ongoing, this should fail
              try {
                  fund.methods.emptyFundAfterEnd().send({
                      from: accounts[12],
                  })
              } catch (e) {}

              balance = await usdc.methods.balanceOf(fund.options.address).call()
              assert.ok(balance > 0)

              // Close remaining cycles
              while (parseInt(await fund.methods.currentState().call()) < 4) {
                  await executeCycle(0, [], false)
              }

              // Make sure fund is closed
              let fundClosed = (await fund.methods.currentState().call()) == 4
              assert.ok(fundClosed)

              // Attempt to withdraw after last cycle, this should fail
              try {
                  fund.methods.emptyFundAfterEnd().send({
                      from: accounts[12],
                  })
              } catch (e) {}

              balance = await usdc.methods.balanceOf(fund.options.address).call()
              assert.ok(balance > 0)

              // Artifically increase time to skip the long wait of 180 days
              await network.provider.send("evm_increaseTime", [180 * 24 * 60 * 60 + 1])
              await network.provider.send("evm_mine")

              // Attempt to withdraw after 180 days
              try {
                  fund.methods.emptyFundAfterEnd().send({
                      from: accounts[12],
                  })
              } catch (e) {}

              balance = await usdc.methods.balanceOf(fund.options.address).call()
              assert.ok(balance == 0)
          })

          // This happens in the 1st cycle
          xit("returns remaining cycle time properly", async function () {
              this.timeout(200000)

              let fundStart = await fund.methods.fundStart().call()
              let currentRemainingCycleTime = await fund.methods.getRemainingCycleTime().call()
              let currentCycle = await fund.methods.currentCycle().call()
              console.log("current remaning cycle time:", currentRemainingCycleTime)
              console.log(cycleTime * currentCycle + fundStart)

              assert.ok(cycleTime == currentRemainingCycleTime)
              // Artifically increase time to skip the wait
              await network.provider.send("evm_increaseTime", [contributionPeriod + 1])
              await network.provider.send("evm_mine")

              let newRemainingCycleTime = await fund.methods.getRemainingCycleTime().call()
              console.log("new remaning cycle time:", newRemainingCycleTime)
              assert.ok(currentRemainingCycleTime - newRemainingCycleTime == contributionPeriod + 1)

              assert.ok(cycleTime * currentCycle + fundStart - currentRemainingCycleTime > 0)
              // Artifically increase time to skip the wait
              await network.provider.send("evm_increaseTime", [cycleTime + 1])
              await network.provider.send("evm_mine")

              newRemainingCycleTime = await fund.methods.getRemainingCycleTime().call()

              assert.ok(newRemainingCycleTime == 0)
          })

          // This happens in the 1st cycle
          xit("returns remaining contribution time properly", async function () {
              this.timeout(200000)

              let fundStart = await fund.methods.fundStart().call()
              let currentCycle = await fund.methods.currentCycle().call()
              let contributionEndTimestamp = parseInt(
                  cycleTime * (currentCycle - 1) + fundStart + contributionPeriod
              )
              let currentRemainingContributionTime = await fund.methods
                  .getRemainingContributionTime()
                  .call()
              //console.log("fundStart", fundStart);
              //console.log("contribution end timestamp", contributionEndTimestamp);
              //console.log("current remaning contribution time:", currentRemainingContributionTime);
              //console.log("answer", fundStart + currentRemainingContributionTime);
              assert.ok(fundStart + currentRemainingContributionTime == contributionEndTimestamp)

              // Artifically increase time to skip the wait
              await network.provider.send("evm_increaseTime", [contributionPeriod * 0.5])
              await network.provider.send("evm_mine")

              let newRemainingContributionTime = await fund.methods
                  .getRemainingContributionTime()
                  .call()
              //console.log("new remaning contribution time:", newRemainingContributionTime);
              assert.ok(newRemainingContributionTime == contributionPeriod * 0.5)

              // Artifically increase time to skip the wait
              await network.provider.send("evm_increaseTime", [contributionPeriod])
              await network.provider.send("evm_mine")

              newRemainingContributionTime = await fund.methods
                  .getRemainingContributionTime()
                  .call()
              //console.log("new remaning contribution time:", newRemainingContributionTime);
              assert.ok(newRemainingContributionTime == 0)
          })
      })
