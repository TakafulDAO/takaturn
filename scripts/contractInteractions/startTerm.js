const { ethers, network } = require("hardhat")
const { moveBlocks } = require("../../utils/move-blocks")

async function startTerm() {
    // This script does not work on local network.
    // It requires to advance in time. Not implemented here.
    const takaturn = await ethers.getContract("TakaturnDiamond")

    console.log("Starting last term...")

    const termIds = await takaturn.getTermsId()
    const termParams = await takaturn.getTermSummary(termIds[0])

    console.log(`termId: ${termParams.termId}`)

    const startTermTx = await takaturn.startTerm(termParams.termId)
    await startTermTx.wait(1)

    console.log(`Term ${termParams.termId} started!`)

    if (network.config.chainId === 31337) {
        console.log("Working on a local network, moving blocks...")
        await moveBlocks(1, (sleepAmount = 1000))
    }
}

startTerm()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
