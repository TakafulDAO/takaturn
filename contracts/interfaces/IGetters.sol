// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {LibTermStorage} from "../libraries/LibTermStorage.sol";
import {LibCollateralStorage} from "../libraries/LibCollateralStorage.sol";
import {LibFundStorage} from "../libraries/LibFundStorage.sol";
import {LibGettersHelpers} from "../libraries/LibGettersHelpers.sol";

interface IGetters {
    /// @notice This function is used as a helper for front-end implementation
    /// @param termId The term id for which the summary is being requested
    /// @return term The term object
    /// @return collateralState The current state of the collateral
    /// @return fundState The current state of the fund
    /// @return nonUserRelated A helper struct with the following values:
    ///                        available positions, security deposits corresponding to each position,
    ///                        remaining registration time, remaining contribution time,
    ///                        remaining cycle time, remaining cycles, remaining cycles
    ///                        contribution in wei, latest price from Chainlink, collateral
    ///                        first deposit time in seconds, collateral counter members,
    ///                        fund start time in seconds, fund end time in seconds, current
    ///                        cycle, expelled participants, total amount of cycles, yield
    ///                        start time in seconds, total deposit in wei, current total
    ///                        deposit in wei, total shares
    function getTermGroupRelatedSummary(
        uint termId
    )
        external
        view
        returns (
            LibTermStorage.Term memory term,
            LibCollateralStorage.CollateralStates collateralState,
            LibFundStorage.FundStates fundState,
            LibGettersHelpers.NonUserRelated memory nonUserRelated
        );

    /// @notice This function is used as a helper for front-end implementation
    /// @param user the depositor address
    /// @param termId the collateral id
    /// @return userRelated an object that contains the following values:
    ///                     user is collateral member, user is participant, user have been
    ///                     beneficiary, user paid current cycle, user paid next cycle, user
    ///                     enabled auto pay, user money pot is frozen, user has opted in for
    ///                     yield generation an array of uints that contains the following values:
    ///                     current users locked collateral balance in wei, current users
    ///                     unlocked collateral balance in wei, initial users deposit in wei,
    ///                     expulsion limit, beneficiaries pool, cycle of expulsion if applies
    //                      withdrawn yield, withdrawn collateral from yield, available yield,
    ///                     deposited collateral by user on yield, amount of yield distributed
    function getUserRelatedSummary(
        address user,
        uint termId
    ) external view returns (LibGettersHelpers.UserRelated memory userRelated);

    /// @notice This function return the current constant values for oracles and yield providers
    /// @param firstAggregator The name of the first aggregator. Example: "ETH/USD"
    /// @param secondAggregator The name of the second aggregator. Example: "USDC/USD"
    /// @param zapAddress The name of the zap address. Example: "ZaynZap"
    /// @param vaultAddress The name of the vault address. Example: "ZaynVault"
    /// @return The addresses of the oracles and yield providers
    function getConstants(
        string memory firstAggregator,
        string memory secondAggregator,
        string memory zapAddress,
        string memory vaultAddress
    ) external view returns (address, address, address, address);

    /// @notice This function is used to get the current state of the yield lock
    /// @return The current state of the yield lock
    function getYieldLockState() external view returns (bool);

    /// @return the current term id
    /// @return the next term id
    function getTermsId() external view returns (uint, uint);

    /// @notice Gets the term object
    /// @param termId the term id
    /// @return the term object
    function getTermSummary(uint termId) external view returns (LibTermStorage.Term memory);

    /// @notice Gets the collateral summary of a term
    /// @param termId the id of the term
    /// @return if collateral is initialized
    /// @return current state of the collateral, see States struct in LibCollateralStorage.sol
    /// @return time of first deposit in seconds, 0 if no deposit occured yet
    /// @return current member count
    /// @return list of depositors
    function getCollateralSummary(
        uint termId
    )
        external
        view
        returns (bool, LibCollateralStorage.CollateralStates, uint, uint, address[] memory);

    /// @notice Gets the fund summary of a term
    /// @param termId the id of the term
    /// @return if fund is initialized
    /// @return current state of the fund, see States struct in LibFund.sol
    /// @return stablecoin address used
    /// @return list for order of beneficiaries
    /// @return when the fund started in seconds
    /// @return when the fund ended in seconds, 0 otherwise
    /// @return current cycle of fund
    /// @return total amount of cycles in this fund/term
    function getFundSummary(
        uint termId
    )
        external
        view
        returns (bool, LibFundStorage.FundStates, IERC20, address[] memory, uint, uint, uint, uint);

    /// @notice Gets the yield object
    /// @param termId the collateral id
    /// @return if the yield is initialized
    /// @return start time stamp for yield deposit
    /// @return total deposit
    /// @return current amount in yield
    /// @return amount of total shares
    /// @return list of yield users
    /// @return address of vault
    /// @return address of zap
    function getYieldSummary(
        uint termId
    ) external view returns (bool, uint, uint, uint, uint, address[] memory, address, address);

    /// @notice This function is used to get a term APY
    /// @param termId The term id for which the APY is being calculated
    /// @return The APY for the term
    function termAPY(uint termId) external view returns (uint256);

    /// @notice a function to get the needed allowance
    /// @param user the user address
    /// @return the needed allowance
    function getNeededAllowance(address user) external view returns (uint);

    /// @notice function to get the beneficiary from the current cycle
    /// @param termId the fund id
    /// @return the current beneficiary
    function getCurrentBeneficiary(uint termId) external view returns (address);

    /// @notice Gets the next beneficiary of a term
    /// @param termId the id of the term
    /// @return user address
    function getNextBeneficiary(uint termId) external view returns (address);

    /// @notice Gets a users collateral summary
    /// @param depositor address
    /// @param termId the id of the term
    /// @return if the user is a true member of the term
    /// @return current users locked collateral balance in wei
    /// @return current users unlocked collateral balance in wei
    /// @return initial users deposit in wei
    /// @return expulsion limit
    function getDepositorCollateralSummary(
        address depositor,
        uint termId
    ) external view returns (bool, uint, uint, uint, uint);

    /// @notice function to get fund information of a specific participant
    /// @param participant the user to get the info from
    /// @param termId the fund id
    /// @return isParticipant, true if is participant
    /// @return isBeneficiary, true if has been beneficiary
    /// @return paidThisCycle, true if has paid the current cycle
    /// @return autoPayEnabled, true if auto pay is enabled
    /// @return beneficiariesPool, the beneficiary pool, 6 decimals
    /// @return beneficiariesFrozenPool, true if the beneficiary pool is frozen
    function getParticipantFundSummary(
        address participant,
        uint termId
    ) external view returns (bool, bool, bool, bool, uint, bool);

    /// @notice Gets the user yield summary
    /// @param user the depositor address
    /// @param termId the collateral id
    /// @return if the user opted in for yield
    /// @return amount withdrawn from yield
    /// @return amount withdrawn from collateral
    /// @return amount available in yield
    /// @return amount deposited by user in yield
    /// @return amount of yield distributed
    function getUserYieldSummary(
        address user,
        uint termId
    ) external view returns (bool, uint, uint, uint, uint, uint);

    /// @notice function to get cycle information of a specific participant
    /// @param participant the user to get the info from
    /// @param termId the fund id
    /// @return on participant set
    /// @return on beneficiary set
    /// @return on defaulter set
    function getUserSet(address participant, uint termId) external view returns (bool, bool, bool);

    /// @notice Called to check how much collateral a user can withdraw
    /// @param termId term id
    /// @param user depositor address
    /// @return allowedWithdrawal amount the amount of collateral the depositor can withdraw
    function getWithdrawableUserBalance(
        uint termId,
        address user
    ) external view returns (uint allowedWithdrawal);

    /// @notice Get all the terms a participant was expelled from
    /// @param participant the participant address
    /// @return an array the term ids on which the participant was expelled
    function getExpelledTerms(address participant) external view returns (uint[] memory);

    /// @notice Checks if a user has a collateral below 1.0x of total contribution amount
    /// @dev This will revert if called during ReleasingCollateral or after
    /// @param termId The term id
    /// @param member The user to check for
    /// @return Bool check if member is below 1.0x of collateralDeposit
    function isUnderCollaterized(uint termId, address member) external view returns (bool);

    /// @notice Gets if a user is exempted from paying for a specefic cycle
    /// @param termId the id of the term
    /// @param cycle number
    /// @param user address
    /// @return true or false
    function isExempted(uint termId, uint cycle, address user) external view returns (bool);

    /// @notice This function is used to check if a user has opted in for yield generation
    /// @param termId The term id for which the check is being made
    /// @param user The user for which the check is being made
    /// @return True if the user has opted in
    function userHasoptedInYG(uint termId, address user) external view returns (bool);

    /// @notice This function is used to get a user APY
    /// @param termId The term id for which the APY is being calculated
    /// @param user The user for which the APY is being calculated
    /// @return The APY for the user
    function userAPY(uint termId, address user) external view returns (uint256);

    /// @notice function to get fund information of a specific participant
    /// @param participant the user to get the info from
    /// @param termId the fund id
    /// @return paidThisCycle, true if has paid the current cycle
    /// @return paidNextCycle, true if has paid the next cycle
    function currentOrNextCyclePaid(
        address participant,
        uint termId
    ) external view returns (bool, bool);

    /// @param termId the id of the term
    /// @param beneficiary the address of the participant to check
    /// @return true if the participant is a beneficiary
    function isBeneficiary(uint termId, address beneficiary) external view returns (bool);

    /// @notice Gets if a user is expelled from a specefic term
    /// @param termId the id of the term
    /// @param user address
    /// @return true or false
    function wasExpelled(uint termId, address user) external view returns (bool);

    /// @notice checks if a participant have been expelled before being a beneficiary
    /// @param termId the id of the term
    /// @param user the address of the participant to check
    /// @return true if the participant is expelled before being a beneficiary
    function expelledBeforeBeneficiary(uint termId, address user) external view returns (bool);

    /// @notice Gets the conversion rate of an amount in ETH to USD
    /// @param ethAmount The amount in ETH
    /// @return uint converted amount in USD correct to 18 decimals
    function getToStableConversionRate(uint ethAmount) external view returns (uint);

    /// @notice Gets all remaining cycles of a term
    /// @param termId the id of the term
    /// @return remaining cycles
    function getRemainingCycles(uint termId) external view returns (uint);

    /// @notice Gets the expected remaining contribution amount for users in a term
    /// @param termId the id of the term
    /// @return total remaining contribution in wei
    function getRemainingCyclesContributionWei(uint termId) external view returns (uint);

    /// @notice Called to check the minimum collateral amount to deposit in wei
    /// @param termId term id
    /// @param depositorIndex the index the depositor wants to join
    /// @return amount the minimum collateral amount to deposit in wei
    /// @dev The minimum collateral amount is calculated based on the index on the depositors array
    /// @dev The return value should be the minimum msg.value when calling joinTerm
    /// @dev C = 1.5 Cp (Tp - I) where C = minimum collateral amount, Cp = contribution amount,
    ///      Tp = total participants, I = depositor index (starts at 0). 1.5
    function minCollateralToDeposit(uint termId, uint depositorIndex) external view returns (uint);

    /// @notice Gets latest ETH / USD price
    /// @dev Revert if there is problem with chainlink data
    /// @return uint latest price in Wei Note: 18 decimals
    function getLatestPrice() external view returns (uint);

    /// @notice Gets the conversion rate of an amount in USD to ETH
    /// @param USDAmount The amount in USD with 18 decimals
    /// @return uint converted amount in wei
    function getToCollateralConversionRate(uint USDAmount) external view returns (uint);

    /// @notice This function is used to get the total yield generated for a term
    /// @param termId The term id for which the yield is being calculated
    /// @return The total yield generated for the term
    function totalYieldGenerated(uint termId) external view returns (uint);

    /// @notice Get all the terms a participant is part of
    /// @param participant the participant address
    /// @return an array with the term ids the participant is part of
    function getAllJoinedTerms(address participant) external view returns (uint[] memory);

    /// @notice Get all the terms a participant is part of by a given state
    /// @param participant the participant address
    /// @param state the term state
    /// @return an array with the term ids the participant is part of, giving the state of the term
    function getJoinedTermsByState(
        address participant,
        LibTermStorage.TermStates state
    ) external view returns (uint[] memory);

    /// @notice Gets the remaining positions in a term and the corresponding security amount
    /// @param termId the term id
    /// @dev Available positions starts at 0
    /// @return availablePositions an array with the available positions
    /// @return securityAmount an array with the security amount for each available position
    function getAvailablePositionsAndSecurityAmount(
        uint termId
    ) external view returns (uint[] memory, uint[] memory);

    /// @notice Gets the remaining registration period for a term
    /// @dev Revert if nobody have deposited
    /// @param termId the term id
    /// @return remaining contribution period
    function getRemainingRegistrationTime(uint termId) external view returns (uint);

    /// @notice Must return 0 before closing a contribution period
    /// @param termId the id of the term
    /// @return remaining contribution time in seconds
    function getRemainingContributionTime(uint termId) external view returns (uint);

    /// @notice Must be 0 before starting a new cycle
    /// @param termId the id of the term
    /// @return remaining cycle time in seconds
    function getRemainingCycleTime(uint termId) external view returns (uint);
}
