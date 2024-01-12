const { assert } = require("chai")
const { getNamedAccounts, ethers } = require("hardhat")
const { isInternal } = require("../../../utils/_networks")
const { usdcUnits, erc20Units } = require("../../../utils/units")

!isInternal
    ? describe.skip
    : describe("Staging Private Network Tests. Pay contribution [ @pay ]", function () {
          let deployer, takaturn

          beforeEach(async () => {
              accounts = await ethers.getSigners()

              deployer = accounts[0]
              participant_1 = accounts[1]
              participant_2 = accounts[2]
              participant_3 = accounts[3]

              takaturn = await ethers.getContract("TakaturnDiamond", deployer)
              usdc = await ethers.getContract("tUSDC", deployer)

              const amount = usdcUnits("10000")

              await usdc.connect(participant_1).approve(takaturn, amount)
              await usdc.connect(participant_2).approve(takaturn, amount)
              await usdc.connect(participant_3).approve(takaturn, amount)

              //   await usdc.mintUSDC(participant_1, amount)
              //   await usdc.mintUSDC(participant_2, amount)
              //   await usdc.mintUSDC(participant_3, amount)
          })

          it("Should allow the users to pay the contribution", async function () {
              const lastTerm = await takaturn.getTermsId()
              const termId = lastTerm[0]

              // Participants pay contribution

              let payContributionTx = await takaturn.connect(participant_2).payContribution(termId)

              let receipt = await payContributionTx.wait()

              assert(receipt.status > 0)

              payContributionTx = await takaturn.connect(participant_3).payContribution(termId)

              receipt = await payContributionTx.wait()

              assert(receipt.status > 0)
          })
      })
