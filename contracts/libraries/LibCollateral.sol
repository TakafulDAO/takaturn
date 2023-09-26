// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {LibCollateralStorage} from "./LibCollateralStorage.sol";

library LibCollateral {
    event OnCollateralStateChanged(
        uint indexed termId,
        LibCollateralStorage.CollateralStates indexed oldState,
        LibCollateralStorage.CollateralStates indexed newState
    );

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
}
