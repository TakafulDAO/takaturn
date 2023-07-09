const hre = require("hardhat")

const isFork = process.env.FORK === "true"
const isLocalhost = !isFork && hre.network.name === "localhost"
const isMemnet = hre.network.name === "hardhat"

const isMainnet = hre.network.name.startsWith("mainnet_")
const isTestnet = hre.network.name.startsWith("testnet_")

const isDevnet = isLocalhost //|| isMemnet
const isRealChain = !isLocalhost && !isMemnet
const isProtocolChain = isMemnet || isFork || isLocalhost || isMainnet || isTestnet

const networkConfig = {
    31337: {
        name: "hardhat",
        decimals: "8",
        ethUsdPriceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
        initialPrice: "200000000000", // 2000 // todo: check this values
    },
    42161: {
        name: "mainnet_arbitrum",
        ethUsdPriceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", // todo: add correct address
    },
    421613: {
        name: "testnet_arbitrum",
        ethUsdPriceFeed: "", // todo: add correct address
    },
    80001: {
        name: "testnet_mumbai",
        ethUsdPriceFeed: "", // todo: add correct address
    },
}

const developmentChains = ["hardhat", "localhost"]
const VERIFICATION_BLOCK_CONFIRMATIONS = 6

module.exports = {
    isFork,
    isLocalhost,
    isMemnet,
    isMainnet,
    isTestnet,
    isDevnet,
    isRealChain,
    isProtocolChain,
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
}
