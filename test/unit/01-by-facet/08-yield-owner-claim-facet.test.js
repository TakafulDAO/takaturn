const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../../utils/_networks")
const { advanceTime } = require("../../../utils/_helpers")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Unit Tests. Yield Owner Claim Facet", function () {
          const totalParticipants = 3
          const cycleTime = 180
          const contributionAmount = 10
          const contributionPeriod = 120
          const registrationPeriod = 120

          let takaturnDiamond

          let deployer,
              participant_1,
              participant_2,
              participant_3,
              participant_4,
              receiver_1,
              receiver_2

          let takaturnDiamondDeployer, takaturnDiamondParticipant_1

          beforeEach(async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              participant_1 = accounts[1]
              participant_2 = accounts[2]
              participant_3 = accounts[3]
              participant_4 = accounts[4]
              receiver_1 = accounts[5]
              receiver_2 = accounts[6]

              await deployments.fixture(["takaturn_upgrade"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")

              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)
              takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1)

              await takaturnDiamondParticipant_1.createTerm(
                  totalParticipants,
                  registrationPeriod,
                  cycleTime,
                  contributionAmount,
                  contributionPeriod,
                  deployer.address
              )

              const termIds = await takaturnDiamondDeployer.getTermsId()
              const termId = termIds[0]

              for (let i = 1; i <= totalParticipants; i++) {
                  const entrance = await takaturnDiamondDeployer.minCollateralToDeposit(
                      termId,
                      i - 1
                  )

                  await takaturnDiamond
                      .connect(accounts[i])
                      ["joinTerm(uint256,bool)"](termId, false, { value: entrance })
              }

              await advanceTime(registrationPeriod + 1)

              await takaturnDiamondDeployer.startTerm(termId)
          })

          describe("claimAvailableYieldForUser", function () {
              it("Owner claims available yield for multiple users", async function () {
                  const termIds = await takaturnDiamondDeployer.getTermsId()
                  const termId = termIds[0]
                  const yield_1 = ethers.parseEther("0.01")
                  const yield_2 = ethers.parseEther("0.02")
                  const diamondAddress = await takaturnDiamond.getAddress()

                  await takaturnDiamondDeployer.testHelper_setAvailableYield(
                      termId,
                      yield_1,
                      participant_1.address
                  )
                  await takaturnDiamondDeployer.testHelper_setAvailableYield(
                      termId,
                      yield_2,
                      participant_2.address
                  )

                  await deployer.sendTransaction({
                      to: diamondAddress,
                      value: yield_1 + yield_2,
                  })

                  const receiver1BalanceBefore = await ethers.provider.getBalance(
                      receiver_1.address
                  )
                  const receiver2BalanceBefore = await ethers.provider.getBalance(
                      receiver_2.address
                  )

                  const claimTx = takaturnDiamondDeployer.claimAvailableYieldForUser(
                      [participant_1.address, participant_2.address],
                      [termId, termId],
                      [receiver_1.address, receiver_2.address]
                  )

                  await Promise.all([
                      expect(claimTx)
                          .to.emit(takaturnDiamond, "OnYieldClaimed")
                          .withArgs(termId, participant_1.address, receiver_1.address, yield_1),
                      expect(claimTx)
                          .to.emit(takaturnDiamond, "OnYieldClaimed")
                          .withArgs(termId, participant_2.address, receiver_2.address, yield_2),
                  ])

                  const receiver1BalanceAfter = await ethers.provider.getBalance(
                      receiver_1.address
                  )
                  const receiver2BalanceAfter = await ethers.provider.getBalance(
                      receiver_2.address
                  )
                  const user1AvailableYield =
                      await takaturnDiamondDeployer.testHelper_getAvailableYield(
                          termId,
                          participant_1.address
                      )
                  const user2AvailableYield =
                      await takaturnDiamondDeployer.testHelper_getAvailableYield(
                          termId,
                          participant_2.address
                      )

                  assert.equal(
                      (receiver1BalanceAfter - receiver1BalanceBefore).toString(),
                      yield_1.toString()
                  )
                  assert.equal(
                      (receiver2BalanceAfter - receiver2BalanceBefore).toString(),
                      yield_2.toString()
                  )
                  assert.equal(user1AvailableYield.toString(), "0")
                  assert.equal(user2AvailableYield.toString(), "0")
              })

              it("Skips users with no available yield", async function () {
                  const termIds = await takaturnDiamondDeployer.getTermsId()
                  const termId = termIds[0]
                  const yield_2 = ethers.parseEther("0.02")
                  const diamondAddress = await takaturnDiamond.getAddress()

                  await takaturnDiamondDeployer.testHelper_setAvailableYield(
                      termId,
                      yield_2,
                      participant_2.address
                  )

                  await deployer.sendTransaction({
                      to: diamondAddress,
                      value: yield_2,
                  })

                  const receiver1BalanceBefore = await ethers.provider.getBalance(
                      receiver_1.address
                  )
                  const receiver2BalanceBefore = await ethers.provider.getBalance(
                      receiver_2.address
                  )

                  await expect(
                      takaturnDiamondDeployer.claimAvailableYieldForUser(
                          [participant_1.address, participant_2.address],
                          [termId, termId],
                          [receiver_1.address, receiver_2.address]
                      )
                  )
                      .to.emit(takaturnDiamond, "OnYieldClaimed")
                      .withArgs(termId, participant_2.address, receiver_2.address, yield_2)

                  const receiver1BalanceAfter = await ethers.provider.getBalance(
                      receiver_1.address
                  )
                  const receiver2BalanceAfter = await ethers.provider.getBalance(
                      receiver_2.address
                  )
                  const user1AvailableYield =
                      await takaturnDiamondDeployer.testHelper_getAvailableYield(
                          termId,
                          participant_1.address
                      )
                  const user2AvailableYield =
                      await takaturnDiamondDeployer.testHelper_getAvailableYield(
                          termId,
                          participant_2.address
                      )

                  assert.equal(receiver1BalanceAfter.toString(), receiver1BalanceBefore.toString())
                  assert.equal(
                      (receiver2BalanceAfter - receiver2BalanceBefore).toString(),
                      yield_2.toString()
                  )
                  assert.equal(user1AvailableYield.toString(), "0")
                  assert.equal(user2AvailableYield.toString(), "0")
              })

              describe("Reverts", function () {
                  it("If caller is not owner", async function () {
                      const termIds = await takaturnDiamondDeployer.getTermsId()
                      const termId = termIds[0]
                      const yield_1 = ethers.parseEther("0.01")
                      const diamondAddress = await takaturnDiamond.getAddress()

                      await takaturnDiamondDeployer.testHelper_setAvailableYield(
                          termId,
                          yield_1,
                          participant_1.address
                      )

                      await deployer.sendTransaction({
                          to: diamondAddress,
                          value: yield_1,
                      })

                      await expect(
                          takaturnDiamondParticipant_1.claimAvailableYieldForUser(
                              [participant_1.address],
                              [termId],
                              [receiver_1.address]
                          )
                      ).to.be.revertedWith("LibDiamond: Must be contract owner")
                  })

                  it("If user is not part of the turn group", async function () {
                      const termIds = await takaturnDiamondDeployer.getTermsId()
                      const termId = termIds[0]
                      const yield_1 = ethers.parseEther("0.01")
                      const diamondAddress = await takaturnDiamond.getAddress()

                      await takaturnDiamondDeployer.testHelper_setAvailableYield(
                          termId,
                          yield_1,
                          participant_4.address
                      )

                      await deployer.sendTransaction({
                          to: diamondAddress,
                          value: yield_1,
                      })

                      await expect(
                          takaturnDiamondDeployer.claimAvailableYieldForUser(
                              [participant_4.address],
                              [termId],
                              [receiver_1.address]
                          )
                      ).to.be.revertedWith("TT-YF-01")
                  })
              })
          })
      })
