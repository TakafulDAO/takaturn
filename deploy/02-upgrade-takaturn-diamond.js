const { network } = require("hardhat")
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    isMainnet,
    isTestnet,
    isDevnet,
    isFork,
} = require("../utils/_networks")
const { verify } = require("../scripts/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { diamond, log } = deployments
    const { deployer, diamondOwner } = await getNamedAccounts()
    const chainId = network.config.chainId
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS
    let ethUsdPriceFeedAddress
    let sequencerUptimeFeedAddress

    log("02. Upgrading Takaturn Diamond...")

    if (isMainnet || isTestnet || isFork) {
        ethUsdPriceFeedAddress = networkConfig[chainId]["ethUsdPriceFeed"]
        sequencerUptimeFeedAddress = networkConfig[chainId]["sequencerUptimeFeed"]
    }

    if (isDevnet && !isFork) {
        const ethUsdAggregator = await deployments.get("MockV3Aggregator")
        ethUsdPriceFeedAddress = ethUsdAggregator.address

        const sequencer = await deployments.get("MockSequencer")
        sequencerUptimeFeedAddress = sequencer.address
    }

    const args = []
    const initArgs = [ethUsdPriceFeedAddress, sequencerUptimeFeedAddress]

    const takaturnDiamondUpgrade = await diamond.deploy("TakaturnDiamond", {
        from: deployer,
        owner: diamondOwner,
        args: args,
        log: true,
        facets: ["CollateralFacetV2", "FundFacetV2", "TermFacetV2", "GettersFacetV2"],
        execute: {
            contract: "DiamondInitV2",
            methodName: "init",
            args: initArgs,
        },
        waitConfirmations: waitBlockConfirmations,
    })

    log("02. Diamond Upgraded!")
    log("==========================================================================")

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("02. Verifying Diamond...")
        await verify(takaturnDiamondUpgrade.address, args)
        log("02. Diamond Verified!")
        log("==========================================================================")
    }
}

module.exports.tags = ["all", "diamond", "takaturn_upgrade"]
