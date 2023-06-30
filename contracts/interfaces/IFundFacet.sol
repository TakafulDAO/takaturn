// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.18;

/// @title Takaturn Fund Interface
/// @author Mohammed Haddouti
/// @notice This is used to allow collateral to easily communicate with fund
/// @dev v2.0 (post-deploy)
interface IFundFacet {
    enum States {
        InitializingFund, // Time before the first cycle has started
        AcceptingContributions, // Triggers at the start of a cycle
        ChoosingBeneficiary, // Contributions are closed, beneficiary is chosen, people default etc.
        CycleOngoing, // Time after beneficiary is chosen, up till the start of the next cycle
        FundClosed // Triggers at the end of the last contribution period, no state changes after this
    }

    function newFund(
        uint cycleTime,
        uint contributionAmount,
        uint contributionPeriod,
        address stableTokenAddress,
        address[] memory participantsArray
    ) external;

    /// @notice starts a new cycle manually called by the owner. Only the first cycle starts automatically upon deploy
    function startNewCycle(uint fundId) external;

    /// @notice Must be called at the end of the contribution period after the time has passed by the owner
    function closeFundingPeriod(uint fundId) external;

    /// @notice Fallback function, if the internal call fails somehow and the state gets stuck, allow owner to call the function again manually
    /// @dev This shouldn't happen, but is here in case there's an edge-case we didn't take into account, can possibly be removed in the future
    function selectBeneficiary(uint fundId) external;

    /// @notice called by the owner to close the fund for emergency reasons.
    function closeFund(uint fundId) external;

    // @notice allow the owner to empty the fund if there's any excess fund left after 180 days,
    //         this with the assumption that beneficiaries can't claim it themselves due to losing their keys for example,
    //         and prevent the fund to be stuck in limbo
    function emptyFundAfterEnd(uint fundId) external;

    /// @notice function to enable/disable autopay
    function toggleAutoPay(uint fundId) external;

    /// @notice This is the function participants call to pay the contribution
    function payContribution(uint fundId) external;

    /// @notice This function is here to give the possibility to pay using a different wallet
    /// @param participant the address the msg.sender is paying for, the address must be part of the fund
    function payContributionOnBehalfOf(uint fundId, address participant) external;

    /// @notice Called by the beneficiary to withdraw the fund
    /// @dev This follows the pull-over-push pattern.
    function withdrawFund(uint fundId) external;

    // @notice returns the time left for this cycle to end
    function getRemainingCycleTime(uint fundId) external view returns (uint);

    // @notice returns the time left to contribute for this cycle
    function getRemainingContributionTime(uint fundId) external view returns (uint);

    /// @notice returns the beneficiaries order as an array
    function getBeneficiariesOrder(uint fundId) external view returns (address[] memory);

    // @notice function to get the cycle information in one go
    function getFundSummary(uint fundId) external view returns (States, uint, address);

    // @notice function to get cycle information of a specific participant
    // @param participant the user to get the info from
    function getParticipantSummary(
        uint fundId,
        address participant
    ) external view returns (uint, bool, bool, bool, bool);

    function isBeneficiary(address beneficiary, uint fundId) external view returns (bool);

    function currentCycle(uint fundId) external view returns (uint);

    function fundEnd(uint fundId) external view returns (uint);
}
