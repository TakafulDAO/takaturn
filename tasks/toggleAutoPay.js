async function _toggleAutoPay(taskArguments, hre) {
    let accounts

    const takaturn = await ethers.getContract("TakaturnDiamond")

    accounts = await ethers.getSigners()

    participant_1 = accounts[1]
    participant_2 = accounts[2]
    participant_3 = accounts[3]

    for (let i = 1; i < accounts.length; i++) {
        try {
            const toggleAutoPayTx = await takaturn
                .connect(accounts[i])
                .toggleAutoPay(taskArguments.termId)
            await toggleAutoPayTx.wait(1)
            console.log(`Participant ${i} toggled auto pay for term: ${taskArguments.termId}`)
        } catch (e) {
            console.log("Error")
            console.log(`Error: ${e.error}`)
        }
    }
}

async function toggleAutoPay(taskArguments, hre) {
    await _toggleAutoPay(taskArguments, hre)
}

module.exports = { toggleAutoPay }
