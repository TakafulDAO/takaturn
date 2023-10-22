const { network } = require("hardhat")
const { networkConfig } = require("../utils/_networks")
const { isDevnet, isFork } = require("../utils/_networks")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer, usdcOwner } = await getNamedAccounts()
    const chainId = network.config.chainId

    if (isDevnet) {
        // No Fork. Completely on localhost
        log("==========================================================================")
        log("00. Local network detected! Deploying mocks...")
        log("==========================================================================")
        log("00. Deploying MockEthUsdAggregator...")

        const decimals = networkConfig[chainId]["decimals"]
        const initialPriceEthUsd = networkConfig[chainId]["initialPriceEthUsd"]

        await deploy("MockV3Aggregator", {
            contract: "MockV3Aggregator",
            from: deployer,
            log: true,
            args: [decimals, initialPriceEthUsd],
        })

        log("00. MockEthUsdAggregator Deployed!...")
        log("==========================================================================")
        log("00. Deploying USDC mock...")

        await deploy("FiatTokenV2_1", {
            contract: "FiatTokenV2_1",
            from: usdcOwner,
            log: true,
            args: [],
        })

        log("00. USDC mock Deployed!...")
        log("==========================================================================")
        log("==========================================================================")
        log(
            "00. You are deploying to a local network, you'll need a local network running to interact"
        )
        log("==========================================================================")
        log("00. Mocks Deployed!")
        log("==========================================================================")
    }
}

module.exports.tags = ["all", "mocks", "takaturn_deploy", "takaturn_upgrade"]
