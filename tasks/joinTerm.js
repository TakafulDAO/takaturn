const { BigNumber } = require("ethers")

async function _joinTerm(taskArguments, hre) {
    let accounts

    const takaturn = await ethers.getContract("TakaturnDiamond")

    accounts = await ethers.getSigners()

    participant_1 = accounts[1]
    participant_2 = accounts[2]
    participant_3 = accounts[3]

    for (let i = 1; i < accounts.length; i++) {
        const entrance = await takaturn.minCollateralToDeposit(taskArguments.termId, i - 1)
        try {
            console.log(`Participant ${i} joining term: ${taskArguments.termId}`)

            const joinTermTx = await takaturn
                .connect(accounts[i])
                .joinTerm(taskArguments.termId, false, { value: entrance })
            await joinTermTx.wait(1)
            console.log(`Participant ${i} joined term: ${taskArguments.termId}`)
        } catch (e) {
            console.log("Error joining term")
            console.log(`Error: ${e.error}`)
        }
    }
}

async function joinTerm(taskArguments, hre) {
    await _joinTerm(taskArguments, hre)
}

module.exports = { joinTerm }
