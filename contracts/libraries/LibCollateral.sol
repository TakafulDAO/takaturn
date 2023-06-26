// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

library LibCollateral {
    bytes32 constant TURN_SPECS_POSITION = keccak256("diamond.storage.turn.specs.struct");
    bytes32 constant TURN_GROUP_DATA = keccak256("diamond.storage.turn.group.data.struct");

    struct TurnSpecs {
        uint totalParticipants;
        uint collateralDeposit;
        uint firstDepositTime;
        uint cycleTime;
        uint contributionAmount;
        uint contributionPeriod;
        uint counterMembers;
        uint fixedCollateralEth;
    }

    struct TurnGroupData {
        address[] participants;
        address fundContract;
        address stableCoinAddress;
        address factoryContract;
    }

    function _turnSpecs() internal pure returns (TurnSpecs storage turnSpecs) {
        bytes32 position = TURN_SPECS_POSITION;
        assembly {
            turnSpecs.slot := position
        }
    }

    function _turnGroupData() internal pure returns (TurnGroupData storage turnGroupData) {
        bytes32 position = TURN_GROUP_DATA;
        assembly {
            turnGroupData.slot := position
        }
    }
}
