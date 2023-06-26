const { parseEther } = require("ethers")
const { isDevnet } = require("../../utils/_networks")
const { ethers } = require("hardhat")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { log, rawTx } = deployments
    const { deployer, diamondOwner } = await getNamedAccounts()

    if (isDevnet) {
        log("==========================================================================")
        log("00. Localhost detected")
        log("00. Sending ETH to Diamond Owner...")

        await rawTx({
            from: deployer,
            log: true,
            to: diamondOwner,
            value: ethers.utils.parseEther("10"),
        })
        log("00. ETH sended!")
        log("==========================================================================")
    }
}

module.exports.tags = ["Test", "Test_deploy"]
