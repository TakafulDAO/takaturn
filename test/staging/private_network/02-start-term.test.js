const { assert } = require("chai")
const { ethers } = require("hardhat")
const { isInternal } = require("../../../utils/_networks")

!isInternal
    ? describe.skip
    : describe("Staging Private Network Tests. Start terms [ @start ]", function () {
          let deployer, takaturn

          beforeEach(async () => {
              accounts = await ethers.getSigners()

              deployer = accounts[0]

              takaturn = await ethers.getContract("TakaturnDiamond", deployer)
          })

          it("Should start a term", async function () {
              const lastTerm = await takaturn.getTermsId()
              const termId = lastTerm[0]

              let startTermTx = await takaturn.startTerm(termId)

              const receipt = await startTermTx.wait()

              assert(receipt.status > 0)
          })
      })
