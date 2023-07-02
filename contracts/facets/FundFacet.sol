// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {IFundFacet} from "../interfaces/IFundFacet.sol";
import {ICollateral} from "../interfaces/ICollateral.sol";

/// @title Takaturn Fund
/// @author Mohammed Haddouti
/// @notice This is used to operate the Takaturn fund
/// @dev v2.0 (post-deploy)
contract FundFacet is IFundFacet {
    // TODO: Review auto pay logic
    // TODO: The fund owner can only interact with own fund
    using EnumerableSet for EnumerableSet.AddressSet;

    uint public constant VERSION = 2; // The version of the contract
    uint public termId; // The id of the fund, incremented on every new fund

    modifier onlyFundOwner(uint id) {
        require(termFunds[id].fundOwner == msg.sender);
        _;
    }

    struct FundData {
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
        address fundOwner;
        address stableTokenAddress;
        ICollateral collateral; // Instance of the collateral
        IERC20 stableToken; // Instance of the stable token
        FundStates currentState; // Current state of the fund
        EnumerableSet.AddressSet participants; // Those who have not been beneficiaries yet and have not defaulted this cycle
        EnumerableSet.AddressSet beneficiaries; // Those who have been beneficiaries and have not defaulted this cycle
        EnumerableSet.AddressSet defaulters; // Both participants and beneficiaries who have defaulted this cycle
        address[] beneficiariesOrder; // The correct order of who gets to be next beneficiary, determined by collateral contract
    }

    mapping(address => mapping(uint => bool)) public isParticipant; // Mapping to keep track of who's a participant or not
    mapping(address => mapping(uint => bool)) public isBeneficiary; // Mapping to keep track of who's a beneficiary or not
    mapping(address => mapping(uint => bool)) public paidThisCycle; // Mapping to keep track of who paid for this cycle
    mapping(address => mapping(uint => bool)) public autoPayEnabled; // Wheter to attempt to automate payments at the end of the contribution period
    mapping(address => mapping(uint => uint)) public beneficiariesPool; // Mapping to keep track on how much each beneficiary can claim
    mapping(uint => FundData) private termFunds; // Term Id => Fund Data

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
    function joinTerm(uint id) external {
        _joinTerm(id);
    }

    /// @notice starts a new cycle manually called by the owner. Only the first cycle starts automatically upon deploy
    function startNewCycle(uint id) external onlyFundOwner(id) {
        _startNewCycle(id);
    }

    /// @notice Must be called at the end of the contribution period after the time has passed by the owner
    function closeFundingPeriod(uint id) external onlyFundOwner(id) {
        FundData storage fund = termFunds[id];
        // Current cycle minus 1 because we use the previous cycle time as start point then add contribution period
        require(
            block.timestamp >
                fund.cycleTime * (fund.currentCycle - 1) + fund.fundStart + fund.contributionPeriod,
            "Still time to contribute"
        );
        require(fund.currentState == FundStates.AcceptingContributions, "Wrong state");

        // We attempt to make the autopayers pay their contribution right away
        _autoPay(id);

        // Only then start choosing beneficiary
        _setState(id, FundStates.ChoosingBeneficiary);

        // We must check who hasn't paid and default them, check all participants based on beneficiariesOrder
        // To maintain the order and to properly push defaulters to the back based on that same order
        // And we make sure that existing defaulters are ignored
        address[] memory currentParticipants = fund.beneficiariesOrder;

        uint currentParticipantsLength = currentParticipants.length;

        for (uint i; i < currentParticipantsLength; ) {
            address p = currentParticipants[i];
            if (paidThisCycle[p][id]) {
                // check where to restore the defaulter to, participants or beneficiaries
                if (isBeneficiary[p][id]) {
                    EnumerableSet.add(fund.beneficiaries, p);
                } else {
                    EnumerableSet.add(fund.participants, p);
                }

                if (EnumerableSet.remove(fund.defaulters, p)) {
                    emit OnParticipantUndefaulted(id, p);
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
        FundData storage fund = termFunds[id];
        require(fund.currentState == FundStates.ChoosingBeneficiary, "Wrong state");
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
        FundData storage fund = termFunds[id];
        require(
            fund.currentState == FundStates.FundClosed && block.timestamp > fund.fundEnd + 180 days,
            "Can't empty yet"
        );

        uint balance = fund.stableToken.balanceOf(address(this));
        if (balance > 0) {
            fund.stableToken.transfer(msg.sender, balance);
        }
    }

    /// @notice function to enable/disable autopay
    function toggleAutoPay(uint id) external {
        require(isParticipant[msg.sender][id], "Not a participant");
        bool enabled = !autoPayEnabled[msg.sender][id];
        autoPayEnabled[msg.sender][id] = enabled;

        emit OnAutoPayToggled(msg.sender, enabled);
    }

    /// @notice This is the function participants call to pay the contribution
    function payContribution(uint id) external {
        FundData storage fund = termFunds[id];
        require(fund.currentState == FundStates.AcceptingContributions, "Wrong state");
        require(isParticipant[msg.sender][id], "Not a participant");
        require(!paidThisCycle[msg.sender][id], "Already paid for cycle");
        _payContribution(id, msg.sender, msg.sender);
    }

    /// @notice This function is here to give the possibility to pay using a different wallet
    /// @param participant the address the msg.sender is paying for, the address must be part of the fund
    function payContributionOnBehalfOf(uint id, address participant) external {
        FundData storage fund = termFunds[id];
        require(fund.currentState == FundStates.AcceptingContributions, "Wrong state");
        require(isParticipant[participant][id], "Not a participant");
        require(!paidThisCycle[participant][id], "Already paid for cycle");
        _payContribution(id, msg.sender, participant);
    }

    /// @notice Called by the beneficiary to withdraw the fund
    /// @dev This follows the pull-over-push pattern.
    function withdrawFund(uint id) external {
        FundData storage fund = termFunds[id];
        require(
            fund.currentState == FundStates.FundClosed || paidThisCycle[msg.sender][id],
            "You must pay your cycle before withdrawing"
        );

        bool hasFundPool = beneficiariesPool[msg.sender][id] > 0;
        (, uint collateralPool, ) = fund.collateral.getParticipantSummary(msg.sender);
        bool hasCollateralPool = collateralPool > 0;
        require(hasFundPool || hasCollateralPool, "Nothing to withdraw");

        if (hasFundPool) {
            // Get the amount this beneficiary can withdraw
            uint transferAmount = beneficiariesPool[msg.sender][id];
            uint contractBalance = fund.stableToken.balanceOf(address(this));
            if (contractBalance < transferAmount) {
                revert InsufficientBalance({available: contractBalance, required: transferAmount});
            } else {
                beneficiariesPool[msg.sender][id] = 0;
                fund.stableToken.transfer(msg.sender, transferAmount); // Untrusted
            }
            emit OnFundWithdrawn(id, msg.sender, transferAmount);
        }

        if (hasCollateralPool) {
            fund.collateral.withdrawReimbursement(msg.sender);
        }
    }

    // @notice returns the time left for this cycle to end
    function getRemainingCycleTime(uint id) external view returns (uint) {
        FundData storage fund = termFunds[id];
        uint cycleEndTimestamp = fund.cycleTime * fund.currentCycle + fund.fundStart;
        if (block.timestamp > cycleEndTimestamp) {
            return 0;
        } else {
            return cycleEndTimestamp - block.timestamp;
        }
    }

    /// @notice returns the time left to contribute for this cycle
    function getRemainingContributionTime(uint id) external view returns (uint) {
        FundData storage fund = termFunds[id];
        if (fund.currentState != FundStates.AcceptingContributions) {
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
        FundData storage fund = termFunds[id];
        return fund.beneficiariesOrder;
    }

    /// @notice function to get the cycle information in one go
    function getFundSummary(uint id) external view returns (FundStates, uint, address) {
        FundData storage fund = termFunds[id];
        return (fund.currentState, fund.currentCycle, fund.lastBeneficiary);
    }

    /// @notice function to get cycle information of a specific participant
    /// @param participant the user to get the info from
    function getParticipantSummary(
        uint id,
        address participant
    ) external view returns (uint, bool, bool, bool, bool) {
        return (
            beneficiariesPool[participant][id],
            isBeneficiary[participant][id],
            paidThisCycle[participant][id],
            autoPayEnabled[participant][id],
            isParticipant[participant][id]
        );
    }

    function currentCycle(uint id) external view returns (uint) {
        FundData storage fund = termFunds[id];
        return fund.currentCycle;
    }

    function fundEnd(uint id) external view returns (uint) {
        FundData storage fund = termFunds[id];
        return fund.fundEnd;
    }

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

        FundData storage fund = termFunds[termId];
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
        fund.collateral = ICollateral(msg.sender); // TODO: Check when the collateral facet is ready
        fund.stableToken = IERC20(_stableTokenAddress);
        fund.currentState = FundStates.InitializingFund; // TODO: Actual state?
        fund.beneficiariesOrder = new address[](_totalParticipants);

        termId++;

        return termId;
    }

    function _joinTerm(uint id) internal {
        FundData storage fund = termFunds[id];
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

    function _startTerm(uint256 _id) internal {
        FundData storage fund = termFunds[_id];
        fund.currentState = FundStates.InitializingFund;

        uint participantsArrayLength = fund.beneficiariesOrder.length;

        // Set and track participants

        for (uint i; i < participantsArrayLength; ) {
            EnumerableSet.add(fund.participants, fund.beneficiariesOrder[i]);
            isParticipant[fund.beneficiariesOrder[i]][termId] = true;
            unchecked {
                ++i;
            }
        }

        // Starts the first cycle
        _startNewCycle(termId);

        // Set timestamp of deployment, which will be used to determine cycle times
        // We do this after starting the first cycle to make sure the first cycle starts smoothly
        fund.fundStart = block.timestamp;
        emit OnTermStart(
            termId,
            msg.sender,
            fund.stableTokenAddress,
            fund.cycleTime,
            fund.contributionAmount
        );
    }

    /// @notice updates the state according to the input and makes sure the state can't be changed if the fund is closed. Also emits an event that this happened
    /// @param _newState The new state of the fund
    function _setState(uint _id, FundStates _newState) internal {
        FundData storage fund = termFunds[_id];
        require(fund.currentState != FundStates.FundClosed, "Fund closed");
        fund.currentState = _newState;
        emit OnStateChanged(_id, _newState);
    }

    /// @notice This starts the new cycle and can only be called internally. Used upon deploy
    function _startNewCycle(uint _id) internal {
        FundData storage fund = termFunds[_id];
        // currentCycle is 0 when this is called for the first time
        require(
            block.timestamp > fund.cycleTime * fund.currentCycle + fund.fundStart,
            "Too early to start new cycle"
        );
        require(
            fund.currentState == FundStates.InitializingFund ||
                fund.currentState == FundStates.CycleOngoing,
            "Wrong state"
        );

        ++fund.currentCycle;
        uint length = fund.beneficiariesOrder.length;
        for (uint i; i < length; ) {
            paidThisCycle[fund.beneficiariesOrder[i]][_id] = false;
            unchecked {
                ++i;
            }
        }

        _setState(_id, FundStates.AcceptingContributions);

        // We attempt to make the autopayers pay their contribution right away
        _autoPay(_id);
    }

    /// @notice function to attempt to make autopayers pay their contribution
    function _autoPay(uint _id) internal {
        FundData storage fund = termFunds[_id];
        address[] memory autoPayers = fund.beneficiariesOrder;
        uint amount = fund.contributionAmount;

        uint length = autoPayers.length;
        for (uint i; i < length; ) {
            if (
                autoPayEnabled[autoPayers[i]][_id] &&
                !paidThisCycle[autoPayers[i]][_id] &&
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
        FundData storage fund = termFunds[_id];
        // Get the amount and do the actual transfer
        // This will only succeed if the sender approved this contract address beforehand
        uint amount = fund.contributionAmount;

        bool success = fund.stableToken.transferFrom(_payer, address(this), amount);
        require(success, "Contribution failed, did you approve stable token?");

        // Finish up, set that the participant paid for this cycle and emit an event that it's been done
        paidThisCycle[_participant][_id] = true;
        emit OnPaidContribution(_id, _participant, fund.currentCycle);
    }

    /// @notice Default the participant/beneficiary by checking the mapping first, then remove them from the appropriate array
    /// @param _defaulter The participant to default
    function _defaultParticipant(uint _id, address _defaulter) internal {
        FundData storage fund = termFunds[_id];
        // Try removing from participants first
        bool success = EnumerableSet.remove(fund.participants, _defaulter);

        // If that fails, we try removing from beneficiaries
        if (!success) {
            success = EnumerableSet.remove(fund.beneficiaries, _defaulter);
        }

        require(success, "Can't remove defaulter");
        EnumerableSet.add(fund.defaulters, _defaulter);

        emit OnParticipantDefaulted(_id, _defaulter);
    }

    /// @notice The beneficiary will be selected here based on the beneficiariesOrder array.
    /// @notice It will loop through the array and choose the first in line to be eligible to be beneficiary.
    function _selectBeneficiary(uint _id) internal {
        FundData storage fund = termFunds[_id];
        // check if there are any participants left, else use the defaulters
        address selectedBeneficiary; // By default initialization is address(0)
        address[] memory arrayToCheck = fund.beneficiariesOrder;
        uint arrayToCheckLength = arrayToCheck.length;
        uint beneficiaryIndex; // By default uint initialization is 0;

        for (uint i; i < arrayToCheckLength; ) {
            address b = arrayToCheck[i];
            if (!isBeneficiary[b][_id]) {
                selectedBeneficiary = b;
                beneficiaryIndex = i;
                break;
            }
            unchecked {
                ++i;
            }
        }

        // If the defaulter didn't pay this cycle, we move the first elligible beneficiary forward and everyone in between forward
        if (!paidThisCycle[selectedBeneficiary][_id]) {
            // Find the index of the beneficiary to move to the end
            for (uint i = beneficiaryIndex; i < arrayToCheckLength; ) {
                address b = arrayToCheck[i];
                // Find the first eligible beneficiary
                if (paidThisCycle[b][_id]) {
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
        isBeneficiary[selectedBeneficiary][_id] = true;

        // Get the amount of participants that paid this cycle, and add that amount to the beneficiary's pool
        uint paidCount;
        address[] memory allParticipants = fund.beneficiariesOrder; // Use beneficiariesOrder here because it contains all active participants in a single array
        for (uint i = 0; i < allParticipants.length; i++) {
            if (paidThisCycle[allParticipants[i]][_id]) {
                paidCount++;
            }
        }

        // Award the beneficiary with the pool and update the lastBeneficiary
        beneficiariesPool[selectedBeneficiary][_id] = fund.contributionAmount * paidCount;
        fund.lastBeneficiary = selectedBeneficiary;

        emit OnBeneficiarySelected(_id, selectedBeneficiary);
        _setState(_id, FundStates.CycleOngoing);
    }

    /// @notice Called internally to move a defaulter in the beneficiariesOrder to the end, so that people who have paid get chosen first as beneficiary
    /// @param _beneficiary The defaulter that could have been beneficiary
    function _removeBeneficiaryFromOrder(uint _id, address _beneficiary) internal {
        FundData storage fund = termFunds[_id];
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
        FundData storage fund = termFunds[_id];
        //require(msg.sender == address(collateral), "Caller is not collateral");
        require(
            isParticipant[_expellant][_id] && EnumerableSet.remove(fund.defaulters, _expellant),
            "Expellant not found"
        );

        // Expellants should only be in the defauters set so no need to touch the other sets
        //require(EnumerableSet.remove(_defaulters, expellant), "Expellant not found");

        // Remove expellant from beneficiaries order
        // Remove expellants from participants tracker and emit that they've been expelled
        // Update the defaulters array
        _removeBeneficiaryFromOrder(_id, _expellant);

        isParticipant[_expellant][_id] = false;
        emit OnDefaulterExpelled(_id, _expellant);

        // If the participant is expelled before becoming beneficiary, we lose a cycle, the one which this expellant is becoming beneficiary
        if (!isBeneficiary[_expellant][_id]) {
            fund.totalAmountOfCycles--;
        }

        // Lastly, lower the amount of participants with the amount expelled
        uint newLength = fund.totalParticipants - 1;
        fund.totalParticipants = newLength;
        ++fund.expelledParticipants;

        emit OnTotalParticipantsUpdated(_id, newLength);
    }

    /// @notice Internal function for close fund which is used by _startNewCycle & _chooseBeneficiary to cover some edge-cases
    function _closeFund(uint _id) internal {
        FundData storage fund = termFunds[_id];
        fund.fundEnd = block.timestamp;
        _setState(_id, FundStates.FundClosed);
        fund.collateral.releaseCollateral();
    }
}
