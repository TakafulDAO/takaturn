const { expect } = require("chai")
const { getNamedAccounts, ethers } = require("hardhat")
const { developmentChains } = require("../../utils/_networks")
const { getTermStateFromIndex } = require("../../utils/_helpers")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Upgrades Term Facet unit tests", function () {
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
                  // This hardcoded params are taken from the last term already created.
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
          })
      })
