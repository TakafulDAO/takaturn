const { network } = require("hardhat")
const { developmentChains, networkConfig, isTestnet, isDevnet } = require("../utils/_networks")
const { verify } = require("../scripts/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer, usdcOwner } = await getNamedAccounts()
    const chainId = network.config.chainId

    log("03. Deploying facets...")
    log("==========================================================================")
    log("03. Deploying Collateral Facet...")

    const collateral = await deploy("CollateralFacet", {
        contract: "CollateralFacet",
        from: deployer,
        log: true,
        args: [],
    })

    log("03. Collateral Facet Deployed!...")
    log("==========================================================================")
    log("03. Deploying Fund Facet...")

    const fund = await deploy("FundFacet", {
        contract: "FundFacet",
        from: deployer,
        log: true,
        args: [],
    })

    log("00. Fund Facet Deployed!...")
    log("==========================================================================")
    log("03. Deploying Getters Facet...")

    const getter = await deploy("GettersFacet", {
        contract: "GettersFacet",
        from: deployer,
        log: true,
        args: [],
    })

    log("03. Getters Facet Deployed!...")
    log("==========================================================================")
    log("03. Deploying Term Facet...")

    const term = await deploy("TermFacet", {
        contract: "TermFacet",
        from: deployer,
        log: true,
        args: [],
    })

    log("00. Term Facet Deployed!...")
    log("==========================================================================")
    log("03. Deploying Yield Facet...")

    const yield = await deploy("YGFacetZaynFi", {
        contract: "YGFacetZaynFi",
        from: deployer,
        log: true,
        args: [],
    })

    log("00. Yield Facet Deployed!...")
    log("==========================================================================")

    if (isTestnet) {
        log("03. Deploying TeWithdrawTestEthFacetrm Facet...")

        const withdraw = await deploy("WithdrawTestEthFacet", {
            contract: "WithdrawTestEthFacet",
            from: deployer,
            log: true,
            args: [],
        })

        log("03. WithdrawTestEthFacet Facet Deployed!...")
        log("==========================================================================")

        if (!developmentChains.includes(network.name) && process.env.ARBISCAN_API_KEY) {
            log("03. Verifying Facets...")
            await verify(collateral.address, [])
            await verify(fund.address, [])
            await verify(getter.address, [])
            await verify(term.address, [])
            await verify(yield.address, [])
            if (isTestnet) {
                await verify(withdraw.address, [])
            }
            log("03. Facets Verified!")
        }
    }
}

module.exports.tags = ["multisig_1"]
