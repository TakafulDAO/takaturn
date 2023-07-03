// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {ICollateralFacet} from "../interfaces/ICollateralFacet.sol";

library LibFund {
    using EnumerableSet for EnumerableSet.AddressSet;

    uint public constant FUND_VERSION = 1;
    bytes32 constant FUND_POSITION = keccak256("diamond.standard.fund");
    bytes32 constant FUND_TRACKING_POSITION = keccak256("diamond.standard.fund.tracking");

    enum FundStates {
        InitializingFund, // Time before the first cycle has started
        AcceptingContributions, // Triggers at the start of a cycle
        ChoosingBeneficiary, // Contributions are closed, beneficiary is chosen, people default etc.
        CycleOngoing, // Time after beneficiary is chosen, up till the start of the next cycle
        FundClosed // Triggers at the end of the last contribution period, no state changes after this
    }

    event OnTermStart(uint indexed termId); // Emits when a new term starts, this also marks the start of the first cycle
    event OnStateChanged(uint indexed termId, FundStates indexed newState); // Emits when state has updated
    event OnPaidContribution(uint indexed termId, address indexed payer, uint indexed currentCycle); // Emits when participant pays the contribution
    event OnBeneficiarySelected(uint indexed termId, address indexed beneficiary); // Emits when beneficiary is selected for this cycle
    event OnFundWithdrawn(uint indexed termId, address indexed claimant, uint indexed amount); // Emits when a chosen beneficiary claims their fund
    event OnParticipantDefaulted(uint indexed termId, address indexed defaulter); // Emits when a participant didn't pay this cycle's contribution
    event OnParticipantUndefaulted(uint indexed termId, address indexed undefaulter); // Emits when a participant was a defaulter before but started paying on time again for this cycle
    event OnDefaulterExpelled(uint indexed termId, address indexed expellant); // Emits when a defaulter can't compensate with the collateral
    event OnTotalParticipantsUpdated(uint indexed termId, uint indexed newLength); // Emits when the total participants lengths has changed from its initial value
    event OnAutoPayToggled(uint indexed termId, address indexed participant, bool indexed enabled); // Emits when a participant succesfully toggles autopay

    struct Fund {
        uint cycleTime; // time for a single cycle in seconds, default is 30 days
        uint contributionAmount; // amount in stable token currency, 6 decimals
        uint contributionPeriod; // time for participants to contribute this cycle
        uint totalParticipants; // Total amount of starting participants
        uint expelledParticipants; // Total amount of participants that have been expelled so far
        uint currentCycle; // Index of current cycle
        uint totalAmountOfCycles; // Amount of cycles that this fund will have
        uint fundStart; // Timestamp of the start of the fund
        uint fundEnd; // Timestamp of the end of the fund
        address lastBeneficiary; // The last selected beneficiary, updates with every cycle
        address fundOwner; // The owner of the fund
        address stableTokenAddress;
        ICollateralFacet collateral; // Instance of the collateral // todo: check later if it has to be here
        IERC20 stableToken; // Instance of the stable token
        FundStates currentState /* = FundStates.InitializingFund*/; // Variable to keep track of the different FundStates // todo: cannot assign here
        address[] beneficiariesOrder; // The correct order of who gets to be next beneficiary, determined by collateral contract
        mapping(address => bool) isParticipant; // Mapping to keep track of who's a participant or not
        mapping(address => bool) isBeneficiary; // Mapping to keep track of who's a beneficiary or not
        mapping(address => bool) paidThisCycle; // Mapping to keep track of who paid for this cycle
        mapping(address => bool) autoPayEnabled; // Wheter to attempt to automate payments at the end of the contribution period
        mapping(address => uint) beneficiariesPool; // Mapping to keep track on how much each beneficiary can claim
        EnumerableSet.AddressSet participants; // Those who have not been beneficiaries yet and have not defaulted this cycle
        EnumerableSet.AddressSet beneficiaries; // Those who have been beneficiaries and have not defaulted this cycle
        EnumerableSet.AddressSet defaulters; // Both participants and beneficiaries who have defaulted this cycle
        bool initialized;
    }

    struct FundTracking {
        uint termId; // termId of the fund
        mapping(uint => Fund) funds; // termId => Fund struct
    }

    // function _fundExists(uint termId) internal pure returns (bool) {
    //     return _fundStorage().funds[termId].initialized;
    // }

    function _fund() internal pure returns (Fund storage fund) {
        bytes32 position = FUND_POSITION;
        assembly {
            fund.slot := position
        }
    }

    function _fundTracking() internal pure returns (FundTracking storage fundTracking) {
        bytes32 position = FUND_TRACKING_POSITION;
        assembly {
            fundTracking.slot := position
        }
    }
}
