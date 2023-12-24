async function _usdcMint(taskArguments, hre) {
    const usdc = await ethers.getContract("FiatTokenV2_1")

    const amount = 10000000000

    console.log(
        `Minting USDC mock tokens on arbitrum sepolia testnet to address: ${taskArguments.userAddress}`
    )
    try {
        await usdc.mint(taskArguments.userAddress, amount)
        console.log("Tokens minted")
    } catch (e) {
        console.log("Error minting tokens")
        console.log(`Error: ${e.error}`)
    }
}

async function usdcMint(taskArguments, hre) {
    await _usdcMint(taskArguments, hre)
}

module.exports = { usdcMint }
