const { assert } = require("chai")
const { ethers } = require("hardhat")
const { isInternal } = require("../../../utils/_networks")

!isInternal
    ? describe.skip
    : describe("Staging Private Network Tests. Close funding period [ @close ]", function () {
          let deployer, takaturn

          beforeEach(async () => {
              accounts = await ethers.getSigners()

              deployer = accounts[0]

              takaturn = await ethers.getContract("TakaturnDiamond", deployer)
          })

          it("Should close the funding period", async function () {
              const lastTerm = await takaturn.getTermsId()
              const termId = lastTerm[0]

              let closePeriodTx = await takaturn.closeFundingPeriod(termId)

              const receipt = await closePeriodTx.wait()

              assert(receipt.status > 0)
          })
      })
