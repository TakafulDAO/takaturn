const { network } = require("hardhat")
const { developmentChains } = require("../../utils/_networks")
const { verify } = require("../../scripts/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    log("01. Deploying ALibrary...")

    const aLibrary = await deploy("ALibrary", {
        from: deployer,
        log: true,
    })
    log("01. ALibrary Deployed!")

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("01. Verifying ALibrary...")
        const args = []
        await verify(aLibrary.address, args)
        log("01. ALibrary Verified!")
        log("==========================================================================")
    }
    log("==========================================================================")
}

module.exports.tags = ["ALibrary"]
