const { network, ethers } = require("hardhat")
const { developmentChains, isTestnet, isInternal } = require("../../../utils/_networks")
const { verify } = require("../../../scripts/verify")
const { deploySimpleContract } = require("../../../utils/deployTx")
const { ZeroAddress } = require("ethers")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { log } = deployments
    const { deployer } = await getNamedAccounts()

    if (isTestnet || isInternal) {
        log("00.02.01. Deploying strategy...")

        const wethContract = await ethers.getContract("WETH")

        const want = wethContract.target
        const wantUnderlyingToken = wethContract.target
        const poolId = 15
        const vault = ZeroAddress
        const unirouter = ZeroAddress
        const manager = deployer
        const strategist = deployer
        const zaynFeeRecipient = deployer
        const wombatRouter = ZeroAddress
        const weth = wethContract.target

        const args = [
            want,
            wantUnderlyingToken,
            poolId,
            vault,
            unirouter,
            manager,
            strategist,
            zaynFeeRecipient,
            wombatRouter,
            weth,
        ]

        const contractName = "StrategyV2Mock"

        const strategy = await deploySimpleContract(contractName, args)

        log("00.02.01. Strategy Deployed!...")
        log("==========================================================================")

        if (
            !developmentChains.includes(network.name) &&
            process.env.ETHERSCAN_API_KEY &&
            !isInternal
        ) {
            log("00.02.01. Verifying Strategy...")
            await verify(strategy.address, args)
            log("00.02.01. Strategy Verified!")

            log("==========================================================================")
        }
    }
}

module.exports.tags = ["zayn", "takadao_mocks"]
