const { assert } = require("chai")
const { getNamedAccounts, ethers } = require("hardhat")
const { isInternal } = require("../../../utils/_networks")
const { usdcUnits } = require("../../../utils/units")

!isInternal
    ? describe.skip
    : describe("Staging Private Network Tests. Create and join terms [ @private-network ]", function () {
          let deployer, takaturn

          beforeEach(async () => {
              //   deployer = (await getNamedAccounts()).deployer
              //   participant_1 = (await getNamedAccounts()).participant_1
              //   participant_2 = (await getNamedAccounts()).participant_2
              //   participant_3 = (await getNamedAccounts()).participant_3

              accounts = await ethers.getSigners()

              deployer = accounts[0]
              participant_1 = accounts[1]
              participant_2 = accounts[2]
              participant_3 = accounts[3]

              takaturn = await ethers.getContract("TakaturnDiamond", deployer)
              usdc = await ethers.getContract("tUSDC", deployer)

              const amount = usdcUnits("10000")

              await usdc.mintUSDC(participant_1, amount)
              await usdc.mintUSDC(participant_2, amount)
              await usdc.mintUSDC(participant_3, amount)
          })

          it("Should create a term", async function () {
              console.log("Creating term...")
              const totalParticipants = 3
              const registrationPeriod = 60
              const cycleTime = 600
              const contributionAmount = 1
              const contributionPeriod = 300
              const stableTokenAddress = usdc

              const createTermTx = await takaturn.createTerm(
                  totalParticipants,
                  registrationPeriod,
                  cycleTime,
                  contributionAmount,
                  contributionPeriod,
                  stableTokenAddress
              )

              const receipt = await createTermTx.wait()

              assert(receipt.status > 0)

              console.log("Term created on private network")
          })
          xit("Should allow the users to join", async function () {
              const lastTerm = await takaturn.getTermsId()
              const termId = lastTerm[0]

              const participants = [participant_1, participant_2, participant_3]

              // Participants join
              for (let i = 1; i <= participants.length; i++) {
                  console.log(`Participant ${i} joining`)
                  let entrance = await takaturn.minCollateralToDeposit(termId, i - 1)

                  let joinTermTx = await takaturn
                      .connect(participants[i])
                      .joinTerm(termId, true, { value: entrance, gasLimit: 1000000 })

                  const receipt = await joinTermTx.wait()
                  console.log(receipt)
                  console.log("")
                  console.log("")
                  console.log("")

                  assert(receipt.status > 0)

                  console.log(`Participant ${i} joined`)
              }
          })
      })
