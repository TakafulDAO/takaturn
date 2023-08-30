const { network } = require("hardhat")
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    isMainnet,
    isTestnet,
    isDevnet,
    isFork,
    isZayn,
} = require("../utils/_networks")
const { verify } = require("../scripts/verify")
const { usdc } = require("hardhat-helpers/dist/mainnet")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { diamond, log } = deployments
    const { deployer, diamondOwner } = await getNamedAccounts()
    const chainId = network.config.chainId
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS
    let ethUsdPriceFeedAddress
    let usdcUsdPriceFeedAddress
    let sequencerUptimeFeedAddress
    let zaynfiZapAddress
    let zaynfiVaultAddress

    log("02. Upgrading Takaturn Diamond...")

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
        facets: [
            "CollateralFacetV2",
            "FundFacetV2",
            "TermFacetV2",
            "GettersFacetV2",
            "YGFacetZaynFi",
        ],
        execute: {
            contract: "DiamondInitV2",
            methodName: "init",
            args: initArgs,
        },
        waitConfirmations: waitBlockConfirmations,
    })

    const collateralFacet = await deployments.get("CollateralFacetV2")
    const fundFacet = await deployments.get("FundFacetV2")
    const termFacet = await deployments.get("TermFacetV2")
    const gettersFacet = await deployments.get("GettersFacetV2")
    const yieldFacet = await deployments.get("YGFacetZaynFi")
    const diamondInit = await deployments.get("DiamondInitV2")
    const diamondCutFacet = await deployments.get("_DefaultDiamondCutFacet")
    const diamondOwnershipFacet = await deployments.get("_DefaultDiamondOwnershipFacet")
    const diamondLoupeFacet = await deployments.get("_DefaultDiamondLoupeFacet")
    const diamondERC165Init = await deployments.get("_DefaultDiamondERC165Init")

    let contractNames = [
        "TakaturnDiamond",
        "CollateralFacetV2",
        "FundFacetV2",
        "TermFacetV2",
        "GettersFacetV2",
        "YGFacetZaynFi",
        "DiamondInitV2",
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

    if (isZayn) {
        log("==========================================================================")
        log("02. Pushing elements to Ethernal...")
        log("==========================================================================")
        // Pushing only the facets, the proxy will be upload through postman
        for (let i = 1; i <= 5; i++) {
            log(`02. Pushing "${contractNames[i]}" to Ethernal...`)
            await ethernal.push({
                name: contractNames[i],
                address: contractAddresses[i],
            })
            log(`02. Pushed "${contractNames[i]}" to Ethernal...`)
            log("==========================================================================")
        }

        log("02. Elements pushed to Ethernal...")
        log("==========================================================================")
    }

    log("02. Diamond Upgraded!")
    log("==========================================================================")

    if (!developmentChains.includes(network.name) && process.env.ARBISCAN_API_KEY) {
        log("02. Verifying Diamond...")
        for (let i = 0; i < contractAddresses.length; i++) {
            log(`02. Verifying "${contractNames[i]}"...`)
            await verify(contractAddresses[i], args)
            log(`02. Verified "${contractNames[i]}"...`)
            log("==========================================================================")
        }
        log("02. Diamond Verified!")
        log("==========================================================================")
    }
}

module.exports.tags = ["all", "diamond", "takaturn_upgrade"]
