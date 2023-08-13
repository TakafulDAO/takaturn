// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

/// @title Takaturn Collateral Interface
/// @author Aisha EL Allam
/// @notice This is used to allow fund to easily communicate with collateral
/// @dev v2.0 (post-deploy)

import {LibCollateralV2} from "../libraries/LibCollateralV2.sol";

interface ICollateralV2 {
    // Function cannot be called at this time.
    error FunctionInvalidAtThisState();

    function setStateOwner(uint id, LibCollateralV2.CollateralStates newState) external;

    /// @notice Called from Fund contract when someone defaults
    /// @dev Check EnumerableMap (openzeppelin) for arrays that are being accessed from Fund contract
    /// @param beneficiary Address that was randomly selected for the current cycle
    /// @param defaulters Address that was randomly selected for the current cycle
    function requestContribution(
        uint id,
        address beneficiary,
        address[] calldata defaulters
    ) external returns (address[] memory);

    /// @notice Called by each member after the end of the cycle to withraw collateral
    /// @dev This follows the pull-over-push pattern.
    function withdrawCollateral(uint id) external;

    function withdrawReimbursement(uint id, address participant) external;

    function releaseCollateral(uint id) external;

    /// @notice Checks if a user has a collateral below 1.0x of total contribution amount
    /// @dev This will revert if called during ReleasingCollateral or after
    /// @param member The user to check for
    /// @return Bool check if member is below 1.0x of collateralDeposit
    function isUnderCollaterized(uint id, address member) external view returns (bool);

    /// @notice allow the owner to empty the Collateral after 180 days
    function emptyCollateralAfterEnd(uint id) external;

    // function getDepositorSummary(
    //     uint id,
    //     address participant
    // ) external view returns (uint, uint, bool);
}
