const { network } = require("hardhat")
const { networkConfig, isDevnet, isInternal } = require("../../../utils/_networks")
const { deploySimpleContract } = require("../../../utils/deployTx")

module.exports = async ({ deployments }) => {
    const { log } = deployments
    const chainId = network.config.chainId
    if (isDevnet || isInternal) {
        // No Fork. Completely on localhost
        log("==========================================================================")
        log("00.00.00. Local network detected! Deploying mocks...")
        log("==========================================================================")
        log("00.00.00. Deploying MockEthUsdAggregator...")
        const contractName = "MockEthUsdAggregator"
        const contract = "MockV3Aggregator"
        const decimals = networkConfig[chainId]["decimals"]
        const initialPriceEthUsd = networkConfig[chainId]["initialPriceEthUsd"]

        const args = [decimals, initialPriceEthUsd]

        await deploySimpleContract(contractName, args, contract)
        log("00.00.00. MockEthUsdAggregator Deployed!...")
        log("==========================================================================")
    }
}

module.exports.tags = [
    "all",
    "takadao",
    "mocks",
    "aggregator",
    "takaturn_deploy",
    "takaturn_upgrade",
]
