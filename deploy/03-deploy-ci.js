const { network } = require("hardhat")
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    isDevnet,
    isFork,
} = require("../utils/_networks")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { diamond, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS
    let ethUsdPriceFeedAddress, usdcUsdPriceFeedAddress
    let zaynfiZapAddress, zaynfiVaultAddress
    let takaturnDiamondUpgrade

    log("02. Deploying Takaturn Diamond...")

    if (chainId == 31337) {
        const ethUsdAggregator = await deployments.get("MockEthUsdAggregator")
        ethUsdPriceFeedAddress = ethUsdAggregator.address

        const usdcUsdAggregator = await deployments.get("MockUsdcUsdAggregator")
        usdcUsdPriceFeedAddress = usdcUsdAggregator.address

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
    }

    log("02. Diamond Deployed!")
    log("==========================================================================")
}

module.exports.tags = ["ci"]
