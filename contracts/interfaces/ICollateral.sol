// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

/// @title Takaturn Collateral Interface
/// @author Aisha EL Allam
/// @notice This is used to allow fund to easily communicate with collateral
/// @dev v2.0 (post-deploy)

import {LibCollateralStorage} from "../libraries/LibCollateralStorage.sol";
import {LibTermStorage} from "../libraries/LibTermStorage.sol";

interface ICollateral {
    /// @notice Called from Fund contract when someone defaults
    /// @dev Check EnumerableMap (openzeppelin) for arrays that are being accessed from Fund contract
    /// @dev Revert if the caller is not the Diamond proxy
    /// @param term Term object
    /// @param defaulters Addressess of all defaulters of the current cycle
    /// @return expellants array of addresses that were expelled
    function requestContribution(
        LibTermStorage.Term memory term,
        address[] calldata defaulters
    ) external returns (address[] memory);

    /// @notice Called by each member after during or at the end of the term to withraw collateral
    /// @dev This follows the pull-over-push pattern.
    /// @param termId term id
    function withdrawCollateral(uint termId) external;

    /// @notice Called by each member after during or at the end of the term to withraw collateral to a different address than the caller
    /// @dev This follows the pull-over-push pattern.
    /// @dev Revert if the caller is not a participant
    /// @param termId term id
    /// @param receiver receiver address
    function withdrawCollateralToAnotherAddress(uint termId, address receiver) external;

    /// @notice Allows to withdraw all collateral from the at the term's end
    /// @dev Does not withdraw anything, just set the state for users to withdraw
    /// @dev Revert if the fund is not closed
    /// @param termId term id
    function releaseCollateral(uint termId) external;

    /// @notice allow the owner to empty the Collateral after 180 days
    /// @dev Revert if the collateral is not at releasing collateral
    /// @dev Revert if the caller is not the term owner
    /// @dev Revert if the time is not met
    /// @param termId The term id
    function emptyCollateralAfterEnd(uint termId) external;
}
