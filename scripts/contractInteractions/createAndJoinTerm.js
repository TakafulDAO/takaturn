const { ethers, network } = require("hardhat")
const { moveBlocks } = require("../../utils/move-blocks")

async function createAndJoinTerm() {
    // This script does not work on local network without forking
    let accounts, participant_1, participant_2, participant_3

    const takaturn = await ethers.getContract("TakaturnDiamond")
    accounts = await ethers.getSigners()

    participant_1 = accounts[1]
    participant_2 = accounts[2]
    participant_3 = accounts[3]

    console.log("Creating term...")
    const totalParticipants = 3
    const registrationPeriod = 120 // Two minutes
    const cycleTime = 180 // Three minute
    const contributionAmount = 10
    const contributionPeriod = 120 // Two minutes
    const stableTokenAddress = "0xfd064A18f3BF249cf1f87FC203E90D8f650f2d63"

    const createTermTx = await takaturn
        .connect(participant_1)
        .createTerm(
            totalParticipants,
            registrationPeriod,
            cycleTime,
            contributionAmount,
            contributionPeriod,
            stableTokenAddress
        )
    await createTermTx.wait(1)

    const termIds = await takaturn.getTermsId()
    const termParams = await takaturn.getTermSummary(termIds[0])

    console.log(`termId: ${termParams.termId} created!`)

    console.log("Joining term...")

    for (let i = 1; i < 4; i++) {
        console.log(`Participant ${i} joining term ${termParams.termId}...`)
        const entrance = await takaturn.minCollateralToDeposit(termParams.termId, i - 1)

        const joinTermTx = await takaturn
            .connect(accounts[i])
            .joinTerm(termParams.termId, false, { value: entrance })
        await joinTermTx.wait(1)
    }

    console.log("Everyone joined!")
    console.log("Wait two minutes for registration period to end and start the term...")

    if (network.config.chainId === 31337) {
        console.log("Working on a local network, moving blocks...")
        await moveBlocks(1, (sleepAmount = 1000))
    }
}

createAndJoinTerm()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
