const { network } = require("hardhat")
const { developmentChains, networkConfig, isTestnet, isDevnet } = require("../utils/_networks")
const { verify } = require("../scripts/verify")

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

    if (isTestnet && chainId == 421614) {
        log("00. Deploying USDC mock...")
        const args = []

        const usdc = await deploy("FiatTokenV2_1", {
            contract: "FiatTokenV2_1",
            from: deployer,
            log: true,
            args: args,
        })

        log("00. USDC mock Deployed!...")
        log("==========================================================================")

        if (!developmentChains.includes(network.name) && process.env.ARBISCAN_API_KEY) {
            log("00. Verifying USDC Mock...")
            await verify(usdc.address, args)
            log("00. USDC Verified!")
        }
    }
}

module.exports.tags = ["all", "mocks", "takaturn_deploy", "takaturn_upgrade"]
