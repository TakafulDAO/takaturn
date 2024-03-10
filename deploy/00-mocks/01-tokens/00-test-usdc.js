const { network } = require("hardhat")
const { developmentChains, isTestnet, isInternal } = require("../../../utils/_networks")
const { verify } = require("../../../scripts/verify")
const { deploySimpleContract } = require("../../../utils/deployTx")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { log } = deployments
    const chainId = network.config.chainId
    if ((isTestnet && chainId == 421614) || isInternal) {
        log("00.01.00. Deploying test USDC...")
        const contractName = "tUSDC"

        const usdc = await deploySimpleContract(contractName)
        log("00.01.00. test USDC Deployed!...")
        log("==========================================================================")
        if (
            !developmentChains.includes(network.name) &&
            process.env.ARBISCAN_API_KEY &&
            !isInternal
        ) {
            log("00.01.00 Verifying test USDC...")
            await verify(usdc.address, args)
            log("00.01.00. test USDC Verified!")
        }
    }
}

module.exports.tags = [
    "all",
    "takadao_mocks",
    "mocks",
    "token",
    "takaturn_deploy",
    "takaturn_upgrade",
]
