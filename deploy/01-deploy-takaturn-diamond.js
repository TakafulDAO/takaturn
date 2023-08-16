const { network, ethernal } = require("hardhat")
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    isDevnet,
    isFork,
    isZayn,
    isMainnet,
    isTestnet,
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

    log("01. Deploying Takaturn Diamond...")

    if (isMainnet || isTestnet || (isFork && !isZayn) || (isZayn && !isFork)) {
        ethUsdPriceFeedAddress = networkConfig[chainId]["ethUsdPriceFeed"]
        sequencerUptimeFeedAddress = networkConfig[chainId]["sequencerUptimeFeed"]
    }

    if (isDevnet && !isFork && !isZayn) {
        const ethUsdAggregator = await deployments.get("MockV3Aggregator")
        ethUsdPriceFeedAddress = ethUsdAggregator.address

        const sequencer = await deployments.get("MockSequencer")
        sequencerUptimeFeedAddress = sequencer.address
    }

    const args = []
    const initArgs = [sequencerUptimeFeedAddress]

    const takaturnDiamond = await diamond.deploy("TakaturnDiamond", {
        from: deployer,
        owner: diamondOwner,
        args: args,
        log: true,
        facets: ["CollateralFacet", "FundFacet", "TermFacet", "GettersFacet"],
        execute: {
            contract: "DiamondInit",
            methodName: "init",
            args: initArgs,
        },
        waitConfirmations: waitBlockConfirmations,
    })

    if (isZayn && !isFork) {
        await ethernal.push({
            name: "TakaturnDiamond_DiamondProxy",
            address: takaturnDiamond.address,
        })
    }

    log("01. Diamond Deployed!")
    log("==========================================================================")

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("01. Verifying Diamond...")
        await verify(takaturnDiamond.address, args)
        log("01. Diamond Verified!")
        log("==========================================================================")
    }
}

module.exports.tags = ["all", "diamond", "takaturn_deploy"]
