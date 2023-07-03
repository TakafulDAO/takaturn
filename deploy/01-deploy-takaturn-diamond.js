// Deploy script for independent contracts
const { network } = require("hardhat")
const { developmentChains, VERIFICATION_BLOCK_CONFIRMATIONS } = require("../utils/_networks")
const { verify } = require("../scripts/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { diamond, log } = deployments
    const { deployer, diamondOwner } = await getNamedAccounts()
    const chainId = network.config.chainId
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS

    log("01. Deploying Takaturn Diamond...")

    const args = []
    const takaturnDiamond = await diamond.deploy("TakaturnDiamond", {
        from: deployer,
        owner: diamondOwner,
        args: args,
        log: true,
        facets: ["CollateralFacet", "FundFacet", "TermFacet"],
        // execute: {
        //     contract: "DiamondInit",
        //     methodName: "init",
        //     args: [],
        // },
        waitConfirmations: waitBlockConfirmations,
    })

    log("01. Diamond Deployed!")
    log("==========================================================================")

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("01. Verifying Diamond...")
        await verify(takaturnDiamond.address, args)
        log("01. Diamond Verified!")
        log("==========================================================================")
    }
}

module.exports.tags = ["all", "diamond_diamond_storage", "diamond_storage_deploy"]
