const { network } = require("hardhat")
const { now } = require("./units")

const TermStates = {
    InitializingTerm: "InitializingTerm",
    ActiveTerm: "ActiveTerm",
    ExpiredTerm: "ExpiredTerm",
    ClosedTerm: "ClosedTerm",
}

const CollateralStates = {
    AcceptingCollateral: "AcceptingCollateral",
    CycleOngoing: "CycleOngoing",
    ReleasingCollateral: "ReleasingCollateral",
    Closed: "Closed",
}

const FundStates = {
    InitializingFund: "InitializingFund",
    AcceptingContributions: "AcceptingContributions",
    ChoosingBeneficiary: "ChoosingBeneficiary",
    CycleOngoing: "CycleOngoing",
    FundClosed: "FundClosed",
}

const getTermStateFromIndex = (index) => {
    return Object.keys(TermStates)[index]
}

const getCollateralStateFromIndex = (index) => {
    return Object.keys(CollateralStates)[index]
}

const getFundStateFromIndex = (index) => {
    return Object.keys(FundStates)[index]
}

const advanceTime = async (seconds) => {
    await network.provider.send("evm_increaseTime", [seconds])
    await network.provider.send("evm_mine", [])
}

/**
 * @param times amount of the param seconds
 * @param seconds hour, day, week, month or year
 * Example advanceTimebyDate(5, day)
 */
const advanceTimeByDate = async (times, seconds) => {
    for (let i = 0; i < times; i++) {
        await advanceTime(seconds)
    }
}

const setTimeFromNow = async (times, seconds) => {
    return now + times * seconds
}

const advanceBlocks = async (numBlocks) => {
    for (let i = 0; i < numBlocks; i++) {
        await network.provider.send("evm_mine")
    }
}

const impersonateAccount = async (account) => {
    return hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [account],
    })
}

const toWei = (num) => String(ethers.parseEther(String(num)))
const fromWei = (num) => Number(ethers.formatEther(num))

module.exports = {
    CollateralStates,
    FundStates,
    TermStates,
    getTermStateFromIndex,
    getCollateralStateFromIndex,
    getFundStateFromIndex,
    // Time utilities
    advanceTime,
    advanceTimeByDate,
    setTimeFromNow,
    advanceBlocks,
    // Accounts
    impersonateAccount,
    // Payments
    toWei,
    fromWei,
}
