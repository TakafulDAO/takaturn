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
const { takaturnABI } = require("../utils/takaturnABI")

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

    log("04. Deploying facets")

    if (isMainnet) {
        rawProposal = await catchUnknownSigner(
            diamond.deploy("TakaturnDiamond", {
                from: deployer,
                owner: diamondOwner,
                args: args,
                log: false,
                facets: [
                    "CollateralFacet",
                    "FundFacet",
                    "TermFacet",
                    "GettersFacet",
                    "YGFacetZaynFi",
                ],
                execute: {
                    contract: "DiamondInit",
                    methodName: "init",
                    args: initArgs,
                },
                waitConfirmations: waitBlockConfirmations,
            })
        )
    } else {
        rawProposal = await catchUnknownSigner(
            diamond.deploy("TakaturnDiamond", {
                from: deployer,
                owner: diamondOwner,
                args: args,
                log: false,
                facets: [
                    "CollateralFacet",
                    "FundFacet",
                    "TermFacet",
                    "GettersFacet",
                    "YGFacetZaynFi",
                    "WithdrawTestEthFacet",
                ],
                execute: {
                    contract: "DiamondInit",
                    methodName: "init",
                    args: initArgs,
                },
                waitConfirmations: waitBlockConfirmations,
            })
        )

        withdrawTestEthFacet = await deployments.get("WithdrawTestEthFacet") // This facet is never deployed on mainnet
    }

    log("04. Facets deployed")

    log("==========================================================================")

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

    log("==========================================================================")
    log("04. Creating the proposal proposal...")

    // Decode raw transaction

    if (rawProposal === null) {
        log("There is nothing to upgrade")
    } else {
        const iface = new ethers.Interface(takaturnABI)
        let decodedData = iface.parseTransaction({
            data: rawProposal.data,
            value: rawProposal.value,
        })

        log(decodedData)
    }
}

module.exports.tags = ["defender"]
