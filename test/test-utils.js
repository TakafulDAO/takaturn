const { toWei } = require("../utils/_helpers")

let totalParticipants = 12
let cycleTime = 60
let contributionAmount = 5
let contributionPeriod = 40
let fixedCollateralEth = toWei(0.055)
let collateralAmount = 60
let collateralFundingPeriod = 604800
let registrationPeriod = 600000

const balanceForUser = 1000 * 10 ** 6

function getRandomInt(max) {
    return Math.floor(Math.random() * max)
}

module.exports = {
    balanceForUser,
    // Term params
    totalParticipants,
    cycleTime,
    contributionAmount,
    contributionPeriod,
    fixedCollateralEth,
    collateralAmount,
    collateralFundingPeriod,
    registrationPeriod,
    // helper functions
    getRandomInt,
}
