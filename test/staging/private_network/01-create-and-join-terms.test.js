const { assert } = require("chai")
const { ethers } = require("hardhat")
const { isInternal } = require("../../../utils/_networks")
const { usdcUnits, erc20Units } = require("../../../utils/units")

!isInternal
    ? describe.skip
    : describe("Staging Private Network Tests. Create and join terms [ @create-and-join ]", function () {
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

          it("Should create a term", async function () {
              console.log("Creating term...")
              const totalParticipants = 3
              const registrationPeriod = 30
              const cycleTime = 60
              const contributionAmount = 10
              const contributionPeriod = 30
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
              //   console.log(participant_1.address)
              //   console.log(participant_2.address)
              //   console.log(participant_3.address)
              //   console.log(await ethers.provider.getBalance(participant_1.address))
              //   console.log(await ethers.provider.getBalance(participant_2.address))
              //   console.log(await ethers.provider.getBalance(deployer.address))
          })
          it("Should allow the users to join with yield generation", async function () {
              const lastTerm = await takaturn.getTermsId()
              const termId = lastTerm[0]

              const participants = [participant_1, participant_2, participant_3]

              const deposit = erc20Units("1")

              await deployer.sendTransaction({
                  to: participant_1,
                  value: deposit,
              })

              await deployer.sendTransaction({
                  to: participant_2,
                  value: deposit, // Sends exactly 1.0 ether
              })

              await deployer.sendTransaction({
                  to: participant_3,
                  value: deposit, // Sends exactly 1.0 ether
              })

              // Participants join
              for (let i = 0; i < participants.length; i++) {
                  //   console.log(`Participant ${i + 1} joining`)
                  //   let entrance = await takaturn.minCollateralToDeposit(termId, i)

                  let joinTermTx = await takaturn
                      .connect(participants[i])
                      .joinTerm(termId, true, { value: deposit, gasLimit: 1000000 })

                  const receipt = await joinTermTx.wait()

                  assert(receipt.status > 0)

                  //   console.log(`Participant ${i + 1} joined`)
              }
          })
      })
