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
let collateralFundingPeriod = 604800

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
    collateralFundingPeriod,
    // helper functions
    getRandomInt,
}
