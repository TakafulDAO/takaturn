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
        initialPriceEthUsd: "200000000000", // 2000 USD
        initialPriceUsdcUsd: "100000000", // 1 USD
        // !Alert: The next values are only used when FORKING MAINNET. On your .env file, set FORK=true
        ethUsdPriceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", // Same as mainnet
        usdcUsdPriceFeed: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3", // Same as mainnet
        usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Same as mainnet
        usdcWhale: "0xe68ee8a12c611fd043fb05d65e1548dc1383f2b9", // Same as mainnet
        zaynfiZap: "0x233349f6d0a6f79758BE5E8f75C51b78D7edD60e", // Same as mainnet
        zaynfiVault: "0xE68F590a735Ec00eD292AC9849aFfcC2D8B50aF1", // Same as mainnet
        takaturnDiamond: "0x00042e3895f5eF16b96bc904B9ACc92509624eA2", // Same as mainnet
    },
    42161: {
        name: "mainnet_arbitrum",
        ethUsdPriceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", // https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum
        usdcUsdPriceFeed: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3", // https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum
        usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // https://developers.circle.com/developer/docs/supported-chains-and-currencies#native-usdc
        usdcWhale: "0xe68ee8a12c611fd043fb05d65e1548dc1383f2b9",
        zaynfiZap: "0x233349f6d0a6f79758BE5E8f75C51b78D7edD60e", // https://zaynfi.notion.site/TakaDAO-Zayn-69307edbb64d4830a868e835ac7fb8a7
        zaynfiVault: "0xE68F590a735Ec00eD292AC9849aFfcC2D8B50aF1", // https://zaynfi.notion.site/TakaDAO-Zayn-69307edbb64d4830a868e835ac7fb8a7
        takaturnDiamond: "0x00042e3895f5eF16b96bc904B9ACc92509624eA2",
    },
    421613: {
        name: "testnet_arbitrum",
        ethUsdPriceFeed: "0x62CAe0FA2da220f43a51F86Db2EDb36DcA9A5A08", // https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum
        usdcUsdPriceFeed: "0x1692Bdd32F31b831caAc1b0c9fAF68613682813b", // https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum
        usdc: "0xfd064A18f3BF249cf1f87FC203E90D8f650f2d63", // https://developers.circle.com/developer/docs/usdc-on-testnet#usdc-on-arbitrum-testnet
        usdcWhale: "0x6ed0c4addc308bb800096b8daa41de5ae219cd36",
        zaynfiZap: "0xc931962FAF7eC41CcE5672c058080d655193A77E", // https://zaynfi.notion.site/TakaDAO-Zayn-69307edbb64d4830a868e835ac7fb8a7
        zaynfiVault: "0xC8d4424f1c77CD148aD31b852E8a9fbEC3FAE4e4", // https://zaynfi.notion.site/TakaDAO-Zayn-69307edbb64d4830a868e835ac7fb8a7
        takaturnDiamond: "0x9FBDb4A7E0fe9EA27148Dcd165a61AFEF4fAFf89",
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
