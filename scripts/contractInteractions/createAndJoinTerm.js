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
    const registrationPeriod = 30 // Three minutes
    const cycleTime = 60 // One minute
    const contributionAmount = 10
    const contributionPeriod = 50 // One minute
    const stableTokenAddress = "0x72A9c57cD5E2Ff20450e409cF6A542f1E6c710fc"

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

    for (let i = 0; i < totalParticipants; i++) {
        console.log(`Participant ${i + 1} joining term ${termParams.termId}...`)
        const entrance = await takaturn.minCollateralToDeposit(termParams.termId, i)

        if (i === 0) {
            const joinTermTx = await takaturn
                .connect(accounts[i])
                .joinTerm(termParams.termId, true, { value: entrance })
            await joinTermTx.wait(1)
            continue
        }

        const joinTermTx = await takaturn
            .connect(accounts[i])
            .joinTerm(termParams.termId, false, { value: entrance })
        await joinTermTx.wait(1)
    }

    console.log("Everyone joined!")
    console.log("Participant 1 opted in for yield generation, Participant 2 and 3 opted out.")
    console.log("Wait 30 seconds for registration period to end and start the term...")

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
