const { ethers, network } = require("hardhat")
const { moveBlocks } = require("../../utils/move-blocks")
const { getTermStateFromIndex } = require("../../utils/_helpers")

async function createTerm() {
    // await deployments.fixture(["diamond"])
    const takaturn = await ethers.getContract("TakaturnDiamond")

    console.log("Creating term...")
    const totalParticipants = 3
    const registrationPeriod = 120 // 2 minutes
    const cycleTime = 180 // 2 minutes
    const contributionAmount = 10 // USDC
    const contributionPeriod = 120 // 1 minute 50 seconds
    const stableTokenAddress = "0xfd064A18f3BF249cf1f87FC203E90D8f650f2d63"

    const tx = await takaturn.createTerm(
        totalParticipants,
        registrationPeriod,
        cycleTime,
        contributionAmount,
        contributionPeriod,
        stableTokenAddress
    )
    await tx.wait(1)

    console.log("Term created!")

    const termIds = await takaturn.getTermsId()
    const termParams = await takaturn.getTermSummary(termIds[0])

    console.log(`termId: ${termParams.termId}`)
    console.log(`initialized: ${termParams.initialized}`)
    console.log(`state: ${getTermStateFromIndex(termParams.state)}`)
    console.log(`termOwner: ${termParams.termOwner}`)
    console.log(`creationTime: ${termParams.creationTime}`)
    console.log(`registrationPeriod: ${termParams.registrationPeriod}`)
    console.log(`totalParticipants: ${termParams.totalParticipants}`)
    console.log(`cycleTime: ${termParams.cycleTime}`)
    console.log(`contributionAmount:: ${termParams.contributionAmount}`)
    console.log(`contributionPeriod:: ${termParams.contributionPeriod}`)
    console.log(`stableTokenAddress:: ${termParams.stableTokenAddress}`)

    if (network.config.chainId === 31337) {
        console.log("Working on a local network, moving blocks...")
        await moveBlocks(1, (sleepAmount = 1000))
    }
}

createTerm()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
