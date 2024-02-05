const collateralJSON = require("../../deployments/mainnet_arbitrum/CollateralFacet.json")
const fundJSON = require("../../deployments/mainnet_arbitrum/FundFacet.json")
const gettersJSON = require("../../deployments/mainnet_arbitrum/GettersFacet.json")
const termJSON = require("../../deployments/mainnet_arbitrum/TermFacet.json")
const yGJSON = require("../../deployments/mainnet_arbitrum/YGFacetZaynFi.json")

async function updateFacetsBytecode() {
    // Current facet addresses
    const collateralFacetAddress = collateralJSON["address"]
    const fundFacetAddress = fundJSON["address"]
    const gettersFacetAddress = gettersJSON["address"]
    const termFacetAddress = termJSON["address"]
    const yGFacetZaynFiAddress = yGJSON["address"]

    // Deploy new needed facets
    await deployments.fixture(["facets"])
    newCollateralFacet = await ethers.getContract("CollateralFacet")
    newFundFacet = await ethers.getContract("FundFacet")
    newGettersFacet = await ethers.getContract("GettersFacet")
    newTermFacet = await ethers.getContract("TermFacet")
    newYGFacetZaynFi = await ethers.getContract("YGFacetZaynFi")

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

    //   Set the new code for each facet
    await hre.network.provider.send("hardhat_setCode", [
        collateralFacetAddress,
        newCollateralFacetCode,
    ])
    await hre.network.provider.send("hardhat_setCode", [fundFacetAddress, newFundFacetCode])
    await hre.network.provider.send("hardhat_setCode", [gettersFacetAddress, newGettersFacetCode])
    await hre.network.provider.send("hardhat_setCode", [termFacetAddress, newTermFacetCode])
    await hre.network.provider.send("hardhat_setCode", [yGFacetZaynFiAddress, newYGFacetZaynFiCode])
}

module.exports = { updateFacetsBytecode }
