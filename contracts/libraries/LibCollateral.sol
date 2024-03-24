// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IGetters} from "../interfaces/IGetters.sol";

import {LibCollateralStorage} from "./LibCollateralStorage.sol";
import {LibFundStorage} from "./LibFundStorage.sol";

library LibCollateral {
    event OnCollateralStateChanged(
        uint indexed termId,
        LibCollateralStorage.CollateralStates indexed oldState,
        LibCollateralStorage.CollateralStates indexed newState
    ); // Emits when the state of the collateral changes
    event OnReimbursementWithdrawn(
        uint indexed termId,
        address indexed participant,
        address receiver,
        uint indexed amount
    ); // Emits when a participant withdraws their reimbursement

    /// @notice Sets the state of the collateral
    /// @param _termId term id
    /// @param _newState collateral state
    function _setState(uint _termId, LibCollateralStorage.CollateralStates _newState) internal {
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[_termId];
        LibCollateralStorage.CollateralStates oldState = collateral.state;
        collateral.state = _newState;
        emit OnCollateralStateChanged(_termId, oldState, _newState);
    }

    /// @notice Allow a user to withdraw their reimbursement
    /// @dev Reverts if the fund does not exists or if the user has nothing to claim
    /// @param _termId term id
    /// @param _participant Address of the depositor
    /// @param _receiver Address of the receiver
    function _withdrawReimbursement(
        uint _termId,
        address _participant,
        address _receiver
    ) internal {
        require(LibFundStorage._fundExists(_termId), "Fund does not exists");
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[_termId];

        uint amount = collateral.collateralPaymentBank[_participant];
        require(amount > 0, "Nothing to claim");
        collateral.collateralPaymentBank[_participant] = 0;

        (bool success, ) = payable(_receiver).call{value: amount}("");
        require(success);

        emit OnReimbursementWithdrawn(_termId, _participant, _receiver, amount);
    }

    /// @notice Checks if a user has a collateral below 1.0x of total contribution amount
    /// @dev This will revert if called during ReleasingCollateral or after
    /// @param _termId The fund id
    /// @param _member The user to check for
    /// @return Bool check if member is below 1.0x of collateralDeposit
    function _isUnderCollaterized(uint _termId, address _member) internal view returns (bool) {
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[_termId];

        uint collateralLimit;
        uint memberCollateral = collateral.collateralMembersBank[_member];

        if (!LibFundStorage._fundExists(_termId)) {
            // Only check here when starting the term
            (, , , , collateralLimit) = IGetters(address(this)).getDepositorCollateralSummary(
                _member,
                _termId
            );
        } else {
            collateralLimit = IGetters(address(this)).getRemainingCyclesContributionWei(_termId);
        }

        return (memberCollateral < collateralLimit);
    }
}
