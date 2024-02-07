const takaturnJSON = require("../../deployments/mainnet_arbitrum/TakaturnDiamond.json")
const diamondInitJSON = require("../../deployments/mainnet_arbitrum/DiamondInit.json")
const collateralJSON = require("../../deployments/mainnet_arbitrum/CollateralFacet.json")
const fundJSON = require("../../deployments/mainnet_arbitrum/FundFacet.json")
const gettersJSON = require("../../deployments/mainnet_arbitrum/GettersFacet.json")
const termJSON = require("../../deployments/mainnet_arbitrum/TermFacet.json")
const yGJSON = require("../../deployments/mainnet_arbitrum/YGFacetZaynFi.json")
const diamondCutJSON = require("../../deployments/mainnet_arbitrum/_DefaultDiamondCutFacet.json")

async function upgradeDiamond() {
    // Current facet addresses
    const diamondInitAddress = diamondInitJSON["address"]
    const collateralFacetAddress = collateralJSON["address"]
    const fundFacetAddress = fundJSON["address"]
    const gettersFacetAddress = gettersJSON["address"]
    const termFacetAddress = termJSON["address"]
    const yGFacetZaynFiAddress = yGJSON["address"]
    const diamondCutFacetAddress = diamondCutJSON["address"]

    // Deploy new needed facets
    await deployments.fixture(["diamondCut"])
    newCollateralFacet = await ethers.getContract("CollateralFacet")
    newFundFacet = await ethers.getContract("FundFacet")
    newGettersFacet = await ethers.getContract("GettersFacet")
    newTermFacet = await ethers.getContract("TermFacet")
    newYGFacetZaynFi = await ethers.getContract("YGFacetZaynFi")
    newDiamondCutFacet = await ethers.getContract("MockDiamondCutFacet")
    newInit = await ethers.getContract("FakeInit")

    // Get the code for each facet
    const newCollateralFacetCode = await hre.network.provider.send("eth_getCode", [
        newCollateralFacet.target,
    ])
    const newFundFacetCode = await hre.network.provider.send("eth_getCode", [newFundFacet.target])
    const newGettersFacetCode = await hre.network.provider.send("eth_getCode", [
        newGettersFacet.target,
    ])
    const newTermFacetCode = await hre.network.provider.send("eth_getCode", [newTermFacet.target])
    const newYGFacetZaynFiCode = await hre.network.provider.send("eth_getCode", [
        newYGFacetZaynFi.target,
    ])
    const newDiamondCutCode = await hre.network.provider.send("eth_getCode", [
        newDiamondCutFacet.target,
    ])
    const newInitCode = await hre.network.provider.send("eth_getCode", [newInit.target])

    //   Set the new code for each facet
    await hre.network.provider.send("hardhat_setCode", [
        collateralFacetAddress,
        newCollateralFacetCode,
    ])
    await hre.network.provider.send("hardhat_setCode", [fundFacetAddress, newFundFacetCode])
    await hre.network.provider.send("hardhat_setCode", [gettersFacetAddress, newGettersFacetCode])
    await hre.network.provider.send("hardhat_setCode", [termFacetAddress, newTermFacetCode])
    await hre.network.provider.send("hardhat_setCode", [yGFacetZaynFiAddress, newYGFacetZaynFiCode])
    await hre.network.provider.send("hardhat_setCode", [diamondCutFacetAddress, newDiamondCutCode])
    await hre.network.provider.send("hardhat_setCode", [diamondInitAddress, newInitCode])

    // Get the diamond
    takaturn = await ethers.getContractAt(takaturnJSON["abi"], takaturnJSON["address"])

    // Todo: Update code to not hardcode the selectors

    const addressAndSelectors = [
        [
            newYGFacetZaynFi.target,
            1,
            ["0xf6a40d2a", "0x27ff9f35", "0xc8eeb578", "0xefbb9761", "0x83da1d76"],
        ],
        [newYGFacetZaynFi.target, 0, ["0x83de6e99", "0xf741e19e"]],
    ]

    const init = diamondInitAddress

    const bytes =
        "0x9ff6ec0a000000000000000000000000694aa1769357215de4fac081bf1f309adc3253060000000000000000000000000153002d20b96532c639313c2d54c3da0910930900000000000000000000000010a40f8d76a7a38bef8ff366329d9305d5cc49860000000000000000000000000b9f2c8d7fd305d1c7fe8eb132865d1252f42d370000000000000000000000000000000000000000000000000000000000000000"

    await takaturn.diamondCut(addressAndSelectors, init, bytes)
}

module.exports = { upgradeDiamond }
