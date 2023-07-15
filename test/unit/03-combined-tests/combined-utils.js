const { toWei, advanceTime } = require("../../../utils/_helpers")

let usdc
let accounts = []
let takaturnDiamond

let totalParticipants = 12
let cycleTime = 60
let contributionAmount = 5
let contributionPeriod = 40
let fixedCollateralEth = toWei(0.055)
let collateralAmount = 60

const states = {
    0: "InitializingFund",
    1: "AcceptingContributions",
    2: "ChoosingBeneficiary",
    3: "CycleOngoing",
    4: "FundClosedCyclesFinished",
    5: "FundClosedEveryoneDefaulted",
}

// const USDC_SLOT = 9

// const locallyManipulatedBalance = 1000 * 10 ** 6
const balanceForUser = 1000 * 10 ** 6

function getRandomInt(max) {
    return Math.floor(Math.random() * max)
}

async function executeCycle(
    termId,
    defaultersAmount = 0,
    specificDefaultersIndices = [],
    withdrawFund = true
) {
    let randomDefaulterIndices = specificDefaultersIndices

    let currentCycle = parseInt(await takaturnDiamond.currentCycle(termId))
    console.log(`Current cycle is: ${currentCycle}`)

    while (defaultersAmount != randomDefaulterIndices.length) {
        if (defaultersAmount > totalParticipants) {
            console.log("Too many defaulters specified!")
            break
        }
        let randomInt = getRandomInt(Math.floor(totalParticipants - 1))

        if (!randomDefaulterIndices.includes(randomInt)) {
            console.log("Defaulting user..")
            randomDefaulterIndices.push(randomInt)
        }
    }

    console.log(`Random Defaulter Indices: ${randomDefaulterIndices}`)

    let paidAmount = 0
    for (let i = 0; i < totalParticipants; i++) {
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

    await takaturnDiamond.connect(accounts[12]).closeFundingPeriod(termId)

    let fund = await takaturnDiamond.getFundSummary(termId)
    let state = fund[1]
    assert.ok(state != 1) // state is not equal to acceptingContributions

    let fundClaimed = false
    let claimant
    let previousBalanceClaimant = 0
    let poolEmpty = 0
    if (withdrawFund) {
        for (let i = 0; i < totalParticipants; i++) {
            try {
                claimant = accounts[i]
                previousBalanceClaimant = await usdc.balanceOf(claimant)
                await takaturnDiamond.connect(accounts[i]).withdrawFund(termId)
                console.log(`Fund claimed by: ${i}`)
                fundClaimed = true
                break
            } catch (e) {}
        }

        depositorFundSummary = await takaturnDiamond.getDepositorFundSummary(claimant, termId)
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
        await takaturnDiamond.connect(accounts[12]).startNewCycle(termId)
    } catch (e) {}

    let newCycle = parseInt(await takaturnDiamond.currentCycle(termId))

    console.log(`We enter to the new cycle. Cycle is: ${newCycle}`)

    let newCycleStarted = currentCycle + 1 == newCycle
    //console.log(newCycleStarted);
    //console.log(await fund.methods.currentState().call());
    fund = await takaturnDiamond.getFundSummary(termId)
    let currentState = fund[1]
    let fundClosed = parseInt(currentState) == 4 || parseInt(currentState) == 5 // FundClosed // todo: este lo agarro del getter
    if (fundClosed) {
        assert.ok(true)
    } else {
        assert.ok(newCycleStarted)
    }
}

module.exports = {
    // USDC_SLOT,
    // locallyManipulatedBalance,
    balanceForUser,
    // Term params
    totalParticipants,
    cycleTime,
    contributionAmount,
    contributionPeriod,
    fixedCollateralEth,
    collateralAmount,
    // helper functions
    getRandomInt,
    executeCycle,
}
