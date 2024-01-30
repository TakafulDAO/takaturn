const { assert, expect } = require("chai")
const { isFork, isMainnet, networkConfig } = require("../../utils/_networks")
const { network, ethers } = require("hardhat")
const { impersonateAccount, advanceTime } = require("../../utils/_helpers")
const { balanceForUser, registrationPeriod } = require("../utils/test-utils")
const { abi } = require("../../deployments/localhost/TakaturnDiamond.json")
const { erc20Units } = require("../../utils/units")

!isFork || isMainnet
    ? describe.skip
    : describe.only("Fork Mainnet test. Yield calculations", function () {
          const chainId = network.config.chainId
          const deployerAddress = "0xF5C5B85eA5f255495e037563cB8cDe3513eE602e"

          let takaturnDiamond

          // Accounts
          let deployer_signer, participantSigner

          let deployer, takaturnParticipant_2

          // Variables from the term to check
          const termId = 2

          const participantAddress = "0x92aE5285Ed66cF37B4A7A6F5DD345E2b11be90fd" // Subject of study

          beforeEach(async function () {
              // Impersonate the accounts
              await impersonateAccount(participantAddress)

              // Get the signer
              participantSigner = await ethers.getSigner(participantAddress)

              // Get the contract instances
              const takaturnDiamondAddress = networkConfig[chainId]["takaturnDiamond"]

              takaturnDiamond = await ethers.getContractAt(abi, takaturnDiamondAddress)

              // Connect the signers
              takaturnParticipant_2 = takaturnDiamond.connect(participantSigner)
          })

          describe("Checking current values", function () {
              it("Prints values", async function () {
                  const collateralParticipantSummary =
                      await takaturnDiamond.getDepositorCollateralSummary(
                          participantAddress,
                          termId
                      )

                  const yieldParticipantSummary = await takaturnDiamond.getUserYieldSummary(
                      participantAddress,
                      termId
                  )

                  const yieldSummary = await takaturnDiamond.getYieldSummary(termId)

                  console.log(`Participant members bank: ${collateralParticipantSummary[1]}`)
                  console.log(`Yield deposited by participant ${yieldParticipantSummary[4]}`)
                  console.log(`Yield to be withdrawn by participant ${yieldParticipantSummary[5]}`)
                  console.log(`Total yield deposited by term ${yieldSummary[2]}`)
                  console.log(`Total shares for term ${yieldSummary[4]}`)

                  assert.equal(yieldParticipantSummary[5], 2950246554592115) // Value reported by user
              })
          })
      })
