const { isDevnet } = require("../utils/_networks")

module.exports = async ({ getNamedAccounts, deployments }) => {
    // This script is to be used on tests
    // It deploy new facets to get their bytecode to be used on the tests
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

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

module.exports.tags = ["facets"]
