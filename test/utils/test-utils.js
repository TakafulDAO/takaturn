let totalParticipants = 12
let cycleTime = 2592002
let contributionAmount = 50
let contributionPeriod = 43200
let registrationPeriod = 604800

const moneyPot = contributionAmount * totalParticipants

const balanceForUser = 1000 * 10 ** 6

function getRandomInt(max) {
    return Math.floor(Math.random() * max)
}

module.exports = {
    moneyPot,
    balanceForUser,
    // Term params
    totalParticipants,
    cycleTime,
    contributionAmount,
    contributionPeriod,
    registrationPeriod,
    // helper functions
    getRandomInt,
}
