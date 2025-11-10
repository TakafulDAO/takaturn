const { network } = require("hardhat")
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    isMainnet,
    isTestnet,
    isDevnet,
} = require("../../../utils/_networks")
const { verify } = require("../../../scripts/verify")
const { writeFileSync } = require("fs")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { diamond, log, catchUnknownSigner } = deployments
    const { deployer, diamondOwner } = await getNamedAccounts()
    const chainId = network.config.chainId
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS
    let ethUsdPriceFeedAddress, usdcUsdPriceFeedAddress
    let zaynfiZapAddress, zaynfiVaultAddress
    let facets

    if (!isDevnet) {
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

        log("01.01.00. Deploying facets")
        log("01.01.00. Creating raw transaction for proposal on multisig...")

        if (isMainnet) {
            facets = ["CollateralFacet", "FundFacet", "TermFacet", "GettersFacet", "YGFacetZaynFi"]
        } else {
            facets = [
                "CollateralFacet",
                "FundFacet",
                "TermFacet",
                "GettersFacet",
                "YGFacetZaynFi",
                "WithdrawTestEthFacet",
            ]
        }

        rawProposal = await catchUnknownSigner(
            diamond.deploy("TakaturnDiamond", {
                from: deployer,
                owner: diamondOwner,
                args: args,
                log: true,
                facets: facets,
                execute: {
                    contract: "DiamondInit",
                    methodName: "init",
                    args: initArgs,
                },
                waitConfirmations: waitBlockConfirmations,
            })
        )

        if (isTestnet) {
            withdrawTestEthFacet = await deployments.get("WithdrawTestEthFacet") // This facet is never deployed on mainnet
        }

        log("01.01.00. Facets deployed")
        log("01.01.00. Raw transaction created")
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

        if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
            log("01.01.00. Verifying Diamond...")
            for (let i = 0; i < contractAddresses.length; i++) {
                log(`01.01.00. Verifying "${contractNames[i]}"...`)
                await verify(contractAddresses[i], args)
                log(`01.01.00. Verified "${contractNames[i]}"...`)
                log("==========================================================================")
            }
            if (isTestnet) {
                log("01.01.00. Verifying Withdraw Test Eth Facet...")
                await verify(withdrawTestEthFacet.address, args)
                log("01.01.00. Withdraw Test Eth Facet Verified!")
            }
            log("==========================================================================")
        }

        log("==========================================================================")

        if (rawProposal === null) {
            log("01.01.00. There is nothing to upgrade")
        } else {
            log(
                "01.01.00. Check the raw transaction on the file rawTransaction.txt on the root of this code base"
            )
            writeFileSync("rawTransaction.txt", rawProposal.data, {
                flag: "a",
            })
        }

        log("==========================================================================")
        log("==========================================================================")
    }
}

module.exports.tags = ["multisig"]
