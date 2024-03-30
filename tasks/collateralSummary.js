const CollateralStates = {
    AcceptingCollateral: "AcceptingCollateral",
    CycleOngoing: "CycleOngoing",
    ReleasingCollateral: "ReleasingCollateral",
    Closed: "Closed",
}

const getCollateralStateFromIndex = (index) => {
    return Object.keys(CollateralStates)[index]
}

async function _collateralSummary(taskArguments, hre) {
    const takaturn = await ethers.getContract("TakaturnDiamond")

    console.log("Collateral Summary...")

    const collateralParams = await takaturn.getCollateralSummary(taskArguments.termId)

    if (!collateralParams[0]) {
        console.log("This term has not been created yet.")
    } else {
        console.log("")
        console.log(`Collateral initialized: ${collateralParams[0]}`)
        console.log(`Collateral state: ${getCollateralStateFromIndex(collateralParams[1])}`)
        console.log(`Collateral first deposit time: ${collateralParams[2]}`)
        console.log(`Collateral counter members: ${collateralParams[3]}`)
        console.log("Collateral depositors:")
        console.table(collateralParams[4])
        console.log("")
    }
}

async function collateralSummary(taskArguments, hre) {
    await _collateralSummary(taskArguments, hre)
}

module.exports = { collateralSummary }
