const { network } = require("hardhat")
const { developmentChains, isTestnet, isInternal } = require("../../../utils/_networks")
const { verify } = require("../../../scripts/verify")
const { deploySimpleContract } = require("../../../utils/deployTx")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { log } = deployments

    if (isTestnet || isInternal) {
        log("00.02.00. Deploying Weth...")

        const contractName = "WETH"

        const weth = await deploySimpleContract(contractName)

        log("00.02.00. Weth Deployed!...")
        log("==========================================================================")

        if (
            !developmentChains.includes(network.name) &&
            process.env.ARBISCAN_API_KEY &&
            !isInternal
        ) {
            log("00.02.00. Verifying Weth...")
            await verify(weth.address, args)
            log("00.02.00. Weth Verified!")

            log("==========================================================================")
        }
    }
}

module.exports.tags = ["zayn", "takadao_mocks"]
