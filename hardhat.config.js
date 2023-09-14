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

/************************************** Networks Scans *************************************************/
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY

/************************************** Coinmarketcap **************************************************/
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY

/***************************************** Features *****************************************************/
const FORK = process.env.FORK
const GAS_REPORT = process.env.GAS_REPORT
const SIZE = process.env.SIZE

/******************************************** Burnable Wallets **************************************/
// Only used for front-end testing
const PARTICIPANT_1_PK = "aa590ecfed7e88085c93a68877d57bed40c16c6bae04da1274beb7091b668f0f"
const PARTICIPANT_2_PK = "7d5e0d884a76313732fab7485890d7f5bf88ea32620800637fab35966c2d7409"
const PARTICIPANT_3_PK = "7d5e0d884a76313732fab7485890d7f5bf88ea32620800637fab35966c2d7409"

const PARTICIPANT_1_ADDRESS = "0x5ab2d59849a91484ab35312121e8a47a494d1622"
const PARTICIPANT_2_ADDRESS = "0xd26235AF7919C81470481fF4436B5465B0bbF6F2"
const PARTICIPANT_3_ADDRESS = "0x73FA3916DEeE2316876A0d88E763C6D6566c50D0"

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
            accounts: [
                DEPLOYER_PK || TESTNET_DEPLOYER_PK,
                PARTICIPANT_1_PK,
                PARTICIPANT_2_PK,
                PARTICIPANT_3_PK,
            ],
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

            default: 0,
            localhost: 0,
        },
        participant_1: {
            testnet_arbitrum: PARTICIPANT_1_ADDRESS,
            default: 1,
            localhost: 1,
        },
        participant_2: {
            testnet_arbitrum: PARTICIPANT_2_ADDRESS,
            default: 2,
            localhost: 2,
        },
        participant_3: {
            testnet_arbitrum: PARTICIPANT_3_ADDRESS,
            default: 3,
            localhost: 3,
        },
        participant_4: {
            default: 4,
            localhost: 4,
        },
        participant_5: {
            default: 5,
            localhost: 5,
        },
        participant_6: {
            default: 6,
            localhost: 6,
        },
        participant_7: {
            default: 7,
            localhost: 7,
        },
        participant_8: {
            default: 8,
            localhost: 8,
        },
        participant_9: {
            default: 9,
            localhost: 9,
        },
        participant_10: {
            default: 10,
            localhost: 10,
        },
        participant_11: {
            default: 11,
            localhost: 11,
        },
        participant_12: {
            default: 12,
            localhost: 12,
        },
        usdcOwner: {
            default: 13,
            localhost: 13,
            // owner, blacklister,pauser
        },
        usdcMasterMinter: {
            default: 14,
            localhost: 14,
        },
        usdcRegularMinter: {
            default: 15,
            localhost: 15,
        },
        usdcLostAndFound: {
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
    external: {
        contracts: [
            {
                artifacts: "./zayn_artifacts",
            },
        ],
    },
}
