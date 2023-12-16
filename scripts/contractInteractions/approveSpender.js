const { ethers } = require("hardhat")

async function approve() {
    // This script does not work on local network without forking
    let accounts, participant_1, participant_2, participant_3

    const takaturn = await ethers.getContract("TakaturnDiamond")
    const usdc = await ethers.getContractAt(
        "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
        "0xfd064A18f3BF249cf1f87FC203E90D8f650f2d63"
    )

    accounts = await ethers.getSigners()

    participant_1 = accounts[1]
    participant_2 = accounts[2]
    participant_3 = accounts[3]

    const amount = 30 * 10 ** 6

    for (let i = 1; i < accounts.length; i++) {
        console.log(`Participant ${i} approving takaturn contract`)
        await usdc.connect(accounts[i]).approve(takaturn, amount)
    }
}

approve()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
