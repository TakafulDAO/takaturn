// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IFundV2} from "../interfaces/IFundV2.sol";
import {ICollateralV2} from "../interfaces/ICollateralV2.sol";
import {IGettersV2} from "../interfaces/IGettersV2.sol";

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {LibCollateralV2} from "../libraries/LibCollateralV2.sol";
import {LibFundV2} from "../libraries/LibFundV2.sol";
import {LibTermV2} from "../libraries/LibTermV2.sol";
import {LibTermOwnership} from "../libraries/LibTermOwnership.sol";

import {TermOwnable} from "../../version-1/access/TermOwnable.sol";

/// @title Takaturn Fund
/// @author Mohammed Haddouti
/// @notice This is used to operate the Takaturn fund
/// @dev v3.0 (Diamond)
contract FundFacetV2 is IFundV2 {
    using EnumerableSet for EnumerableSet.AddressSet;

    uint public constant FUND_VERSION = 2; // The version of the contract

    event OnTermStart(uint indexed termId); // Emits when a new term starts, this also marks the start of the first cycle
    event OnFundStateChanged(
        uint indexed termId,
        uint indexed currentCycle,
        LibFundV2.FundStates indexed newState
    ); // Emits when state has updated
    event OnPaidContribution(uint indexed termId, address indexed payer, uint indexed currentCycle); // Emits when participant pays the contribution
    event OnBeneficiaryAwarded(uint indexed termId, address indexed beneficiary); // Emits when beneficiary is selected for this cycle
    event OnFundWithdrawn(uint indexed termId, address indexed claimant, uint indexed amount); // Emits when a chosen beneficiary claims their fund
    event OnParticipantDefaulted(
        uint indexed termId,
        uint indexed currentCycle,
        address indexed defaulter
    ); // Emits when a participant didn't pay this cycle's contribution
    event OnDefaulterExpelled(
        uint indexed termId,
        uint indexed currentCycle,
        address indexed expellant
    ); // Emits when a defaulter can't compensate with the collateral
    event OnAutoPayToggled(uint indexed termId, address indexed participant, bool indexed enabled); // Emits when a participant succesfully toggles autopay

    modifier onlyTermOwner(uint termId) {
        LibTermOwnership._ensureTermOwner(termId);
        _;
    }

    /// Insufficient balance for transfer. Needed `required` but only
    /// `available` available.
    /// @param available balance available.
    /// @param required requested amount to transfer.
    error InsufficientBalance(uint available, uint required);

    /// @notice called by the term to init the fund
    /// @param termId the id of the term
    function initFund(uint termId) external {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[termId];
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
        //emit LibFundV2.OnTermStart(termId);
        emit OnTermStart(termId);
    }

    /// @notice starts a new cycle manually called by the owner. Only the first cycle starts automatically upon deploy
    /// @param termId the id of the term
    function startNewCycle(uint termId) external {
        _startNewCycle(termId);
    }

    /// @notice Must be called at the end of the contribution period after the time has passed by the owner
    /// @param termId the id of the term
    function closeFundingPeriod(uint termId) external {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[termId];
        LibTermV2.Term storage term = LibTermV2._termStorage().terms[termId];
        // Current cycle minus 1 because we use the previous cycle time as start point then  add contribution period
        require(
            block.timestamp >
                term.cycleTime * (fund.currentCycle - 1) + fund.fundStart + term.contributionPeriod,
            "Still time to contribute"
        );
        require(fund.currentState == LibFundV2.FundStates.AcceptingContributions, "Wrong state");

        address currentBeneficiary = IGettersV2(address(this)).getCurrentBeneficiary(termId);

        // We attempt to make the autopayers pay their contribution right away
        _autoPay(termId);

        // Only then award the beneficiary
        _setState(termId, LibFundV2.FundStates.AwardingBeneficiary);

        // We must check who hasn't paid and default them, check all participants based on beneficiariesOrder
        address[] memory participants = fund.beneficiariesOrder;

        uint participantsLength = participants.length;
        uint currentCycle = fund.currentCycle;
        for (uint i; i < participantsLength; ) {
            address p = participants[i];

            // The current beneficiary or someone who is exempt doesn't pay neither gets defaulted
            if (p == currentBeneficiary || fund.isExemptedOnCycle[currentCycle].exempted[p]) {
                unchecked {
                    ++i;
                }
                continue;
            }

            if (fund.paidThisCycle[p]) {
                // check where to restore the defaulter to, participants or beneficiaries
                if (fund.isBeneficiary[p]) {
                    EnumerableSet.add(fund._beneficiaries, p);
                } else {
                    EnumerableSet.add(fund._participants, p);
                }

                EnumerableSet.remove(fund._defaulters, p);
            } else if (!EnumerableSet.contains(fund._defaulters, p)) {
                // And we make sure that existing defaulters are ignored
                // If the current beneficiary is an expelled participant, only check previous beneficiaries
                if (IGettersV2(address(this)).wasExpelled(termId, currentBeneficiary)) {
                    if (fund.isBeneficiary[p]) {
                        _defaultParticipant(termId, p);
                    }
                } else {
                    _defaultParticipant(termId, p);
                }
            }
            unchecked {
                ++i;
            }
        }

        // Once we decided who defaulted and who paid, we can award the beneficiary for this cycle
        _awardBeneficiary(fund, term);
        if (!(fund.currentCycle < fund.totalAmountOfCycles)) {
            // If all cycles have passed, and the last cycle's time has passed, close the fund
            _closeFund(termId);
            return;
        }
    }

    /// @notice Fallback function, if the internal call fails somehow and the state gets stuck, allow owner to call the function again manually
    /// @dev This shouldn't happen, but is here in case there's an edge-case we didn't take into account, can possibly be removed in the future
    /// @param termId the id of the term
    function awardBeneficiary(uint termId) external onlyTermOwner(termId) {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[termId];
        require(fund.currentState == LibFundV2.FundStates.AwardingBeneficiary, "Wrong state");
        LibTermV2.Term storage term = LibTermV2._termStorage().terms[termId];

        _awardBeneficiary(fund, term);
    }

    /// @notice called by the owner to close the fund for emergency reasons.
    /// @param termId the id of the term
    function closeFund(uint termId) external onlyTermOwner(termId) {
        //require (!(currentCycle < totalAmountOfCycles), "Not all cycles have happened yet");
        _closeFund(termId);
    }

    /// @notice allow the owner to empty the fund if there's any excess fund left after 180 days,
    ///         this with the assumption that beneficiaries can't claim it themselves due to losing their keys for example,
    ///         and prevent the fund to be stuck in limbo
    /// @param termId the id of the term
    function emptyFundAfterEnd(uint termId) external onlyTermOwner(termId) {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[termId];
        require(
            fund.currentState == LibFundV2.FundStates.FundClosed &&
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
    /// @param termId the id of the term
    function toggleAutoPay(uint termId) external {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[termId];
        require(fund.isParticipant[msg.sender], "Not a participant");
        bool enabled = !fund.autoPayEnabled[msg.sender];
        fund.autoPayEnabled[msg.sender] = enabled;

        emit OnAutoPayToggled(termId, msg.sender, enabled);
    }

    /// @notice This is the function participants call to pay the contribution
    /// @param termId the id of the term
    function payContribution(uint termId) external {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[termId];

        // Get the beneficiary for this cycle
        address currentBeneficiary = IGettersV2(address(this)).getCurrentBeneficiary(termId);

        require(fund.currentState == LibFundV2.FundStates.AcceptingContributions, "Wrong state");
        require(fund.isParticipant[msg.sender], "Not a participant");
        require(currentBeneficiary != msg.sender, "Beneficiary doesn't pay");
        require(!fund.paidThisCycle[msg.sender], "Already paid for cycle");
        require(
            !fund.isExemptedOnCycle[fund.currentCycle].exempted[msg.sender],
            "Participant is exempted this cycle"
        );

        _payContribution(termId, msg.sender, msg.sender);
    }

    /// @notice This function is here to give the possibility to pay using a different wallet
    /// @param termId the id of the term
    /// @param participant the address the msg.sender is paying for, the address must be part of the fund
    function payContributionOnBehalfOf(uint termId, address participant) external {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[termId];

        address currentBeneficiary = IGettersV2(address(this)).getCurrentBeneficiary(termId);

        require(fund.currentState == LibFundV2.FundStates.AcceptingContributions, "Wrong state");
        require(fund.isParticipant[participant], "Not a participant");
        require(currentBeneficiary != participant, "Beneficiary doesn't pay");
        require(!fund.paidThisCycle[participant], "Already paid for cycle");
        require(
            !fund.isExemptedOnCycle[fund.currentCycle].exempted[participant],
            "Participant is exempted this cycle"
        );

        _payContribution(termId, msg.sender, participant);
    }

    /// @notice Called by the beneficiary to withdraw the fund
    /// @dev This follows the pull-over-push pattern.
    /// @param termId the id of the term
    function withdrawFund(uint termId) external {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[termId];
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[termId];
        // To withdraw the fund, the fund must be closed or the participant must be a beneficiary on
        // any of the past cycles.

        require(
            fund.currentState == LibFundV2.FundStates.FundClosed || fund.isBeneficiary[msg.sender],
            "You must be a beneficiary"
        );

        bool hasFundPool = fund.beneficiariesPool[msg.sender] > 0;
        bool hasFrozenPool = fund.beneficiariesFrozenPool[msg.sender];
        bool hasCollateralPool = collateral.collateralPaymentBank[msg.sender] > 0;

        require(hasFundPool || hasFrozenPool || hasCollateralPool, "Nothing to withdraw");

        if (hasFundPool) {
            _transferPoolToBeneficiary(termId, msg.sender);
        }

        if (hasCollateralPool) {
            ICollateralV2(address(this)).withdrawReimbursement(termId, msg.sender);
        }

        if (hasFrozenPool) {
            bool freeze = _freezePot(LibTermV2._termStorage().terms[termId], fund, msg.sender);

            require(!freeze, "Need at least 1.1RCC collateral to unfreeze your fund");

            _transferPoolToBeneficiary(termId, msg.sender);
        }
    }

    /// @param termId the id of the term
    /// @param beneficiary the address of the participant to check
    /// @return true if the participant is a beneficiary
    function isBeneficiary(uint termId, address beneficiary) external view returns (bool) {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[termId];
        return fund.isBeneficiary[beneficiary];
    }

    /// @notice updates the state according to the input and makes sure the state can't be changed if the fund is closed. Also emits an event that this happened
    /// @param _termId The id of the term
    /// @param _newState The new state of the fund
    function _setState(uint _termId, LibFundV2.FundStates _newState) internal {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[_termId];
        require(fund.currentState != LibFundV2.FundStates.FundClosed, "Fund closed");
        fund.currentState = _newState;
        emit OnFundStateChanged(_termId, fund.currentCycle, _newState);
    }

    /// @notice This starts the new cycle and can only be called internally. Used upon deploy
    /// @param _termId The id of the term
    function _startNewCycle(uint _termId) internal {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[_termId];
        LibTermV2.Term storage term = LibTermV2._termStorage().terms[_termId];
        // currentCycle is 0 when this is called for the first time
        require(
            block.timestamp > term.cycleTime * fund.currentCycle + fund.fundStart,
            "Too early to start new cycle"
        );
        require(
            fund.currentState == LibFundV2.FundStates.InitializingFund ||
                fund.currentState == LibFundV2.FundStates.CycleOngoing,
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

        _setState(_termId, LibFundV2.FundStates.AcceptingContributions);

        // We attempt to make the autopayers pay their contribution right away
        _autoPay(_termId);
    }

    /// @notice function to attempt to make autopayers pay their contribution
    /// @param _termId the id of the term
    function _autoPay(uint _termId) internal {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[_termId];

        // Get the beneficiary for this cycle
        address currentBeneficiary = IGettersV2(address(this)).getCurrentBeneficiary(_termId);

        address[] memory autoPayers = fund.beneficiariesOrder; // use beneficiariesOrder because it is a single array with all participants
        uint autoPayersArray = autoPayers.length;

        for (uint i; i < autoPayersArray; ) {
            address autoPayer = autoPayers[i];
            // The beneficiary doesn't pay
            if (currentBeneficiary == autoPayer) {
                unchecked {
                    ++i;
                }
                continue;
            }

            if (
                fund.autoPayEnabled[autoPayer] &&
                !fund.paidThisCycle[autoPayer] &&
                !fund.isExemptedOnCycle[fund.currentCycle].exempted[autoPayer]
            ) {
                _payContributionSafe(_termId, autoPayer, autoPayer);
            }

            unchecked {
                ++i;
            }
        }
    }

    /// @notice function to pay the actual contribution for the cycle, used for autopay to prevent reverts
    /// @param _termId the id of the term
    /// @param _payer the address that's paying
    /// @param _participant the (participant) address that's being paid for
    function _payContributionSafe(uint _termId, address _payer, address _participant) internal {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[_termId];
        LibTermV2.Term storage term = LibTermV2._termStorage().terms[_termId];

        // Get the amount and do the actual transfer
        // This will only succeed if the sender approved this contract address beforehand
        uint amount = term.contributionAmount * 10 ** 6;
        try fund.stableToken.transferFrom(_payer, address(this), amount) returns (bool success) {
            if (success) {
                // Finish up, set that the participant paid for this cycle and emit an event that it's been done
                fund.paidThisCycle[_participant] = true;
                emit OnPaidContribution(_termId, _participant, fund.currentCycle);
            }
        } catch {}
    }

    /// @notice function to pay the actual contribution for the cycle
    /// @param _termId the id of the term
    /// @param _payer the address that's paying
    /// @param _participant the (participant) address that's being paid for
    function _payContribution(uint _termId, address _payer, address _participant) internal {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[_termId];
        LibTermV2.Term storage term = LibTermV2._termStorage().terms[_termId];

        // Get the amount and do the actual transfer
        // This will only succeed if the sender approved this contract address beforehand
        uint amount = term.contributionAmount * 10 ** 6;

        bool success = fund.stableToken.transferFrom(_payer, address(this), amount);
        require(success, "Contribution failed, did you approve stable token?");

        // Finish up, set that the participant paid for this cycle and emit an event that it's been done
        fund.paidThisCycle[_participant] = true;
        emit OnPaidContribution(_termId, _participant, fund.currentCycle);
    }

    /// @notice Default the participant/beneficiary by checking the mapping first, then remove them from the appropriate array
    /// @param _termId The id of the term
    /// @param _defaulter The participant to default
    function _defaultParticipant(uint _termId, address _defaulter) internal {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[_termId];
        // Try removing from participants first
        bool success = EnumerableSet.remove(fund._participants, _defaulter);

        // If that fails, we try removing from beneficiaries
        if (!success) {
            success = EnumerableSet.remove(fund._beneficiaries, _defaulter);
        }

        require(success, "Can't remove defaulter");
        EnumerableSet.add(fund._defaulters, _defaulter);

        emit OnParticipantDefaulted(_termId, fund.currentCycle, _defaulter);
    }

    /// @notice The beneficiary will be awarded here based on the beneficiariesOrder array.
    /// @notice It will loop through the array and choose the first in line to be eligible to be beneficiary.
    function _awardBeneficiary(
        LibFundV2.Fund storage _fund,
        LibTermV2.Term storage _term
    ) internal {
        address beneficiary = IGettersV2(address(this)).getCurrentBeneficiary(_term.termId);

        // Request contribution from the collateral for those who have to pay this cycle and haven't paid
        if (EnumerableSet.length(_fund._defaulters) > 0) {
            address[] memory actualDefaulters = _actualDefaulters(
                _fund,
                _term,
                beneficiary,
                EnumerableSet.values(_fund._defaulters)
            );

            address[] memory expellants = ICollateralV2(address(this)).requestContribution(
                _term,
                actualDefaulters
            );

            uint expellantsLength = expellants.length;
            for (uint i; i < expellantsLength; ) {
                if (expellants[i] == address(0)) {
                    unchecked {
                        ++i;
                    }
                    continue;
                }
                _expelDefaulter(_fund, _term, expellants[i]);
                unchecked {
                    ++i;
                }
            }
        }

        // Remove participant from participants set..
        if (EnumerableSet.remove(_fund._participants, beneficiary)) {
            // ..Then add them to the benificiaries set
            EnumerableSet.add(_fund._beneficiaries, beneficiary);
        } // If this if-statement fails, this means we're dealing with a graced defaulter

        // Update the mapping to track who's been beneficiary
        _fund.isBeneficiary[beneficiary] = true;

        // Get the amount of participants that paid this cycle, and add that amount to the beneficiary's pool
        uint paidCount;
        address[] memory participants = _fund.beneficiariesOrder; // Use beneficiariesOrder here because it contains all active participants in a single array
        uint participantsLength = participants.length;
        for (uint i; i < participantsLength; ) {
            if (_fund.paidThisCycle[participants[i]]) {
                paidCount++;
            }
            unchecked {
                ++i;
            }
        }

        // Award the beneficiary with the pool or freeze the pot
        _freezePot(_term, _fund, beneficiary);

        _fund.beneficiariesPool[beneficiary] = _term.contributionAmount * paidCount * 10 ** 6;

        emit OnBeneficiaryAwarded(_term.termId, beneficiary);
        _setState(_term.termId, LibFundV2.FundStates.CycleOngoing);
    }

    /// @notice Called to get the defaulters
    /// @dev Beneficiary is never considered a defaulter
    /// @dev If the beneficiary was previously expelled, then we only consider previous beneficiaries
    /// @param _fund Fund storage
    /// @param _defaulters Complete defaulters array that will be filtered
    /// @return actualDefaulters array of addresses that we will consider as defaulters for the current cycle
    function _actualDefaulters(
        LibFundV2.Fund storage _fund,
        LibTermV2.Term storage _term,
        address _beneficiary,
        address[] memory _defaulters
    ) internal view returns (address[] memory) {
        address[] memory actualDefaulters;
        address[] memory beneficiariesOrder = _fund.beneficiariesOrder; // We check on the beneficiariesOrder array

        uint defaultersLength = _defaulters.length;
        uint defaultersCounter;

        if (IGettersV2(address(this)).wasExpelled(_term.termId, _beneficiary)) {
            uint cycleOfExpulsion = _fund.cycleOfExpulsion[_beneficiary];
            for (uint i; i < cycleOfExpulsion; ) {
                for (uint j; j < defaultersLength; ) {
                    // We check if the previous beneficiary is on the defaulter array
                    if (beneficiariesOrder[i] == _defaulters[j]) {
                        actualDefaulters[defaultersCounter] = _defaulters[j];
                        unchecked {
                            ++defaultersCounter;
                        }
                    }
                    unchecked {
                        ++j;
                    }
                }
                unchecked {
                    ++i;
                }
            }
        } else {
            // We don't consider the beneficiary a defaulter
            for (uint i; i < defaultersLength; ) {
                if (_defaulters[i] == _beneficiary) {
                    unchecked {
                        ++i;
                    }
                    continue;
                }
                actualDefaulters[defaultersCounter] = _defaulters[i];
                unchecked {
                    ++defaultersCounter;
                    ++i;
                }
            }
        }

        return actualDefaulters;
    }

    /// @notice called internally to expel a participant. It should not be possible to expel non-defaulters, so those arrays are not checked.
    /// @param _expellant The address of the defaulter that will be expelled
    function _expelDefaulter(
        LibFundV2.Fund storage _fund,
        LibTermV2.Term storage _term,
        address _expellant
    ) internal {
        // Expellants should only be in the defauters set so no need to touch the other sets
        require(
            _fund.isParticipant[_expellant] && EnumerableSet.remove(_fund._defaulters, _expellant),
            "Expellant not found"
        );

        _fund.isParticipant[_expellant] = false;

        // Lastly, lower the amount of participants
        --_term.totalParticipants;
        // collateral.isCollateralMember[_expellant] = false; // todo: needed? it is set also on whoExpelled
        ++_fund.expelledParticipants;

        emit OnDefaulterExpelled(_term.termId, _fund.currentCycle, _expellant);
    }

    /// @notice Internal function for close fund which is used by _startNewCycle & _chooseBeneficiary to cover some edge-cases
    /// @param _termId The id of the term
    function _closeFund(uint _termId) internal {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[_termId];
        LibTermV2.Term storage term = LibTermV2._termStorage().terms[_termId];
        fund.fundEnd = block.timestamp;
        term.state = LibTermV2.TermStates.ClosedTerm;
        _setState(_termId, LibFundV2.FundStates.FundClosed);
        ICollateralV2(address(this)).releaseCollateral(_termId);
    }

    /// @notice Internal function to transfer the pool to the beneficiary
    /// @param _termId The id of the term
    /// @param _beneficiary The address of the beneficiary
    function _transferPoolToBeneficiary(uint _termId, address _beneficiary) internal {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[_termId];

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
        emit OnFundWithdrawn(_termId, _beneficiary, transferAmount);
    }

    /// @notice Internal function to freeze the pot for the beneficiary
    function _freezePot(
        LibTermV2.Term memory _term,
        LibFundV2.Fund storage _fund,
        address _user
    ) internal returns (bool) {
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[_term.termId];

        uint remainingCyclesContribution = IGettersV2(address(this))
            .getRemainingCyclesContributionWei(_term.termId);

        uint neededCollateral = (110 * remainingCyclesContribution) / 100; // 1.1 x RCC

        if (collateral.collateralMembersBank[_user] < neededCollateral) {
            _fund.beneficiariesFrozenPool[_user] = true;
        } else {
            _fund.beneficiariesFrozenPool[_user] = false;
        }

        return _fund.beneficiariesFrozenPool[_user];
    }
}
