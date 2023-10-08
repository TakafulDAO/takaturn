const TermStates = {
    InitializingTerm: "InitializingTerm",
    ActiveTerm: "ActiveTerm",
    ExpiredTerm: "ExpiredTerm",
    ClosedTerm: "ClosedTerm",
}

const getTermStateFromIndex = (index) => {
    return Object.keys(TermStates)[index]
}

async function _termSummary(taskArguments, hre) {
    const takaturn = await ethers.getContract("TakaturnDiamond")

    console.log("Term Summary...")

    const termParams = await takaturn.getTermSummary(taskArguments.termId)

    console.log("")
    console.log(`termId: ${termParams.termId}`)
    console.log(`initialized: ${termParams.initialized}`)
    console.log(`state: ${getTermStateFromIndex(termParams.state)}`)
    console.log(`termOwner: ${termParams.termOwner}`)
    console.log(`creationTime: ${termParams.creationTime}`)
    console.log(
        `registrationPeriod: ${termParams.registrationPeriod} seconds from the creationTime`
    )
    console.log(`totalParticipants: ${termParams.totalParticipants}`)
    console.log(`cycleTime: ${termParams.cycleTime} seconds`)
    console.log(`contributionAmount:: ${termParams.contributionAmount} USDC`)
    console.log(`contributionPeriod:: ${termParams.contributionPeriod} seconds`)
    console.log(`stableTokenAddress:: ${termParams.stableTokenAddress}`)
    console.log("")
}

async function termSummary(taskArguments, hre) {
    await _termSummary(taskArguments, hre)
}

module.exports = { termSummary }
