const { network } = require("hardhat")
const { developmentChains, isTestnet, isInternal } = require("../../../utils/_networks")
const { verify } = require("../../../scripts/verify")
const { deploySimpleContract } = require("../../../utils/deployTx")
const { ZeroAddress } = require("ethers")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { log } = deployments

    if (isTestnet || isInternal) {
        log("00.02.03. Deploying zap...")
        const wethContract = await ethers.getContract("WETH")

        const wombatRouter = ZeroAddress
        const wombatPool = ZeroAddress
        const poolPath = ZeroAddress
        const weth = wethContract.target

        const args = [wombatRouter, wombatPool, poolPath, weth]

        const contractName = "ZaynZapV2TakaDAOMock"

        const zap = await deploySimpleContract(contractName, args)

        log("00.02.03. Zap Deployed!...")
        log("==========================================================================")

        if (
            !developmentChains.includes(network.name) &&
            process.env.ETHERSCAN_API_KEY &&
            !isInternal
        ) {
            log("00.02.03. Verifying zap...")
            await verify(zap.address, args)
            log("00.02.03. Zap Verified!")

            log("==========================================================================")
        }
    }
}

module.exports.tags = ["takadao_mocks"]
