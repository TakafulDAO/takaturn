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
const { hour, day } = require("../../../utils/units")

const {
    totalParticipants,
    cycleTime,
    contributionAmount,
    contributionPeriod,
    fixedCollateralEth,
    collateralAmount,
    balanceForUser,
    collateralFundingPeriod,
    getRandomInt,
} = require("./combined-utils")

let takaturnDiamond, usdc

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

async function executeCycle(
    termId,
    defaultersAmount = 0,
    specificDefaultersIndices = [],
    withdrawFund = true
) {
    let randomDefaulterIndices = specificDefaultersIndices

    let fund = await takaturnDiamond.getFundSummary(termId)

    let currentCycle = parseInt(fund[3])

    //let currentCycle = parseInt(await takaturnDiamond.currentCycle(termId))
    //console.log(`Current cycle is: ${currentCycle}`)

    while (defaultersAmount != randomDefaulterIndices.length) {
        if (defaultersAmount > totalParticipants) {
            //console.log("Too many defaulters specified!")
            break
        }
        let randomInt = getRandomInt(Math.floor(totalParticipants - 1))
        if (!randomDefaulterIndices.includes(randomInt)) {
            //console.log("Defaulting user..")
            randomDefaulterIndices.push(randomInt)
        }
    }

    // console.log(`Random Defaulter Indices: ${randomDefaulterIndices}`)

    let paidAmount = 0
    for (let i = 1; i <= totalParticipants; i++) {
        if (randomDefaulterIndices.includes(i)) {
            continue
        } else {
            try {
                await usdc
                    .connect(accounts[i])
                    .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)

                await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                paidAmount++
            } catch (e) {}
        }
    }

    // Artifically increase time to skip the wait
    await advanceTime(contributionPeriod + 1)

    await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

    fund = await takaturnDiamond.getFundSummary(termId)
    let state = fund[1]
    //console.log(`State is: ${getFundStateFromIndex(state)}`)
    expect(getFundStateFromIndex(fund[1])).not.to.equal(FundStates.AcceptingContributions)

    let fundClaimed = false
    let claimant
    let previousBalanceClaimant = 0
    let poolEmpty = 0
    if (withdrawFund) {
        for (let i = 1; i <= totalParticipants; i++) {
            try {
                claimant = accounts[i]
                previousBalanceClaimant = await usdc.balanceOf(claimant.address)
                await takaturnDiamond.connect(accounts[i]).withdrawFund(termId)
                fundClaimed = true
                break
            } catch (e) {}
        }
        depositorFundSummary = await takaturnDiamond.getParticipantFundSummary(
            claimant.address,
            termId
        )
        poolEmpty = depositorFundSummary[4]
    }

    let poolEmptyOk = poolEmpty == 0

    if (!fundClaimed) {
        assert.ok(true)
    } else {
        assert.ok(fundClaimed)
        assert.ok(poolEmptyOk)
    }

    // Artifically increase time to skip the wait
    await advanceTime(cycleTime + 1)

    //await makeExcelSheet();
    try {
        await takaturnDiamondParticipant_1.startNewCycle(termId)
    } catch (e) {}

    fund = await takaturnDiamond.getFundSummary(termId)

    let newCycle = parseInt(fund[3])

    // let newCycle = parseInt(await takaturnDiamond.currentCycle(termId))

    //console.log(`We enter to the new cycle. Cycle is: ${newCycle}`)

    let newCycleStarted = currentCycle + 1 == newCycle
    //console.log(`newCycleStarted: ${newCycleStarted}`)
    fund = await takaturnDiamond.getFundSummary(termId)
    state = fund[1]
    // console.log(`State is: ${getFundStateFromIndex(state)}`)

    let fundClosed = getFundStateFromIndex(state) == FundStates.FundClosed
    if (fundClosed) {
        assert.ok(true)
    } else {
        assert.ok(newCycleStarted)
    }
}

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Takaturn Collateral & Fund Tests", function () {
          const chainId = network.config.chainId

          let aggregator

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

              participants = []
              // From account[1] to account[12]
              for (let i = 1; i <= totalParticipants; i++) {
                  participants.push(accounts[i])
              }

              // Deploy contracts
              await deployments.fixture(["takaturn_deploy"])
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
                      //"contracts/version-1/mocks/USDC.sol:IERC20",
                      "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                      usdcAddress
                  )
              }
              // Connect the accounts
              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)
              takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1)

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
                          .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)
                  }
              }
          })

          describe("Combined Tests Part 1 & Part 2", function () {
              beforeEach(async function () {
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

                  for (let i = 1; i <= totalParticipants; i++) {
                      await takaturnDiamond
                          .connect(accounts[i])
                          .joinTerm(termId, { value: fixedCollateralEth })
                  }

                  await advanceTimeByDate(1, hour)

                  await takaturnDiamondParticipant_1.startTerm(termId)
              })
              describe("Combined Tests Part 1", function () {
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

                      await expect(
                          takaturnDiamondDeployer.payContribution(termId)
                      ).to.be.revertedWith("Not a participant")
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

                          let depositorSummary =
                              await takaturnDiamondDeployer.getParticipantFundSummary(
                                  accounts[i].address,
                                  termId
                              )

                          assert.equal(depositorSummary[2], true)
                          assert(takaturnBalanceAfter.toNumber() > takaturnBalanceBefore.toNumber())
                          assert(
                              participantBalanceBefore.toNumber() >
                                  participantBalanceAfter.toNumber()
                          )
                          assert.equal(
                              takaturnBalanceAfter - takaturnBalanceBefore,
                              contributionAmount * 10 ** 6
                          )
                          assert.equal(
                              participantBalanceBefore - participantBalanceAfter,
                              contributionAmount * 10 ** 6
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
                      expect(getFundStateFromIndex(fund[1])).to.equal(
                          FundStates.AcceptingContributions
                      )

                      await expect(
                          takaturnDiamondDeployer.closeFundingPeriod(termId)
                      ).to.be.revertedWith("TermOwnable: caller is not the owner")

                      await expect(
                          takaturnDiamondParticipant_1.closeFundingPeriod(termId)
                      ).to.be.revertedWith("Still time to contribute")

                      // Artifically increase time to skip the wait
                      await advanceTime(contributionPeriod + 1)

                      fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      expect(getFundStateFromIndex(fund[1])).to.equal(
                          FundStates.AcceptingContributions
                      )

                      await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                      fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      expect(getFundStateFromIndex(fund[1])).to.equal(FundStates.CycleOngoing)
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
                          const participantSummary =
                              await takaturnDiamondDeployer.getParticipantFundSummary(
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
                      let beneficiariesOrder = fund[4]
                      let supposedBeneficiary = beneficiariesOrder[0]
                      let actualBeneficiary = fund[7]

                      assert.ok(supposedBeneficiary == actualBeneficiary)
                  })

                  // This happens in the 1st cycle
                  it("allows the beneficiary to claim the fund", async function () {
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      await expect(
                          takaturnDiamondParticipant_1.withdrawFund(termId)
                      ).to.be.revertedWith("You must pay your cycle before withdrawing")

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

                  it("does not move the order of beneficiaries of previous cycles if they default in future cycles", async function () {
                      this.timeout(200000)

                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      await everyonePaysAndCloseCycle(termId)
                      await advanceTime(cycleTime + 1)

                      await expect(
                          takaturnDiamondDeployer.startNewCycle(termId)
                      ).to.be.revertedWith("TermOwnable: caller is not the owner")

                      await takaturnDiamondParticipant_1.startNewCycle(termId)

                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      let beneficiariesOrder = fund[4]
                      let firstBeneficiary = beneficiariesOrder[0]
                      await executeCycle(termId, 1, [1])
                      //   let firstBeneficiaryAfterDefault = await fund.methods.beneficiariesOrder(0).call()
                      fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      beneficiariesOrder = fund[4]
                      let firstBeneficiaryAfterDefault = beneficiariesOrder[0]
                      assert.ok(firstBeneficiary == firstBeneficiaryAfterDefault)
                  })

                  // This happens in the 1st cycle
                  it("moves the order of beneficiaries if the supposed beneficiary of this cycle defaults", async function () {
                      this.timeout(200000)
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      let beneficiariesOrder = fund[4]
                      let supposedBeneficiary = beneficiariesOrder[0]

                      // Everyone pays but the first participant, which should be the first beneficiary
                      for (let i = 2; i <= totalParticipants; i++) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                      // Artifically increase time to skip the wait
                      await advanceTime(contributionPeriod + 1)
                      await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                      fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      beneficiariesOrder = fund[4]
                      let supposedBeneficiaryAfterDefault = beneficiariesOrder[0]
                      let supposedBeneficiaryNewPosition = beneficiariesOrder[1]

                      assert.ok(supposedBeneficiary != supposedBeneficiaryAfterDefault)
                      assert.ok(supposedBeneficiary == supposedBeneficiaryNewPosition)
                  })

                  // This happens in the 1st cycle
                  it("moves multiple defaulters in a row to after the first elligible beneficiary", async function () {
                      this.timeout(200000)
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      let supposedBeneficiaryOrder = [
                          participant_4.address,
                          participant_1.address,
                          participant_2.address,
                          participant_3.address,
                          participant_5.address,
                      ]

                      // Everyone pays but the first participant, which should be the first beneficiary
                      for (let i = 4; i <= totalParticipants; i++) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                      // Artifically increase time to skip the wait
                      await advanceTime(contributionPeriod + 1)
                      await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      let beneficiariesOrder = fund[4]
                      for (let i = 0; i < supposedBeneficiaryOrder.length; i++) {
                          assert.ok(supposedBeneficiaryOrder[i] == beneficiariesOrder[i])
                      }

                      // Check if the moved order is actually applied as well
                      fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      let lastBeneficiary = fund[7]
                      assert.ok(participant_4.address == lastBeneficiary)
                  })

                  // This happens in the 1st cycle
                  it("does not permit a graced defaulter to withdraw their fund in the current cycle", async function () {
                      this.timeout(200000)
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      let beneficiariesOrder = fund[4]
                      let supposedBeneficiary = beneficiariesOrder[0]
                      // Everyone pays but the first participant, which should be the first beneficiary
                      for (let i = 2; i <= totalParticipants; i++) {
                          await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                      }
                      // Artifically increase time to skip the wait
                      await advanceTime(contributionPeriod + 1)
                      await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                      fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      beneficiariesOrder = fund[4]
                      let supposedBeneficiaryAfterDefault = beneficiariesOrder[0]
                      let supposedBeneficiaryNewPosition = beneficiariesOrder[1]

                      assert.ok(supposedBeneficiary != supposedBeneficiaryAfterDefault)
                      assert.ok(supposedBeneficiary == supposedBeneficiaryNewPosition)
                  })

                  it("simulates a whole fund cycle and allows everyone to withdraw after the fund is closed", async function () {
                      this.timeout(200000)

                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      await everyonePaysAndCloseCycle(termId)
                      await advanceTime(cycleTime + 1)

                      await takaturnDiamondParticipant_1.startNewCycle(termId)

                      await executeCycle(termId, 1)
                      await executeCycle(termId, 6)

                      await executeCycle(termId, 1)
                      await executeCycle(termId, 6)

                      await executeCycle(termId, 5)
                      await executeCycle(termId, 3)

                      await executeCycle(termId, 2)
                      await executeCycle(termId, 6)

                      await executeCycle(termId, 6)
                      await executeCycle(termId, 8)

                      await executeCycle(termId, 6)

                      for (let i = 1; i <= totalParticipants; i++) {
                          try {
                              await takaturnDiamond.connect(accounts[i]).withdrawFund(termId)
                              // console.log(`Fund claimed by: ${accounts[i].address}`)
                          } catch (e) {}
                      }

                      const takaturnBalance = await usdc.balanceOf(takaturnDiamond.address)
                      assert.ok(takaturnBalance == 0)
                  })

                  it("makes sure the fund is closed correctly", async function () {
                      this.timeout(200000)

                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      await everyonePaysAndCloseCycle(termId)
                      await advanceTime(cycleTime + 1)
                      await takaturnDiamondParticipant_1.startNewCycle(termId)

                      // Close remaining cycles

                      while ((await takaturnDiamondDeployer.getFundSummary(termId))[1] < 4) {
                          await executeCycle(termId)
                      }

                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      expect(getFundStateFromIndex(fund[1])).to.equal(FundStates.FundClosed)
                  })

                  it("allows owner to withdraw any unclaimed funds after 180 days, but not earlier", async function () {
                      this.timeout(200000)

                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      await everyonePaysAndCloseCycle(termId)
                      await advanceTime(cycleTime + 1)
                      await takaturnDiamondParticipant_1.startNewCycle(termId)

                      let balance = 0
                      // Attempt to withdraw while cycles are ongoing, this should fail
                      await expect(
                          takaturnDiamondParticipant_1.emptyFundAfterEnd(termId)
                      ).to.be.revertedWith("Can't empty yet")

                      balance = await usdc.balanceOf(takaturnDiamond.address)
                      assert.ok(balance > 0)

                      // Close remaining cycles
                      while ((await takaturnDiamondDeployer.getFundSummary(termId))[1] < 4) {
                          await executeCycle(termId, 0, [], false)
                      }

                      // Make sure fund is closed
                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      expect(getFundStateFromIndex(fund[1])).to.equal(FundStates.FundClosed)

                      // Attempt to withdraw after last cycle, this should fail
                      await expect(
                          takaturnDiamondParticipant_1.emptyFundAfterEnd(termId)
                      ).to.be.revertedWith("Can't empty yet")

                      balance = await usdc.balanceOf(takaturnDiamond.address)
                      assert.ok(balance > 0)

                      // Artifically increase time to skip the long wait of 180 days
                      await advanceTimeByDate(180, day)

                      // Attempt to withdraw after 180 days
                      try {
                          await takaturnDiamondParticipant_1.emptyFundAfterEnd(termId)
                      } catch (e) {}

                      balance = await usdc.balanceOf(takaturnDiamond.address)
                      assert.ok(balance == 0)
                  })

                  // This happens in the 1st cycle
                  it("returns remaining cycle time properly", async function () {
                      //todo: this one sometimes fails. check where to wait
                      this.timeout(200000)

                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      let fundStart = fund[5].toNumber()
                      let currentCycle = fund[6].toNumber()

                      let currentRemainingCycleTime =
                          await takaturnDiamondDeployer.getRemainingCycleTime(termId)

                      //console.log(cycleTime * currentCycle + fundStart)

                      assert.ok(cycleTime == currentRemainingCycleTime.toNumber())
                      // Artifically increase time to skip the wait
                      await advanceTime(contributionPeriod + 1)

                      let newRemainingCycleTime =
                          await takaturnDiamondDeployer.getRemainingCycleTime(termId)

                      // console.log("new remaning cycle time:", newRemainingCycleTime.toNumber())

                      assert.ok(
                          currentRemainingCycleTime - newRemainingCycleTime ==
                              contributionPeriod + 1
                      )

                      assert.ok(
                          cycleTime * currentCycle + fundStart - currentRemainingCycleTime > 0
                      )
                      // Artifically increase time to skip the wait
                      await advanceTime(cycleTime + 1)

                      newRemainingCycleTime = await takaturnDiamondDeployer.getRemainingCycleTime(
                          termId
                      )

                      assert.ok(newRemainingCycleTime.toString() == 0)
                  })

                  // This happens in the 1st cycle
                  it("returns remaining contribution time properly", async function () {
                      //todo: this one sometimes fails. check where to wait
                      this.timeout(200000)

                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      let fundStart = fund[5].toNumber()
                      let currentCycle = fund[6].toNumber()

                      let contributionEndTimestamp = parseInt(
                          cycleTime * (currentCycle - 1) + fundStart + contributionPeriod
                      )
                      let currentRemainingContributionTime =
                          await takaturnDiamondDeployer.getRemainingContributionTime(termId)

                      //   console.log("answer", fundStart + currentRemainingContributionTime)
                      assert.ok(
                          fundStart + currentRemainingContributionTime.toNumber() ==
                              contributionEndTimestamp
                      )

                      // Artifically increase time to skip the wait
                      await advanceTime(contributionPeriod * 0.5)

                      let newRemainingContributionTime =
                          await takaturnDiamondDeployer.getRemainingContributionTime(termId)

                      assert.ok(newRemainingContributionTime.toNumber() == contributionPeriod * 0.5)

                      // Artifically increase time to skip the wait
                      await advanceTime(contributionPeriod)

                      newRemainingContributionTime =
                          await takaturnDiamondDeployer.getRemainingContributionTime(termId)
                      //console.log("new remaning contribution time:", newRemainingContributionTime);
                      assert.ok(newRemainingContributionTime == 0)
                  })
              })

              describe("Combined Tests Part 2", function () {
                  it("reduces the no. of cycles if a non-beneficiary user is expelled", async function () {
                      // todo: check this one. collateralMembersBank and contributionAmountWei
                      this.timeout(200000)
                      //   console.log("=======================================================")
                      //   console.log("entrando al test 1")
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      await everyonePaysAndCloseCycle(termId)

                      await advanceTime(cycleTime + 1)

                      await takaturnDiamondParticipant_1.startNewCycle(termId)

                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      let startingCycles = fund[8]
                      let currentCycle = fund[3]
                      //   console.log("starting cycles 1:", startingCycles.toNumber())

                      // We let the participant 3 default constantly, before becoming beneficiary
                      //   console.log("participant_3.address:", participant_3.address)
                      for (let i = 1; i <= totalParticipants; i++) {
                          //   console.log("=======================================================")
                          //   console.log("i:", i)
                          let collateralSummary =
                              await takaturnDiamondDeployer.getDepositorCollateralSummary(
                                  participant_3.address,
                                  termId
                              )
                          let isCollateralMember = collateralSummary[0]

                          let fundParticipant =
                              await takaturnDiamondDeployer.getParticipantFundSummary(
                                  participant_3.address,
                                  termId
                              )
                          let wasBeneficiary = fundParticipant[1]
                          let paidCycle = fundParticipant[2]

                          fund = await takaturnDiamondDeployer.getFundSummary(termId)
                          let currentState = fund[1]
                          //   console.log("is collateral member:", isCollateralMember)
                          //   console.log("was beneficiary:", wasBeneficiary)
                          //   console.log("paid cycle:", paidCycle)

                          if (getFundStateFromIndex(currentState) == FundStates.FundClosed) {
                              //   console.log("fund closed")
                              break
                          }

                          if (isCollateralMember) {
                              await executeCycle(termId, 1, [3])
                          }
                      }
                      //   while (
                      //       (
                      //           await takaturnDiamondDeployer.getDepositorCollateralSummary(
                      //               participant_3.address,
                      //               termId
                      //           )
                      //       )[0]
                      //   ) {
                      //       fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      //       let currentState = fund[1]
                      //       if (getFundStateFromIndex(currentState) == FundStates.FundClosed) {
                      //           break
                      //       }
                      //       await executeCycle(termId, 1, [3])
                      //   }

                      let collateral = await takaturnDiamondDeployer.getDepositorCollateralSummary(
                          participant_1.address,
                          termId
                      )
                      let member = collateral[0]

                      //   let fundParticipant = await takaturnDiamondDeployer.getParticipantFundSummary(
                      //       participant_1.address,
                      //       termId
                      //   )
                      //   let wasBeneficiary = fundParticipant[1]

                      fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      const finishingCycles = fund[8]
                      currentCycle = fund[3]

                      //   console.log("finishing cycles 1:", finishingCycles.toNumber())
                      //   console.log("member 1:", member)
                      // console.log("was beneficiary 1:", wasBeneficiary)

                      //   console.log("saliendo del test 1")
                      //   console.log("=======================================================")
                      //assert.ok(!wasBeneficiary) // todo: this one fails
                      assert.ok(!member) // todo: this one fails
                      assert.ok(finishingCycles < startingCycles) // todo: this one fails
                  })

                  it("does not reduce the no. of cycles if a past beneficiary is expelled", async function () {
                      // todo: check this one. _isUnderCollaterized is returning false
                      this.timeout(200000)
                      //   console.log("=======================================================")
                      //   console.log("entrando al test 2")
                      const lastTerm = await takaturnDiamondDeployer.getTermsId()
                      const termId = lastTerm[0]

                      await everyonePaysAndCloseCycle(termId)
                      await advanceTime(cycleTime + 1)
                      await takaturnDiamondParticipant_1.startNewCycle(termId)

                      let fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      const startingCycles = fund[8]
                      let currentCycle = fund[3]
                      //   console.log("starting cycles 2:", startingCycles.toNumber())

                      // We let the participant 1 default constantly, before becoming beneficiary
                      while (
                          (
                              await takaturnDiamondDeployer.getDepositorCollateralSummary(
                                  participant_1.address,
                                  termId
                              )
                          )[0]
                      ) {
                          fund = await takaturnDiamondDeployer.getFundSummary(termId)
                          let currentState = fund[1]

                          if (getFundStateFromIndex(currentState) == FundStates.FundClosed) {
                              break
                          }
                          await executeCycle(termId, 1, [1])
                      }

                      let collateral = await takaturnDiamondDeployer.getDepositorCollateralSummary(
                          participant_1.address,
                          termId
                      )
                      let member = collateral[0]

                      let fundParticipant = await takaturnDiamondDeployer.getParticipantFundSummary(
                          participant_1.address,
                          termId
                      )
                      let wasBeneficiary = fundParticipant[1]

                      fund = await takaturnDiamondDeployer.getFundSummary(termId)
                      const finishingCycles = fund[8]
                      currentCycle = fund[3]
                      //   console.log("finishing cycles 2:", finishingCycles.toNumber())
                      //   console.log("member 2:", member)
                      //   console.log("was beneficiary 2:", wasBeneficiary)

                      //   console.log("saliendo del test 2")
                      //   console.log("=======================================================")
                      assert.ok(wasBeneficiary) // todo: this one fails
                      assert.ok(!member) // todo: this one fails
                      assert.ok(finishingCycles.toNumber() == startingCycles) // todo: this one passes
                  })
              })
          })

          describe("Combined Tests Part 3", function () {
              beforeEach(async function () {
                  let totalParticipantsPart3 = 3

                  // Create a new term where participant_1 is the term owner
                  // This create the term and collateral
                  await takaturnDiamondParticipant_1.createTerm(
                      totalParticipantsPart3,
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

                  for (let i = 1; i <= totalParticipantsPart3; i++) {
                      await takaturnDiamond
                          .connect(accounts[i])
                          .joinTerm(termId, { value: fixedCollateralEth })
                  }

                  await advanceTimeByDate(1, hour)

                  await takaturnDiamondParticipant_1.startTerm(termId)
              })

              it("selects graced defaulters as beneficiaries when there are no eligible beneficiaries left", async function () {
                  this.timeout(200000)

                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // First cycle, participant 1 & 3 pay
                  payers = [1, 3]
                  for (let i = 0; i < payers.length; i++) {
                      await takaturnDiamond.connect(accounts[payers[i]]).payContribution(termId)
                  }
                  // Artifically increase time to skip the wait
                  await advanceTime(contributionPeriod + 1)
                  await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                  // Artifically increase time to skip the wait
                  await advanceTime(cycleTime + 1)
                  await takaturnDiamondParticipant_1.startNewCycle(termId)

                  // Next cycle, only participant 1 pays. Participant 2 and 3 default. Participant 2 should be beneficiary
                  await executeCycle(termId, 2, [2, 3])
                  const participantSummary =
                      await takaturnDiamondDeployer.getParticipantFundSummary(
                          participant_2.address,
                          termId
                      )
                  assert.ok(participantSummary[1])
              })

              it("does not permit a graced defaulter to withdraw their fund in the current cycle but it allows them to do so if they pay the next cycle", async function () {
                  this.timeout(200000)

                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // First cycle, participant 1 & 3 pay
                  payers = [1, 3]
                  for (let i = 0; i < payers.length; i++) {
                      await takaturnDiamond.connect(accounts[payers[i]]).payContribution(termId)
                  }

                  // Artifically increase time to skip the wait
                  await advanceTime(contributionPeriod + 1)
                  await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                  // Artifically increase time to skip the wait
                  await advanceTime(cycleTime + 1)
                  await takaturnDiamondParticipant_1.startNewCycle(termId)

                  // Next cycle, only participant 1 pays. Participant 2 and 3 default. Participant 2 should be beneficiary
                  await executeCycle(termId, 2, [2, 3])
                  let fund = await takaturnDiamondDeployer.getFundSummary(termId)

                  // Make sure participant 2 is beneficiary
                  let participantSummary = await takaturnDiamondDeployer.getParticipantFundSummary(
                      participant_2.address,
                      termId
                  )
                  assert.ok(participantSummary[1])

                  // Should not be able to withdraw because beneficiary defaulted
                  await expect(
                      takaturnDiamond.connect(participant_2).withdrawFund(termId)
                  ).to.be.revertedWith("You must pay your cycle before withdrawing")

                  // Next cycle, participant 2 pays and can withdraw the fund after paying
                  await usdc
                      .connect(participant_2)
                      .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)

                  fund = await takaturnDiamondDeployer.getFundSummary(termId)

                  await takaturnDiamond.connect(participant_2).payContribution(termId)

                  await expect(takaturnDiamond.connect(participant_2).withdrawFund(termId)).not.to
                      .be.reverted
              })
          })

          describe("Combined Tests Part 4", function () {
              beforeEach(async function () {
                  totalParticipantsPart4 = 2

                  // Create a new term where participant_1 is the term owner
                  // This create the term and collateral
                  await takaturnDiamondParticipant_1.createTerm(
                      totalParticipantsPart4,
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

                  for (let i = 1; i <= totalParticipantsPart4; i++) {
                      await takaturnDiamond
                          .connect(accounts[i])
                          .joinTerm(termId, { value: fixedCollateralEth })
                  }

                  await advanceTimeByDate(1, hour)

                  await takaturnDiamondParticipant_1.startTerm(termId)
              })

              it("does not produce weird behaviour when theres only 2 participants, and one pays and the other doesnt 1", async function () {
                  this.timeout(200000)

                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]

                  // First participant pays, second doesn't
                  await usdc
                      .connect(participant_1)
                      .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)

                  await takaturnDiamond.connect(participant_1).payContribution(termId)

                  // Artifically increase time to skip the wait
                  await advanceTime(contributionPeriod + 1)
                  await takaturnDiamondParticipant_1.closeFundingPeriod(termId)
                  await advanceTime(cycleTime + 1)

                  await takaturnDiamondParticipant_1.startNewCycle(termId)

                  // Second participant pays, first doesn't
                  await usdc
                      .connect(participant_2)
                      .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)
                  await takaturnDiamond.connect(participant_2).payContribution(termId)
                  // Artifically increase time to skip the wait
                  await advanceTime(contributionPeriod + 1)
                  await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                  let participant_1FundSummary =
                      await takaturnDiamondDeployer.getParticipantFundSummary(
                          participant_1.address,
                          termId
                      )
                  let participant_1BeneficiariesPool = participant_1FundSummary[4]

                  let participant_2FundSummary =
                      await takaturnDiamondDeployer.getParticipantFundSummary(
                          participant_2.address,
                          termId
                      )
                  let participant_2BeneficiariesPool = participant_2FundSummary[4]

                  let participant_1CollateralSummary =
                      await takaturnDiamondDeployer.getDepositorCollateralSummary(
                          participant_1.address,
                          termId
                      )
                  let participant_1PaymentBank = participant_1CollateralSummary[2]

                  let participant_2CollateralSummary =
                      await takaturnDiamondDeployer.getDepositorCollateralSummary(
                          participant_2.address,
                          termId
                      )
                  let participant_2PaymentBank = participant_2CollateralSummary[2]

                  assert.ok(
                      participant_1BeneficiariesPool.toNumber() ==
                          participant_2BeneficiariesPool.toNumber()
                  )
                  assert.ok(
                      participant_1PaymentBank.toNumber() == participant_2PaymentBank.toNumber()
                  )
              })

              it("does not produce weird behaviour when theres only 2 participants, and one pays and the other doesnt 2", async function () {
                  this.timeout(200000)

                  const lastTerm = await takaturnDiamondDeployer.getTermsId()
                  const termId = lastTerm[0]
                  // First participant pays, second doesn't
                  await usdc
                      .connect(participant_2)
                      .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)
                  await takaturnDiamond.connect(participant_2).payContribution(termId)

                  // Artifically increase time to skip the wait
                  await advanceTime(contributionPeriod + 1)
                  await takaturnDiamondParticipant_1.closeFundingPeriod(termId)
                  await advanceTime(cycleTime + 1)
                  await takaturnDiamondParticipant_1.startNewCycle(termId)

                  // First participant pays, second doesn't
                  await usdc
                      .connect(participant_1)
                      .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)
                  await takaturnDiamond.connect(participant_1).payContribution(termId)

                  // Artifically increase time to skip the wait
                  await advanceTime(contributionPeriod + 1)
                  await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

                  let participant_1FundSummary =
                      await takaturnDiamondDeployer.getParticipantFundSummary(
                          participant_1.address,
                          termId
                      )
                  let participant_1BeneficiariesPool = participant_1FundSummary[4]

                  let participant_2FundSummary =
                      await takaturnDiamondDeployer.getParticipantFundSummary(
                          participant_2.address,
                          termId
                      )
                  let participant_2BeneficiariesPool = participant_2FundSummary[4]

                  let participant_1CollateralSummary =
                      await takaturnDiamondDeployer.getDepositorCollateralSummary(
                          participant_1.address,
                          termId
                      )
                  let participant_1PaymentBank = participant_1CollateralSummary[2]

                  let participant_2CollateralSummary =
                      await takaturnDiamondDeployer.getDepositorCollateralSummary(
                          participant_2.address,
                          termId
                      )
                  let participant_2PaymentBank = participant_2CollateralSummary[2]

                  assert.ok(
                      participant_1BeneficiariesPool.toNumber() ==
                          participant_2BeneficiariesPool.toNumber()
                  )
                  assert.ok(
                      participant_1PaymentBank.toNumber() == participant_2PaymentBank.toNumber()
                  )
              })
          })
      })
