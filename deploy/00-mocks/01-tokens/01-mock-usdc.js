const { network } = require("hardhat")
const { developmentChains, isTestnet, isDevnet } = require("../../../utils/_networks")
const { verify } = require("../../../scripts/verify")
const { deploySimpleContract } = require("../../../utils/deployTx")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { log } = deployments
    const chainId = network.config.chainId
    if ((isTestnet && chainId == 421614) || isDevnet) {
        log("00.01.01. Deploying USDC mock...")
        const contractName = "FiatTokenV2_1"

        await deploySimpleContract(contractName)
        log("00.01.01. USDC mock Deployed!...")
        log("==========================================================================")
    }
    if (!developmentChains.includes(network.name) && process.env.ARBISCAN_API_KEY) {
        log("00.01.01. Verifying USDC Mock...")
        await verify(usdc.address, args)
        log("00.01.01. USDC Verified!")
    }
}

module.exports.tags = ["all", "mocks", "token", "takaturn_deploy", "takaturn_upgrade"]
