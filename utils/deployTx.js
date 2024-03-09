//
// Deployment utilities
//

const hre = require("hardhat")

const { isMainnet, isTestnet, isRealChain, isInternal } = require("./_networks.js")

// Wait for 6 blocks confirmation on Mainnet/Testnets.
const NUM_CONFIRMATIONS = isMainnet || isTestnet || isInternal ? 6 : 0

const deploySimpleContract = async (contractName, args, contract) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    if (!args) args = null
    if (!contract) contract = contractName
    const result = await deploy(contractName, {
        contract: contract,
        from: deployer,
        args: args,
        log: true,
        waitConfimations: NUM_CONFIRMATIONS,
    })

    return result
}

const deployUpgradeDiamond = async (
    diamondName,
    diamondOwner,
    args,
    facets,
    initContract,
    initMethod,
    initArgs
) => {
    const { diamond, log } = deployments
    const { deployer } = await getNamedAccounts()
    if (!diamondOwner) diamondOwner = deployer
    if (!args) args = null
    if (!initArgs) initArgs = null
    if (!facets) return
    const result = await diamond.deploy(diamondName, {
        from: deployer,
        owner: diamondOwner,
        args: args,
        facets: facets,
        log: true,
        execute: {
            contract: initContract,
            methodName: initMethod,
            args: initArgs,
        },
        waitConfimations: NUM_CONFIRMATIONS,
    })

    return result
}

const getRawTransaction = async (diamondName, args, facets, initContract, initMethod, initArgs) => {
    const { diamond, catchUnknownSigner, log } = deployments
    const { deployer, diamondOwner } = await getNamedAccounts()
    if (!args) args = null
    if (!initArgs) initArgs = null
    if (!facets) return
    const rawTransaction = await catchUnknownSigner(
        diamond.deploy(diamondName, {
            from: deployer,
            owner: diamondOwner,
            args: args,
            facets: facets,
            log: false,
            execute: {
                contract: initContract,
                methodName: initMethod,
                args: initArgs,
            },
            waitConfimations: NUM_CONFIRMATIONS,
        })
    )
    return rawTransaction
}

module.exports = {
    deploySimpleContract,
    deployUpgradeDiamond,
    getRawTransaction,
}
