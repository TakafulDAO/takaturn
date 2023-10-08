async function _startNewCycle(taskArguments, hre) {
    const takaturn = await ethers.getContract("TakaturnDiamond")

    console.log("Starting new cycle")
    try {
        await takaturn.startNewCycle(taskArguments.termId)
        console.log("New cycle started!")
    } catch (e) {
        console.log("Error starting new cycle")
        console.log(`Error: ${e.error}`)
    }
}

async function startNewCycle(taskArguments, hre) {
    await _startNewCycle(taskArguments, hre)
}

module.exports = { startNewCycle }
