require("dotenv").config()

require("hardhat-deploy")
require("@nomicfoundation/hardhat-ethers")
require("hardhat-deploy-ethers")
require("@nomicfoundation/hardhat-chai-matchers")

/******************************************** Private Keys *********************************************/
const TESTNET_DEPLOYER_PK = process.env.TESTNET_DEPLOYER_PK

/******************************************* RPC providers **********************************************/
const ARBITRUM_MAINNET_RPC_URL = process.env.ARBITRUM_MAINNET_RPC_URL

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
            forking: {
                //chainId: 42161,
                accounts: [TESTNET_DEPLOYER_PK],
                url: ARBITRUM_MAINNET_RPC_URL,
                blockNumber: 157570648, // Block to ensure zayn contracts are deployed and trusted sender is set
                enabled: true,
            },
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
            localhost: 0,
        },
        participant_1: {
            default: 1,
            localhost: 1,
        },
        participant_2: {
            default: 2,
            localhost: 2,
        },
        participant_3: {
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
        grep: "@skip-on-ci", // Find everything with this tag
        invert: true, // Run the grep's inverse set.
    },
}
