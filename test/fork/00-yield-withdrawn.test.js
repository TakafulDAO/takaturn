const { assert, expect } = require("chai")
const { isFork, isMainnet, networkConfig } = require("../../utils/_networks")
const { network, ethers } = require("hardhat")
const { impersonateAccount } = require("../../utils/_helpers")
const { abi } = require("../../deployments/localhost/TakaturnDiamond.json")
const { updateFacetsBytecode } = require("../utils/update-facets-bytecode")

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

              await updateFacetsBytecode()
          })

          it.only("Correct yield calculation", async function () {
              const withdrawableBefore = await takaturnDiamond.getWithdrawableUserBalance(
                  term,
                  participantAddress
              )
              const yieldParticipantSummaryBefore = await takaturnDiamond.getUserYieldSummary(
                  participantAddress,
                  term
              )
              const participantBalanceBefore = await ethers.provider.getBalance(participantAddress)

              //   console.log(
              //       `Yield to be withdrawn by participant ${yieldParticipantSummaryBefore[5]}`
              //   )
              //   console.log(`Withdrawable: ${withdrawableBefore}`)

              const withdrawTx = await takaturnParticipant.withdrawCollateral(term)
              await Promise.all([
                  expect(withdrawTx)
                      .to.emit(takaturnDiamond, "OnCollateralWithdrawal")
                      .withArgs(term, participantAddress, participantAddress, withdrawableBefore),
                  expect(withdrawTx)
                      .to.emit(takaturnDiamond, "OnYieldClaimed")
                      .withArgs(term, participantAddress, participantAddress, 3394213108906536),
              ])

              const withdrawableAfter = await takaturnDiamond.getWithdrawableUserBalance(
                  term,
                  participantAddress
              )
              const yieldParticipantSummaryAfter = await takaturnDiamond.getUserYieldSummary(
                  participantAddress,
                  term
              )
              const participantBalanceAfter = await ethers.provider.getBalance(participantAddress)

              //   console.log(`Yield to be withdrawn by participant ${yieldParticipantSummaryAfter[5]}`)

              assert.equal(withdrawableAfter, 0)
              assert.equal(yieldParticipantSummaryAfter[5], 0)

              assert(withdrawableBefore > withdrawableAfter)
              assert(yieldParticipantSummaryBefore[5] > yieldParticipantSummaryAfter[5])

              assert(participantBalanceBefore < participantBalanceAfter)
              assert(participantBalanceAfter > participantBalanceBefore + withdrawableBefore)
          })
      })
