async function _payContribution(taskArguments, hre) {
    let accounts

    const takaturn = await ethers.getContract("TakaturnDiamond")

    accounts = await ethers.getSigners()

    participant_1 = accounts[1]
    participant_2 = accounts[2]
    participant_3 = accounts[3]

    for (let i = 1; i < accounts.length; i++) {
        console.log(`Participant ${i} paying term contribution for term: ${taskArguments.termId}`)
        try {
            const payContributionTx = await takaturn
                .connect(accounts[i])
                .payContribution(taskArguments.termId)
            await payContributionTx.wait(1)
            console.log(
                `Participant ${i} payed term contribution for term: ${taskArguments.termId}`
            )
        } catch (e) {
            console.log("Error paying contribution")
            console.log(`Error: ${e.error}`)
        }
    }
}

async function payContribution(taskArguments, hre) {
    await _payContribution(taskArguments, hre)
}

module.exports = { payContribution }
