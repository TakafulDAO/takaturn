const hre = require("hardhat")

const isFork = process.env.FORK === "true"
const isLocalhost = !isFork && hre.network.name === "localhost"
const isMemnet = hre.network.name === "hardhat"

const isMainnet = hre.network.name.startsWith("mainnet_")
const isTestnet = hre.network.name.startsWith("testnet_")

const isDevnet = isLocalhost || isMemnet
const isRealChain = !isLocalhost && !isMemnet
const isProtocolChain = isMemnet || isFork || isLocalhost || isMainnet || isTestnet

const networkConfig = {
    31337: {
        name: "hardhat",
        // !Alert: The next two values are only used when working on localhost WITHOUT FORK. On your .env file, set FORK=false
        decimals: "8",
        initialPrice: "200000000000", // 2000 USD
        // !Alert: The next values are only used when FORKING MAINNET. On your .env file, set FORK=true
        ethUsdPriceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", // Same as mainnet
        usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Same as mainnet
        usdcWhale: "0xe68ee8a12c611fd043fb05d65e1548dc1383f2b9", // Same as mainnet
    },
    42161: {
        name: "mainnet_arbitrum",
        ethUsdPriceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", // https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum
        usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // https://developers.circle.com/developer/docs/supported-chains-and-currencies#native-usdc
        usdcWhale: "0xe68ee8a12c611fd043fb05d65e1548dc1383f2b9",
        l2SequencerFeed: "0xFdB631F5EE196F0ed6FAa767959853A9F217697D", // https://docs.chain.link/data-feeds/l2-sequencer-feeds
    },
    421613: {
        name: "testnet_arbitrum",
        ethUsdPriceFeed: "0x62CAe0FA2da220f43a51F86Db2EDb36DcA9A5A08", // https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum
        usdc: "0xfd064A18f3BF249cf1f87FC203E90D8f650f2d63", // https://developers.circle.com/developer/docs/usdc-on-testnet#usdc-on-arbitrum-testnet
        usdcWhale: "0x6ed0c4addc308bb800096b8daa41de5ae219cd36",
        l2SequencerFeed: "0x4da69F028a5790fCCAfe81a75C0D24f46ceCDd69", // https://docs.chain.link/data-feeds/l2-sequencer-feeds
    },
    80001: {
        name: "testnet_mumbai",
        ethUsdPriceFeed: "0x0715A7794a1dc8e42615F059dD6e406A6594651A", // https://docs.chain.link/data-feeds/price-feeds/addresses?network=polygon
        usdc: "0x0FA8781a83E46826621b3BC094Ea2A0212e71B23", // https://developers.circle.com/developer/docs/usdc-on-testnet#bridged-usdc-on-polygon-testnet
        usdcWhale: "0x48520ff9b32d8b5bf87abf789ea7b3c394c95ebe",
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
