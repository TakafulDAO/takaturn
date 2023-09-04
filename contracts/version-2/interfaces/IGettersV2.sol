// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {LibTermV2} from "../libraries/LibTermV2.sol";
import {LibCollateralV2} from "../libraries/LibCollateralV2.sol";
import {LibFundV2} from "../libraries/LibFundV2.sol";

interface IGettersV2 {
    // TERM GETTERS

    @notice Gets the current and next term id
    @return current termID
    @return next termID
    function getTermsId() external view returns (uint, uint);

    @notice Must return 0 before starting the fund
    @param termId 
    @return remaining registration time in seconds
    function getRemainingContributionPeriod(uint termId) external view returns (uint);
    
    @notice Get current information of a term
    @param termId 
    @return Term Struct, see LibTermV2.sol
    function getTermSummary(uint termId) external view returns (LibTermV2.Term memory);

    @notice Gets all terms a user has previously joined
    @param participant address 
    @return List of termIDs 
    function getAllJoinedTerms(address participant) external view returns (uint[] memory);

    @notice Gets all terms a user has previously joined based on the specefied term state
    @param participant address 
    @param term state, can be InitializingTerm, ActiveTerm, ExpiredTerm, ClosedTerm
    @return List of termIDs 
    function getJoinedTermsByState(
        address participant,
        LibTermV2.TermStates state
    ) external view returns (uint[] memory);

    @notice Gets all terms a user was previously expelled from
    @param participant address 
    @return List of termIDs
    function getExpelledTerms(address participant) external view returns (uint[] memory);

    @notice Gets all remaining cycles of a term
    @param termID 
    @return remaining cycles
    function getRemainingCycles(uint termId) external view returns (uint);

    @notice Must be 0 before starting a new cycle
    @param termID 
    @return remaining cycle time in seconds
    function getRemainingCycleTime(uint termId) external view returns (uint);

    @notice Gets the expected remaining contribution amount for users in a term
    @param termID 
    @return total remaining contribution in wei
    function getRemainingCyclesContributionWei(uint termId) external view returns (uint);

    // COLLATERAL GETTERS

    @notice Gets a users collateral summary
    @param depositor 
    @param termID 
    @return if the user is a true member of the term
    @return current users locked collateral balance in wei
    @return current users unlocked collateral balance in wei
    @return initial users deposit in wei
    function getDepositorCollateralSummary(
        address depositor,
        uint termId
    ) external view returns (bool, uint, uint, uint);

    @notice Gets the collateral summary of a term
    @param termID 
    @return if collateral is initialized
    @return current state of the collateral, see States struct in LibCollateralV2.sol
    @return time of first deposit in seconds, 0 if no deposit occured yet
    @return current member count
    @return list of depositors
    function getCollateralSummary(
        uint termId
    ) external view returns (bool, LibCollateralV2.CollateralStates, uint, uint, address[] memory);

    @notice Gets the required minimum collateral deposit based on the position
    @param termID 
    @param depositorIndex
    @return required minimum in wei
    function minCollateralToDeposit(
        LibTermV2.Term memory term,
        uint depositorIndex
    ) external view returns (uint);

    // FUND GETTERS
    @notice Gets the fund summary of a term
    @param termID 
    @return if fund is initialized
    @return current state of the fund, see States struct in LibFundV2.sol
    @return stablecoin address used
    @return list for order of beneficiaries
    @return when the fund started in seconds
    @return when the fund ended in seconds, 0 otherwise
    @return current cycle of fund
    @return total amount of cycles in this fund/term
    function getFundSummary(
        uint termId
    )
        external
        view
        returns (bool, LibFundV2.FundStates, IERC20, address[] memory, uint, uint, uint, uint);

    @notice Gets the current beneficiary of a term
    @param termID 
    @return user address
    function getCurrentBeneficiary(uint termId) external view returns (address);

    @notice Gets if a user is expelled from a specefic term
    @param termID 
    @param user
    @return true or false
    function wasExpelled(uint termId, address user) external view returns (bool);

    @notice Gets if a user is exempted from paying for a specefic cycle
    @param termID 
    @param cycle number
    @param user address
    @return true or false
    function isExempted(uint termId, uint cycle, address user) external view returns (bool);

    @notice Gets a user information of in a fund
    @param user address
    @param termID 
    @return if the user is a true member of the fund/term
    @return if the user was beneficiary in the past
    @return if the user paid for the current cycle
    @return if the user has autopay enabled
    @return users money pot balance
    function getParticipantFundSummary(
        address participant,
        uint termId
    ) external view returns (bool, bool, bool, bool, uint);

    @notice Must return 0 before closing a contribution period
    @param termID
    @return remaining contribution time in seconds
    function getRemainingContributionTime(uint termId) external view returns (uint);

    // CONVERSION GETTERS

    function getToCollateralConversionRate(uint USDAmount) external view returns (uint);

    function getToStableConversionRate(uint ethAmount) external view returns (uint);

    // YIELD GENERATION GETTERS

    function userAPR(uint termId, address user) external view returns (uint256);

    function termAPR(uint termId) external view returns (uint256);

    function yieldDistributionRatio(uint termId, address user) external view returns (uint256);

    function totalYieldGenerated(uint termId) external view returns (uint);

    function userYieldGenerated(uint termId, address user) external view returns (uint);
}
