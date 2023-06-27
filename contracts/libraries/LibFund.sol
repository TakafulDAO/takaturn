// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

//import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

library LibCollateral {
    uint public constant COLLATERAL_VERSION = 2;
    bytes32 constant TURN_SPECS_POSITION = keccak256("turn.specs.struct");
    bytes32 constant TURN_GROUP_DATA = keccak256("turn.group.data.struct");
    bytes32 constant COLLATERAL_MAPPINGS = keccak256("colateral.mappings.struct");

    struct CollateralMappings {
        mapping(address => bool) isCollateralMember; // Determines if a participant is a valid user
        mapping(address => uint) collateralMembersBank; // Users main balance
        mapping(address => uint) collateralPaymentBank; // Users reimbursement balance after someone defaults
    }

    // TODO: uint256 for all? Explicitness purposes
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

    function _collateralMappings()
        internal
        pure
        returns (CollateralMappings storage collateralMappings)
    {
        bytes32 position = COLLATERAL_MAPPINGS;
        assembly {
            collateralMappings.slot := position
        }
    }
}
