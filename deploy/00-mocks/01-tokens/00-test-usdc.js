const { network } = require("hardhat")
const { developmentChains, isTestnet } = require("../../../utils/_networks")
const { verify } = require("../../../scripts/verify")
const { deploySimpleContract } = require("../../../utils/deployTx")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { log } = deployments
    const chainId = network.config.chainId
    if (isTestnet && chainId == 421614) {
        log("00.01.00. Deploying test USDC...")
        const contractName = "tUSDC"

        await deploySimpleContract(contractName)
        log("00.01.00. test USDC Deployed!...")
        log("==========================================================================")
    }
    if (!developmentChains.includes(network.name) && process.env.ARBISCAN_API_KEY) {
        log("00.01.00 Verifying test USDC...")
        await verify(usdc.address, args)
        log("00.01.00. test USDC Verified!")
    }
}

module.exports.tags = ["all", "mocks", "token", "takaturn_deploy", "takaturn_upgrade"]
