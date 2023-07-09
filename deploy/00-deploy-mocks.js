const { network } = require("hardhat")
const { networkConfig } = require("../utils/_networks")
const { isDevnet, isFork } = require("../utils/_networks")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer, usdcOwner, usdcMasterMinter } = await getNamedAccounts()
    const chainId = network.config.chainId

    if (isDevnet && !isFork) {
        log("==========================================================================")
        log("00. Local network detected! Deploying mocks...")
        log("==========================================================================")
        log("00. Deploying MockV3Aggregator...")

        const decimals = networkConfig[chainId]["decimals"]
        const initialPrice = networkConfig[chainId]["initialPrice"]

        await deploy("MockV3Aggregator", {
            contract: "MockV3Aggregator",
            from: deployer,
            log: true,
            args: [decimals, initialPrice],
        })

        log("00. MockV3Aggregator Deployed!...")
        log("==========================================================================")
        log(
            "00. You are deploying to a local network, you'll need a local network running to interact"
        )
        log("==========================================================================")
    }

    if (isDevnet) {
        log("==========================================================================")
        log("00. Deploying USDC mock...")

        const tokenName = "USD Coin"
        const tokenSymbol = "USDC"
        const tokenCurrency = "USD"
        const tokenDecimals = 6
        const newMasterMinter = usdcMasterMinter
        const newPauser = usdcOwner
        const newBlacklister = usdcOwner
        const newOwner = usdcOwner

        const initializeArgs = [
            tokenName,
            tokenSymbol,
            tokenCurrency,
            tokenDecimals,
            newMasterMinter,
            newPauser,
            newBlacklister,
            newOwner,
        ]

        await deploy("FiatTokenV2_1", {
            contract: "FiatTokenV2_1",
            from: deployer,
            log: true,
            args: [],
            execute: {
                methodName: "initialize",
                args: initializeArgs,
            },
        })

        log("00. USDC mock Deployed!...")
        log("==========================================================================")
    }
    log("00. Mocks Deployed!")
    log("==========================================================================")
}

module.exports.tags = ["all", "mocks"]
