const { erc20UnitsFormat } = require("../utils/units")

async function _userSummaryByTermId(taskArguments, hre) {
    const takaturn = await ethers.getContract("TakaturnDiamond")

    console.log(`The user summary on term: ${taskArguments.termId} is:`)
    const userCollateralSummary = await takaturn.getDepositorCollateralSummary(
        taskArguments.userAddress,
        taskArguments.termId
    )
    const userFundSummary = await takaturn.getParticipantFundSummary(
        taskArguments.userAddress,
        taskArguments.termId
    )
    const userYieldSummary = await takaturn.getUserYieldSummary(
        taskArguments.userAddress,
        taskArguments.termId
    )
    console.log("")
    console.log("Collateral Summary:")
    console.log(`User is collateral Member: ${userCollateralSummary[0]}`)
    console.log(`User collateral Members Bank: ${erc20UnitsFormat(userCollateralSummary[1])} ETH`)
    console.log(`User collateral Payment Bank: ${erc20UnitsFormat(userCollateralSummary[2])} ETH`)
    console.log(`Collateral Deposited: ${erc20UnitsFormat(userCollateralSummary[3])} ETH`)
    console.log(`Expulsion limit: ${erc20UnitsFormat(userCollateralSummary[4])} ETH`)
    console.log("")
    console.log("Fund Summary:")
    console.log(`User is fund Participant: ${userFundSummary[0]}`)
    console.log(`User have been beneficiary: ${userFundSummary[1]}`)
    console.log(`User paid the current cycle: ${userFundSummary[2]}`)
    console.log(`User enabled auto pay: ${userFundSummary[3]}`)
    console.log(`User beneficiaries pool: ${userFundSummary[4]} USDC`)
    console.log(`User pool is frozen: ${userFundSummary[5]}`)
    console.log("")
    console.log("Yield Summary:")
    if (!userYieldSummary[0]) {
        console.log("User has not opted in yield generation")
    } else {
        console.log(`User has opted in yield generation: ${userYieldSummary[0]}`)
        console.log(`User deposited collateral on yield generation: ${userYieldSummary[4]}`)
        console.log(`User withdrawn yield: ${userYieldSummary[1]}`)
        console.log(`User withdrawn collateral: ${userYieldSummary[2]}`)
        console.log(`User available yield: ${userYieldSummary[3]}`)
        console.log(`Unwithdrawn yield: ${userYieldSummary[5]}`)
        console.log("")
    }
}

async function userSummaryByTermId(taskArguments, hre) {
    await _userSummaryByTermId(taskArguments, hre)
}

module.exports = { userSummaryByTermId }
