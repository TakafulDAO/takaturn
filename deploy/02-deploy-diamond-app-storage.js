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

    log("02. Deploying Diamond...")

    // After deploy addresses and abis will be on the deployments folder
    const args = []
    const takaturnDiamondAppStorage = await diamond.deploy("TakaturnDiamondAppStorage", {
        from: deployer,
        owner: diamondOwner,
        args: args,
        log: true, // Will log on console the address of the facets and diamond
        facets: ["ActionFacetAppStorage", "FacetToDelete", "TestFacetAppStorage"], // Facet contracts names
        execute: {
            contract: "DiamondInitAppStorage",
            methodName: "init",
            args: ["hola", "1"],
        },
        waitConfirmations: waitBlockConfirmations,
    })

    log("02. Diamond Deployed!")
    log("==========================================================================")

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("02. Verifying Diamond...")
        await verify(takaturnDiamondAppStorage.address, args)
        log("02. Diamond Verified!")
        log("==========================================================================")
    }
}

module.exports.tags = ["all", "diamond_app_storage", "diamond_app_storage_deploy"]
