async function _withdrawCollateral(taskArguments, hre) {
    let accounts

    const takaturn = await ethers.getContract("TakaturnDiamond")

    accounts = await ethers.getSigners()

    participant_1 = accounts[1]
    participant_2 = accounts[2]
    participant_3 = accounts[3]

    for (let i = 1; i < accounts.length; i++) {
        console.log(`Participant ${i} withdrawing collateral from term: ${taskArguments.termId}`)
        try {
            const withdrawColllateralTx = await takaturn
                .connect(accounts[i])
                .withdrawCollateral(taskArguments.termId)
            await withdrawColllateralTx.wait(1)
            console.log(`Participant ${i} withdraw collateral from term: ${taskArguments.termId}`)
        } catch (e) {
            console.log("Error withdrawing collateral term")
            console.log(`Error: ${e.error}`)
        }
    }
}

async function withdrawCollateral(taskArguments, hre) {
    await _withdrawCollateral(taskArguments, hre)
}

module.exports = { withdrawCollateral }
