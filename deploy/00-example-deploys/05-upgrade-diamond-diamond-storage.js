// Deploy script for independent contracts
const { network } = require("hardhat")
const { developmentChains, VERIFICATION_BLOCK_CONFIRMATIONS } = require("../../utils/_networks")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { diamond, log, catchUnknownSigner } = deployments
    const { deployer, diamondOwner } = await getNamedAccounts()
    const chainId = network.config.chainId
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS

    log("05. Upgrading Diamond...")

    const args = []
    const takaturnDiamondUpgrade = await catchUnknownSigner(
        diamond.deploy("TakaturnDiamondStorage", {
            from: deployer,
            owner: diamondOwner,
            args: args,
            log: true,
            facets: ["ActionFacetDiamondStorage", "NewFacet", "TestFacetDiamondStorage"],
            waitConfirmations: waitBlockConfirmations,
        })
    )

    log("==========================================================================")
    log("05. Upgrade recheck")
    await diamond.deploy("TakaturnDiamondStorage", {
        from: deployer,
        owner: diamondOwner,
        args: args,
        log: true,
        facets: ["ActionFacetDiamondStorage", "NewFacet", "TestFacetDiamondStorage"],
        waitConfirmations: waitBlockConfirmations,
    })

    // log("==========================================================================")
    // log("05. Running deploy tests")
    // const test = await deployments.read("TakaturnDiamondStorage", "sayHello")
    // console.log({ test })

    // const test2 = await deployments.read("TakaturnDiamondStorage", "sayHello2")
    // console.log({ test2 })

    log("05. Diamond Upgraded!")
    log("==========================================================================")
}

module.exports.tags = ["all", "diamond_storage", "diamond_storage_upgrade"]
