// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

//import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

library LibCollateral {
    uint public constant COLLATERAL_VERSION = 2;
    bytes32 constant COLLATERAL_STORAGE_POSITION = keccak256("diamond.standard.collateral.storage");

    enum CollateralStates {
        AcceptingCollateral, // Initial state where collateral are deposited
        CycleOngoing, // Triggered when a fund instance is created, no collateral can be accepted
        ReleasingCollateral, // Triggered when the fund closes
        Closed // Triggered when all depositors withdraw their collaterals
    }

    struct Collateral {
        CollateralStates state = CollateralStates.AcceptingCollateral;
        mapping(address => bool) isCollateralMember; // Determines if a depositor is a valid user
        mapping(address => uint) collateralMembersBank; // Users main balance
        mapping(address => uint) collateralPaymentBank; // Users reimbursement balance after someone defaults
    }

    struct CollateralStorage {
        mapping(uint => CollateralStorage) collaterals; // termId => Collateral struct
    }

    function _collateralStorage() internal pure returns (CollateralStorage storage collateralStorage) {
        bytes32 position = COLLATERAL_STORAGE_POSITION;
        assembly {
            collateralStorage.slot := position
        }
    }
}
