const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../../utils/_networks")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Unit tests. Ownership", function () {
          let takaturnDiamond

          let deployer, participant_1

          let takaturnDiamondDeployer, takaturnDiamondParticipant_1

          beforeEach(async () => {
              // Get the accounts
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              participant_1 = accounts[1]

              // Deploy contracts
              await deployments.fixture(["takaturn_upgrade"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")

              // Connect the accounts
              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)
              takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1)
          })

          describe("Owner and transfer ownership", function () {
              it("Check the current diamond owner", async function () {
                  const currentOwner = await takaturnDiamond.owner()

                  assert.equal(currentOwner, deployer.address)
              })

              it("Transfer the diamond ownership", async function () {
                  await takaturnDiamondDeployer.transferOwnership(participant_1.address)
                  const currentOwner = await takaturnDiamond.owner()

                  assert.equal(currentOwner, participant_1.address)
                  assert(currentOwner != deployer.address)

                  await expect(
                      takaturnDiamondDeployer.transferOwnership(deployer.address)
                  ).to.be.revertedWith("LibDiamond: Must be contract owner")
              })
          })
      })
