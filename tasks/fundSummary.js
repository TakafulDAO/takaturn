const FundStates = {
    InitializingTerm: "InitializingTerm",
    ActiveTerm: "ActiveTerm",
    ExpiredTerm: "ExpiredTerm",
    ClosedTerm: "ClosedTerm",
}

const getFundStateFromIndex = (index) => {
    return Object.keys(FundStates)[index]
}

async function _fundSummary(taskArguments, hre) {
    const takaturn = await ethers.getContract("TakaturnDiamond")

    console.log("Fund Summary...")

    const fundParams = await takaturn.getFundSummary(taskArguments.termId)

    console.log("")
    console.log(`Fund initialized: ${fundParams[0]}`)
    console.log(`Fund state: ${getFundStateFromIndex(fundParams[1])}`)
    console.log(`Fund stable token: ${fundParams[2]}`)
    console.log(`Fund start: ${fundParams[4]}`)
    console.log(`Fund end: ${fundParams[5]}`)
    console.log(`Current cycle: ${fundParams[6]}`)
    console.log(`Total amount of Cycles: ${fundParams[7]}`)
    console.log("Beneficiaries order")
    console.table(fundParams[3])
    console.log("")
}

async function fundSummary(taskArguments, hre) {
    await _fundSummary(taskArguments, hre)
}

module.exports = { fundSummary }
