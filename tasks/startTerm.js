async function _startTerm(taskArguments, hre) {
    const takaturn = await ethers.getContract("TakaturnDiamond")

    console.log(`Starting term: ${taskArguments.termId}`)
    try {
        await takaturn.startTerm(taskArguments.termId)
        console.log("Term started!")
    } catch (e) {
        console.log("Error starting new cycle")
        console.log(`Error: ${e.error}`)
    }
}

async function startTerm(taskArguments, hre) {
    await _startTerm(taskArguments, hre)
}

module.exports = { startTerm }
