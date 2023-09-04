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
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS
    let ethUsdPriceFeedAddress
    let usdcUsdPriceFeedAddress
    let sequencerUptimeFeedAddress
    let zaynfiZapAddress
    let zaynfiVaultAddress

    log("01. Upgrading Takaturn Diamond...")

    if (isMainnet || isTestnet || isFork) {
        ethUsdPriceFeedAddress = networkConfig[chainId]["ethUsdPriceFeed"]
        usdcUsdPriceFeedAddress = networkConfig[chainId]["usdcUsdPriceFeed"]
        sequencerUptimeFeedAddress = networkConfig[chainId]["sequencerUptimeFeed"]
        zaynfiZapAddress = networkConfig[chainId]["zaynfiZap"]
        zaynfiVaultAddress = networkConfig[chainId]["zaynfiVault"]
    }

    if (isDevnet && !isFork) {
        const ethUsdAggregator = await deployments.get("MockEthUsdAggregator")
        ethUsdPriceFeedAddress = ethUsdAggregator.address

        const usdcUsdAggregator = await deployments.get("MockUsdcUsdAggregator")
        usdcUsdPriceFeedAddress = usdcUsdAggregator.address

        const sequencer = await deployments.get("MockSequencer")
        sequencerUptimeFeedAddress = sequencer.address

        zaynfiZapAddress = networkConfig[chainId]["zaynfiZap"]
        zaynfiVaultAddress = networkConfig[chainId]["zaynfiVault"]
    }

    const args = []
    const initArgs = [
        ethUsdPriceFeedAddress,
        usdcUsdPriceFeedAddress,
        sequencerUptimeFeedAddress,
        zaynfiZapAddress,
        zaynfiVaultAddress,
    ]

    const takaturnDiamondUpgrade = await diamond.deploy("TakaturnDiamond", {
        from: deployer,
        owner: deployer,
        args: args,
        log: true,
        facets: ["CollateralFacet", "FundFacet", "TermFacet", "GettersFacet", "YGFacetZaynFi"],
        execute: {
            contract: "DiamondInit",
            methodName: "init",
            args: initArgs,
        },
        waitConfirmations: waitBlockConfirmations,
    })

    const collateralFacet = await deployments.get("CollateralFacet")
    const fundFacet = await deployments.get("FundFacet")
    const termFacet = await deployments.get("TermFacet")
    const gettersFacet = await deployments.get("GettersFacet")
    const yieldFacet = await deployments.get("YGFacetZaynFi")
    const diamondInit = await deployments.get("DiamondInit")
    const diamondCutFacet = await deployments.get("_DefaultDiamondCutFacet")
    const diamondOwnershipFacet = await deployments.get("_DefaultDiamondOwnershipFacet")
    const diamondLoupeFacet = await deployments.get("_DefaultDiamondLoupeFacet")
    const diamondERC165Init = await deployments.get("_DefaultDiamondERC165Init")

    let contractNames = [
        "TakaturnDiamond",
        "CollateralFacet",
        "FundFacet",
        "TermFacet",
        "GettersFacet",
        "YGFacetZaynFi",
        "DiamondInit",
        "_DefaultDiamondCutFacet",
        "_DefaultDiamondOwnershipFacet",
        "_DefaultDiamondLoupeFacet",
        "_DefaultDiamondERC165Init",
    ]

    let contractAddresses = [
        takaturnDiamondUpgrade.address,
        collateralFacet.address,
        fundFacet.address,
        termFacet.address,
        gettersFacet.address,
        yieldFacet.address,
        diamondInit.address,
        diamondCutFacet.address,
        diamondOwnershipFacet.address,
        diamondLoupeFacet.address,
        diamondERC165Init.address,
    ]

    log("01. Diamond Upgraded!")
    log("==========================================================================")

    if (!developmentChains.includes(network.name) && process.env.ARBISCAN_API_KEY) {
        log("01. Verifying Diamond...")
        for (let i = 0; i < contractAddresses.length; i++) {
            log(`01. Verifying "${contractNames[i]}"...`)
            await verify(contractAddresses[i], args)
            log(`01. Verified "${contractNames[i]}"...`)
            log("==========================================================================")
        }
        log("01. Diamond Verified!")
        log("==========================================================================")
    }
}

module.exports.tags = ["all", "diamond", "takaturn_upgrade"]
