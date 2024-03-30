async function _yieldSummary(taskArguments, hre) {
    const takaturn = await ethers.getContract("TakaturnDiamond")

    console.log("Yield Summary...")

    const yieldParams = await takaturn.getYieldSummary(taskArguments.termId)

    if (!yieldParams[0]) {
        console.log("Yield not initialized yet")
    } else {
        console.log("")
        console.log(`initialized: ${yieldParams[0]}`)
        console.log(`startTimeStamp: ${yieldParams[1]}`)
        console.log(`totalDeposit: ${yieldParams[2]}`)
        console.log(`currentTotalDeposit: ${yieldParams[3]}`)
        console.log(`totalShares: ${yieldParams[4]}`)
        console.log(`vault: ${yieldParams[6]}`)
        console.log(`zap: ${yieldParams[7]}`)
        console.log("yieldUsers:")
        console.table(yieldParams[5])

        console.log("")
    }
}

async function yieldSummary(taskArguments, hre) {
    await _yieldSummary(taskArguments, hre)
}

module.exports = { yieldSummary }
