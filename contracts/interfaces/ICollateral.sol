// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

/// @title Takaturn Collateral Interface
/// @author Aisha EL Allam
/// @notice This is used to allow fund to easily communicate with collateral
/// @dev v2.0 (post-deploy)

import {LibCollateralStorage} from "../libraries/LibCollateralStorage.sol";
import {LibTermStorage} from "../libraries/LibTermStorage.sol";

interface ICollateral {
    // Function cannot be called at this time.
    error FunctionInvalidAtThisState();

    /// @notice Called from Fund contract when someone defaults
    /// @dev Check EnumerableMap (openzeppelin) for arrays that are being accessed from Fund contract
    /// @param term the term object
    /// @param defaulters Address that was randomly selected for the current cycle
    function requestContribution(
        LibTermStorage.Term memory term,
        address[] calldata defaulters
    ) external returns (address[] memory);

    /// @notice Called by each member after the end of the cycle to withraw collateral
    /// @dev This follows the pull-over-push pattern.
    /// @param termId The term id
    function withdrawCollateral(uint termId) external;

    /// @param termId The term id
    function releaseCollateral(uint termId) external;

    /// @notice allow the owner to empty the Collateral after 180 days
    function emptyCollateralAfterEnd(uint termId) external;
}
