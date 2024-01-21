const { network, ethers } = require("hardhat")
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    isMainnet,
    isTestnet,
} = require("../utils/_networks")
const { verify } = require("../scripts/verify")
const path = require("path")
const { takaturnABI } = require("../utils/takaturnABI")
const { Defender } = require("@openzeppelin/defender-sdk")

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
    let multisigAddress
    let defenderKey, defenderSecret, defenderNetwork
    let decodedData

    ethUsdPriceFeedAddress = networkConfig[chainId]["ethUsdPriceFeed"]
    usdcUsdPriceFeedAddress = networkConfig[chainId]["usdcUsdPriceFeed"]
    zaynfiZapAddress = networkConfig[chainId]["zaynfiZap"]
    zaynfiVaultAddress = networkConfig[chainId]["zaynfiVault"]

    takaturnAddress = networkConfig[chainId]["takaturnDiamond"]

    multisigAddress = networkConfig[chainId]["multisig"]

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
                log: true,
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
    // Create the Defender instance
    const creds = { apiKey: defenderKey, apiSecret: defenderSecret }
    const client = new Defender(creds)

    const approvalProcess = await client.deploy.getUpgradeApprovalProcess(defenderNetwork)
    // const relayer = await client.relay.get(approvalProcess.relayerId) // TODO: To be deployed

    log(approvalProcess)
    // log(relayer)

    // if (approvalProcess.address === undefined) {
    //     throw new Error(
    //         `Upgrade approval process with id ${approvalProcess.approvalProcessId} has no assigned address`
    //     )
    // }

    log("==========================================================================")
    log("04. Setting the proposal...")

    // Decode raw transaction

    if (rawProposal === null) {
        log("There is nothing to upgrade")
        return
    } else {
        const iface = new ethers.Interface(takaturnABI)
        decodedData = iface.parseTransaction({
            data: rawProposal.data,
            value: rawProposal.value,
        })
    }

    // diamondCut function abi

    const diamondCutFunctionAbi = {
        name: "diamondCut",
        inputs: [
            {
                components: [
                    {
                        internalType: "address",
                        name: "facetAddress",
                        type: "address",
                    },
                    {
                        internalType: "enum IDiamondCut.FacetCutAction",
                        name: "action",
                        type: "uint8",
                    },
                    {
                        internalType: "bytes4[]",
                        name: "functionSelectors",
                        type: "bytes4[]",
                    },
                ],
                internalType: "struct IDiamondCutFacetCut[]",
                name: "_diamondCut",
                type: "tuple[]",
            },
            {
                internalType: "address",
                name: "_init",
                type: "address",
            },
            {
                internalType: "bytes",
                name: "_calldata",
                type: "bytes",
            },
        ],
    }

    // Get the arguments for the diamondCut function

    let _diamondCut = []
    for (let i = 0; i < decodedData.args[0].length; i++) {
        for (let j = 0; j < decodedData.args[0][i].length; j++) {
            if (j === 1) {
                _diamondCut.push(Number(decodedData.args[0][i][j]))
            } else {
                _diamondCut.push(decodedData.args[0][i][j])
            }
        }
    }

    let _init = decodedData.args[1]
    let _calldata = decodedData.args[2]

    // Create the proposal through the Defender Client

    log("04. Creating proposal...")
    // TODO: Here fails due to authentication error

    const proposal = await client.proposal.create({
        proposal: {
            contract: {
                address: takaturnAddress,
                network: defenderNetwork,
            },
            title: "Upgrade test",
            description: "Send proposal to safe wallet using the defender sdk",
            type: "custom",
            functionInterface: diamondCutFunctionAbi,
            functionInputs: [_diamondCut, _init, _calldata],
            via: multisigAddress,
            viaType: "Gnosis Safe",
        },
    })

    log("Proposal")
    log(proposal)

    log("04. Proposal successfully created at: ", proposal.url)

    log("04. Proposal created")
    log("==========================================================================")

    takaturnDiamondUpgrade = await deployments.get("TakaturnDiamond")
    collateralFacet = await deployments.get("CollateralFacet")
    fundFacet = await deployments.get("FundFacet")
    termFacet = await deployments.get("TermFacet")
    gettersFacet = await deployments.get("GettersFacet")
    yieldFacet = await deployments.get("YGFacetZaynFi")
    diamondInit = await deployments.get("DiamondInit")
    diamondCutFacet = await deployments.get("_DefaultDiamondCutFacet")
    diamondOwnershipFacet = await deployments.get("_DefaultDiamondOwnershipFacet")
    diamondLoupeFacet = await deployments.get("_DefaultDiamondLoupeFacet")
    diamondERC165Init = await deployments.get("_DefaultDiamondERC165Init")

    contractNames = [
        "TakaturnDiamond",
        "CollateralFacet",
        "FundFacet",
        "TermFacet",
        "GettersFacet",
        "YGFacetZaynFi",
        "DiamondInit",
        "_DefaultDiamondCutFacet",
        "_DefaultDiamondOwnershipFacet",
        "_DefaultDiamondLoupeFacet",
        "_DefaultDiamondERC165Init",
    ]

    contractAddresses = [
        takaturnDiamondUpgrade.address,
        collateralFacet.address,
        fundFacet.address,
        termFacet.address,
        gettersFacet.address,
        yieldFacet.address,
        diamondInit.address,
        diamondCutFacet.address,
        diamondOwnershipFacet.address,
        diamondLoupeFacet.address,
        diamondERC165Init.address,
    ]

    if (!developmentChains.includes(network.name) && process.env.ARBISCAN_API_KEY) {
        log("01. Verifying Diamond...")
        for (let i = 0; i < contractAddresses.length; i++) {
            log(`01. Verifying "${contractNames[i]}"...`)
            await verify(contractAddresses[i], args)
            log(`01. Verified "${contractNames[i]}"...`)
            log("==========================================================================")
        }
        if (isTestnet) {
            log("01. Verifying Withdraw Test Eth Facet...")
            await verify(withdrawTestEthFacet.address, args)
            log("01. Withdraw Test Eth Facet Verified!")
        }
        log("==========================================================================")
    }
}

module.exports.tags = ["defender"]
