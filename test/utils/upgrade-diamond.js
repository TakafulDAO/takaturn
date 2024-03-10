// Live contract ABIs
const takaturnJSON = require("../../deployments/mainnet_arbitrum/TakaturnDiamond.json")
const diamondInitJSON = require("../../deployments/mainnet_arbitrum/DiamondInit.json")
const collateralJSON = require("../../deployments/mainnet_arbitrum/CollateralFacet.json")
const fundJSON = require("../../deployments/mainnet_arbitrum/FundFacet.json")
const gettersJSON = require("../../deployments/mainnet_arbitrum/GettersFacet.json")
const termJSON = require("../../deployments/mainnet_arbitrum/TermFacet.json")
const yGJSON = require("../../deployments/mainnet_arbitrum/YGFacetZaynFi.json")
const diamondCutJSON = require("../../deployments/mainnet_arbitrum/_DefaultDiamondCutFacet.json")

// Local contract ABIs
const newCollateralFacetJSON = require("../../deployments/localhost/CollateralFacet.json")
const newFundFacetJSON = require("../../deployments/localhost/FundFacet.json")
const newGettersFacetJSON = require("../../deployments/localhost/GettersFacet.json")
const newTermFacetJSON = require("../../deployments/localhost/TermFacet.json")
const newYGFacetZaynFiJSON = require("../../deployments/localhost/YGFacetZaynFi.json")

const diamondInitAddress = diamondInitJSON["address"]

async function _getAndChangeCode(newAddress, oldAddress) {
    // Always change the code for the diamondCutFacet and the init contract
    const newCode = await hre.network.provider.send("eth_getCode", [newAddress])
    await hre.network.provider.send("hardhat_setCode", [oldAddress, newCode])
}

async function _prepareDiamondCutSelectors(newFacetAddress, oldSelectors, newSelectors) {
    // Create a new array with the selectors that are in the old selectors array and in the new selectors array
    const selectorsThatRemains = newSelectors.filter((x) => oldSelectors.includes(x))

    // Create a new array with the selectors that are not in the old selectors array but are in the new selectors array
    const selectorsToAdd = newSelectors.filter((x) => !oldSelectors.includes(x))

    // Create a new array with the selectors that are in the old selectors array but are not in the new selectors array
    const selectorsToRemove = oldSelectors.filter((x) => !newSelectors.includes(x))

    // Create the array of address and selectors that remains, to add or to remove
    const addressAndSelectorsThatRemains = []
    const addressAndSelectorsToAdd = []
    const addressAndSelectorsToRemove = []

    if (selectorsThatRemains.length !== 0) {
        addressAndSelectorsThatRemains.push(newFacetAddress, 1, selectorsThatRemains)
    }

    if (selectorsToAdd.length !== 0) {
        addressAndSelectorsToAdd.push(newFacetAddress, 0, selectorsToAdd)
    }

    if (selectorsToRemove.length !== 0) {
        addressAndSelectorsToRemove.push(newFacetAddress, 2, selectorsToRemove)
    }

    return [addressAndSelectorsThatRemains, addressAndSelectorsToAdd, addressAndSelectorsToRemove]
}

async function _checkCodeAndChange(newAddress, oldAddress, newAbi, oldAbi) {
    // For the other facets
    const oldCode = await hre.network.provider.send("eth_getCode", [oldAddress])
    const newCode = await hre.network.provider.send("eth_getCode", [newAddress])

    // If the code is the same, do nothing.
    // If the code is different:
    if (oldCode != newCode) {
        // Get old and new interfaces
        const oldIface = new ethers.Interface(oldAbi)
        const newIface = new ethers.Interface(newAbi)

        const oldSelectors = []
        const newSelectors = []

        // Get the selectors for each function in the old and new interfaces
        for (const fragment of oldIface.fragments) {
            if (fragment.type === "function") {
                // Create an array of the selectors
                oldSelectors.push(oldIface.getFunction(fragment.name).selector)
            }
        }

        for (const fragment of newIface.fragments) {
            if (fragment.type === "function") {
                // Create an array of the selectors
                newSelectors.push(newIface.getFunction(fragment.name).selector)
            }
        }

        // Compare if the selectors are the same, or if there are new selectors
        let differentSelectors = false

        if (oldSelectors.length === newSelectors.length) {
            for (let i = 0; i < oldSelectors.length; i++) {
                if (oldSelectors[i] !== newSelectors[i]) {
                    differentSelectors = true
                    break
                }
            }
        } else {
            differentSelectors = true
        }

        if (!differentSelectors) {
            // If the selectors are the same, change the code
            await hre.network.provider.send("hardhat_setCode", [oldAddress, newCode])
        } else {
            // If the selectors are different, diamond cut manually
            const addressPrepared = await _prepareDiamondCutSelectors(
                newAddress,
                oldSelectors,
                newSelectors
            )

            return addressPrepared
        }
    }
}

async function _alwaysUpdated() {
    const diamondCutFacetAddress = diamondCutJSON["address"]

    newDiamondCutFacet = await ethers.getContract("MockDiamondCutFacet")
    newInit = await ethers.getContract("FakeInit")

    await _getAndChangeCode(newDiamondCutFacet.target, diamondCutFacetAddress)
    await _getAndChangeCode(newInit.target, diamondInitAddress)
}

async function _checkIfNeedsToBeUpdated() {
    // Current facet addresses
    const collateralFacetAddress = collateralJSON["address"]
    const fundFacetAddress = fundJSON["address"]
    const gettersFacetAddress = gettersJSON["address"]
    const termFacetAddress = termJSON["address"]
    const yGFacetZaynFiAddress = yGJSON["address"]

    // New facets
    newCollateralFacet = await ethers.getContract("CollateralFacet")
    newFundFacet = await ethers.getContract("FundFacet")
    newGettersFacet = await ethers.getContract("GettersFacet")
    newTermFacet = await ethers.getContract("TermFacet")
    newYGFacetZaynFi = await ethers.getContract("YGFacetZaynFi")

    // Get the code for each facet (new and old)
    const checkCollateralFacet = await _checkCodeAndChange(
        newCollateralFacet.target,
        collateralFacetAddress,
        newCollateralFacetJSON["abi"],
        collateralJSON["abi"]
    )
    const checkFundFacet = await _checkCodeAndChange(
        newFundFacet.target,
        fundFacetAddress,
        newFundFacetJSON["abi"],
        fundJSON["abi"]
    )
    const checkGettersFacet = await _checkCodeAndChange(
        newGettersFacet.target,
        gettersFacetAddress,
        newGettersFacetJSON["abi"],
        gettersJSON["abi"]
    )
    const checkTermFacet = await _checkCodeAndChange(
        newTermFacet.target,
        termFacetAddress,
        newTermFacetJSON["abi"],
        termJSON["abi"]
    )
    const checkYieldFacet = await _checkCodeAndChange(
        newYGFacetZaynFi.target,
        yGFacetZaynFiAddress,
        newYGFacetZaynFiJSON["abi"],
        yGJSON["abi"]
    )

    const _diamondCutArgs = []

    if (checkCollateralFacet) {
        for (let i = 0; i < checkCollateralFacet.length; i++) {
            if (checkCollateralFacet[i].length !== 0) {
                _diamondCutArgs.push(checkCollateralFacet[i])
            }
        }
    }
    if (checkFundFacet) {
        for (let i = 0; i < checkFundFacet.length; i++) {
            if (checkFundFacet[i].length !== 0) {
                _diamondCutArgs.push(checkFundFacet[i])
            }
        }
    }
    if (checkGettersFacet) {
        for (let i = 0; i < checkGettersFacet.length; i++) {
            if (checkGettersFacet[i].length !== 0) {
                _diamondCutArgs.push(checkGettersFacet[i])
            }
        }
    }
    if (checkTermFacet) {
        for (let i = 0; i < checkTermFacet.length; i++) {
            if (checkTermFacet[i].length !== 0) {
                _diamondCutArgs.push(checkTermFacet[i])
            }
        }
    }
    if (checkYieldFacet) {
        for (let i = 0; i < checkYieldFacet.length; i++) {
            if (checkYieldFacet[i].length !== 0) {
                _diamondCutArgs.push(checkYieldFacet[i])
            }
        }
    }

    return _diamondCutArgs
}

async function _manualDiamondCut(
    _diamondAbi,
    _diamondAddress,
    _addressAndSelectors,
    _initAddress,
    _bytesData
) {
    takaturn = await ethers.getContractAt(_diamondAbi, _diamondAddress)

    await takaturn.diamondCut(_addressAndSelectors, _initAddress, _bytesData)
}

async function upgradeDiamond() {
    // Deploy new needed facets
    await deployments.fixture(["diamondCut"])

    await _alwaysUpdated()
    const addressAndSelectors = await _checkIfNeedsToBeUpdated()

    const bytesData =
        "0x9ff6ec0a000000000000000000000000639fe6ab55c921f74e7fac1ee960c0b6293ba61200000000000000000000000050834f3163758fcc1df9973b6e91f0f0f0434ad30000000000000000000000001534c33ff68cff9e0c5babee5be72bf4cad0826b000000000000000000000000e68f590a735ec00ed292ac9849affcc2d8b50af10000000000000000000000000000000000000000000000000000000000000000"

    await _manualDiamondCut(
        takaturnJSON["abi"],
        takaturnJSON["address"],
        addressAndSelectors,
        diamondInitAddress,
        bytesData
    )
}

module.exports = { upgradeDiamond }
