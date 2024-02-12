// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {ICollateral} from "../interfaces/ICollateral.sol";
import {IGetters} from "../interfaces/IGetters.sol";
import {IYGFacetZaynFi} from "../interfaces/IYGFacetZaynFi.sol";

import {LibFundStorage} from "../libraries/LibFundStorage.sol";
import {LibTermStorage} from "../libraries/LibTermStorage.sol";
import {LibCollateral} from "../libraries/LibCollateral.sol";
import {LibCollateralStorage} from "../libraries/LibCollateralStorage.sol";
import {LibYieldGeneration} from "../libraries/LibYieldGeneration.sol";
import {LibYieldGenerationStorage} from "../libraries/LibYieldGenerationStorage.sol";
import {LibTermOwnership} from "../libraries/LibTermOwnership.sol";

/// @title Takaturn Collateral
/// @author Aisha El Allam
/// @notice This is used to operate the Takaturn collateral
/// @dev v3.0 (Diamond)
contract CollateralFacet is ICollateral {
    event OnCollateralStateChanged(
        uint indexed termId,
        LibCollateralStorage.CollateralStates indexed oldState,
        LibCollateralStorage.CollateralStates indexed newState
    );
    event OnCollateralWithdrawal(
        uint indexed termId,
        address indexed user,
        address receiver,
        uint indexed collateralAmount
    );
    event OnReimbursementWithdrawn(
        uint indexed termId,
        address indexed participant,
        address receiver,
        uint indexed amount
    );
    event OnCollateralLiquidated(uint indexed termId, address indexed user, uint indexed amount);
    event OnFrozenMoneyPotLiquidated(
        uint indexed termId,
        address indexed user,
        uint indexed amount
    );
    event OnYieldClaimed(
        uint indexed termId,
        address indexed user,
        address receiver,
        uint indexed amount
    ); // Emits when a user claims their yield

    /// @param termId term id
    /// @param _state collateral state
    modifier atState(uint termId, LibCollateralStorage.CollateralStates _state) {
        _atState(termId, _state);
        _;
    }

    modifier onlyTermOwner(uint termId) {
        LibTermOwnership._ensureTermOwner(termId);
        _;
    }

    /// @notice Called from Fund contract when someone defaults
    /// @dev Check EnumerableMap (openzeppelin) for arrays that are being accessed from Fund contract
    /// @param defaulters Addressess of all defaulters of the current cycle
    /// @return expellants array of addresses that were expelled
    function requestContribution(
        LibTermStorage.Term memory term,
        address[] calldata defaulters
    )
        external
        atState(term.termId, LibCollateralStorage.CollateralStates.CycleOngoing)
        returns (address[] memory)
    {
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[term.termId];
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[term.termId];
        require(msg.sender == address(this));

        (uint collateralToDistribute, address[] memory expellants) = _solveDefaulters(
            collateral,
            term,
            fund,
            defaulters
        );

        (uint nonBeneficiaryCounter, address[] memory nonBeneficiaries) = _findNonBeneficiaries(
            collateral,
            fund
        );

        if (nonBeneficiaryCounter > 0) {
            // This case can only happen when what?
            // Exempt non beneficiaries from paying an early expellant's cycle
            uint expellantsLength = expellants.length;
            for (uint i; i < expellantsLength; ) {
                _exemptNonBeneficiariesFromPaying(
                    fund,
                    expellants[i],
                    nonBeneficiaryCounter,
                    nonBeneficiaries
                );

                unchecked {
                    ++i;
                }
            }

            // Finally, divide the share equally among non-beneficiaries
            collateralToDistribute = collateralToDistribute / nonBeneficiaryCounter;
            for (uint i; i < nonBeneficiaryCounter; ) {
                collateral.collateralPaymentBank[nonBeneficiaries[i]] += collateralToDistribute;

                unchecked {
                    ++i;
                }
            }
        }
        return (expellants);
    }

    /// @notice Called to exempt users from needing to pay
    /// @param _fund Fund storage
    /// @param _expellant The expellant in question
    /// @param _nonBeneficiaries All non-beneficiaries at this time
    function _exemptNonBeneficiariesFromPaying(
        LibFundStorage.Fund storage _fund,
        address _expellant,
        uint _nonBeneficiaryCounter,
        address[] memory _nonBeneficiaries
    ) internal {
        if (!_fund.isBeneficiary[_expellant]) {
            uint expellantBeneficiaryCycle;

            uint beneficiariesLength = _fund.beneficiariesOrder.length;
            for (uint i; i < beneficiariesLength; ) {
                if (_expellant == _fund.beneficiariesOrder[i]) {
                    expellantBeneficiaryCycle = i + 1;
                    break;
                }
                unchecked {
                    ++i;
                }
            }

            for (uint i; i < _nonBeneficiaryCounter; ) {
                _fund.isExemptedOnCycle[expellantBeneficiaryCycle].exempted[
                    _nonBeneficiaries[i]
                ] = true;
                unchecked {
                    ++i;
                }
            }
        }
    }

    /// @notice Called by each member after during or at the end of the term to withraw collateral
    /// @dev This follows the pull-over-push pattern.
    /// @param termId term id
    function withdrawCollateral(uint termId) external {
        _withdrawCollateral(termId, msg.sender);
    }

    /// @notice Called by each member after during or at the end of the term to withraw collateral
    /// @dev This follows the pull-over-push pattern.
    /// @param termId term id
    /// @param receiver receiver address
    function withdrawCollateralToAnotherAddress(uint termId, address receiver) external {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];

        address[] memory participants = fund.beneficiariesOrder;
        uint participantsLength = participants.length;
        bool canCall;

        for (uint i; i < participantsLength; ) {
            if (participants[i] == msg.sender) {
                canCall = true;
                break;
            }

            unchecked {
                ++i;
            }
        }

        require(canCall, "The caller must be a participant");

        _withdrawCollateral(termId, receiver);
    }

    /// @param termId term id
    function releaseCollateral(uint termId) external {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        require(fund.currentState == LibFundStorage.FundStates.FundClosed, "Wrong state");
        LibCollateral._setState(termId, LibCollateralStorage.CollateralStates.ReleasingCollateral);
    }

    /// @notice allow the owner to empty the Collateral after 180 days
    /// @param termId The term id
    function emptyCollateralAfterEnd(
        uint termId
    )
        external
        onlyTermOwner(termId)
        atState(termId, LibCollateralStorage.CollateralStates.ReleasingCollateral)
    {
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];

        (, , , , , uint fundEnd, , ) = IGetters(address(this)).getFundSummary(termId);
        require(block.timestamp > fundEnd + 180 days, "Can't empty yet");

        uint totalToWithdraw;
        uint depositorsLength = collateral.depositors.length;
        for (uint i; i < depositorsLength; ) {
            address depositor = collateral.depositors[i];
            uint amount = collateral.collateralMembersBank[depositor];
            uint paymentAmount = collateral.collateralPaymentBank[depositor];

            collateral.collateralMembersBank[depositor] = 0;
            collateral.collateralPaymentBank[depositor] = 0;
            uint withdrawnYield = _withdrawFromYield(termId, depositor, amount, yield);

            totalToWithdraw += (amount + paymentAmount + withdrawnYield);

            unchecked {
                ++i;
            }
        }
        LibCollateral._setState(termId, LibCollateralStorage.CollateralStates.Closed);

        (bool success, ) = payable(msg.sender).call{value: totalToWithdraw}("");
        require(success);
    }

    /// @notice Called by each member after during or at the end of the term to withraw collateral
    /// @dev This follows the pull-over-push pattern.
    /// @param _termId term id
    /// @param _receiver receiver address
    function _withdrawCollateral(uint _termId, address _receiver) internal {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[_termId];

        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[_termId];

        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[_termId];

        LibTermStorage.Term memory term = LibTermStorage._termStorage().terms[_termId];

        uint allowedWithdrawal = IGetters(address(this)).getWithdrawableUserBalance(
            _termId,
            msg.sender
        );
        require(allowedWithdrawal > 0, "Nothing to withdraw");

        bool success;
        bool expelledBeforeBeneficiary = fund.expelledBeforeBeneficiary[msg.sender];
        // Withdraw all the user has.
        if (
            collateral.state == LibCollateralStorage.CollateralStates.ReleasingCollateral ||
            expelledBeforeBeneficiary
        ) {
            // First case: The collateral is released or the user was expelled before being a beneficiary
            collateral.collateralMembersBank[msg.sender] = 0;

            if (term.state != LibTermStorage.TermStates.ExpiredTerm) {
                _withdrawFromYield(_termId, msg.sender, allowedWithdrawal, yield);
            }

            (success, ) = payable(_receiver).call{value: allowedWithdrawal}("");

            if (collateral.state == LibCollateralStorage.CollateralStates.ReleasingCollateral) {
                --collateral.counterMembers;
            }

            emit OnCollateralWithdrawal(_termId, msg.sender, _receiver, allowedWithdrawal);
        }
        // Or withdraw partially
        else if (collateral.state == LibCollateralStorage.CollateralStates.CycleOngoing) {
            // Second case: The term is on an ongoing cycle, the user has not been expelled
            // Everything above 1.5 X remaining cycles contribution (RCC) can be withdrawn
            collateral.collateralMembersBank[msg.sender] -= allowedWithdrawal;

            _withdrawFromYield(_termId, msg.sender, allowedWithdrawal, yield);

            (success, ) = payable(_receiver).call{value: allowedWithdrawal}("");

            emit OnCollateralWithdrawal(_termId, msg.sender, _receiver, allowedWithdrawal);
        }

        require(success, "Withdraw failed");
        if (yield.hasOptedIn[msg.sender] && yield.availableYield[msg.sender] > 0) {
            LibYieldGeneration._claimAvailableYield(_termId, msg.sender, _receiver);
        }
    }

    /// @param _collateral Collateral storage
    /// @param _term Term storage
    /// @param _defaulters Defaulters array
    /// @return share The total amount of collateral to be divided among non-beneficiaries
    /// @return expellants array of addresses that were expelled
    function _solveDefaulters(
        LibCollateralStorage.Collateral storage _collateral,
        LibTermStorage.Term memory _term,
        LibFundStorage.Fund storage _fund,
        address[] memory _defaulters
    ) internal returns (uint, address[] memory) {
        // require(_defaulters.length > 0, "No defaulters");

        address[] memory expellants = new address[](_defaulters.length);
        uint expellantsCounter;
        uint distributedCollateral;

        uint contributionAmountWei = IGetters(address(this)).getToCollateralConversionRate(
            _term.contributionAmount * 10 ** 18
        );

        // Determine who will be expelled and who will just pay the contribution from their collateral.
        for (uint i; i < _defaulters.length; ) {
            LibCollateralStorage.DefaulterState memory defaulterState;
            defaulterState.isBeneficiary = _fund.isBeneficiary[_defaulters[i]];
            uint collateralAmount = _collateral.collateralMembersBank[_defaulters[i]];
            if (defaulterState.isBeneficiary) {
                // Has the user been beneficiary?
                if (LibCollateral._isUnderCollaterized(_term.termId, _defaulters[i])) {
                    // Is the collateral below 1.0 X RCC?
                    if (_fund.beneficiariesFrozenPool[_defaulters[i]]) {
                        // Is the pool currently frozen?
                        if (collateralAmount >= contributionAmountWei) {
                            // Does the user's collateral cover a cycle?
                            defaulterState.payWithCollateral = true; // Pay with collateral
                            defaulterState.payWithFrozenPool = false; // Does not pay with frozen pool
                            defaulterState.gettingExpelled = false; // Not expelled
                        } else {
                            // We don't have to check exact amounts because the pool would always be deducted by consistent amounts
                            if (_fund.beneficiariesPool[_defaulters[i]] > 0) {
                                // Does the frozen stable token portion of the pool contain anything?
                                defaulterState.payWithCollateral = false; // Do not pay with collateral
                                defaulterState.payWithFrozenPool = true; // Pay with frozen pool
                                defaulterState.gettingExpelled = false; // Not expelled
                            } else {
                                // Is whatever is left from the collateral + received collateral portion of money pool below 1.0 X RCC?
                                if (
                                    collateralAmount +
                                        _collateral.collateralPaymentBank[_defaulters[i]] >=
                                    IGetters(address(this)).getRemainingCyclesContributionWei(
                                        _term.termId
                                    )
                                ) {
                                    defaulterState.payWithCollateral = true; // Pay with collateral
                                    defaulterState.payWithFrozenPool = true; // Pay with frozen pool
                                    defaulterState.gettingExpelled = false; // Not expelled
                                } else {
                                    defaulterState.payWithCollateral = true; // Pay with collateral
                                    defaulterState.payWithFrozenPool = true; // Pay with frozen pool
                                    defaulterState.gettingExpelled = true; // Expelled
                                }
                            }
                        }
                    } else {
                        defaulterState.payWithCollateral = true; // Pay with collateral
                        defaulterState.payWithFrozenPool = false; // Does not pay with frozen pool
                        defaulterState.gettingExpelled = true; // Expelled
                    }
                } else {
                    defaulterState.payWithCollateral = true; // Pay with collateral
                    defaulterState.payWithFrozenPool = false; // Does not pay with frozen pool
                    defaulterState.gettingExpelled = false; // Not expelled
                }
            } else {
                if (collateralAmount >= contributionAmountWei) {
                    defaulterState.payWithCollateral = true; // Pay with collateral
                    defaulterState.payWithFrozenPool = false; // Does not pay with frozen pool
                    defaulterState.gettingExpelled = false; // Not expelled
                } else {
                    defaulterState.payWithCollateral = false; // Pay with collateral
                    defaulterState.payWithFrozenPool = false; // Does not pay with frozen pool
                    defaulterState.gettingExpelled = true; // Expelled
                }
            }

            distributedCollateral += _payDefaulterContribution(
                _collateral,
                _fund,
                _term,
                _defaulters[i],
                contributionAmountWei,
                defaulterState
            );

            if (defaulterState.gettingExpelled) {
                expellants[expellantsCounter] = _defaulters[i];
                _fund.cycleOfExpulsion[expellants[expellantsCounter]] = _fund.currentCycle;

                unchecked {
                    ++expellantsCounter;
                }
            }

            unchecked {
                ++i;
            }
        }

        return (distributedCollateral, expellants);
    }

    /// @notice called internally to pay defaulter contribution
    function _payDefaulterContribution(
        LibCollateralStorage.Collateral storage _collateral,
        LibFundStorage.Fund storage _fund,
        LibTermStorage.Term memory _term,
        address _defaulter,
        uint _contributionAmountWei,
        LibCollateralStorage.DefaulterState memory _defaulterState
    ) internal returns (uint distributedCollateral) {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[_term.termId];

        address beneficiary = IGetters(address(this)).getCurrentBeneficiary(_term.termId);
        if (_defaulterState.payWithCollateral && !_defaulterState.payWithFrozenPool) {
            if (_defaulterState.gettingExpelled) {
                if (_defaulterState.isBeneficiary) {
                    uint remainingCollateral = _collateral.collateralMembersBank[_defaulter];
                    _withdrawFromYield(_term.termId, _defaulter, remainingCollateral, yield);

                    distributedCollateral += remainingCollateral; // This will be distributed later
                    _collateral.collateralMembersBank[_defaulter] = 0;
                    emit OnCollateralLiquidated(_term.termId, _defaulter, remainingCollateral);
                }

                // Expelled
                _collateral.isCollateralMember[_defaulter] = false;
            } else {
                _withdrawFromYield(_term.termId, _defaulter, _contributionAmountWei, yield);

                // Subtract contribution from defaulter and add to beneficiary.
                _collateral.collateralMembersBank[_defaulter] -= _contributionAmountWei;
                _collateral.collateralPaymentBank[beneficiary] += _contributionAmountWei;

                emit OnCollateralLiquidated(_term.termId, _defaulter, _contributionAmountWei);
            }
        }
        if (_defaulterState.payWithFrozenPool && !_defaulterState.payWithCollateral) {
            _fund.beneficiariesPool[_defaulter] -= _term.contributionAmount * 10 ** 6;
            _fund.beneficiariesPool[beneficiary] += _term.contributionAmount * 10 ** 6;

            emit OnFrozenMoneyPotLiquidated(_term.termId, _defaulter, _term.contributionAmount);
        }
        if (_defaulterState.payWithCollateral && _defaulterState.payWithFrozenPool) {
            uint remainingCollateral = _collateral.collateralMembersBank[_defaulter];
            uint remainingCollateralFromPayments = _collateral.collateralPaymentBank[_defaulter];
            uint contributionAmountWei = IGetters(address(this)).getToCollateralConversionRate(
                _term.contributionAmount * 10 ** 18
            );

            if (remainingCollateral > 0) {
                _withdrawFromYield(_term.termId, _defaulter, remainingCollateral, yield);

                emit OnCollateralLiquidated(_term.termId, _defaulter, remainingCollateral);
            }
            if (_defaulterState.gettingExpelled) {
                distributedCollateral += (remainingCollateral + remainingCollateralFromPayments);
                _collateral.collateralMembersBank[_defaulter] = 0;
                _collateral.collateralPaymentBank[_defaulter] = 0;
                emit OnFrozenMoneyPotLiquidated(
                    _term.termId,
                    _defaulter,
                    remainingCollateralFromPayments
                );
            } else {
                // Remaining collateral is always less than contribution amount if/when we reach this
                if (remainingCollateral > 0) {
                    // Remove any last remaining collateral
                    uint toDeductFromPayments = contributionAmountWei - remainingCollateral;
                    _collateral.collateralMembersBank[_defaulter] = 0;
                    _collateral.collateralPaymentBank[_defaulter] -= toDeductFromPayments;
                    emit OnFrozenMoneyPotLiquidated(
                        _term.termId,
                        _defaulter,
                        remainingCollateralFromPayments
                    );
                } else {
                    _collateral.collateralPaymentBank[_defaulter] -= contributionAmountWei;
                    emit OnFrozenMoneyPotLiquidated(
                        _term.termId,
                        _defaulter,
                        contributionAmountWei
                    );
                }

                _collateral.collateralPaymentBank[beneficiary] += _contributionAmountWei;
            }
        }
    }

    /// @param _collateral Collateral storage
    /// @param _fund Fund storage
    /// @return nonBeneficiaryCounter The total amount of collateral to be divided among non-beneficiaries
    /// @return nonBeneficiaries array of addresses that were expelled
    function _findNonBeneficiaries(
        LibCollateralStorage.Collateral storage _collateral,
        LibFundStorage.Fund storage _fund
    ) internal view returns (uint, address[] memory) {
        address currentDepositor;
        address[] memory nonBeneficiaries = new address[](_collateral.depositors.length);
        uint nonBeneficiaryCounter;

        // Check beneficiaries
        uint depositorsLength = _collateral.depositors.length;
        for (uint i; i < depositorsLength; ) {
            currentDepositor = _collateral.depositors[i];
            if (
                !_fund.isBeneficiary[currentDepositor] &&
                _collateral.isCollateralMember[currentDepositor]
            ) {
                nonBeneficiaries[nonBeneficiaryCounter] = currentDepositor;
                nonBeneficiaryCounter++;
            }
            unchecked {
                ++i;
            }
        }

        return (nonBeneficiaryCounter, nonBeneficiaries);
    }

    function _withdrawFromYield(
        uint _termId,
        address _user,
        uint _amount,
        LibYieldGenerationStorage.YieldGeneration storage _yieldStorage
    ) internal returns (uint withdrawnYield) {
        if (_yieldStorage.hasOptedIn[_user]) {
            uint amountToWithdraw;
            if (_amount > _yieldStorage.depositedCollateralByUser[_user]) {
                amountToWithdraw = _yieldStorage.depositedCollateralByUser[_user];
            } else {
                amountToWithdraw = _amount;
            }
            withdrawnYield = LibYieldGeneration._withdrawYG(_termId, amountToWithdraw, _user);
        } else {
            withdrawnYield = 0;
        }
    }

    function _atState(uint _termId, LibCollateralStorage.CollateralStates _state) internal view {
        LibCollateralStorage.CollateralStates state = LibCollateralStorage
            ._collateralStorage()
            .collaterals[_termId]
            .state;
        if (state != _state) revert FunctionInvalidAtThisState();
    }
}
