async function upgradeDiamond() {
    // Current facet addresses
    const collateralFacetAddress = "0x0b76B7a683C0e57e930A6C53E52fCCa67Af2d0E1"
    const fundFacetAddress = "0x72714C6B27B519670d6dbb1dB381f27f0c902104"
    const gettersFacetAddress = "0x89A410c18056233b44e93a0797dA9379CC6d12a7"
    const termFacetAddress = "0xDEaEBA6De8CC4597baAcbd47dcd8A275Ef3aAe4a"
    const yGFacetZaynFiAddress = "0xF0bf37E51078E9Ece8ec43D18261900a1DC5c1a2"

    // Deploy new needed facets
    await deployments.fixture(["test-yield"])
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

module.exports = { upgradeDiamond }
