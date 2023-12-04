require("dotenv").config()

require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")

/******************************************** Private Keys *********************************************/
const TESTNET_DEPLOYER_PK = process.env.TESTNET_DEPLOYER_PK

/******************************************** Deployer address *****************************************/
const TESTNET_DEPLOYER = process.env.TESTNET_DEPLOYER_ADDRESS

/******************************************* RPC providers **********************************************/
const ARBITRUM_TESTNET_RPC_URL = process.env.ARBITRUM_TESTNET_RPC_URL

/************************************** Networks Scans *************************************************/
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY

/***************************************** Config ******************************************************/

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        compilers: [
            {
                version: "0.6.12",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: "0.8.10",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: "0.8.18",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            blockConfirmations: 1,
            initialBaseFeePerGas: 0,
        },
        testnet_arbitrum: {
            chainId: 421613,
            accounts: [TESTNET_DEPLOYER_PK],
            url: ARBITRUM_TESTNET_RPC_URL,
            blockConfirmations: 6,
            timeout: 900000,
        },
    },
    etherscan: {
        apiKey: {
            arbitrumOne: ARBISCAN_API_KEY,
            arbitrumGoerli: ARBISCAN_API_KEY,
        },
    },
    namedAccounts: {
        deployer: {
            testnet_arbitrum: TESTNET_DEPLOYER,
        },
    },
}
