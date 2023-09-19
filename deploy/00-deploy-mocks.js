const { network } = require("hardhat")
const { networkConfig } = require("../utils/_networks")
const { isDevnet, isFork, isZayn } = require("../utils/_networks")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer, usdcOwner } = await getNamedAccounts()
    const chainId = network.config.chainId

    if (isDevnet && !isFork && !isZayn) {
        // No Fork, No Zayn. Completely on localhost
        log("==========================================================================")
        log("00. Local network detected! Deploying mocks...")
        log("==========================================================================")
        log("00. Deploying MockEthUsdAggregator...")

        const decimals = networkConfig[chainId]["decimals"]
        const initialPriceEthUsd = networkConfig[chainId]["initialPriceEthUsd"]

        await deploy("MockEthUsdAggregator", {
            contract: "MockV3Aggregator",
            from: deployer,
            log: true,
            args: [decimals, initialPriceEthUsd],
        })

        log("00. MockEthUsdAggregator Deployed!...")
        log("==========================================================================")
        log("00. Deploying MockUsdcUsdAggregator...")

        const initialPriceUsdcUsd = networkConfig[chainId]["initialPriceUsdcUsd"]

        await deploy("MockUsdcUsdAggregator", {
            contract: "MockV3Aggregator",
            from: deployer,
            log: true,
            args: [decimals, initialPriceUsdcUsd],
        })

        log("00. MockUsdcUsdAggregator Deployed!...")
        log("==========================================================================")
        log("00. Deploying MockSequencer...")

        await deploy("MockSequencer", {
            contract: "MockSequencer",
            from: deployer,
            log: true,
            args: [decimals, initialPriceEthUsd],
        })

        log("00. MockSequencer Deployed!...")
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
