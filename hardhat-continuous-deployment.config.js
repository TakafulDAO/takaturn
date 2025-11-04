require("dotenv").config()

require("@nomicfoundation/hardhat-verify")
require("hardhat-deploy")

/******************************************** Private Keys *********************************************/
const TESTNET_DEPLOYER_PK = process.env.TESTNET_DEPLOYER_PK

/******************************************** Deployer address *****************************************/
const TESTNET_DEPLOYER = process.env.TESTNET_DEPLOYER_ADDRESS

/******************************************* RPC providers **********************************************/
const ARBITRUM_TESTNET_GOERLI_RPC_URL = process.env.ARBITRUM_TESTNET_GOERLI_RPC_URL
const ARBITRUM_TESTNET_SEPOLIA_RPC_URL = process.env.ARBITRUM_TESTNET_SEPOLIA_RPC_URL

/************************************** Networks Scans *************************************************/
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY

/***************************************** Config ******************************************************/

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        compilers: [
            {
                version: "0.4.18",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
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
        testnet_arbitrum_sepolia: {
            chainId: 421614,
            accounts: [TESTNET_DEPLOYER_PK],
            url: ARBITRUM_TESTNET_SEPOLIA_RPC_URL,
            blockConfirmations: 6,
            timeout: 900000,
        },
    },
    etherscan: {
        apiKey: {
            arbitrumGoerli: ETHERSCAN_API_KEY,
            arbitrumSepolia: ETHERSCAN_API_KEY,
        },
        customChains: [
            {
                network: "arbitrumSepolia",
                chainId: 421614,
                urls: {
                    apiURL: "https://api-sepolia.arbiscan.io/api",
                    browserURL: "https://sepolia.arbiscan.io/",
                },
            },
        ],
    },
    sourcify: {
        enabled: true,
    },
    namedAccounts: {
        deployer: {
            testnet_arbitrum: TESTNET_DEPLOYER,
            default: 0,
        },
    },
}
