const { assert, expect } = require("chai")
const { isFork, isMainnet, networkConfig } = require("../../utils/_networks")
const { network, ethers } = require("hardhat")
const { impersonateAccount } = require("../../utils/_helpers")
const { abi } = require("../../deployments/localhost/TakaturnDiamond.json")
const { upgradeDiamond } = require("../utils/upgrade-diamond")
const { erc20UnitsFormat } = require("../../utils/units")

!isFork || isMainnet
    ? describe.skip
    : describe("Fork Mainnet test. Yield calculations", function () {
          const chainId = network.config.chainId

          let takaturnDiamond

          // Variables from the term to check
          const term = 2
          const participantAddress = "0x92aE5285Ed66cF37B4A7A6F5DD345E2b11be90fd"

          beforeEach(async function () {
              // Impersonate the accounts
              await impersonateAccount(participantAddress)

              // Get the signer
              participantSigner = await ethers.getSigner(participantAddress)

              // Get the contract instances
              const takaturnDiamondAddress = networkConfig[chainId]["takaturnDiamond"]

              takaturnDiamond = await ethers.getContractAt(abi, takaturnDiamondAddress)

              takaturnParticipant = takaturnDiamond.connect(participantSigner)

              await upgradeDiamond()
          })

          it.only("Correct yield calculation", async function () {
              const withdrawable = await takaturnDiamond.getWithdrawableUserBalance(
                  term,
                  participantAddress
              )
              let yieldParticipantSummary = await takaturnDiamond.getUserYieldSummary(
                  participantAddress,
                  term
              )
              console.log(`Yield to be withdrawn by participant ${yieldParticipantSummary[5]}`)
              console.log(`Withdrawable: ${withdrawable}`)

              const withdrawTx = await takaturnParticipant.withdrawCollateral(term)
              await Promise.all([
                  expect(withdrawTx)
                      .to.emit(takaturnDiamond, "OnCollateralWithdrawal")
                      .withArgs(term, participantAddress, participantAddress, withdrawable),
                  expect(withdrawTx)
                      .to.emit(takaturnDiamond, "OnYieldClaimed")
                      .withArgs(term, participantAddress, participantAddress, 2559347141517344),
              ])
              yieldParticipantSummary = await takaturnDiamond.getUserYieldSummary(
                  participantAddress,
                  term
              )
              console.log(`Yield to be withdrawn by participant ${yieldParticipantSummary[5]}`)
          })
      })
