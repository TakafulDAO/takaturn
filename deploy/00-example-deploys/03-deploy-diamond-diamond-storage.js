// Deploy script for independent contracts
const { network } = require("hardhat")
const { developmentChains, VERIFICATION_BLOCK_CONFIRMATIONS } = require("../../utils/_networks")
const { verify } = require("../../scripts/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { diamond, log } = deployments
    const { deployer, diamondOwner } = await getNamedAccounts()
    const chainId = network.config.chainId
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS

    log("03. Deploying Diamond...")

    // After deploy addresses and abis will be on the deployments folder
    const args = []
    const takaturnDiamondStorage = await diamond.deploy("TakaturnDiamondStorage", {
        from: deployer,
        owner: diamondOwner,
        args: args,
        log: true, // Will log on console the address of the facets and diamond
        facets: ["ActionFacetDiamondStorage", "FacetToDelete", "TestFacetDiamondStorage"], // Facet contracts names
        execute: {
            contract: "DiamondInitDiamondStorage",
            methodName: "init",
            args: ["hola", "1"],
        },
        waitConfirmations: waitBlockConfirmations,
    })

    log("03. Diamond Deployed!")
    log("==========================================================================")

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("03. Verifying Diamond...")
        await verify(takaturnDiamondStorage.address, args)
        log("03. Diamond Verified!")
        log("==========================================================================")
    }
}

module.exports.tags = ["all", "diamond_diamond_storage", "diamond_storage_deploy"]
