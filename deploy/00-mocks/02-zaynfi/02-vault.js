const { network } = require("hardhat")
const { developmentChains, isTestnet, isInternal } = require("../../../utils/_networks")
const { verify } = require("../../../scripts/verify")
const { deploySimpleContract } = require("../../../utils/deployTx")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { log } = deployments

    if (isTestnet || isInternal) {
        log("00.02.02. Deploying vault...")

        const strategyContract = await ethers.getContract("StrategyV2Mock")

        const strategy = strategyContract.target
        const approvalDelay = 1000

        const args = [strategy, approvalDelay]

        const contractName = "ZaynVaultV2TakaDAO"

        const vault = await deploySimpleContract(contractName, args)

        log("00.02.02. Vault Deployed!...")
        log("==========================================================================")

        if (
            !developmentChains.includes(network.name) &&
            process.env.ARBISCAN_API_KEY &&
            !isInternal
        ) {
            log("00.02.02. Verifying Vault...")
            await verify(vault.address, args)
            log("00.02.00. Vault Verified!")

            log("==========================================================================")
        }
    }
}

module.exports.tags = ["zayn", "takadao_mocks"]
