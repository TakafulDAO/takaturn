async function _closeFundingPeriod(taskArguments, hre) {
    const takaturn = await ethers.getContract("TakaturnDiamond")

    console.log("Closing funding period")
    try {
        await takaturn.closeFundingPeriod(taskArguments.termId)
        console.log("Funding Period closed!")
    } catch (e) {
        console.log("Error starting new cycle")
        console.log(`Error: ${e.error}`)
    }
}

async function closeFundingPeriod(taskArguments, hre) {
    await _closeFundingPeriod(taskArguments, hre)
}

module.exports = { closeFundingPeriod }
