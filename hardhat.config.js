require("dotenv").config()

require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")

/******************************************** Private Keys *********************************************/
const DEPLOYER_PK = process.env.DEPLOYER_PK
const ARBITRUM_MAINNET_DEPLOYER_PK = process.env.ARBITRUM_MAINNET_DEPLOYER_PK
const TESTNET_DEPLOYER_PK = process.env.TESTNET_DEPLOYER_PK

/******************************************** Deployer address *****************************************/
const DEPLOYER = process.env.DEPLOYER_ADDRESS
const TESTNET_DEPLOYER = process.env.TESTNET_DEPLOYER_ADDRESS

/******************************************* RPC providers **********************************************/
const ARBITRUM_MAINNET_RPC_URL = process.env.ARBITRUM_MAINNET_RPC_URL
const ARBITRUM_TESTNET_RPC_URL = process.env.ARBITRUM_TESTNET_RPC_URL
const MUMBAI_TESTNET_RPC_URL = process.env.MUMBAI_TESTNET_RPC_URL

/************************************** Networks Scans *************************************************/
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY

/************************************** Coinmarketcap **************************************************/
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY

/***************************************** Features*****************************************************/
const FORK = process.env.FORK
const GAS_REPORT = process.env.GAS_REPORT
const SIZE = process.env.SIZE

/***************************************** Config ******************************************************/

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        compilers: [
            {
                version: "0.8.20",
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
            forking: {
                //chainId: 42161,
                accounts: [DEPLOYER_PK],
                url: ARBITRUM_MAINNET_RPC_URL,
                blockNumber: 104233350,
                enabled: FORK === "true",
            },
        },
        localhost: {
            chainId: 31337,
            timeout: 60000,
        },
        mainnet_arbitrum: {
            chainId: 42161,
            accounts: [DEPLOYER_PK || ARBITRUM_MAINNET_DEPLOYER_PK],
            url: ARBITRUM_MAINNET_RPC_URL,
            blockConfirmations: 6,
            timeout: 900000,
        },
        testnet_arbitrum: {
            chainId: 421613,
            accounts: [DEPLOYER_PK || TESTNET_DEPLOYER_PK],
            url: ARBITRUM_TESTNET_RPC_URL,
            blockConfirmations: 6,
            timeout: 900000,
        },
        testnet_mumbai: {
            chainId: 80001,
            accounts: [DEPLOYER_PK || TESTNET_DEPLOYER_PK],
            url: MUMBAI_TESTNET_RPC_URL,
            blockConfirmations: 6,
            timeout: 300000,
        },
    },
    etherscan: {
        apiKey: {
            arbitrumOne: ETHERSCAN_API_KEY,
            arbitrumGoerli: ETHERSCAN_API_KEY,
            polygonMumbai: POLYGONSCAN_API_KEY,
        },
    },
    gasReporter: {
        enabled: GAS_REPORT === "true",
        currency: "USD",
        token: "ARB",
        outputFile: "gas-report.txt",
        noColors: true,
        coinmarketcap: COINMARKETCAP_API_KEY,
    },
    namedAccounts: {
        deployer: {
            mainnet_arbitrum: DEPLOYER,

            testnet_arbitrum: TESTNET_DEPLOYER,
            testnet_mumbai: TESTNET_DEPLOYER,

            default: 0,
            localhost: 0,
        },
        diamondOwner: {
            default: 0,
            localhost: 0,
        },
        Takaturn_User_1: {
            default: 1,
            localhost: 1,
        },
        Takaturn_User_2: {
            default: 2,
            localhost: 2,
        },
        Takaturn_User_3: {
            default: 3,
            localhost: 3,
        },
        Takaturn_User_4: {
            default: 4,
            localhost: 4,
        },
        diamondOwner: {
            default: 5,
            localhost: 5,
        },
    },
    mocha: {
        timeout: 300000,
    },
    contractSizer: {
        alphaSort: true,
        runOnCompile: SIZE === "true",
    },
}
