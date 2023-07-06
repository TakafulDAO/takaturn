const { network } = require("hardhat")
const { networkConfig } = require("../utils/_networks")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    if (chainId == 31337) {
        log("==========================================================================")
        log("00. Local network detected! Deploying mocks...")

        const decimals = networkConfig[chainId]["decimals"]
        const initialPrice = networkConfig[chainId]["initialPrice"]

        await deploy("MockV3Aggregator", {
            contract: "MockV3Aggregator",
            from: deployer,
            log: true,
            args: [decimals, initialPrice],
        })
        log("00. Mocks Deployed!")
        log("==========================================================================")
        log(
            "00. You are deploying to a local network, you'll need a local network running to interact"
        )
        log("==========================================================================")
    }
}
module.exports.tags = ["all", "mocks"]
