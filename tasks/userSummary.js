const { erc20UnitsFormat } = require("../utils/units")

async function _userSummary(taskArguments, hre) {
    const takaturn = await ethers.getContract("TakaturnDiamond")

    const joinedTerms = await takaturn.getAllJoinedTerms(taskArguments.userAddress)

    for (let i = 0; i < joinedTerms.length; i++) {
        console.log(`The user summary on term: ${joinedTerms[i].toString()} is:`)
        const userCollateralSummary = await takaturn.getDepositorCollateralSummary(
            taskArguments.userAddress,
            joinedTerms[i]
        )
        const userFundSummary = await takaturn.getParticipantFundSummary(
            taskArguments.userAddress,
            joinedTerms[i]
        )
        const userYieldSummary = await takaturn.getUserYieldSummary(
            taskArguments.userAddress,
            joinedTerms[i]
        )
        console.log("")
        console.log("Collateral Summary:")
        console.log(`User is collateral Member: ${userCollateralSummary[0]}`)
        console.log(
            `User collateral Members Bank: ${erc20UnitsFormat(userCollateralSummary[1])} ETH`
        )
        console.log(
            `User collateral Payment Bank: ${erc20UnitsFormat(userCollateralSummary[2])} ETH`
        )
        console.log(`Collateral Deposited: ${erc20UnitsFormat(userCollateralSummary[3])} ETH`)
        console.log(`Expulsion limit: ${erc20UnitsFormat(userCollateralSummary[4])} ETH`)
        console.log("")
        console.log("Fund Summary:")
        console.log(`User is fund Participant: ${userFundSummary[0]}`)
        console.log(`User have been beneficiary: ${userFundSummary[1]}`)
        console.log(`User paid the current cycle: ${userFundSummary[2]}`)
        console.log(`User enabled auto pay: ${userFundSummary[3]}`)
        console.log(`User beneficiaries pool: ${userFundSummary[4]} USDC`)
        console.log(`User pools frozen: ${userFundSummary[5]}`)
        console.log("")
        console.log("Yield Summary:")
        console.log(`User has opted in yield generation: ${userYieldSummary[0]}`)
        console.log(`User withdrawn yield: ${userYieldSummary[1]}`)
        console.log(`User withdrawn collateral: ${userYieldSummary[2]}`)
        console.log(`User available yield: ${userYieldSummary[3]}`)
        console.log(`User deposited collateral on yield generation: ${userYieldSummary[4]}`)
        console.log("")
    }
}

async function userSummary(taskArguments, hre) {
    await _userSummary(taskArguments, hre)
}

module.exports = { userSummary }
