const { isZayn } = require("../utils/_networks")

module.exports = async ({ deployments }) => {
    const { log } = deployments
    if (isZayn) {
        log("02. Upgrading contracts to Ethernal...")

        const collateralFacet = await deployments.get("CollateralFacet")
        const fundFacet = await deployments.get("FundFacet")
        const termFacet = await deployments.get("TermFacet")
        const gettersFacet = await deployments.get("GettersFacet")
        const yieldFacet = await deployments.get("YGFacetZaynFi")

        let contractNames = [
            "CollateralFacet",
            "FundFacet",
            "TermFacet",
            "GettersFacet",
            "YGFacetZaynFi",
        ]

        let contractAddresses = [
            collateralFacet.address,
            fundFacet.address,
            termFacet.address,
            gettersFacet.address,
            yieldFacet.address,
        ]

        log("==========================================================================")
        log("02. Pushing elements to Ethernal...")
        log("==========================================================================")
        // Pushing only the facets, the proxy will be upload through postman
        for (let i = 0; i < contractAddresses.length; i++) {
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
    } else {
        log("02. Skipping Ethernal upload...")
        log("==========================================================================")
    }
}

module.exports.tags = ["all", "diamond", "ethernal"]
