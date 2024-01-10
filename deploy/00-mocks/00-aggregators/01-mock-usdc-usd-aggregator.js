const { network } = require("hardhat")
const { networkConfig, isDevnet } = require("../../../utils/_networks")
const { deploySimpleContract } = require("../../../utils/deployTx")

module.exports = async ({ deployments }) => {
    const { log } = deployments
    const chainId = network.config.chainId
    if (isDevnet) {
        // No Fork. Completely on localhost
        log("==========================================================================")
        log("00.00.01. Local network detected! Deploying mocks...")
        log("==========================================================================")
        log("00.00.01. Deploying MockUsdcUsdAggregator...")
        const contractName = "MockUsdcUsdAggregator"
        const contract = "MockV3Aggregator"
        const decimals = networkConfig[chainId]["decimals"]
        const initialPriceUsdcUsd = networkConfig[chainId]["initialPriceUsdcUsd"]

        const args = [decimals, initialPriceUsdcUsd]

        await deploySimpleContract(contractName, args, contract)
        log("00.00.01. MockUsdcUsdAggregator Deployed!...")
        log("==========================================================================")
    }
}

module.exports.tags = ["all", "mocks", "aggregator", "takaturn_deploy", "takaturn_upgrade"]
