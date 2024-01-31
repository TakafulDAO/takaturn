const { assert, expect } = require("chai")
const { isFork, isMainnet, networkConfig } = require("../../utils/_networks")
const { network, ethers } = require("hardhat")
const { impersonateAccount, advanceTime } = require("../../utils/_helpers")
const { abi } = require("../../deployments/localhost/TakaturnDiamond.json")
const { balanceForUser } = require("../utils/test-utils")
const { erc20UnitsFormat } = require("../../utils/units")

!isFork || isMainnet
    ? describe.skip
    : describe.only("Fork Mainnet test. Yield calculations", function () {
          const chainId = network.config.chainId

          let takaturnDiamond, zaynZap

          let deployer

          // Variables from the term to check
          const term = 2
          const participantAddress = "0x92aE5285Ed66cF37B4A7A6F5DD345E2b11be90fd" // Subject of study

          beforeEach(async function () {
              // Impersonate the accounts
              await impersonateAccount(participantAddress)

              // Get the signer
              participantSigner = await ethers.getSigner(participantAddress)

              // Get the contract instances
              const takaturnDiamondAddress = networkConfig[chainId]["takaturnDiamond"]

              takaturnDiamond = await ethers.getContractAt(abi, takaturnDiamondAddress)

              takaturnParticipant = takaturnDiamond.connect(participantSigner)
          })

          describe("Checking current values", function () {
              it("Prints and check values", async function () {
                  const collateralParticipantSummary =
                      await takaturnDiamond.getDepositorCollateralSummary(participantAddress, term)
                  const yieldParticipantSummary = await takaturnDiamond.getUserYieldSummary(
                      participantAddress,
                      term
                  )
                  const yieldSummary = await takaturnDiamond.getYieldSummary(term)

                  //   console.log(`Participant members bank: ${collateralParticipantSummary[1]}`)
                  //   console.log(`Yield deposited by participant ${yieldParticipantSummary[4]}`)
                  //   console.log(`Yield to be withdrawn by participant ${yieldParticipantSummary[5]}`)
                  //   console.log(`Total yield deposited by term ${yieldSummary[2]}`)
                  //   console.log(`Total shares for term ${yieldSummary[4]}`)

                  assert.equal(yieldParticipantSummary[5], 2950246554592115) // Value reported by user
              })
          })

          describe("Proposed solution", function () {
              beforeEach(async function () {
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
                  const newFundFacetCode = await hre.network.provider.send("eth_getCode", [
                      newFundFacet.target,
                  ])
                  const newGettersFacetCode = await hre.network.provider.send("eth_getCode", [
                      newGettersFacet.target,
                  ])
                  const newTermFacetCode = await hre.network.provider.send("eth_getCode", [
                      newTermFacet.target,
                  ])
                  const newYGFacetZaynFiCode = await hre.network.provider.send("eth_getCode", [
                      newYGFacetZaynFi.target,
                  ])

                  //   Set the new code for each facet
                  await hre.network.provider.send("hardhat_setCode", [
                      collateralFacetAddress,
                      newCollateralFacetCode,
                  ])
                  await hre.network.provider.send("hardhat_setCode", [
                      fundFacetAddress,
                      newFundFacetCode,
                  ])
                  await hre.network.provider.send("hardhat_setCode", [
                      gettersFacetAddress,
                      newGettersFacetCode,
                  ])
                  await hre.network.provider.send("hardhat_setCode", [
                      termFacetAddress,
                      newTermFacetCode,
                  ])
                  await hre.network.provider.send("hardhat_setCode", [
                      yGFacetZaynFiAddress,
                      newYGFacetZaynFiCode,
                  ])
              })
              it("Correct yield calculation", async function () {
                  // Previous to the patch could be withdrawn from yield 0.000411862287375209
                  // After the patch should be 0.002559347141517344
                  // What was shown in the UI was 0.002950246554592115
                  // The difference is 0.000391899413074771
                  const withdrawable = await takaturnDiamond.getWithdrawableUserBalance(
                      term,
                      participantAddress
                  )
                  let yieldParticipantSummary = await takaturnDiamond.getUserYieldSummary(
                      participantAddress,
                      term
                  )
                  console.log(`Yield to be withdrawn by participant ${yieldParticipantSummary[5]}`)
                  console.log(`Withdrawable: ${erc20UnitsFormat(withdrawable)} ETH`)

                  const withdrawTx = await takaturnParticipant.withdrawCollateral(term)
                  await Promise.all([
                      expect(withdrawTx)
                          .to.emit(takaturnDiamond, "OnCollateralWithdrawal")
                          .withArgs(term, participantAddress, participantAddress, withdrawable),
                      expect(withdrawTx)
                          .to.emit(takaturnDiamond, "OnYieldClaimed")
                          .withArgs(term, participantAddress, participantAddress, 2559347141517344),
                      // 2559347141517344 = 0.002559347141517344
                  ])
                  yieldParticipantSummary = await takaturnDiamond.getUserYieldSummary(
                      participantAddress,
                      term
                  )
                  console.log(`Yield to be withdrawn by participant ${yieldParticipantSummary[5]}`)
              })
          })
      })
