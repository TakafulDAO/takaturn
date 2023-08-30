require("dotenv").config()

require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("hardhat-ethernal")

/******************************************** Private Keys *********************************************/
const DEPLOYER_PK = process.env.DEPLOYER_PK
const ARBITRUM_MAINNET_DEPLOYER_PK = process.env.ARBITRUM_MAINNET_DEPLOYER_PK
const TESTNET_DEPLOYER_PK = process.env.TESTNET_DEPLOYER_PK

/******************************************** Deployer address *****************************************/
const DEPLOYER = process.env.DEPLOYER_ADDRESS
const TESTNET_DEPLOYER = process.env.TESTNET_DEPLOYER_ADDRESS

/******************************************** Mnemonic **************************************************/

const MNEMONIC = "test test test test test test test test test test test junk" // https://hardhat.org/hardhat-network/docs/reference#accounts

/******************************************* RPC providers **********************************************/
const ARBITRUM_MAINNET_RPC_URL = process.env.ARBITRUM_MAINNET_RPC_URL
const ARBITRUM_TESTNET_RPC_URL = process.env.ARBITRUM_TESTNET_RPC_URL

/************************************** Networks Scans *************************************************/
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY

/************************************** Coinmarketcap **************************************************/
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY

/***************************************** Features *****************************************************/
const FORK = process.env.FORK
const GAS_REPORT = process.env.GAS_REPORT
const SIZE = process.env.SIZE

/***************************************** Ethernal *****************************************************/
const ZAYN = process.env.ZAYN
const ETHERNAL_API_KEY = process.env.ETHERNAL_API_KEY
const ETHERNAL_EMAIL = process.env.ETHERNAL_EMAIL
const ETHERNAL_PASSWORD = process.env.ETHERNAL_PASSWORD

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
        zayn: {
            chainId: 42161,
            url: "https://arbi.zayn.fi",
            accounts: {
                mnemonic: MNEMONIC,
                count: 20,
            },
        },
    },
    etherscan: {
        apiKey: {
            arbitrumOne: ARBISCAN_API_KEY,
            arbitrumGoerli: ARBISCAN_API_KEY,
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

            zayn: 0,
            default: 0,
            localhost: 0,
        },
        participant_1: {
            zayn: 1,
            default: 1,
            localhost: 1,
        },
        participant_2: {
            zayn: 2,
            default: 2,
            localhost: 2,
        },
        participant_3: {
            zayn: 3,
            default: 3,
            localhost: 3,
        },
        participant_4: {
            zayn: 4,
            default: 4,
            localhost: 4,
        },
        participant_5: {
            zayn: 5,
            default: 5,
            localhost: 5,
        },
        participant_6: {
            zayn: 6,
            default: 6,
            localhost: 6,
        },
        participant_7: {
            zayn: 7,
            default: 7,
            localhost: 7,
        },
        participant_8: {
            zayn: 8,
            default: 8,
            localhost: 8,
        },
        participant_9: {
            zayn: 9,
            default: 9,
            localhost: 9,
        },
        participant_10: {
            zayn: 10,
            default: 10,
            localhost: 10,
        },
        participant_11: {
            zayn: 11,
            default: 11,
            localhost: 11,
        },
        participant_12: {
            zayn: 12,
            default: 12,
            localhost: 12,
        },
        usdcOwner: {
            zayn: 13,
            default: 13,
            localhost: 13,
            // owner, blacklister,pauser
        },
        usdcMasterMinter: {
            zayn: 14,
            default: 14,
            localhost: 14,
        },
        usdcRegularMinter: {
            zayn: 15,
            default: 15,
            localhost: 15,
        },
        usdcLostAndFound: {
            zayn: 16,
            default: 16,
            localhost: 16,
        },
    },
    mocha: {
        timeout: 300000,
    },
    contractSizer: {
        alphaSort: true,
        runOnCompile: SIZE === "true",
        outputFile: "contracts-size-report.txt",
    },
    ethernal: {
        disabled: ZAYN === "true",
        disableSync: false,
        uploadAst: false,
        email: ETHERNAL_EMAIL,
        password: ETHERNAL_PASSWORD,
        apiToken: ETHERNAL_API_KEY,
        workspace: "Zayn Arbitrum",
        skipFirstBlock: true,
        verbose: false,
    },
    external: {
        contracts: [
            {
                artifacts: "./zayn_artifacts",
            },
        ],
    },
}
