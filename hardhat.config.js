require("dotenv").config()

require("@nomicfoundation/hardhat-verify")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("@nomicfoundation/hardhat-ethers")
require("hardhat-deploy-ethers")
require("@nomicfoundation/hardhat-chai-matchers")

const { joinTerm } = require("./tasks/joinTerm")
const { startTerm } = require("./tasks/startTerm")
const { payContribution } = require("./tasks/payContribution")
const { toggleAutoPay } = require("./tasks/toggleAutoPay")
const { withdrawFund } = require("./tasks/withdrawFund")
const { withdrawCollateral } = require("./tasks/withdrawCollateral")
const { closeFundingPeriod } = require("./tasks/closeFundingPeriod")
const { startNewCycle } = require("./tasks/startNewCycle")
const { termSummary } = require("./tasks/termSummary")
const { fundSummary } = require("./tasks/fundSummary")
const { collateralSummary } = require("./tasks/collateralSummary")
const { yieldSummary } = require("./tasks/yieldSummary")
const { userSummary } = require("./tasks/userSummary")
const { userSummaryByTermId } = require("./tasks/userSummaryByTermId")
const { usdcMint } = require("./tasks/usdcMint")

/******************************************** Private Keys *********************************************/
const DEPLOYER_PK = process.env.DEPLOYER_PK
const ARBITRUM_MAINNET_DEPLOYER_PK = process.env.ARBITRUM_MAINNET_DEPLOYER_PK
const TESTNET_DEPLOYER_PK = process.env.TESTNET_DEPLOYER_PK

/******************************************** Deployer address *****************************************/
const DEPLOYER = process.env.DEPLOYER_ADDRESS
const TESTNET_DEPLOYER = process.env.TESTNET_DEPLOYER_ADDRESS

/******************************************** Diamond Owner address *****************************************/
const DIAMOND_MAINNET_OWNER = process.env.DIAMOND_MAINNET_OWNER
const DIAMOND_SEPOLIA_OWNER = process.env.DIAMOND_SEPOLIA_OWNER

/******************************************* RPC providers **********************************************/
const ARBITRUM_MAINNET_RPC_URL = process.env.ARBITRUM_MAINNET_RPC_URL
const ARBITRUM_TESTNET_GOERLI_RPC_URL = process.env.ARBITRUM_TESTNET_GOERLI_RPC_URL
const ARBITRUM_TESTNET_SEPOLIA_RPC_URL = process.env.ARBITRUM_TESTNET_SEPOLIA_RPC_URL
const ETHEREUM_TESTNET_SEPOLIA_RPC_URL = process.env.ETHEREUM_TESTNET_SEPOLIA_RPC_URL

/************************************** Networks Scans *************************************************/
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY

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
const PARTICIPANT_3_PK = "cf96b1d20ddbaff23c0abada26d28c63dc99c93b75f5a5e698f94e16de51b9f5"

const PARTICIPANT_1_ADDRESS = "0x5ab2d59849a91484ab35312121e8a47a494d1622"
const PARTICIPANT_2_ADDRESS = "0xd26235AF7919C81470481fF4436B5465B0bbF6F2"
const PARTICIPANT_3_ADDRESS = "0x55296ae1c0114A4C20E333571b1DbD40939C80A3"

/***************************************** Tasks ******************************************************/
task("joinTerm", "Join the term")
    .addParam("termId", "The term Id to check")
    .setAction(async (taskArguments, hre) => {
        return joinTerm(taskArguments, hre)
    })

task("startTerm", "Start the term")
    .addParam("termId", "The term Id to check")
    .setAction(async (taskArguments, hre) => {
        return startTerm(taskArguments, hre)
    })

task("payContribution", "Pay contribution for the term")
    .addParam("termId", "The term Id to check")
    .setAction(async (taskArguments, hre) => {
        return payContribution(taskArguments, hre)
    })

task("toggleAutoPay", "Toggle auto pay for the term")
    .addParam("termId", "The term Id to check")
    .setAction(async (taskArguments, hre) => {
        return toggleAutoPay(taskArguments, hre)
    })

task("withdrawFund", "Withdraw fund for the term")
    .addParam("termId", "The term Id to check")
    .setAction(async (taskArguments, hre) => {
        return withdrawFund(taskArguments, hre)
    })

task("withdrawCollateral", "Withdraw collateral for the term")
    .addParam("termId", "The term Id to check")
    .setAction(async (taskArguments, hre) => {
        return withdrawCollateral(taskArguments, hre)
    })

task("closeFundingPeriod", "Close the funding period for the current cycle")
    .addParam("termId", "The term Id to check")
    .setAction(async (taskArguments, hre) => {
        return closeFundingPeriod(taskArguments, hre)
    })

task("startNewCycle", "Start a new cycle")
    .addParam("termId", "The term Id to check")
    .setAction(async (taskArguments, hre) => {
        return startNewCycle(taskArguments, hre)
    })

task("termSummary", "Prints the term summary")
    .addParam("termId", "The term Id to check")
    .setAction(async (taskArguments, hre) => {
        return termSummary(taskArguments, hre)
    })

task("fundSummary", "Prints the fund summary")
    .addParam("termId", "The term Id to check")
    .setAction(async (taskArguments, hre) => {
        return fundSummary(taskArguments, hre)
    })

task("collateralSummary", "Prints the collateral summary")
    .addParam("termId", "The term Id to check")
    .setAction(async (taskArguments, hre) => {
        return collateralSummary(taskArguments, hre)
    })

task("yieldSummary", "Prints the yield summary")
    .addParam("termId", "The term Id to check")
    .setAction(async (taskArguments, hre) => {
        return yieldSummary(taskArguments, hre)
    })

task("userSummary", "Prints the user summary")
    .addParam("userAddress", "The user address to check")
    .setAction(async (taskArguments, hre) => {
        return userSummary(taskArguments, hre)
    })

task("userSummaryByTermId", "Prints the user summary for a term")
    .addParam("userAddress", "The user address to check")
    .addParam("termId", "The term Id to check")
    .setAction(async (taskArguments, hre) => {
        return userSummaryByTermId(taskArguments, hre)
    })

task("usdcMint", "Mint 10000 USDC to user on arbitrum sepolia testnet")
    .addParam("userAddress", "The user address to check")
    .setAction(async (taskArguments, hre) => {
        return usdcMint(taskArguments, hre)
    })
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
                blockNumber: 175144195, // Block to ensure zayn contracts are deployed and trusted sender is set
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
        testnet_arbitrum_goerli: {
            chainId: 421613,
            accounts: [TESTNET_DEPLOYER_PK, PARTICIPANT_1_PK, PARTICIPANT_2_PK, PARTICIPANT_3_PK],
            url: ARBITRUM_TESTNET_GOERLI_RPC_URL,
            blockConfirmations: 6,
            timeout: 900000,
        },
        testnet_arbitrum_sepolia: {
            chainId: 421614,
            accounts: [TESTNET_DEPLOYER_PK, PARTICIPANT_1_PK, PARTICIPANT_2_PK, PARTICIPANT_3_PK],
            url: ARBITRUM_TESTNET_SEPOLIA_RPC_URL,
            blockConfirmations: 6,
            timeout: 900000,
        },
        testnet_ethereum_sepolia: {
            chainId: 11155111,
            accounts: [TESTNET_DEPLOYER_PK, PARTICIPANT_1_PK, PARTICIPANT_2_PK, PARTICIPANT_3_PK],
            url: ETHEREUM_TESTNET_SEPOLIA_RPC_URL,
            blockConfirmations: 6,
            timeout: 900000,
        },
    },
    etherscan: {
        apiKey: {
            arbitrumOne: ARBISCAN_API_KEY,
            arbitrumGoerli: ARBISCAN_API_KEY,
            arbitrumSepolia: ARBISCAN_API_KEY,
            sepolia: ETHERSCAN_API_KEY,
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

            testnet_arbitrum_goerli: TESTNET_DEPLOYER,
            testnet_arbitrum_sepolia: TESTNET_DEPLOYER,
            testnet_ethereum_sepolia: TESTNET_DEPLOYER,

            default: 0,
            localhost: 0,
        },
        participant_1: {
            testnet_arbitrum_goerli: PARTICIPANT_1_ADDRESS,
            testnet_arbitrum_sepolia: PARTICIPANT_1_ADDRESS,
            default: 1,
            localhost: 1,
        },
        participant_2: {
            testnet_arbitrum_goerli: PARTICIPANT_2_ADDRESS,
            testnet_arbitrum_sepolia: PARTICIPANT_2_ADDRESS,
            default: 2,
            localhost: 2,
        },
        participant_3: {
            testnet_arbitrum_goerli: PARTICIPANT_3_ADDRESS,
            testnet_arbitrum_sepolia: PARTICIPANT_3_ADDRESS,
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
        diamondOwner: {
            mainnet_arbitrum: DIAMOND_MAINNET_OWNER,

            testnet_ethereum_sepolia: DIAMOND_SEPOLIA_OWNER,

            default: 17,
            localhost: 17,
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
}
