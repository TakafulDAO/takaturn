const { ethers } = require("hardhat")

async function contractsInfo() {
    const takaturn = await ethers.getContract("TakaturnDiamond")
    const collateralFacet = await ethers.getContract("CollateralFacet")
    const fundFacet = await ethers.getContract("FundFacet")
    const gettersFacet = await ethers.getContract("GettersFacet")
    const termFacet = await ethers.getContract("TermFacet")
    const ygFacet = await ethers.getContract("YGFacetZaynFi")
    const diamondCutFacet = await ethers.getContract("_DefaultDiamondCutFacet")
    const diamondOwnershipFacet = await ethers.getContract("_DefaultDiamondOwnershipFacet")
    const diamondLoupeFacet = await ethers.getContract("_DefaultDiamondLoupeFacet")

    console.log("====================")
    console.log("Takaturn Diamond Contract addresses")
    console.log("====================")

    console.log(`Takaturn Proxy:             ${takaturn.address}`)
    console.log("===========================")

    console.log(`Collateral Facet:           ${collateralFacet.address}`)
    console.log("===========================")

    console.log(`Fund Facet:                 ${fundFacet.address}`)
    console.log("===========================")

    console.log(`Getters Facet:              ${gettersFacet.address}`)
    console.log("===========================")

    console.log(`Term Facet:                 ${termFacet.address}`)
    console.log("===========================")

    console.log(`Yield Facet:                ${ygFacet.address}`)
    console.log("===========================")

    console.log(`Diamond Cut Facet:          ${diamondCutFacet.address}`)
    console.log("===========================")

    console.log(`Diamond Ownership Facet:    ${diamondOwnershipFacet.address}`)
    console.log("===========================")

    console.log(`Diamond Louper Facet:       ${diamondLoupeFacet.address}`)
    console.log("===========================")
}

contractsInfo()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
