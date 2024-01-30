const { assert, expect } = require("chai")
const { isFork, isMainnet, networkConfig } = require("../../utils/_networks")
const { network, ethers } = require("hardhat")
const { impersonateAccount, advanceTime } = require("../../utils/_helpers")
const { balanceForUser, registrationPeriod } = require("../utils/test-utils")
const { abi } = require("../../deployments/localhost/TakaturnDiamond.json")

!isFork || isMainnet
    ? describe.skip
    : describe.only("Fork Mainnet test. Yield calculations", function () {
          const chainId = network.config.chainId
          const deployerAddress = "0xF5C5B85eA5f255495e037563cB8cDe3513eE602e"

          let takaturnDiamond

          // Accounts
          let deployer_signer,
              participant_1_signer,
              participant_2_signer,
              participant_3_signer,
              participant_4_signer

          let deployer,
              takaturnParticipant_1,
              takaturnParticipant_2,
              takaturnParticipant_3,
              takaturnParticipant_4

          // Variables from the term to check
          const termId = 2

          const participant_1_address = "0x773D44a5F9FF345440565B26526E7b89c03f5418"
          const participant_2_address = "0x92aE5285Ed66cF37B4A7A6F5DD345E2b11be90fd"
          const participant_3_address = "0xA253ABb03A060b2C170ead2772D3171Cae484643"
          const participant_4_address = "0xA8d00383fE40A161020B53b2a741047150a88599"

          beforeEach(async function () {
              // Impersonate the accounts
              await impersonateAccount(participant_1_address)
              await impersonateAccount(participant_2_address)
              await impersonateAccount(participant_3_address)
              await impersonateAccount(participant_4_address)

              // Get the signer
              participant_1_signer = await ethers.getSigner(participant_1_address)
              participant_2_signer = await ethers.getSigner(participant_2_address)
              participant_3_signer = await ethers.getSigner(participant_3_address)
              participant_4_signer = await ethers.getSigner(participant_4_address)

              // Get the contract instances
              const takaturnDiamondAddress = networkConfig[chainId]["takaturnDiamond"]

              takaturnDiamond = await ethers.getContractAt(abi, takaturnDiamondAddress)

              // Connect the signers
              takaturnParticipant_1 = takaturnDiamond.connect(participant_1_signer)
              takaturnParticipant_2 = takaturnDiamond.connect(participant_2_signer)
              takaturnParticipant_3 = takaturnDiamond.connect(participant_3_signer)
              takaturnParticipant_4 = takaturnDiamond.connect(participant_4_signer)
          })

          describe("Checking current values", function () {
              it("Prints values", async function () {})
          })
      })
