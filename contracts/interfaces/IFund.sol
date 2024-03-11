// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

/// @title Takaturn Fund Interface
/// @author Mohammed Haddouti
/// @notice This is used to allow collateral to easily communicate with fund
/// @dev v2.0 (post-deploy)

import {LibFund} from "../libraries/LibFund.sol";

interface IFund {
    /// @notice starts a new cycle manually called by the owner. Only the first cycle starts automatically upon deploy
    /// @param termId the id of the term
    function startNewCycle(uint termId) external;

    /// @notice Must be called at the end of the contribution period after the time has passed by the owner
    /// @dev Revert if still time to contribute
    /// @dev Revert if Fund is not accepting contributions
    /// @param termId the id of the term
    function closeFundingPeriod(uint termId) external;

    /// @notice allow the owner to empty the fund if there's any excess fund left after 180 days,
    ///         this with the assumption that beneficiaries can't claim it themselves due to losing their keys for example,
    ///         and prevent the fund to be stuck in limbo
    /// @dev Revert if the caller is not the term owner
    /// @dev Revert if the time is not met (180 days)
    /// @param termId the id of the term
    function emptyFundAfterEnd(uint termId) external;

    /// @notice function to enable/disable autopay
    /// @dev Revert if the user is not a collateral member
    /// @dev Revert if the Fund is closed
    /// @dev It needs the user to have enough tokens and allow the contract as spender
    /// @dev Can be set before the Fund starts
    /// @param termId the id of the term
    function toggleAutoPay(uint termId) external;

    /// @notice This is the function participants call to pay the contribution
    /// @param termId the id of the term
    function payContribution(uint termId) external;

    /// @notice This function is here to give the possibility to pay using a different wallet
    /// @param termId the id of the term
    /// @param participant the address the msg.sender is paying for, the address must be part of the fund
    function payContributionOnBehalfOf(uint termId, address participant) external;

    /// @notice Called by the beneficiary to withdraw the fund
    /// @dev This follows the pull-over-push pattern.
    /// @param termId the id of the term
    function withdrawFund(uint termId) external;

    /// @notice Called by the beneficiary to withdraw the fund
    /// @dev This follows the pull-over-push pattern.
    /// @param termId the id of the term
    /// @param receiver the address that will receive the fund
    function withdrawFundOnAnotherWallet(uint termId, address receiver) external;
}
