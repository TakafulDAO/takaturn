const { assert, expect } = require("chai")
const { isFork, isMainnet, networkConfig } = require("../../utils/_networks")
const { network, ethers } = require("hardhat")
const {
    FundStates,
    getFundStateFromIndex,
    advanceTime,
    impersonateAccount,
} = require("../../utils/_helpers")
const {
    totalParticipants,
    cycleTime,
    contributionAmount,
    contributionPeriod,
    balanceForUser,
    registrationPeriod,
    getRandomInt,
} = require("../utils/test-utils")
const { abi } = require("../../deployments/mainnet_arbitrum/TakaturnDiamond.json")
const { BigNumber } = require("ethers")

let takaturnDiamond, usdc

async function executeCycle(
    termId,
    defaultersAmount = 0,
    specificDefaultersIndices = [],
    withdrawFund = true
) {
    let randomDefaulterIndices = specificDefaultersIndices

    let fund = await takaturnDiamond.getFundSummary(termId)

    let currentCycle = parseInt(fund[6])
    // console.log(`Current cycle is: ${currentCycle}`)

    while (defaultersAmount != randomDefaulterIndices.length) {
        if (defaultersAmount > totalParticipants) {
            //console.log("Too many defaulters specified!")
            break
        }
        let randomInt = getRandomInt(Math.floor(totalParticipants - 1))
        if (!randomDefaulterIndices.includes(randomInt)) {
            //console.log("Defaulting user..")
            randomDefaulterIndices.push(randomInt)
        }
    }

    //console.log(`Random Defaulter Indices: ${randomDefaulterIndices}`)

    let paidAmount = 0
    for (let i = 1; i <= totalParticipants; i++) {
        if (randomDefaulterIndices.includes(i)) {
            continue
        } else {
            try {
                await usdc
                    .connect(accounts[i])
                    .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)

                await takaturnDiamond.connect(accounts[i]).payContribution(termId)
                paidAmount++
                //console.log(`Participant: ${i} paid the contribution`)
            } catch (e) {
                //console.log(e)
            }
        }
    }

    // Artifically increase time to skip the wait
    await advanceTime(contributionPeriod + 1)

    await takaturnDiamondParticipant_1.closeFundingPeriod(termId)

    fund = await takaturnDiamond.getFundSummary(termId)
    let state = fund[1]
    //console.log(`State is: ${getFundStateFromIndex(state)}`)
    expect(getFundStateFromIndex(fund[1])).not.to.equal(FundStates.AcceptingContributions)

    let fundClaimed = false
    let claimant
    let previousBalanceClaimant = 0
    let poolEmpty = 0
    if (withdrawFund) {
        for (let i = 1; i <= totalParticipants; i++) {
            // console.log(`Participant withdrawing: ${i}`)
            try {
                claimant = accounts[i]
                previousBalanceClaimant = await usdc.balanceOf(claimant.address)
                await takaturnDiamond.connect(accounts[i]).withdrawFund(termId)
                fundClaimed = true
                //console.log(`Participant: ${i} withdrew the fund`)
                break
            } catch (e) {
                //console.log(e)
            }
        }
        depositorFundSummary = await takaturnDiamond.getParticipantFundSummary(
            claimant.address,
            termId
        )
        poolEmpty = depositorFundSummary[4]
    }

    let poolEmptyOk = poolEmpty == 0

    if (!fundClaimed) {
        assert.ok(true)
        //console.log("No one claimed the fund")
    } else {
        assert.ok(fundClaimed)
        assert.ok(poolEmptyOk)
        //console.log(`Claimant: ${claimant.address}`)
    }

    // Artifically increase time to skip the wait
    await advanceTime(cycleTime + 1)

    //await makeExcelSheet();
    try {
        await takaturnDiamondParticipant_1.startNewCycle(termId)
        //console.log("New cycle started")
    } catch (e) {
        //console.log(e)
    }

    fund = await takaturnDiamond.getFundSummary(termId)

    let newCycle = parseInt(fund[6])

    //console.log(`We enter to the new cycle. Cycle is: ${newCycle}`)

    let newCycleStarted = currentCycle + 1 == newCycle
    //console.log(`newCycleStarted: ${newCycleStarted}`)
    fund = await takaturnDiamond.getFundSummary(termId)
    state = fund[1]
    //console.log(`State is: ${getFundStateFromIndex(state)}`)

    let fundClosed = getFundStateFromIndex(state) == FundStates.FundClosed
    if (fundClosed) {
        assert.ok(true)
    } else {
        assert.ok(newCycleStarted)
    }
}

!isFork || isMainnet
    ? describe.skip
    : describe("New Zayn Zap", function () {
          const chainId = network.config.chainId

          let deployer,
              participant_1,
              participant_2,
              participant_3,
              participant_4,
              participant_5,
              participant_6,
              participant_7,
              participant_8,
              participant_9,
              participant_10,
              participant_11,
              participant_12
          beforeEach(async function () {
              // Get the accounts
              accounts = await ethers.getSigners()

              // accounts used:
              // 0: deployer
              // 1 - 12: participants

              deployer = accounts[0]
              participant_1 = accounts[1]
              participant_2 = accounts[2]
              participant_3 = accounts[3]
              participant_4 = accounts[4]
              participant_5 = accounts[5]
              participant_6 = accounts[6]
              participant_7 = accounts[7]
              participant_8 = accounts[8]
              participant_9 = accounts[9]
              participant_10 = accounts[10]
              participant_11 = accounts[11]
              participant_12 = accounts[12]

              participants = []
              // From account[1] to account[12]
              for (let i = 1; i <= totalParticipants; i++) {
                  participants.push(accounts[i])
              }

              // Deploy contract
              await deployments.fixture(["takaturn_upgrade"])
              takaturnDiamond = await ethers.getContract("TakaturnDiamond")
              // Get the contract instances

              const usdcAddress = networkConfig[chainId]["usdc"]
              const newZaynZapAddress = "0x1534c33FF68cFF9E0c5BABEe5bE72bf4cad0826b"

              usdc = await ethers.getContractAt(
                  "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                  usdcAddress
              )
              zaynZap = await ethers.getContractAt(
                  "contracts/interfaces/IZaynZapV2TakaDAO.sol:IZaynZapV2TakaDAO",
                  newZaynZapAddress
              )

              // Connect the accounts
              takaturnDiamondDeployer = takaturnDiamond.connect(deployer)
              takaturnDiamondParticipant_1 = takaturnDiamond.connect(participant_1)

              const zapOwner = "0xff0C52AfD43CeCA4c5E674f61fa93BE32647f185"
              const usdcWhale = networkConfig[chainId]["usdcWhale"]

              await impersonateAccount(zapOwner)
              await impersonateAccount(usdcWhale)

              const zapOwnerSigner = await ethers.getSigner(zapOwner)
              const whale = await ethers.getSigner(usdcWhale)

              zaynZapOwner = zaynZap.connect(zapOwnerSigner)
              usdcWhaleSigner = usdc.connect(whale)

              await zaynZapOwner.toggleTrustedSender(takaturnDiamond.address, true, {
                  gasLimit: 1000000,
              })

              let userAddress

              for (let i = 1; i <= totalParticipants; i++) {
                  userAddress = accounts[i].address
                  await usdcWhaleSigner.transfer(userAddress, balanceForUser)

                  await usdc
                      .connect(accounts[i])
                      .approve(takaturnDiamond.address, contributionAmount * 10 ** 6)
              }

              await takaturnDiamond.createTerm(
                  totalParticipants,
                  registrationPeriod,
                  cycleTime,
                  contributionAmount,
                  contributionPeriod,
                  usdc.address
              )

              const ids = await takaturnDiamond.getTermsId()
              const termId = ids[0]

              for (let i = 1; i <= totalParticipants; i++) {
                  const entrance = await takaturnDiamond.minCollateralToDeposit(termId, i - 1)

                  await takaturnDiamond
                      .connect(accounts[i])
                      .joinTerm(termId, true, { value: entrance })
              }
              await advanceTime(registrationPeriod + 1)
              await takaturnDiamond.startTerm(termId)
          })

          it("Check the yield generation", async function () {
              const deployConstants = await takaturnDiamond.getConstants(
                  "ETH/USD",
                  "USDC/USD",
                  "ZaynZap",
                  "ZaynVault"
              )

              assert.equal(deployConstants[2].toLowerCase(), zaynZap.address.toLowerCase())

              const ids = await takaturnDiamond.getTermsId()
              const termId = ids[0]

              let yieldSummary = await takaturnDiamond.getYieldSummary(termId)
              //   console.log(yieldSummary[6])
              console.log(zaynZap.address)

              await executeCycle(termId, 0, [], false) // 1st cycle
              await executeCycle(termId, 0, [], false) // 2nd cycle
              await executeCycle(termId, 0, [], false) // 3rd cycle
              await executeCycle(termId, 0, [], false) // 4th cycle
              await executeCycle(termId, 0, [], false) // 5th cycle
              await executeCycle(termId, 0, [], false) // 6th cycle
              await executeCycle(termId, 0, [], false) // 7th cycle
              await executeCycle(termId, 0, [], false) // 8th cycle
              await executeCycle(termId, 0, [], false) // 9th cycle
              await executeCycle(termId, 0, [], false) // 10th cycle
              await executeCycle(termId, 0, [], false) // 11th cycle
              await executeCycle(termId, 0, [], false) // 12th cycle

              await takaturnDiamond.connect(participant_1).withdrawCollateral(termId)

              let yield = await takaturnDiamond.getUserYieldSummary(participant_1.address, termId)

              let availableYield = yield[3]

              console.log(`Available Yield: ${availableYield}`)

              if (availableYield > 0) {
                  await expect(
                      takaturnDiamond["claimAvailableYield(uint256,address)"](
                          termId,
                          participant_2.address
                      )
                  )
                      .to.emit(takaturnDiamond, "OnYieldClaimed")
                      .withArgs(termId, participant_2.address, availableYield)
              } else {
                  await expect(
                      takaturnDiamond["claimAvailableYield(uint256,address)"](
                          termId,
                          participant_2.address
                      )
                  ).to.be.revertedWith("No yield to withdraw")
              }
          })
      })
