// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

//import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {ICollateral} from "../interfaces/ICollateral.sol"

library LibCollateral {
    uint public constant FUND_VERSION = 2;
    bytes32 constant FUND_STORAGE_POSITION = keccak256("diamond.standard.fund.storage");

    enum FundStates {
        InitializingFund, // Time before the first cycle has started
        AcceptingContributions, // Triggers at the start of a cycle
        ChoosingBeneficiary, // Contributions are closed, beneficiary is chosen, people default etc.
        CycleOngoing, // Time after beneficiary is chosen, up till the start of the next cycle
        FundClosed // Triggers at the end of the last contribution period, no state changes after this
    }

    struct Fund {
        IERC20 stableToken; // Instance of the stable token
        FundStates currentState = FundStates.InitializingFund; // Variable to keep track of the different FundStates
        uint currentCycle; // Index of current cycle
        uint fundStart; // Timestamp of the start of the fund
        uint fundEnd; // Timestamp of the end of the fund

        mapping(address => bool) public isParticipant; // Mapping to keep track of who's a participant or not
        mapping(address => bool) public isBeneficiary; // Mapping to keep track of who's a beneficiary or not
        mapping(address => bool) public paidThisCycle; // Mapping to keep track of who paid for this cycle
        mapping(address => bool) public autoPayEnabled; // Wheter to attempt to automate payments at the end of the contribution period
        mapping(address => uint) public beneficiariesPool; // Mapping to keep track on how much each beneficiary can claim
        EnumerableSet.AddressSet private _participants; // Those who have not been beneficiaries yet and have not defaulted this cycle
        EnumerableSet.AddressSet private _beneficiaries; // Those who have been beneficiaries and have not defaulted this cycle
        EnumerableSet.AddressSet private _defaulters; // Both participants and beneficiaries who have defaulted this cycle

        address[] public beneficiariesOrder; // The correct order of who gets to be next beneficiary, determined by collateral contract
        uint public expelledParticipants; // Total amount of participants that have been expelled so far

        address public lastBeneficiary; // The last selected beneficiary, updates with every cycle
    }

    struct FundStorage {
        mapping(uint => Fund) funds; // termId => Fund struct
    }

    function _fundStorage() internal pure returns (FundStorage storage fundStorage) {
        bytes32 position = FUND_STORAGE_POSITION;
        assembly {
            fundStorage.slot := position
        }
    }
}
