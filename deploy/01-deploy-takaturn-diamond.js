const { network, ethernal } = require("hardhat")
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    isDevnet,
    isFork,
    isZayn,
    isMainnet,
    isTestnet,
} = require("../utils/_networks")
const { verify } = require("../scripts/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { diamond, log } = deployments
    const { deployer, diamondOwner } = await getNamedAccounts()
    const chainId = network.config.chainId
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS
    let sequencerUptimeFeedAddress

    log("01. Deploying Takaturn Diamond...")

    if (isMainnet || isTestnet || (isFork && !isZayn) || (isZayn && !isFork)) {
        sequencerUptimeFeedAddress = networkConfig[chainId]["sequencerUptimeFeed"]
    }

    if (isDevnet && !isFork && !isZayn) {
        const sequencer = await deployments.get("MockSequencer")
        sequencerUptimeFeedAddress = sequencer.address
    }

    const args = []
    const initArgs = [sequencerUptimeFeedAddress]

    const takaturnDiamond = await diamond.deploy("TakaturnDiamond", {
        from: deployer,
        owner: diamondOwner,
        args: args,
        log: true,
        facets: ["CollateralFacet", "FundFacet", "TermFacet", "GettersFacet"],
        execute: {
            contract: "DiamondInit",
            methodName: "init",
            args: initArgs,
        },
        waitConfirmations: waitBlockConfirmations,
    })

    const collateralFacet = await deployments.get("CollateralFacet")
    const fundFacet = await deployments.get("FundFacet")
    const termFacet = await deployments.get("TermFacet")
    const gettersFacet = await deployments.get("GettersFacet")
    const diamondInit = await deployments.get("DiamondInit")
    const diamondCutFacet = await deployments.get("_DefaultDiamondCutFacet")
    const diamondOwnershipFacet = await deployments.get("_DefaultDiamondOwnershipFacet")
    const diamondLoupeFacet = await deployments.get("_DefaultDiamondLoupeFacet")
    const diamondERC165Init = await deployments.get("_DefaultDiamondERC165Init")

    let contractNames = [
        "CollateralFacet",
        "FundFacet",
        "TermFacet",
        "GettersFacet",
        "DiamondInit",
        "_DefaultDiamondCutFacet",
        "_DefaultDiamondOwnershipFacet",
        "_DefaultDiamondLoupeFacet",
        "_DefaultDiamondERC165Init",
        "TakaturnDiamond",
    ]

    let contractAddresses = [
        collateralFacet.address,
        fundFacet.address,
        termFacet.address,
        gettersFacet.address,
        diamondInit.address,
        diamondCutFacet.address,
        diamondOwnershipFacet.address,
        diamondLoupeFacet.address,
        diamondERC165Init.address,
        takaturnDiamond.address,
    ]

    if (isZayn && !isFork) {
        log("==========================================================================")
        log("01. Pushing elements to Ethernal...")
        log("==========================================================================")
        for (let i = 0; i <= 4; i++) {
            log(`01. Pushing "${contractNames[i]}" to Ethernal...`)
            await ethernal.push({
                name: contractNames[i],
                address: contractAddresses[i],
            })
            log(`01. Pushed "${contractNames[i]}" to Ethernal...`)
            log("==========================================================================")
        }

        log("01. Elements pushed to Ethernal...")
        log("==========================================================================")
    }

    log("01. Diamond Deployed!")
    log("==========================================================================")

    if (!developmentChains.includes(network.name) && process.env.ARBISCAN_API_KEY && !isZayn) {
        log("01. Verifying Diamond...")
        for (let i = 0; i < contractAddresses.length; i++) {
            log(`01. Verifying "${contractNames[i]}"...`)
            await verify(contractAddresses[i], args)
            log(`01. Verified "${contractNames[i]}"...`)
            log("==========================================================================")
        }
        log("01. Diamond Verified!")
        log("==========================================================================")
    }
}

module.exports.tags = ["all", "diamond", "takaturn_deploy"]
