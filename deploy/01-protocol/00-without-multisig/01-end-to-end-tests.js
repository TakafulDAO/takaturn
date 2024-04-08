const { network } = require("hardhat")
const { networkConfig, isDevnet, isFork } = require("../../../utils/_networks")
const { deployUpgradeDiamond } = require("../../../utils/deployTx")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { log } = deployments
    const { deployer } = await getNamedAccounts()

    const chainId = network.config.chainId

    let ethUsdPriceFeedAddress, usdcUsdPriceFeedAddress
    let zaynfiZapAddress, zaynfiVaultAddress
    let takaturnDiamondUpgrade

    log("01.00.01. Deploying Takaturn Diamond...")
    if (isDevnet && isFork) {
        const ethUsdAggregator = await deployments.get("MockEthUsdAggregator")
        ethUsdPriceFeedAddress = ethUsdAggregator.address
        const usdcUsdAggregator = await deployments.get("MockUsdcUsdAggregator")
        usdcUsdPriceFeedAddress = usdcUsdAggregator.address
        zaynfiZapAddress = networkConfig[chainId]["zaynfiZap"]
        zaynfiVaultAddress = networkConfig[chainId]["zaynfiVault"]

        const diamondName = "TakaturnDiamond"
        const args = []
        const facets = [
            "CollateralFacet",
            "FundFacet",
            "TermFacet",
            "GettersFacet",
            "YGFacetZaynFi",
            "TestHelperFacet",
        ]
        const initContract = "DiamondInit"
        const initMethod = "init"
        const initArgs = [
            ethUsdPriceFeedAddress,
            usdcUsdPriceFeedAddress,
            zaynfiZapAddress,
            zaynfiVaultAddress,
            false,
        ]

        takaturnDiamondUpgrade = await deployUpgradeDiamond(
            diamondName,
            deployer,
            args,
            facets,
            initContract,
            initMethod,
            initArgs
        )
    }
    log("01.00.01. Diamond Deployed!")
    log("==========================================================================")
}

module.exports.tags = ["all", "mocks"]
