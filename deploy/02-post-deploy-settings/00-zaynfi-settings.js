const { network } = require("hardhat")
const { isTestnet, isInternal } = require("../../utils/_networks")

module.exports = async ({ deployments }) => {
    const { log } = deployments

    if (isTestnet || isInternal) {
        log("02.00. Setting variables in Zaynfi contracts...")

        const strategy = await ethers.getContract("StrategyV2Mock")
        const vault = await ethers.getContract("ZaynVaultV2TakaDAO")
        const zap = await ethers.getContract("ZaynZapV2TakaDAOMock")
        const takaturn = await ethers.getContract("TakaturnDiamond")

        log("02.00. Setting vault address in Strategy Contract...")
        await strategy.setVault(vault.target)
        log("02.00. Vault address set...")

        log("02.00. Setting zap address in Vault Contract...")
        await vault.setZapAddress(zap.target)
        log("02.00. Zap address set...")

        log("02.00. Setting takaturn address in Zap Contract...")
        await zap.toggleTrustedSender(takaturn.target, true)
        log("02.00. Takaturn address set...")

        log("02.00. All Variables set")
    }
}

module.exports.tags = ["takadao_main"]
