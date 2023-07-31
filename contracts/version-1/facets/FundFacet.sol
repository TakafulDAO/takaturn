// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IFund} from "../interfaces/IFund.sol";
import {ICollateral} from "../interfaces/ICollateral.sol";
import {IGetters} from "../interfaces/IGetters.sol";

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {LibCollateral} from "../libraries/LibCollateral.sol";
import {LibFund} from "../libraries/LibFund.sol";
import {LibTerm} from "../libraries/LibTerm.sol";

import {TermOwnable} from "../access/TermOwnable.sol";

/// @title Takaturn Fund
/// @author Mohammed Haddouti
/// @notice This is used to operate the Takaturn fund
/// @dev v3.0 (Diamond)
contract FundFacet is IFund, TermOwnable {
    using EnumerableSet for EnumerableSet.AddressSet;

    uint public constant FUND_VERSION = 2; // The version of the contract

    event OnTermStart(uint indexed termId); // Emits when a new term starts, this also marks the start of the first cycle
    event OnFundStateChanged(uint indexed termId, LibFund.FundStates indexed newState); // Emits when state has updated
    event OnPaidContribution(uint indexed termId, address indexed payer, uint indexed currentCycle); // Emits when participant pays the contribution
    event OnBeneficiarySelected(uint indexed termId, address indexed beneficiary); // Emits when beneficiary is selected for this cycle
    event OnFundWithdrawn(uint indexed termId, address indexed claimant, uint indexed amount); // Emits when a chosen beneficiary claims their fund
    event OnParticipantDefaulted(uint indexed termId, address indexed defaulter); // Emits when a participant didn't pay this cycle's contribution
    event OnParticipantUndefaulted(uint indexed termId, address indexed undefaulter); // Emits when a participant was a defaulter before but started paying on time again for this cycle
    event OnDefaulterExpelled(uint indexed termId, address indexed expellant); // Emits when a defaulter can't compensate with the collateral
    event OnTotalParticipantsUpdated(uint indexed termId, uint indexed newLength); // Emits when the total participants lengths has changed from its initial value
    event OnAutoPayToggled(uint indexed termId, address indexed participant, bool indexed enabled); // Emits when a participant succesfully toggles autopay

    /// Insufficient balance for transfer. Needed `required` but only
    /// `available` available.
    /// @param available balance available.
    /// @param required requested amount to transfer.
    error InsufficientBalance(uint available, uint required);

    /// @notice called by the term to init the fund
    /// @param termId the id of the term
    function initFund(uint termId) external {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[termId];
        uint participantsArrayLength = fund.beneficiariesOrder.length;
        // Set and track participants
        for (uint i; i < participantsArrayLength; ) {
            EnumerableSet.add(fund._participants, fund.beneficiariesOrder[i]);
            fund.isParticipant[fund.beneficiariesOrder[i]] = true;
            unchecked {
                ++i;
            }
        }

        // Starts the first cycle
        _startNewCycle(termId);

        // Set timestamp of deployment, which will be used to determine cycle times
        // We do this after starting the first cycle to make sure the first cycle starts smoothly
        fund.fundStart = block.timestamp;
        //emit LibFund.OnTermStart(termId);
        emit OnTermStart(termId);
    }

    /// @notice starts a new cycle manually called by the owner. Only the first cycle starts automatically upon deploy
    /// @param id the id of the term
    function startNewCycle(uint id) external onlyTermOwner(id) {
        _startNewCycle(id);
    }

    /// @notice Must be called at the end of the contribution period after the time has passed by the owner
    /// @param id the id of the term
    function closeFundingPeriod(uint id) external onlyTermOwner(id) {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[id];
        LibTerm.Term storage term = LibTerm._termStorage().terms[id];
        // Current cycle minus 1 because we use the previous cycle time as start point then add contribution period
        require(
            block.timestamp >
                term.cycleTime * (fund.currentCycle - 1) + fund.fundStart + term.contributionPeriod,
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
                    EnumerableSet.add(fund._beneficiaries, p);
                } else {
                    EnumerableSet.add(fund._participants, p);
                }

                if (EnumerableSet.remove(fund._defaulters, p)) {
                    emit OnParticipantUndefaulted(id, p);
                }
            } else if (!EnumerableSet.contains(fund._defaulters, p)) {
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
    /// @param id the id of the term
    function selectBeneficiary(uint id) external onlyTermOwner(id) {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[id];
        require(fund.currentState == LibFund.FundStates.ChoosingBeneficiary, "Wrong state");
        _selectBeneficiary(id);
    }

    /// @notice called by the owner to close the fund for emergency reasons.
    /// @param id the id of the term
    function closeFund(uint id) external onlyTermOwner(id) {
        //require (!(currentCycle < totalAmountOfCycles), "Not all cycles have happened yet");
        _closeFund(id);
    }

    /// @notice allow the owner to empty the fund if there's any excess fund left after 180 days,
    ///         this with the assumption that beneficiaries can't claim it themselves due to losing their keys for example,
    ///         and prevent the fund to be stuck in limbo
    /// @param id the id of the term
    function emptyFundAfterEnd(uint id) external onlyTermOwner(id) {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[id];
        require(
            fund.currentState == LibFund.FundStates.FundClosed &&
                block.timestamp > fund.fundEnd + 180 days,
            "Can't empty yet"
        );

        uint balance = fund.stableToken.balanceOf(address(this));
        if (balance > 0) {
            bool success = fund.stableToken.transfer(msg.sender, balance);
            require(success, "Transfer failed");
        }
    }

    /// @notice function to enable/disable autopay
    /// @param id the id of the term
    function toggleAutoPay(uint id) external {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[id];
        require(fund.isParticipant[msg.sender], "Not a participant");
        bool enabled = !fund.autoPayEnabled[msg.sender];
        fund.autoPayEnabled[msg.sender] = enabled;

        emit OnAutoPayToggled(id, msg.sender, enabled);
    }

    /// @notice This is the function participants call to pay the contribution
    /// @param id the id of the term
    function payContribution(uint id) external {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[id];
        require(fund.currentState == LibFund.FundStates.AcceptingContributions, "Wrong state");
        require(fund.isParticipant[msg.sender], "Not a participant");
        require(!fund.paidThisCycle[msg.sender], "Already paid for cycle");
        _payContribution(id, msg.sender, msg.sender);
    }

    /// @notice This function is here to give the possibility to pay using a different wallet
    /// @param id the id of the term
    /// @param participant the address the msg.sender is paying for, the address must be part of the fund
    function payContributionOnBehalfOf(uint id, address participant) external {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[id];
        require(fund.currentState == LibFund.FundStates.AcceptingContributions, "Wrong state");
        require(fund.isParticipant[participant], "Not a participant");
        require(!fund.paidThisCycle[participant], "Already paid for cycle");
        _payContribution(id, msg.sender, participant);
    }

    /// @notice Called by the beneficiary to withdraw the fund
    /// @dev This follows the pull-over-push pattern.
    /// @param id the id of the term
    function withdrawFund(uint id) external {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[id];
        require(
            fund.currentState == LibFund.FundStates.FundClosed || fund.paidThisCycle[msg.sender],
            "You must pay your cycle before withdrawing"
        );

        bool hasFundPool = fund.beneficiariesPool[msg.sender] > 0;
        (, , uint collateralPool) = IGetters(address(this)).getDepositorCollateralSummary(
            msg.sender,
            id
        );
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
                bool success = fund.stableToken.transfer(msg.sender, transferAmount);
                require(success, "Transfer failed");
            }
            emit OnFundWithdrawn(id, msg.sender, transferAmount);
        }

        if (hasCollateralPool) {
            ICollateral(address(this)).withdrawReimbursement(id, msg.sender);
        }
    }

    /// @param id the id of the term
    /// @param beneficiary the address of the participant to check
    /// @return true if the participant is a beneficiary
    function isBeneficiary(uint id, address beneficiary) external view returns (bool) {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[id];
        return fund.isBeneficiary[beneficiary];
    }

    /// @notice updates the state according to the input and makes sure the state can't be changed if the fund is closed. Also emits an event that this happened
    /// @param _id The id of the term
    /// @param _newState The new state of the fund
    function _setState(uint _id, LibFund.FundStates _newState) internal {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[_id];
        require(fund.currentState != LibFund.FundStates.FundClosed, "Fund closed");
        fund.currentState = _newState;
        emit OnFundStateChanged(_id, _newState);
    }

    /// @notice This starts the new cycle and can only be called internally. Used upon deploy
    /// @param _id The id of the term
    function _startNewCycle(uint _id) internal {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[_id];
        LibTerm.Term storage term = LibTerm._termStorage().terms[_id];
        // currentCycle is 0 when this is called for the first time
        require(
            block.timestamp > term.cycleTime * fund.currentCycle + fund.fundStart,
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
    /// @param _id the id of the term
    function _autoPay(uint _id) internal {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[_id];
        address[] memory autoPayers = fund.beneficiariesOrder; // use beneficiariesOrder because it is a single array with all participants
        uint length = autoPayers.length;
        for (uint i; i < length; ) {
            if (fund.autoPayEnabled[autoPayers[i]] && !fund.paidThisCycle[autoPayers[i]]) {
                _payContributionSafe(_id, autoPayers[i], autoPayers[i]);
            }
            unchecked {
                ++i;
            }
        }
    }

    /// @notice function to pay the actual contribution for the cycle, used for autopay to prevent reverts
    /// @param _id the id of the term
    /// @param _payer the address that's paying
    /// @param _participant the (participant) address that's being paid for
    function _payContributionSafe(uint _id, address _payer, address _participant) internal {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[_id];
        LibTerm.Term storage term = LibTerm._termStorage().terms[_id];

        // Get the amount and do the actual transfer
        // This will only succeed if the sender approved this contract address beforehand
        uint amount = term.contributionAmount * 10 ** 6;
        try fund.stableToken.transferFrom(_payer, address(this), amount) returns (bool success) {
            if (success) {
                // Finish up, set that the participant paid for this cycle and emit an event that it's been done
                fund.paidThisCycle[_participant] = true;
                emit OnPaidContribution(_id, _participant, fund.currentCycle);
            }
        } catch {}
    }

    /// @notice function to pay the actual contribution for the cycle
    /// @param _id the id of the term
    /// @param _payer the address that's paying
    /// @param _participant the (participant) address that's being paid for
    function _payContribution(uint _id, address _payer, address _participant) internal {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[_id];
        LibTerm.Term storage term = LibTerm._termStorage().terms[_id];

        // Get the amount and do the actual transfer
        // This will only succeed if the sender approved this contract address beforehand
        uint amount = term.contributionAmount * 10 ** 6;

        bool success = fund.stableToken.transferFrom(_payer, address(this), amount);
        require(success, "Contribution failed, did you approve stable token?");

        // Finish up, set that the participant paid for this cycle and emit an event that it's been done
        fund.paidThisCycle[_participant] = true;
        emit OnPaidContribution(_id, _participant, fund.currentCycle);
    }

    /// @notice Default the participant/beneficiary by checking the mapping first, then remove them from the appropriate array
    /// @param _id The id of the term
    /// @param _defaulter The participant to default
    function _defaultParticipant(uint _id, address _defaulter) internal {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[_id];
        // Try removing from participants first
        bool success = EnumerableSet.remove(fund._participants, _defaulter);

        // If that fails, we try removing from beneficiaries
        if (!success) {
            success = EnumerableSet.remove(fund._beneficiaries, _defaulter);
        }

        require(success, "Can't remove defaulter");
        EnumerableSet.add(fund._defaulters, _defaulter);

        emit OnParticipantDefaulted(_id, _defaulter);
    }

    /// @notice The beneficiary will be selected here based on the beneficiariesOrder array.
    /// @notice It will loop through the array and choose the first in line to be eligible to be beneficiary.
    /// @param _id The id of the term
    function _selectBeneficiary(uint _id) internal {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[_id];
        LibTerm.Term storage term = LibTerm._termStorage().terms[_id];
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
        if (EnumerableSet.length(fund._defaulters) > 0) {
            address[] memory expellants = ICollateral(address(this)).requestContribution(
                _id,
                selectedBeneficiary,
                EnumerableSet.values(fund._defaulters)
            );

            uint expellantsLength = expellants.length;
            for (uint i; i < expellantsLength; ) {
                if (expellants[i] == address(0)) {
                    unchecked {
                        ++i;
                    }
                    continue;
                }
                _expelDefaulter(_id, expellants[i]);
                unchecked {
                    ++i;
                }
            }
        }

        // Remove participant from participants set..
        if (EnumerableSet.remove(fund._participants, selectedBeneficiary)) {
            // ..Then add them to the benificiaries set
            EnumerableSet.add(fund._beneficiaries, selectedBeneficiary);
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
        // todo: check if this is correct
        fund.beneficiariesPool[selectedBeneficiary] = term.contributionAmount * paidCount * 10 ** 6;
        fund.lastBeneficiary = selectedBeneficiary;

        emit OnBeneficiarySelected(_id, selectedBeneficiary);
        _setState(_id, LibFund.FundStates.CycleOngoing);
    }

    /// @notice Called internally to move a defaulter in the beneficiariesOrder to the end, so that people who have paid get chosen first as beneficiary
    /// @param _id The id of the term
    /// @param _beneficiary The defaulter that could have been beneficiary
    function _removeBeneficiaryFromOrder(uint _id, address _beneficiary) internal {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[_id];
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
    /// @param _id The id of the term
    /// @param _expellant The address of the defaulter that will be expelled
    function _expelDefaulter(uint _id, address _expellant) internal {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[_id];
        LibFund.Fund storage fund = LibFund._fundStorage().funds[_id];
        LibTerm.Term storage term = LibTerm._termStorage().terms[_id];
        //require(msg.sender == address(collateral), "Caller is not collateral");
        require(
            fund.isParticipant[_expellant] && EnumerableSet.remove(fund._defaulters, _expellant),
            "Expellant not found"
        );

        // Expellants should only be in the defauters set so no need to touch the other sets
        //require(EnumerableSet.remove(_defaulters, expellant), "Expellant not found");

        // Remove expellant from beneficiaries order
        // Remove expellants from participants tracker and emit that they've been expelled
        // Update the defaulters array
        _removeBeneficiaryFromOrder(_id, _expellant);

        fund.isParticipant[_expellant] = false;
        emit OnDefaulterExpelled(_id, _expellant);

        // If the participant is expelled before becoming beneficiary, we lose a cycle, the one which this expellant is becoming beneficiary
        if (!fund.isBeneficiary[_expellant]) {
            fund.totalAmountOfCycles--;
        }

        // Lastly, lower the amount of participants with the amount expelled
        uint newLength = term.totalParticipants - 1;
        term.totalParticipants = newLength;
        collateral.isCollateralMember[_expellant] = false;
        ++fund.expelledParticipants;

        emit OnTotalParticipantsUpdated(_id, newLength);
    }

    /// @notice Internal function for close fund which is used by _startNewCycle & _chooseBeneficiary to cover some edge-cases
    /// @param _id The id of the term
    function _closeFund(uint _id) internal {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[_id];
        fund.fundEnd = block.timestamp;
        _setState(_id, LibFund.FundStates.FundClosed);
        ICollateral(address(this)).releaseCollateral(_id);
    }
}