const { assert } = require("chai")
const { ethers } = require("hardhat")
const { isInternal } = require("../../../utils/_networks")

!isInternal
    ? describe.skip
    : describe("Staging Private Network Tests. Start a new cycle and withdraw [ @new-cycle ]", function () {
          let deployer, takaturn

          beforeEach(async () => {
              accounts = await ethers.getSigners()

              deployer = accounts[0]
              participant_1 = accounts[1]
              participant_2 = accounts[2]
              participant_3 = accounts[3]

              takaturn = await ethers.getContract("TakaturnDiamond", deployer)
              usdc = await ethers.getContract("tUSDC", deployer)
          })

          it("Should start a new cycle", async function () {
              const lastTerm = await takaturn.getTermsId()
              const termId = lastTerm[0]

              let startNewCycleTx = await takaturn.startNewCycle(termId)

              const receipt = await startNewCycleTx.wait()

              assert(receipt.status > 0)
          })

          it("Should allow to withdraw the money pot", async function () {
              const lastTerm = await takaturn.getTermsId()
              const termId = lastTerm[0]

              let withdrawTx = await takaturn.connect(participant_1).withdrawFund(termId)

              const receipt = await withdrawTx.wait()

              assert(receipt.status > 0)
          })

          it("Should allow to partially withdraw collateral", async function () {
              const lastTerm = await takaturn.getTermsId()
              const termId = lastTerm[0]

              let withdrawTx = await takaturn.connect(participant_1).withdrawCollateral(termId)

              const receipt = await withdrawTx.wait()

              assert(receipt.status > 0)
          })
      })
