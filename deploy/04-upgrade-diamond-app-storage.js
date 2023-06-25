// Deploy script for independent contracts
const { network } = require("hardhat")
const { developmentChains, VERIFICATION_BLOCK_CONFIRMATIONS } = require("../utils/_networks")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { diamond, log, catchUnknownSigner } = deployments
    const { deployer, diamondOwner } = await getNamedAccounts()
    const chainId = network.config.chainId
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS

    log("04. Upgrading Diamond...")

    const args = []
    const takaturnDiamondUpgrade = await catchUnknownSigner(
        diamond.deploy("TakaturnDiamondAppStorage", {
            from: deployer,
            owner: diamondOwner,
            args: args,
            log: true,
            facets: ["ActionFacetAppStorage", "NewFacet", "TestFacetAppStorage"],
            waitConfirmations: waitBlockConfirmations,
        })
    )

    log("==========================================================================")
    log("04. Upgrade recheck")
    await diamond.deploy("TakaturnDiamondAppStorage", {
        from: deployer,
        owner: diamondOwner,
        args: args,
        log: true,
        facets: ["ActionFacetAppStorage", "NewFacet", "TestFacetAppStorage"],
        waitConfirmations: waitBlockConfirmations,
    })

    // log("==========================================================================")
    // log("04. Running deploy tests")
    // const test = await deployments.read("TakaturnDiamondAppStorage", "sayHello")
    // console.log({ test })

    // const test2 = await deployments.read("TakaturnDiamondAppStorage", "sayHello2")
    // console.log({ test2 })

    log("04. Diamond Upgraded!")
    log("==========================================================================")
}

module.exports.tags = ["all", "diamond_app_storage", "diamond_app_storage_upgrade"]
