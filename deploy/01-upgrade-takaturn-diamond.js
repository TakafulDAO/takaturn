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
    let ethUsdPriceFeedAddress, usdcUsdPriceFeedAddress, sequencerUptimeFeedAddress
    let zaynfiZapAddress, zaynfiVaultAddress
    let contractNames, contractAddresses
    let takaturnDiamondUpgrade
    let collateralFacet,
        fundFacet,
        termFacet,
        gettersFacet,
        yieldFacet,
        diamondInit,
        diamondCutFacet,
        diamondOwnershipFacet,
        diamondLoupeFacet,
        diamondERC165Init,
        withdrawGoerliEthFacet

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

    if (isMainnet) {
        takaturnDiamondUpgrade = await diamond.deploy("TakaturnDiamond", {
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

        collateralFacet = await deployments.get("CollateralFacet")
        fundFacet = await deployments.get("FundFacet")
        termFacet = await deployments.get("TermFacet")
        gettersFacet = await deployments.get("GettersFacet")
        yieldFacet = await deployments.get("YGFacetZaynFi")
        diamondInit = await deployments.get("DiamondInit")
        diamondCutFacet = await deployments.get("_DefaultDiamondCutFacet")
        diamondOwnershipFacet = await deployments.get("_DefaultDiamondOwnershipFacet")
        diamondLoupeFacet = await deployments.get("_DefaultDiamondLoupeFacet")
        diamondERC165Init = await deployments.get("_DefaultDiamondERC165Init")

        contractNames = [
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

        contractAddresses = [
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
    } else {
        takaturnDiamondUpgrade = await diamond.deploy("TakaturnDiamond", {
            from: deployer,
            owner: deployer,
            args: args,
            log: true,
            facets: [
                "CollateralFacet",
                "FundFacet",
                "TermFacet",
                "GettersFacet",
                "YGFacetZaynFi",
                "WithdrawGoerliEthFacet",
            ],
            execute: {
                contract: "DiamondInit",
                methodName: "init",
                args: initArgs,
            },
            waitConfirmations: waitBlockConfirmations,
        })

        collateralFacet = await deployments.get("CollateralFacet")
        fundFacet = await deployments.get("FundFacet")
        termFacet = await deployments.get("TermFacet")
        gettersFacet = await deployments.get("GettersFacet")
        yieldFacet = await deployments.get("YGFacetZaynFi")
        diamondInit = await deployments.get("DiamondInit")
        diamondCutFacet = await deployments.get("_DefaultDiamondCutFacet")
        diamondOwnershipFacet = await deployments.get("_DefaultDiamondOwnershipFacet")
        diamondLoupeFacet = await deployments.get("_DefaultDiamondLoupeFacet")
        diamondERC165Init = await deployments.get("_DefaultDiamondERC165Init")
        withdrawGoerliEthFacet = await deployments.get("WithdrawGoerliEthFacet") // This facet is never deployed on mainnet

        contractNames = [
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

        contractAddresses = [
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
    }

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
