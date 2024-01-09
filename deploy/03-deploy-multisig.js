const { network } = require("hardhat")
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    isMainnet,
    isTestnet,
} = require("../utils/_networks")
const { verify } = require("../scripts/verify")
const { writeFileSync } = require("fs")
const path = require("path")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { diamond, log, catchUnknownSigner } = deployments
    const { deployer, diamondOwner } = await getNamedAccounts()
    const chainId = network.config.chainId
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS
    let ethUsdPriceFeedAddress, usdcUsdPriceFeedAddress
    let zaynfiZapAddress, zaynfiVaultAddress

    ethUsdPriceFeedAddress = networkConfig[chainId]["ethUsdPriceFeed"]
    usdcUsdPriceFeedAddress = networkConfig[chainId]["usdcUsdPriceFeed"]
    zaynfiZapAddress = networkConfig[chainId]["zaynfiZap"]
    zaynfiVaultAddress = networkConfig[chainId]["zaynfiVault"]

    const args = []
    const initArgs = [
        ethUsdPriceFeedAddress,
        usdcUsdPriceFeedAddress,
        zaynfiZapAddress,
        zaynfiVaultAddress,
        false,
    ]

    log("==========================================================================")

    log("04. Deploying facets")
    log("04. Creating raw transaction for proposal on multisig...")

    let txData

    if (isMainnet) {
        rawProposal = await catchUnknownSigner(
            diamond.deploy("TakaturnDiamond", {
                from: deployer,
                owner: diamondOwner,
                args: args,
                log: false,
                facets: [
                    "CollateralFacet",
                    "FundFacet",
                    "TermFacet",
                    "GettersFacet",
                    "YGFacetZaynFi",
                ],
                execute: {
                    contract: "DiamondInit",
                    methodName: "init",
                    args: initArgs,
                },
                waitConfirmations: waitBlockConfirmations,
            })
        )
    } else {
        rawProposal = await catchUnknownSigner(
            diamond.deploy("TakaturnDiamond", {
                from: deployer,
                owner: diamondOwner,
                args: args,
                log: false,
                facets: [
                    "CollateralFacet",
                    "FundFacet",
                    "TermFacet",
                    "GettersFacet",
                    "YGFacetZaynFi",
                    "WithdrawTestEthFacet",
                ],
                execute: {
                    contract: "DiamondInit",
                    methodName: "init",
                    args: initArgs,
                },
                waitConfirmations: waitBlockConfirmations,
            })
        )

        withdrawTestEthFacet = await deployments.get("WithdrawTestEthFacet") // This facet is never deployed on mainnet
    }

    log("04. Facets deployed")
    log("04. Raw transaction created")
    log("==========================================================================")

    takaturnDiamondUpgrade = await deployments.get("TakaturnDiamond")
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

    if (!developmentChains.includes(network.name) && process.env.ARBISCAN_API_KEY) {
        log("01. Verifying Diamond...")
        for (let i = 0; i < contractAddresses.length; i++) {
            log(`01. Verifying "${contractNames[i]}"...`)
            await verify(contractAddresses[i], args)
            log(`01. Verified "${contractNames[i]}"...`)
            log("==========================================================================")
        }
        if (isTestnet) {
            log("01. Verifying Withdraw Test Eth Facet...")
            await verify(withdrawTestEthFacet.address, args)
            log("01. Withdraw Test Eth Facet Verified!")
        }
        log("==========================================================================")
    }

    log("==========================================================================")

    if (rawProposal === null) {
        log("There is nothing to upgrade")
    } else {
        log(
            "Check the raw transaction on the file rawTransaction.txt on the root of this code base"
        )
        writeFileSync("rawTransaction.txt", rawProposal.data, {
            flag: "a",
        })
    }

    log("==========================================================================")
    log("==========================================================================")
}

module.exports.tags = ["multisig"]
