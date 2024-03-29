// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IFund} from "../interfaces/IFund.sol";
import {ICollateral} from "../interfaces/ICollateral.sol";
import {IGetters} from "../interfaces/IGetters.sol";

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {LibCollateralStorage} from "../libraries/LibCollateralStorage.sol";
import {LibFundStorage} from "../libraries/LibFundStorage.sol";
import {LibTermStorage} from "../libraries/LibTermStorage.sol";
import {LibCollateral} from "../libraries/LibCollateral.sol";
import {LibTermOwnership} from "../libraries/LibTermOwnership.sol";
import {LibFund} from "../libraries/LibFund.sol";

/// @title Takaturn Fund Facet
/// @author Mohammed Haddouti
/// @notice This is used to operate the Takaturn fund
/// @dev v3.0 (Diamond)
contract FundFacet is IFund {
    using EnumerableSet for EnumerableSet.AddressSet;

    event OnFundStateChanged(
        uint indexed termId,
        uint indexed currentCycle,
        LibFundStorage.FundStates indexed newState
    ); // Emits when state has updated
    event OnPaidContribution(uint indexed termId, address indexed payer, uint indexed currentCycle); // Emits when participant pays the contribution
    event OnBeneficiaryAwarded(uint indexed termId, address indexed beneficiary); // Emits when beneficiary is selected for this cycle
    event OnFundWithdrawn(
        uint indexed termId,
        address indexed participant,
        address receiver,
        uint indexed amount
    ); // Emits when a chosen beneficiary claims their fund
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

    /// @param termId term Id
    modifier onlyTermOwner(uint termId) {
        LibTermOwnership._ensureTermOwner(termId);
        _;
    }

    /// @dev Insufficient balance for transfer. Needed `required` but only `available` available.
    /// @param available balance available.
    /// @param required requested amount to transfer.
    error InsufficientBalance(uint available, uint required);

    /// @notice starts a new cycle manually called by the owner. Only the first cycle starts automatically upon deploy
    /// @param termId the id of the term
    function startNewCycle(uint termId) external {
        LibFund._startNewCycle(termId);
    }

    /// @notice Must be called at the end of the contribution period after the time has passed by the owner
    /// @dev Revert if there is still time to contribute
    /// @dev Revert if Fund is not accepting contributions
    /// @param termId the id of the term
    function closeFundingPeriod(uint termId) external {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[termId];
        // Current cycle minus 1 because we use the previous cycle time as start point then  add contribution period
        require(
            block.timestamp >
                term.cycleTime * (fund.currentCycle - 1) + fund.fundStart + term.contributionPeriod,
            "TT-FF-01"
        );
        require(fund.currentState == LibFundStorage.FundStates.AcceptingContributions, "TT-FF-02");

        address currentBeneficiary = IGetters(address(this)).getCurrentBeneficiary(termId);

        // We attempt to make the autopayers pay their contribution right away
        LibFund._autoPay(termId);

        // Only then award the beneficiary
        LibFund._setState(termId, LibFundStorage.FundStates.AwardingBeneficiary);

        // We must check who hasn't paid and default them, check all participants based on beneficiariesOrder
        address[] memory participants = fund.beneficiariesOrder;

        uint participantsLength = participants.length;
        uint currentCycle = fund.currentCycle;
        for (uint i; i < participantsLength; ) {
            address p = participants[i];

            // The current beneficiary or someone who is exempt doesn't pay neither gets defaulted
            if (p == currentBeneficiary || fund.isExemptedOnCycle[currentCycle].exempted[p]) {
                if (EnumerableSet.contains(fund._defaulters, p)) {
                    EnumerableSet.remove(fund._defaulters, p);
                    if (p == currentBeneficiary) {
                        EnumerableSet.add(fund._beneficiaries, p);
                    } else {
                        EnumerableSet.add(fund._participants, p);
                    }
                }

                /// @custom:unchecked-block without risks, i can't be higher than beneficiariesOrder length
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
            } else if (
                !EnumerableSet.contains(fund._defaulters, p) &&
                !IGetters(address(this)).wasExpelled(termId, p)
            ) {
                // And we make sure that existing defaulters are ignored
                // If the current beneficiary is an expelled participant, only check previous beneficiaries,
                // that have not been expelled
                if (IGetters(address(this)).wasExpelled(termId, currentBeneficiary)) {
                    if (fund.isBeneficiary[p]) {
                        _defaultParticipant(termId, p);
                    }
                } else {
                    _defaultParticipant(termId, p);
                }
            }

            /// @custom:unchecked-block without risks, i can't be higher than beneficiariesOrder length
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

    /// @notice allow the owner to empty the fund if there's any excess fund left after 180 days,
    ///         this with the assumption that beneficiaries can't claim it themselves due to losing their keys for example,
    ///         and prevent the fund to be stuck in limbo
    /// @dev Revert if the caller is not the term owner
    /// @dev Revert if the time is not met (180 days)
    /// @param termId the id of the term
    function emptyFundAfterEnd(uint termId) external onlyTermOwner(termId) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        require(
            fund.currentState == LibFundStorage.FundStates.FundClosed &&
                block.timestamp > fund.fundEnd + 180 days,
            "TT-FF-03"
        );

        uint balance;
        uint beneficiariesLength = fund.beneficiariesOrder.length;

        for (uint i; i < beneficiariesLength; ) {
            if (fund.beneficiariesPool[fund.beneficiariesOrder[i]] > 0) {
                balance += fund.beneficiariesPool[fund.beneficiariesOrder[i]];
                fund.beneficiariesPool[fund.beneficiariesOrder[i]] = 0;
            }

            /// @custom:unchecked-block without risks, i can't be higher than beneficiariesOrder length
            unchecked {
                ++i;
            }
        }

        if (balance > 0) {
            bool success = fund.stableToken.transfer(msg.sender, balance);
            require(success, "TT-FF-04");
        }
    }

    /// @notice function to enable/disable autopay
    /// @dev Revert if the user is not a collateral member
    /// @dev Revert if the Fund is closed
    /// @dev It needs the user to have enough tokens and allow the contract as spender
    /// @dev Can be set before the Fund starts
    /// @param termId the id of the term
    function toggleAutoPay(uint termId) external {
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        require(collateral.isCollateralMember[msg.sender], "TT-FF-05");
        require(fund.currentState != LibFundStorage.FundStates.FundClosed, "TT-FF-02");
        bool enabled = !fund.autoPayEnabled[msg.sender];
        fund.autoPayEnabled[msg.sender] = enabled;

        emit OnAutoPayToggled(termId, msg.sender, enabled);
    }

    /// @notice This is the function participants call to pay the contribution
    /// @param termId the id of the term
    function payContribution(uint termId) external {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];

        bool payNextCycle = _payContributionsChecks(fund, termId, msg.sender);

        _payContribution(termId, msg.sender, msg.sender, payNextCycle);
    }

    /// @notice This function is here to give the possibility to pay using a different wallet
    /// @param termId the id of the term
    /// @param participant the address the msg.sender is paying for, the address must be part of the fund
    function payContributionOnBehalfOf(uint termId, address participant) external {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];

        bool payNextCycle = _payContributionsChecks(fund, termId, participant);

        _payContribution(termId, msg.sender, participant, payNextCycle);
    }

    /// @notice Called by the beneficiary to withdraw the fund
    /// @dev This follows the pull-over-push pattern.
    /// @param termId the id of the term
    function withdrawFund(uint termId) external {
        _withdrawFund(termId, msg.sender);
    }

    /// @notice Called by the beneficiary to withdraw the fund
    /// @dev This follows the pull-over-push pattern.
    /// @param termId the id of the term
    /// @param receiver the address that will receive the fund
    function withdrawFundOnAnotherWallet(uint termId, address receiver) external {
        _withdrawFund(termId, receiver);
    }

    /// @notice Default the participant/beneficiary by checking the mapping first, then remove them from the appropriate array
    /// @param _termId The id of the term
    /// @param _defaulter The participant to default
    function _defaultParticipant(uint _termId, address _defaulter) internal {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[_termId];
        // Try removing from participants first
        bool success = EnumerableSet.remove(fund._participants, _defaulter);

        // If that fails, we try removing from beneficiaries
        if (!success) {
            success = EnumerableSet.remove(fund._beneficiaries, _defaulter);
        }

        require(success, "TT-FF-06");
        EnumerableSet.add(fund._defaulters, _defaulter);

        emit OnParticipantDefaulted(_termId, fund.currentCycle, _defaulter);
    }

    /// @notice The beneficiary will be awarded here based on the beneficiariesOrder array.
    /// @notice It will loop through the array and choose the first in line to be eligible to be beneficiary.
    /// @param _fund Fund object
    /// @param _term Term object
    function _awardBeneficiary(
        LibFundStorage.Fund storage _fund,
        LibTermStorage.Term storage _term
    ) internal {
        address beneficiary = IGetters(address(this)).getCurrentBeneficiary(_term.termId);

        // Request contribution from the collateral for those who have to pay this cycle and haven't paid
        if (EnumerableSet.length(_fund._defaulters) > 0) {
            address[] memory expellants = ICollateral(address(this)).requestContribution(
                _term,
                EnumerableSet.values(_fund._defaulters)
            );

            uint expellantsLength = expellants.length;
            for (uint i; i < expellantsLength; ) {
                if (expellants[i] == address(0) || expellants[i] == beneficiary) {
                    /// @custom:unchecked-block without risks, i can't be higher than expellants length
                    unchecked {
                        ++i;
                    }
                    continue;
                }
                _expelDefaulter(_fund, _term, expellants[i]);

                /// @custom:unchecked-block without risks, i can't be higher than expellants length
                unchecked {
                    ++i;
                }
            }
        }

        // Remove participant from participants set..
        if (EnumerableSet.remove(_fund._participants, beneficiary)) {
            // ..Then add them to the benificiaries set
            EnumerableSet.add(_fund._beneficiaries, beneficiary);
        }

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

            /// @custom:unchecked-block without risks, i can't be higher than beneficiariesOrder length
            unchecked {
                ++i;
            }
        }

        // Award the beneficiary with the pool or freeze the pot
        _freezePot(_term, _fund, beneficiary);

        _fund.beneficiariesPool[beneficiary] += _term.contributionAmount * paidCount * 10 ** 6; // Six decimals

        emit OnBeneficiaryAwarded(_term.termId, beneficiary);
        LibFund._setState(_term.termId, LibFundStorage.FundStates.CycleOngoing);
    }

    /// @notice Internal function for close fund which is used by _startNewCycle & _chooseBeneficiary to cover some edge-cases
    /// @param _termId The id of the term
    function _closeFund(uint _termId) internal {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[_termId];
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[_termId];
        fund.fundEnd = block.timestamp;
        term.state = LibTermStorage.TermStates.ClosedTerm;
        LibFund._setState(_termId, LibFundStorage.FundStates.FundClosed);
        ICollateral(address(this)).releaseCollateral(_termId);
    }

    /// @notice function to pay the actual contribution for the cycle
    /// @param _termId the id of the term
    /// @param _payer the address that's paying
    /// @param _participant the (participant) address that's being paid for
    /// @param _payNextCycle whether to pay for the next cycle or not
    function _payContribution(
        uint _termId,
        address _payer,
        address _participant,
        bool _payNextCycle
    ) internal {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[_termId];
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[_termId];

        // Get the amount and do the actual transfer
        // This will only succeed if the sender approved this contract address beforehand
        uint amount = term.contributionAmount * 10 ** 6; // Deducted from user's wallet, six decimals

        bool success = fund.stableToken.transferFrom(_payer, address(this), amount);
        require(success, "TT-FF-07");

        // Finish up, set that the participant paid for this cycle and emit an event that it's been done
        if (!_payNextCycle) {
            fund.paidThisCycle[_participant] = true;
            emit OnPaidContribution(_termId, _participant, fund.currentCycle);
        } else {
            fund.paidNextCycle[_participant] = true;
            emit OnPaidContribution(_termId, _participant, fund.currentCycle + 1);
        }
    }

    /// @param _termId term Id
    /// @param _receiver address that will receive the money pot
    /// @dev Revert if Fund is closed
    /// @dev Revert if the user have not been a beneficiary
    /// @dev Revert if the user is not a participant
    /// @dev Revert if there is nothing to withdraw
    /// @dev Revert if the money pot is frozen
    function _withdrawFund(uint _termId, address _receiver) internal {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[_termId];
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[_termId];
        // To withdraw the fund, the fund must be closed or the participant must be a beneficiary on
        // any of the past cycles.

        bool expelledBeforeBeneficiary = fund.expelledBeforeBeneficiary[msg.sender];

        require(
            fund.currentState == LibFundStorage.FundStates.FundClosed ||
                fund.isBeneficiary[msg.sender] ||
                expelledBeforeBeneficiary,
            "TT-FF-08"
        );

        bool hasFundPool = fund.beneficiariesPool[msg.sender] > 0;
        bool hasFrozenPool = fund.beneficiariesFrozenPool[msg.sender];
        bool hasCollateralPool = collateral.collateralPaymentBank[msg.sender] > 0;

        require(hasFundPool || hasFrozenPool || hasCollateralPool, "TT-FF-09");

        if (hasFrozenPool) {
            bool freeze = _freezePot(
                LibTermStorage._termStorage().terms[_termId],
                fund,
                msg.sender
            );

            if (fund.currentState != LibFundStorage.FundStates.FundClosed) {
                require(!freeze, "TT-FF-10");
            }

            _transferPoolToBeneficiary(_termId, msg.sender, _receiver);
        } else if (hasFundPool) {
            _transferPoolToBeneficiary(_termId, msg.sender, _receiver);
        }

        if (hasCollateralPool) {
            LibCollateral._withdrawReimbursement(_termId, msg.sender, _receiver);
        }
    }

    /// @notice called internally to expel a participant. It should not be possible to expel non-defaulters, so those arrays are not checked.
    /// @param _fund Fund object
    /// @param _term Term object
    /// @param _expellant The address of the defaulter that will be expelled
    function _expelDefaulter(
        LibFundStorage.Fund storage _fund,
        LibTermStorage.Term storage _term,
        address _expellant
    ) internal {
        // Expellants should only be in the defauters set so no need to touch the other sets
        require(
            _fund.isParticipant[_expellant] && EnumerableSet.remove(_fund._defaulters, _expellant),
            "TT-FF-11"
        );

        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[_term.termId];

        _fund.isParticipant[_expellant] = false;
        collateral.isCollateralMember[_expellant] = false;
        // If the expellant has not been a beneficiary before, mark them as expelledBeforeBeneficiary
        if (!_fund.isBeneficiary[_expellant]) {
            _fund.expelledBeforeBeneficiary[_expellant] = true;
        }

        // Lastly, lower the amount of participants
        --_term.totalParticipants;
        ++_fund.expelledParticipants;

        emit OnDefaulterExpelled(_term.termId, _fund.currentCycle, _expellant);
    }

    /// @notice Internal function to transfer the pool to the beneficiary
    /// @dev Revert if the contract does not have enough funds
    /// @param _termId The id of the term
    /// @param _participant address
    /// @param _receiver address
    function _transferPoolToBeneficiary(
        uint _termId,
        address _participant,
        address _receiver
    ) internal {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[_termId];

        // Get the amount this beneficiary can withdraw
        uint transferAmount = fund.beneficiariesPool[_participant];
        uint contractBalance = fund.stableToken.balanceOf(address(this));
        if (contractBalance < transferAmount) {
            revert InsufficientBalance({available: contractBalance, required: transferAmount});
        } else {
            fund.beneficiariesPool[_participant] = 0;
            bool success = fund.stableToken.transfer(_receiver, transferAmount);
            require(success, "TT-FF-04");
        }
        emit OnFundWithdrawn(_termId, _participant, _receiver, transferAmount);
    }

    /// @notice Internal function to freeze the pot for the beneficiary
    /// @dev Users remaining collateral must be at least 1.1 times remaining cycles contributions
    /// @param _term Term object
    /// @param _fund Fund object
    /// @param _user address
    function _freezePot(
        LibTermStorage.Term memory _term,
        LibFundStorage.Fund storage _fund,
        address _user
    ) internal returns (bool) {
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[_term.termId];

        bool expelledBeforeBeneficiary = _fund.expelledBeforeBeneficiary[_user];

        if (expelledBeforeBeneficiary) {
            _fund.beneficiariesFrozenPool[_user] = false;
        } else {
            uint remainingCyclesContribution = IGetters(address(this))
                .getRemainingCyclesContributionWei(_term.termId);

            uint neededCollateral = (110 * remainingCyclesContribution) / 100; // 1.1 x RCC

            if (collateral.collateralMembersBank[_user] < neededCollateral) {
                _fund.beneficiariesFrozenPool[_user] = true;
            } else {
                _fund.beneficiariesFrozenPool[_user] = false;
            }
        }
        return _fund.beneficiariesFrozenPool[_user];
    }

    /// @param _fund Fund object
    /// @param _termId term Id
    /// @param _participant address
    /// @dev Revert if the fund is Closed or initializing
    /// @dev Revert if the caller is not a participant, is exempted, is the beneficiary or has already paid
    function _payContributionsChecks(
        LibFundStorage.Fund storage _fund,
        uint _termId,
        address _participant
    ) internal view returns (bool _payNextCycle) {
        require(
            _fund.currentState == LibFundStorage.FundStates.AcceptingContributions ||
                _fund.currentState == LibFundStorage.FundStates.CycleOngoing,
            "TT-FF-02"
        );
        require(_fund.isParticipant[_participant], "TT-FF-12");

        address _beneficiary;
        uint _cycle;

        if (_fund.currentState == LibFundStorage.FundStates.AcceptingContributions) {
            require(!_fund.paidThisCycle[_participant], "TT-FF-13");

            _cycle = _fund.currentCycle;
            _beneficiary = IGetters(address(this)).getCurrentBeneficiary(_termId);
            _payNextCycle = false;
        } else {
            require(!_fund.paidNextCycle[_participant], "TT-FF-13");

            _cycle = _fund.currentCycle + 1;
            _beneficiary = IGetters(address(this)).getNextBeneficiary(_termId);
            _payNextCycle = true;
        }

        require(_beneficiary != _participant, "TT-FF-14");
        require(!_fund.isExemptedOnCycle[_cycle].exempted[_participant], "TT-FF-15");
    }
}
