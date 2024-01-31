const { network } = require("hardhat")
const { networkConfig, isDevnet } = require("../utils/_networks")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    if (isDevnet) {
        await deploy("CollateralFacet", {
            contract: "CollateralFacet",
            from: deployer,
            log: true,
            args: [],
        })

        await deploy("FundFacet", {
            contract: "FundFacet",
            from: deployer,
            log: true,
            args: [],
        })

        await deploy("GettersFacet", {
            contract: "GettersFacet",
            from: deployer,
            log: true,
            args: [],
        })

        await deploy("TermFacet", {
            contract: "TermFacet",
            from: deployer,
            log: true,
            args: [],
        })

        await deploy("YGFacetZaynFi", {
            contract: "YGFacetZaynFi",
            from: deployer,
            log: true,
            args: [],
        })
    }
}

module.exports.tags = ["test-yield"]
