// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IFund} from "../interfaces/IFund.sol";
import {ICollateralFacet} from "../interfaces/ICollateralFacet.sol";

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {LibFund} from "../libraries/LibFund.sol";

/// @title Takaturn Fund
/// @author Mohammed Haddouti
/// @notice This is used to operate the Takaturn fund
/// @dev v2.0 (post-deploy)
contract FundFacet is IFund {
    // TODO: Review auto pay logic
    using EnumerableSet for EnumerableSet.AddressSet;

    uint public constant VERSION = 2; // The version of the contract // todo: can not set state variables on facets. on Init?

    modifier onlyFundOwner(uint id) {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[id]; //termFunds[id];
        require(fund.fundOwner == msg.sender);
        _;
    }

    // mapping(address => mapping(uint => bool)) public isParticipant; // Mapping to keep track of who's a participant or not
    // mapping(address => mapping(uint => bool)) public isBeneficiary; // Mapping to keep track of who's a beneficiary or not
    // mapping(address => mapping(uint => bool)) public paidThisCycle; // Mapping to keep track of who paid for this cycle
    // mapping(address => mapping(uint => bool)) public autoPayEnabled; // Wheter to attempt to automate payments at the end of the contribution period
    // mapping(address => mapping(uint => uint)) public beneficiariesPool; // Mapping to keep track on how much each beneficiary can claim

    /// Insufficient balance for transfer. Needed `required` but only
    /// `available` available.
    /// @param available balance available.
    /// @param required requested amount to transfer.
    error InsufficientBalance(uint available, uint required);

    function createTerm(
        uint cycleTime,
        uint contributionAmount,
        uint contributionPeriod,
        uint totalParticipants,
        address stableTokenAddress
    ) external {
        _createTerm(
            cycleTime,
            contributionAmount,
            contributionPeriod,
            totalParticipants,
            stableTokenAddress
        );
    }

    // TODO: Still needs to call the collateral, for now only adds the participant
    // todo: it was moved to term facet. remove from here
    function joinTerm(uint id) external payable {
        //FundData storage fund = termFunds[id];
        LibFund.Fund storage fund = LibFund._fundTracking().funds[id];
        fund.collateral.depositCollateral{value: msg.value}(id); // TODO: Check for success. On collateral,  msg.sender or tx.origin?
        uint beneficiariesLength = fund.beneficiariesOrder.length;
        for (uint i; i < beneficiariesLength; ) {
            if (fund.beneficiariesOrder[i] == address(0)) {
                fund.beneficiariesOrder[i] = msg.sender;
                if (i == fund.beneficiariesOrder.length - 1) {
                    _startTerm(id);
                }
                break;
            }
            unchecked {
                ++i;
            }
        }
    }

    /// @notice starts a new cycle manually called by the owner. Only the first cycle starts automatically upon deploy
    function startNewCycle(uint id) external onlyFundOwner(id) {
        _startNewCycle(id);
    }

    /// @notice Must be called at the end of the contribution period after the time has passed by the owner
    function closeFundingPeriod(uint id) external onlyFundOwner(id) {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[id];
        // Current cycle minus 1 because we use the previous cycle time as start point then add contribution period
        require(
            block.timestamp >
                fund.cycleTime * (fund.currentCycle - 1) + fund.fundStart + fund.contributionPeriod,
            "Still time to contribute"
        );
        require(fund.currentState == LibFund.FundStates.AcceptingContributions, "Wrong state");

        // We attempt to make the autopayers pay their contribution right away
        _autoPay(id);

        // Only then start choosing beneficiary
        _setState(id, LibFund.FundStates.ChoosingBeneficiary);

        // We must check who hasn't paid and default them, check all participants based on beneficiariesOrder
        // To maintain the order and to properly push defaulters to the back based on that same order
        // And we make sure that existing defaulters are ignored
        address[] memory currentParticipants = fund.beneficiariesOrder;

        uint currentParticipantsLength = currentParticipants.length;

        for (uint i; i < currentParticipantsLength; ) {
            address p = currentParticipants[i];
            if (fund.paidThisCycle[p]) {
                // check where to restore the defaulter to, participants or beneficiaries
                if (fund.isBeneficiary[p]) {
                    EnumerableSet.add(fund.beneficiaries, p);
                } else {
                    EnumerableSet.add(fund.participants, p);
                }

                if (EnumerableSet.remove(fund.defaulters, p)) {
                    emit LibFund.OnParticipantUndefaulted(id, p);
                }
            } else if (!EnumerableSet.contains(fund.defaulters, p)) {
                _defaultParticipant(id, p);
            }
            unchecked {
                ++i;
            }
        }

        // Once we decided who defaulted and who paid, we can select the beneficiary for this cycle
        _selectBeneficiary(id);

        if (!(fund.currentCycle < fund.totalAmountOfCycles)) {
            // If all cycles have passed, and the last cycle's time has passed, close the fund
            _closeFund(id);
            return;
        }
    }

    /// @notice Fallback function, if the internal call fails somehow and the state gets stuck, allow owner to call the function again manually
    /// @dev This shouldn't happen, but is here in case there's an edge-case we didn't take into account, can possibly be removed in the future
    function selectBeneficiary(uint id) external onlyFundOwner(id) {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[id];
        require(fund.currentState == LibFund.FundStates.ChoosingBeneficiary, "Wrong state");
        _selectBeneficiary(id);
    }

    /// @notice called by the owner to close the fund for emergency reasons.
    function closeFund(uint id) external onlyFundOwner(id) {
        //require (!(currentCycle < totalAmountOfCycles), "Not all cycles have happened yet");
        _closeFund(id);
    }

    /// @notice allow the owner to empty the fund if there's any excess fund left after 180 days,
    ///         this with the assumption that beneficiaries can't claim it themselves due to losing their keys for example,
    ///         and prevent the fund to be stuck in limbo
    function emptyFundAfterEnd(uint id) external onlyFundOwner(id) {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[id];
        require(
            fund.currentState == LibFund.FundStates.FundClosed &&
                block.timestamp > fund.fundEnd + 180 days,
            "Can't empty yet"
        );

        uint balance = fund.stableToken.balanceOf(address(this));
        if (balance > 0) {
            fund.stableToken.transfer(msg.sender, balance);
        }
    }

    /// @notice function to enable/disable autopay
    function toggleAutoPay(uint id) external {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[id];
        require(fund.isParticipant[msg.sender], "Not a participant");
        bool enabled = !fund.autoPayEnabled[msg.sender];
        fund.autoPayEnabled[msg.sender] = enabled;

        emit LibFund.OnAutoPayToggled(id, msg.sender, enabled);
    }

    /// @notice This is the function participants call to pay the contribution
    function payContribution(uint id) external {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[id];
        require(fund.currentState == LibFund.FundStates.AcceptingContributions, "Wrong state");
        require(fund.isParticipant[msg.sender], "Not a participant");
        require(!fund.paidThisCycle[msg.sender], "Already paid for cycle");
        _payContribution(id, msg.sender, msg.sender);
    }

    /// @notice This function is here to give the possibility to pay using a different wallet
    /// @param participant the address the msg.sender is paying for, the address must be part of the fund
    function payContributionOnBehalfOf(uint id, address participant) external {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[id];
        require(fund.currentState == LibFund.FundStates.AcceptingContributions, "Wrong state");
        require(fund.isParticipant[participant], "Not a participant");
        require(!fund.paidThisCycle[participant], "Already paid for cycle");
        _payContribution(id, msg.sender, participant);
    }

    /// @notice Called by the beneficiary to withdraw the fund
    /// @dev This follows the pull-over-push pattern.
    function withdrawFund(uint id) external {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[id];
        require(
            fund.currentState == LibFund.FundStates.FundClosed || fund.paidThisCycle[msg.sender],
            "You must pay your cycle before withdrawing"
        );

        bool hasFundPool = fund.beneficiariesPool[msg.sender] > 0;
        (, uint collateralPool, ) = fund.collateral.getDepositorSummary(msg.sender);
        bool hasCollateralPool = collateralPool > 0;
        require(hasFundPool || hasCollateralPool, "Nothing to withdraw");

        if (hasFundPool) {
            // Get the amount this beneficiary can withdraw
            uint transferAmount = fund.beneficiariesPool[msg.sender];
            uint contractBalance = fund.stableToken.balanceOf(address(this));
            if (contractBalance < transferAmount) {
                revert InsufficientBalance({available: contractBalance, required: transferAmount});
            } else {
                fund.beneficiariesPool[msg.sender] = 0;
                fund.stableToken.transfer(msg.sender, transferAmount); // Untrusted
            }
            emit LibFund.OnFundWithdrawn(id, msg.sender, transferAmount);
        }

        if (hasCollateralPool) {
            fund.collateral.withdrawReimbursement(msg.sender);
        }
    }

    // @notice returns the time left for this cycle to end
    function getRemainingCycleTime(uint id) external view returns (uint) {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[id];
        uint cycleEndTimestamp = fund.cycleTime * fund.currentCycle + fund.fundStart;
        if (block.timestamp > cycleEndTimestamp) {
            return 0;
        } else {
            return cycleEndTimestamp - block.timestamp;
        }
    }

    /// @notice returns the time left to contribute for this cycle
    function getRemainingContributionTime(uint id) external view returns (uint) {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[id];
        if (fund.currentState != LibFund.FundStates.AcceptingContributions) {
            return 0;
        }

        // Current cycle minus 1 because we use the previous cycle time as start point then add contribution period
        uint contributionEndTimestamp = fund.cycleTime *
            (fund.currentCycle - 1) +
            fund.fundStart +
            fund.contributionPeriod;
        if (block.timestamp > contributionEndTimestamp) {
            return 0;
        } else {
            return contributionEndTimestamp - block.timestamp;
        }
    }

    /// @notice returns the beneficiaries order as an array
    function getBeneficiariesOrder(uint id) external view returns (address[] memory) {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[id];
        return fund.beneficiariesOrder;
    }

    // TODO: check return problems
    /// @notice function to get the cycle information in one go
    function getFundSummary(uint id) external view returns (/*FundStates, */ uint, address) {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[id];
        return (/*fund.currentState, */ fund.currentCycle, fund.lastBeneficiary);
    }

    /// @notice function to get cycle information of a specific participant
    /// @param participant the user to get the info from
    function getParticipantSummary(
        uint id,
        address participant
    ) external view returns (uint, bool, bool, bool, bool) {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[id];
        return (
            fund.beneficiariesPool[participant],
            fund.isBeneficiary[participant],
            fund.paidThisCycle[participant],
            fund.autoPayEnabled[participant],
            fund.isParticipant[participant]
        );
    }

    function currentCycle(uint id) external view returns (uint) {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[id];
        return fund.currentCycle;
    }

    function fundEnd(uint id) external view returns (uint) {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[id];
        return fund.fundEnd;
    }

    // TODO: This will have to create the new collateral struct and assign the termId with the collateral Id
    function _createTerm(
        uint _cycleTime,
        uint _contributionAmount,
        uint _contributionPeriod,
        uint _totalParticipants,
        address _stableTokenAddress
    ) internal returns (uint) {
        require(
            _cycleTime != 0 &&
                _contributionAmount != 0 &&
                _contributionPeriod != 0 &&
                _totalParticipants != 0,
            "Invalid inputs"
        );

        uint _id = LibFund._fundTracking().termId;
        LibFund.Fund storage fund = LibFund._fundTracking().funds[_id];
        // TODO: Check default values
        // Sets some cycle-related parameters
        fund.cycleTime = _cycleTime;
        fund.contributionAmount = _contributionAmount * 10 ** 6; // Convert to 6 decimals
        fund.contributionPeriod = _contributionPeriod;
        fund.totalParticipants = _totalParticipants;
        fund.expelledParticipants;
        fund.currentCycle;
        fund.totalAmountOfCycles = _totalParticipants;
        fund.fundStart;
        fund.fundEnd;
        fund.lastBeneficiary;
        fund.fundOwner = msg.sender;
        fund.stableTokenAddress = _stableTokenAddress;
        fund.collateral = ICollateralFacet(msg.sender); // TODO: Check when the collateral facet is ready
        fund.stableToken = IERC20(_stableTokenAddress);
        fund.currentState = LibFund.FundStates.InitializingFund; // TODO: Actual state?
        fund.beneficiariesOrder = new address[](_totalParticipants);

        ++LibFund._fundTracking().termId;

        return _id;
    }

    function _startTerm(uint256 _id) internal {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[_id];
        //currentState = FundStates.InitializingFund;

        uint participantsArrayLength = fund.beneficiariesOrder.length;

        // Set and track participants

        for (uint i; i < participantsArrayLength; ) {
            EnumerableSet.add(fund.participants, fund.beneficiariesOrder[i]);
            fund.isParticipant[fund.beneficiariesOrder[i]] = true;
            unchecked {
                ++i;
            }
        }

        // Starts the first cycle
        _startNewCycle(_id);

        // Set timestamp of deployment, which will be used to determine cycle times
        // We do this after starting the first cycle to make sure the first cycle starts smoothly
        fund.fundStart = block.timestamp;
        emit LibFund.OnTermStart(_id);
    }

    /// @notice updates the state according to the input and makes sure the state can't be changed if the fund is closed. Also emits an event that this happened
    /// @param _newState The new state of the fund
    function _setState(uint _id, LibFund.FundStates _newState) internal {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[_id];
        require(fund.currentState != LibFund.FundStates.FundClosed, "Fund closed");
        fund.currentState = _newState;
        emit LibFund.OnStateChanged(_id, _newState);
    }

    /// @notice This starts the new cycle and can only be called internally. Used upon deploy
    function _startNewCycle(uint _id) internal {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[_id];
        // currentCycle is 0 when this is called for the first time
        require(
            block.timestamp > fund.cycleTime * fund.currentCycle + fund.fundStart,
            "Too early to start new cycle"
        );
        require(
            fund.currentState == LibFund.FundStates.InitializingFund ||
                fund.currentState == LibFund.FundStates.CycleOngoing,
            "Wrong state"
        );

        ++fund.currentCycle;
        uint length = fund.beneficiariesOrder.length;
        for (uint i; i < length; ) {
            fund.paidThisCycle[fund.beneficiariesOrder[i]] = false;
            unchecked {
                ++i;
            }
        }

        _setState(_id, LibFund.FundStates.AcceptingContributions);

        // We attempt to make the autopayers pay their contribution right away
        _autoPay(_id);
    }

    /// @notice function to attempt to make autopayers pay their contribution
    function _autoPay(uint _id) internal {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[_id];
        address[] memory autoPayers = fund.beneficiariesOrder;
        uint amount = fund.contributionAmount;

        uint length = autoPayers.length;
        for (uint i; i < length; ) {
            if (
                fund.autoPayEnabled[autoPayers[i]] &&
                !fund.paidThisCycle[autoPayers[i]] &&
                amount <= fund.stableToken.allowance(autoPayers[i], address(this)) &&
                amount <= fund.stableToken.balanceOf(autoPayers[i])
            ) {
                _payContribution(_id, autoPayers[i], autoPayers[i]);
            }
            unchecked {
                ++i;
            }
        }
    }

    /// @notice function to pay the actual contribution for the cycle
    /// @param _payer the address that's paying
    /// @param _participant the (participant) address that's being paid for
    function _payContribution(uint _id, address _payer, address _participant) internal {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[_id];
        // Get the amount and do the actual transfer
        // This will only succeed if the sender approved this contract address beforehand
        uint amount = fund.contributionAmount;

        bool success = fund.stableToken.transferFrom(_payer, address(this), amount);
        require(success, "Contribution failed, did you approve stable token?");

        // Finish up, set that the participant paid for this cycle and emit an event that it's been done
        fund.paidThisCycle[_participant] = true;
        emit LibFund.OnPaidContribution(_id, _participant, fund.currentCycle);
    }

    /// @notice Default the participant/beneficiary by checking the mapping first, then remove them from the appropriate array
    /// @param _defaulter The participant to default
    function _defaultParticipant(uint _id, address _defaulter) internal {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[_id];
        // Try removing from participants first
        bool success = EnumerableSet.remove(fund.participants, _defaulter);

        // If that fails, we try removing from beneficiaries
        if (!success) {
            success = EnumerableSet.remove(fund.beneficiaries, _defaulter);
        }

        require(success, "Can't remove defaulter");
        EnumerableSet.add(fund.defaulters, _defaulter);

        emit LibFund.OnParticipantDefaulted(_id, _defaulter);
    }

    /// @notice The beneficiary will be selected here based on the beneficiariesOrder array.
    /// @notice It will loop through the array and choose the first in line to be eligible to be beneficiary.
    function _selectBeneficiary(uint _id) internal {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[_id];
        // check if there are any participants left, else use the defaulters
        address selectedBeneficiary; // By default initialization is address(0)
        address[] memory arrayToCheck = fund.beneficiariesOrder;
        uint arrayToCheckLength = arrayToCheck.length;
        uint beneficiaryIndex; // By default uint initialization is 0;

        for (uint i; i < arrayToCheckLength; ) {
            address b = arrayToCheck[i];
            if (!fund.isBeneficiary[b]) {
                selectedBeneficiary = b;
                beneficiaryIndex = i;
                break;
            }
            unchecked {
                ++i;
            }
        }

        // If the defaulter didn't pay this cycle, we move the first elligible beneficiary forward and everyone in between forward
        if (!fund.paidThisCycle[selectedBeneficiary]) {
            // Find the index of the beneficiary to move to the end
            for (uint i = beneficiaryIndex; i < arrayToCheckLength; ) {
                address b = arrayToCheck[i];
                // Find the first eligible beneficiary
                if (fund.paidThisCycle[b]) {
                    selectedBeneficiary = b;
                    address[] memory newOrder = fund.beneficiariesOrder;
                    // Move each defaulter between current beneficiary and new beneficiary 1 position forward
                    for (uint j = beneficiaryIndex; j < i; ) {
                        newOrder[j + 1] = arrayToCheck[j];
                        unchecked {
                            ++j;
                        }
                    }
                    // Move new beneficiary to original beneficiary's position
                    newOrder[beneficiaryIndex] = selectedBeneficiary;
                    fund.beneficiariesOrder = newOrder;
                    break;
                }
                unchecked {
                    ++i;
                }
            }
        }

        // Request contribution from the collateral for those who haven't paid this cycle
        if (EnumerableSet.length(fund.defaulters) > 0) {
            address[] memory expellants = fund.collateral.requestContribution(
                _id,
                selectedBeneficiary,
                EnumerableSet.values(fund.defaulters)
            );

            uint expellantsLength = expellants.length;
            for (uint i; i < expellantsLength; ) {
                if (expellants[i] == address(0)) {
                    continue;
                }
                _expelDefaulter(_id, expellants[i]);
                unchecked {
                    ++i;
                }
            }
        }

        // Remove participant from participants set..
        if (EnumerableSet.remove(fund.participants, selectedBeneficiary)) {
            // ..Then add them to the benificiaries set
            EnumerableSet.add(fund.beneficiaries, selectedBeneficiary);
        } // If this if-statement fails, this means we're dealing with a graced defaulter

        // Update the mapping to track who's been beneficiary
        fund.isBeneficiary[selectedBeneficiary] = true;

        // Get the amount of participants that paid this cycle, and add that amount to the beneficiary's pool
        uint paidCount;
        address[] memory allParticipants = fund.beneficiariesOrder; // Use beneficiariesOrder here because it contains all active participants in a single array
        for (uint i = 0; i < allParticipants.length; i++) {
            if (fund.paidThisCycle[allParticipants[i]]) {
                paidCount++;
            }
        }

        // Award the beneficiary with the pool and update the lastBeneficiary
        fund.beneficiariesPool[selectedBeneficiary] = fund.contributionAmount * paidCount;
        fund.lastBeneficiary = selectedBeneficiary;

        emit LibFund.OnBeneficiarySelected(_id, selectedBeneficiary);
        _setState(_id, LibFund.FundStates.CycleOngoing);
    }

    /// @notice Called internally to move a defaulter in the beneficiariesOrder to the end, so that people who have paid get chosen first as beneficiary
    /// @param _beneficiary The defaulter that could have been beneficiary
    function _removeBeneficiaryFromOrder(uint _id, address _beneficiary) internal {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[_id];
        address[] memory arrayToCheck = fund.beneficiariesOrder;
        uint arrayToCheckLength = arrayToCheck.length;
        address[] memory newArray = new address[](arrayToCheck.length - 1);
        uint j;
        for (uint i; i < arrayToCheckLength; ) {
            address b = arrayToCheck[i];
            if (b != _beneficiary) {
                newArray[j] = b;
                unchecked {
                    ++j;
                }
            }
            unchecked {
                ++i;
            }
        }

        fund.beneficiariesOrder = newArray;
    }

    /// @notice called internally to expel a participant. It should not be possible to expel non-defaulters, so those arrays are not checked.
    /// @param _expellant The address of the defaulter that will be expelled
    function _expelDefaulter(uint _id, address _expellant) internal {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[_id];
        //require(msg.sender == address(collateral), "Caller is not collateral");
        require(
            fund.isParticipant[_expellant] && EnumerableSet.remove(fund.defaulters, _expellant),
            "Expellant not found"
        );

        // Expellants should only be in the defauters set so no need to touch the other sets
        //require(EnumerableSet.remove(_defaulters, expellant), "Expellant not found");

        // Remove expellant from beneficiaries order
        // Remove expellants from participants tracker and emit that they've been expelled
        // Update the defaulters array
        _removeBeneficiaryFromOrder(_id, _expellant);

        fund.isParticipant[_expellant] = false;
        emit LibFund.OnDefaulterExpelled(_id, _expellant);

        // If the participant is expelled before becoming beneficiary, we lose a cycle, the one which this expellant is becoming beneficiary
        if (!fund.isBeneficiary[_expellant]) {
            fund.totalAmountOfCycles--;
        }

        // Lastly, lower the amount of participants with the amount expelled
        uint newLength = fund.totalParticipants - 1;
        fund.totalParticipants = newLength;
        ++fund.expelledParticipants;

        emit LibFund.OnTotalParticipantsUpdated(_id, newLength);
    }

    /// @notice Internal function for close fund which is used by _startNewCycle & _chooseBeneficiary to cover some edge-cases
    function _closeFund(uint _id) internal {
        LibFund.Fund storage fund = LibFund._fundTracking().funds[_id];
        fund.fundEnd = block.timestamp;
        _setState(_id, LibFund.FundStates.FundClosed);
        fund.collateral.releaseCollateral(_id);
    }
}
