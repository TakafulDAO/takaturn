const { expect, assert } = require("chai")
const { getNamedAccounts, ethers } = require("hardhat")
const { isTestnet } = require("../../../utils/_networks")
const { getTermStateFromIndex } = require("../../../utils/_helpers")

!isTestnet
    ? describe.skip
    : describe("Staging Testnet Test. Upgrades checks", function () {
          let deployer, takaturn

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer
              takaturn = await ethers.getContract("TakaturnDiamond", deployer)
              console.log(
                  "Please be aware that this tests are calling the blockchain and can take a while to finish."
              )
              console.log(
                  "=================================================================================="
              )
          })

          describe("After upgrade check", function () {
              it("Should check the correct term params for the term id 0", async function () {
                  // This test check that old terms are still working after the upgrade
                  // This hardcoded params are taken from the first term already created
                  const termId = 0
                  const initialized = true
                  const state = "InitializingTerm"
                  const termOwner = "0xca01ec47798B8Dd0708BBe0855DdB35bC66D959F"
                  const creationTime = 1693461145
                  const registrationPeriod = 86400
                  const totalParticipants = 3
                  const cycleTime = 172800
                  const contributionAmount = 10
                  const contributionPeriod = 86400
                  const stableTokenAddress = "0x72A9c57cD5E2Ff20450e409cF6A542f1E6c710fc"

                  const termParams = await takaturn.getTermSummary(0)

                  console.log(`termId: ${termParams.termId}`)
                  console.log(`initialized: ${termParams.initialized}`)
                  console.log(`state: ${getTermStateFromIndex(termParams.state)}`)
                  console.log(`termOwner: ${termParams.termOwner}`)
                  console.log(`creationTime: ${termParams.creationTime}`)
                  console.log(`registrationPeriod: ${termParams.registrationPeriod}`)
                  console.log(`totalParticipants: ${termParams.totalParticipants}`)
                  console.log(`cycleTime: ${termParams.cycleTime}`)
                  console.log(`contributionAmount:: ${termParams.contributionAmount}`)
                  console.log(`contributionPeriod:: ${termParams.contributionPeriod}`)
                  console.log(`stableTokenAddress:: ${termParams.stableTokenAddress}`)

                  expect(termParams.termId).to.equal(termId)
                  expect(termParams.initialized).to.equal(initialized)
                  expect(getTermStateFromIndex(termParams.state)).to.equal(state)
                  expect(termParams.termOwner).to.equal(termOwner)
                  expect(termParams.creationTime).to.equal(creationTime)
                  expect(termParams.registrationPeriod).to.equal(registrationPeriod)
                  expect(termParams.totalParticipants).to.equal(totalParticipants)
                  expect(termParams.cycleTime).to.equal(cycleTime)
                  expect(termParams.contributionAmount).to.equal(contributionAmount)
                  expect(termParams.contributionPeriod).to.equal(contributionPeriod)
                  expect(termParams.stableTokenAddress).to.equal(stableTokenAddress)
              })

              it("Should check the correct term params for the last term id", async function () {
                  // This test check that the last term after the upgrade is working after the upgrade
                  // This term is created via the createTerm.js script just before the upgrade
                  // The test should be updated if the createTerm.js script changes
                  // The flow is: createTerm.js -> upgrade contract -> this test

                  const termIds = await takaturn.getTermsId()

                  const termId = termIds[0]
                  const initialized = true
                  const state = "InitializingTerm"
                  const registrationPeriod = 86400
                  const totalParticipants = 4
                  const cycleTime = 172800
                  const contributionAmount = 10
                  const contributionPeriod = 86400
                  const stableTokenAddress = "0x72A9c57cD5E2Ff20450e409cF6A542f1E6c710fc"

                  const termParams = await takaturn.getTermSummary(termId)

                  console.log(`termId: ${termParams.termId}`)
                  console.log(`initialized: ${termParams.initialized}`)
                  console.log(`state: ${getTermStateFromIndex(termParams.state)}`)
                  console.log(`termOwner: ${termParams.termOwner}`)
                  console.log(`creationTime: ${termParams.creationTime}`)
                  console.log(`registrationPeriod: ${termParams.registrationPeriod}`)
                  console.log(`totalParticipants: ${termParams.totalParticipants}`)
                  console.log(`cycleTime: ${termParams.cycleTime}`)
                  console.log(`contributionAmount:: ${termParams.contributionAmount}`)
                  console.log(`contributionPeriod:: ${termParams.contributionPeriod}`)
                  console.log(`stableTokenAddress:: ${termParams.stableTokenAddress}`)

                  expect(termParams.termId).to.equal(termId)
                  expect(termParams.initialized).to.equal(initialized)
                  expect(getTermStateFromIndex(termParams.state)).to.equal(state)
                  expect(termParams.registrationPeriod).to.equal(registrationPeriod)
                  expect(termParams.totalParticipants).to.equal(totalParticipants)
                  expect(termParams.cycleTime).to.equal(cycleTime)
                  expect(termParams.contributionAmount).to.equal(contributionAmount)
                  expect(termParams.contributionPeriod).to.equal(contributionPeriod)
                  expect(termParams.stableTokenAddress).to.equal(stableTokenAddress)
              })

              it("Should check the correct term params for the last term id", async function () {
                  // This test check the termIds upgrade correctly after the upgrade
                  const termIds = await takaturn.getTermsId()
                  // The last Term id before the upgrade
                  const termIdBefore = termIds[0]

                  // Create a new term after the upgrade
                  console.log("Creating term...")
                  const totalParticipants = 3
                  const registrationPeriod = 86400
                  const cycleTime = 172800
                  const contributionAmount = 10
                  const contributionPeriod = 86400
                  const stableTokenAddress = "0x72A9c57cD5E2Ff20450e409cF6A542f1E6c710fc"

                  await expect(
                      takaturn.createTerm(
                          totalParticipants,
                          registrationPeriod,
                          cycleTime,
                          contributionAmount,
                          contributionPeriod,
                          stableTokenAddress
                      )
                  ).to.emit(takaturn, "OnTermCreated")

                  console.log("Term created on testnet")

                  // Get the new termIds
                  const termIdsAfter = await takaturn.getTermsId()
                  // The last Term id after the upgrade
                  const termIdAfter = termIdsAfter[0]

                  assert.equal(termIdBefore, termIdAfter - 1)
              })
          })
      })
