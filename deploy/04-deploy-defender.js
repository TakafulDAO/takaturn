const { network, ethers, defender } = require("hardhat")
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    isMainnet,
    isTestnet,
} = require("../utils/_networks")
const { verify } = require("../scripts/verify")
const { writeFileSync } = require("fs")
const path = require("path")
const { AdminClient } = require("@openzeppelin/defender-admin-client")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { diamond, log, catchUnknownSigner } = deployments
    const { deployer, diamondOwner } = await getNamedAccounts()

    const chainId = network.config.chainId

    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS

    let ethUsdPriceFeedAddress, usdcUsdPriceFeedAddress
    let zaynfiZapAddress, zaynfiVaultAddress
    let takaturnAddress
    let multisigContract
    let defenderKey, defenderSecret, defenderNetwork

    ethUsdPriceFeedAddress = networkConfig[chainId]["ethUsdPriceFeed"]
    usdcUsdPriceFeedAddress = networkConfig[chainId]["usdcUsdPriceFeed"]
    zaynfiZapAddress = networkConfig[chainId]["zaynfiZap"]
    zaynfiVaultAddress = networkConfig[chainId]["zaynfiVault"]

    takaturnAddress = networkConfig[chainId]["takaturnDiamond"]

    multisigContract = networkConfig[chainId]["multisig"]

    defenderKey = networkConfig[chainId]["defenderKey"]
    defenderSecret = networkConfig[chainId]["defenderSecret"]
    defenderNetwork = networkConfig[chainId]["defenderId"]

    const args = []
    const initArgs = [
        ethUsdPriceFeedAddress,
        usdcUsdPriceFeedAddress,
        zaynfiZapAddress,
        zaynfiVaultAddress,
        false,
    ]

    log("==========================================================================")

    log("04. Deploying facets")

    // Configuration
    log("04. Configurating the openzeppelin defender client")
    const upgradeApprovalProcess = await defender.getUpgradeApprovalProcess()

    log(upgradeApprovalProcess)

    if (upgradeApprovalProcess.address === undefined) {
        throw new Error(
            `Upgrade approval process with id ${upgradeApprovalProcess.approvalProcessId} has no assigned address`
        )
    }

    // Create the Defender Admin Client instance
    const client = new AdminClient({
        apiKey: defenderKey,
        apiSecret: defenderSecret,
    })

    log("04. Creating the proposal proposal...")
}

module.exports.tags = ["defender"]
