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

    console.log(`Takaturn Proxy:             ${takaturn.target}`)
    console.log("===========================")

    console.log(`Collateral Facet:           ${collateralFacet.target}`)
    console.log("===========================")

    console.log(`Fund Facet:                 ${fundFacet.target}`)
    console.log("===========================")

    console.log(`Getters Facet:              ${gettersFacet.target}`)
    console.log("===========================")

    console.log(`Term Facet:                 ${termFacet.target}`)
    console.log("===========================")

    console.log(`Yield Facet:                ${ygFacet.target}`)
    console.log("===========================")

    console.log(`Diamond Cut Facet:          ${diamondCutFacet.target}`)
    console.log("===========================")

    console.log(`Diamond Ownership Facet:    ${diamondOwnershipFacet.target}`)
    console.log("===========================")

    console.log(`Diamond Louper Facet:       ${diamondLoupeFacet.target}`)
    console.log("===========================")
}

contractsInfo()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
