async function _withdrawFund(taskArguments, hre) {
    let accounts

    const takaturn = await ethers.getContract("TakaturnDiamond")

    accounts = await ethers.getSigners()

    participant_1 = accounts[1]
    participant_2 = accounts[2]
    participant_3 = accounts[3]

    for (let i = 1; i < accounts.length; i++) {
        console.log(`Participant ${i} withdrawing fundfund from term: ${taskArguments.termId}`)
        try {
            const withdrawFundTx = await takaturn
                .connect(accounts[i])
                .withdrawFund(taskArguments.termId)
            await withdrawFundTx.wait(1)
            console.log(`Participant ${i} withdraw fund from term: ${taskArguments.termId}`)
        } catch (e) {
            console.log("Error withdrawing fund term")
            console.log(`Error: ${e.error}`)
        }
    }
}

async function withdrawFund(taskArguments, hre) {
    await _withdrawFund(taskArguments, hre)
}

module.exports = { withdrawFund }
