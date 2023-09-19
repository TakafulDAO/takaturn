const { ethers, network } = require("hardhat")
const { moveBlocks } = require("../../utils/move-blocks")
const { BigNumber } = require("ethers")

async function joinTerm() {
    const takaturn = await ethers.getContract("TakaturnDiamond")

    const lastTerm = await takaturn.getTermsId()
    const termId = lastTerm[0]

    const entrance = await takaturn.minCollateralToDeposit(termId, 0)

    console.log("Joining last term...")

    const tx = await takaturn.joinTerm(termId, false, { value: BigNumber.from(entrance) })
    await tx.wait(1)

    console.log(`Joined Term ${termId}!`)

    if (network.config.chainId === 31337) {
        console.log("Working on a local network, moving blocks...")
        await moveBlocks(1, (sleepAmount = 1000))
    }
}

joinTerm()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
