// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IFundV2} from "../interfaces/IFundV2.sol";
import {ICollateralV2} from "../interfaces/ICollateralV2.sol";
import {IGettersV2} from "../interfaces/IGettersV2.sol";
import {IYGFacetZaynFi} from "../interfaces/IYGFacetZaynFi.sol";

import {LibFundV2} from "../libraries/LibFundV2.sol";
import {LibTermV2} from "../libraries/LibTermV2.sol";
import {LibCollateralV2} from "../libraries/LibCollateralV2.sol";
import {LibYieldGeneration} from "../libraries/LibYieldGeneration.sol";

import {TermOwnable} from "../../version-1/access/TermOwnable.sol";

/// @title Takaturn Collateral
/// @author Aisha El Allam
/// @notice This is used to operate the Takaturn collateral
/// @dev v3.0 (Diamond)
contract CollateralFacetV2 is ICollateralV2, TermOwnable {
    event OnCollateralStateChanged(
        uint indexed termId,
        LibCollateralV2.CollateralStates indexed oldState,
        LibCollateralV2.CollateralStates indexed newState
    );
    event OnCollateralWithdrawal(uint indexed termId, address indexed user, uint indexed amount);
    event OnCollateralLiquidated(uint indexed termId, address indexed user, uint indexed amount);
    event OnFrozenMoneyPotLiquidated(
        uint indexed termId,
        address indexed user,
        uint indexed amount
    );

    /// @param id term id
    /// @param _state collateral state
    modifier atState(uint id, LibCollateralV2.CollateralStates _state) {
        LibCollateralV2.CollateralStates state = LibCollateralV2
            ._collateralStorage()
            .collaterals[id]
            .state;
        if (state != _state) revert FunctionInvalidAtThisState();
        _;
    }

    /// @param id term id
    /// @param newState collateral state
    function setStateOwner(uint id, LibCollateralV2.CollateralStates newState) external {
        _setState(id, newState);
    }

    /// @notice Called from Fund contract when someone defaults
    /// @dev Check EnumerableMap (openzeppelin) for arrays that are being accessed from Fund contract
    /// @param defaulters Address that was randomly selected for the current cycle
    /// @return expellants array of addresses that were expelled
    function requestContribution(
        LibTermV2.Term memory term,
        address[] calldata defaulters
    )
        external
        atState(term.termId, LibCollateralV2.CollateralStates.CycleOngoing)
        returns (address[] memory)
    {
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[term.termId];
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[term.termId];

        (uint shareEth, uint shareUsdc, address[] memory expellants) = _whoExpelled(
            collateral,
            term,
            fund,
            defaulters
        );

        (uint nonBeneficiaryCounter, address[] memory nonBeneficiaries) = _liquidateCollateral(
            collateral,
            term
        );

        // Finally, divide the share equally among non-beneficiaries //todo: check if this is still needed
        if (nonBeneficiaryCounter > 0) {
            // This case can only happen when what?
            shareEth = shareEth / nonBeneficiaryCounter;
            shareUsdc = shareUsdc / nonBeneficiaryCounter;
            for (uint i; i < nonBeneficiaryCounter; ) {
                collateral.collateralPaymentBank[nonBeneficiaries[i]] += shareEth;
                fund.beneficiariesPool[nonBeneficiaries[i]] += shareUsdc;

                unchecked {
                    ++i;
                }
            }
        }
        return (expellants);
    }

    /// @notice Called by each member after the end of the cycle to withraw collateral
    /// @dev This follows the pull-over-push pattern.
    /// @param id term id
    function withdrawCollateral(
        uint id
    ) external atState(id, LibCollateralV2.CollateralStates.ReleasingCollateral) {
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[id];
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[id];
        LibTermV2.Term storage term = LibTermV2._termStorage().terms[id];
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[id];

        require(fund.paidThisCycle[msg.sender], "You have not paid this cycle");
        require(fund.currentState == LibFundV2.FundStates.CycleOngoing, "Wrong state");

        uint userSecurity = collateral.collateralDepositByUser[msg.sender]; // todo: or collateralMembersBank?

        uint remainingCycles = IGettersV2(address(this)).getRemainingCycles(id);
        uint remainingCyclesContribution = IGettersV2(address(this))
            .getRemainingCyclesContributionWei(id);
        uint contributionAmountWei = IGettersV2(address(this)).getToEthConversionRate(
            term.contributionAmount * 10 ** 18
        );

        uint allowedWithdraw = ((userSecurity - remainingCyclesContribution) / remainingCycles) +
            contributionAmountWei;

        if (allowedWithdraw <= collateral.collateralPaymentBank[msg.sender]) {
            _withdrawFromYield(id, msg.sender, allowedWithdraw, yield);

            collateral.collateralPaymentBank[msg.sender] -= allowedWithdraw;
            (bool success, ) = payable(msg.sender).call{value: allowedWithdraw}("");
            require(success);
        } else {
            uint neededAmount = allowedWithdraw - collateral.collateralPaymentBank[msg.sender];
            if (neededAmount <= collateral.collateralMembersBank[msg.sender]) {
                _withdrawFromYield(id, msg.sender, allowedWithdraw, yield);

                collateral.collateralPaymentBank[msg.sender] -= 0;
                collateral.collateralMembersBank[msg.sender] -= neededAmount;
                (bool success, ) = payable(msg.sender).call{value: allowedWithdraw}("");
                require(success);
            } else {
                // todo: check if this is still needed. Think now with partial withdraws this else can be removed
                uint amount = collateral.collateralMembersBank[msg.sender] +
                    collateral.collateralPaymentBank[msg.sender];
                _withdrawFromYield(id, msg.sender, amount, yield);

                collateral.collateralMembersBank[msg.sender] = 0;
                collateral.collateralPaymentBank[msg.sender] = 0;
                (bool success, ) = payable(msg.sender).call{value: amount}("");
                require(success);
                --collateral.counterMembers;
            }
        }
    }

    /// @param id term id
    /// @param depositor Address of the depositor
    function withdrawReimbursement(uint id, address depositor) external {
        require(LibFundV2._fundExists(id), "Fund does not exists");
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[id];
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[id];

        uint amount = collateral.collateralPaymentBank[depositor];
        require(amount > 0, "Nothing to claim");

        _withdrawFromYield(id, msg.sender, amount, yield);

        collateral.collateralPaymentBank[depositor] = 0;

        (bool success, ) = payable(depositor).call{value: amount}("");
        require(success);

        emit OnCollateralWithdrawal(id, depositor, amount);
    }

    /// @param id term id
    function releaseCollateral(uint id) external {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[id];
        require(fund.currentState == LibFundV2.FundStates.FundClosed, "Wrong state");
        _setState(id, LibCollateralV2.CollateralStates.ReleasingCollateral);
    }

    /// @notice Checks if a user has a collateral below 1.0x of total contribution amount
    /// @dev This will revert if called during ReleasingCollateral or after
    /// @param id The term id
    /// @param member The user to check for
    /// @return Bool check if member is below 1.0x of collateralDeposit
    function isUnderCollaterized(uint id, address member) external view returns (bool) {
        return _isUnderCollaterized(id, member);
    }

    /// @notice allow the owner to empty the Collateral after 180 days
    /// @param id The term id
    function emptyCollateralAfterEnd(
        uint id
    ) external onlyTermOwner(id) atState(id, LibCollateralV2.CollateralStates.ReleasingCollateral) {
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[id];
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[id];

        (, , , , , uint fundEnd, , , ) = IGettersV2(address(this)).getFundSummary(id);
        require(block.timestamp > fundEnd + 180 days, "Can't empty yet");

        uint depositorsLength = collateral.depositors.length;
        for (uint i; i < depositorsLength; ) {
            address depositor = collateral.depositors[i];
            uint amount = collateral.collateralMembersBank[depositor] +
                collateral.collateralPaymentBank[depositor];

            _withdrawFromYield(id, depositor, amount, yield);

            collateral.collateralMembersBank[depositor] = 0;
            collateral.collateralPaymentBank[depositor] = 0;
            unchecked {
                ++i;
            }
        }
        _setState(id, LibCollateralV2.CollateralStates.Closed);

        (bool success, ) = payable(msg.sender).call{value: address(this).balance}("");
        require(success);
    }

    /// @param _id term id
    /// @param _newState collateral state
    function _setState(uint _id, LibCollateralV2.CollateralStates _newState) internal {
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[_id];
        LibCollateralV2.CollateralStates oldState = collateral.state;
        collateral.state = _newState;
        emit OnCollateralStateChanged(_id, oldState, _newState);
    }

    /// @notice Checks if a user has a collateral below 1.0x of total contribution amount
    /// @dev This will revert if called during ReleasingCollateral or after
    /// @param _id The fund id
    /// @param _member The user to check for
    /// @return Bool check if member is below 1.0x of collateralDeposit
    function _isUnderCollaterized(uint _id, address _member) internal view returns (bool) {
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[_id];

        uint collateralLimit;
        uint memberCollateral = collateral.collateralMembersBank[_member];

        if (!LibFundV2._fundExists(_id)) {
            // Only check here when starting the term
            (, , , collateralLimit) = IGettersV2(address(this)).getDepositorCollateralSummary(
                _member,
                _id
            );
        } else {
            collateralLimit = IGettersV2(address(this)).getRemainingCyclesContributionWei(_id);
        }

        return (memberCollateral < collateralLimit);
    }

    /// @param _collateral Collateral storage
    /// @param _term Term storage
    /// @param _defaulters Defaulters array
    /// @return share The total amount of collateral to be divided among non-beneficiaries
    /// @return expellants array of addresses that were expelled
    function _whoExpelled(
        LibCollateralV2.Collateral storage _collateral,
        LibTermV2.Term memory _term,
        LibFundV2.Fund storage _fund,
        address[] memory _defaulters
    ) internal returns (uint, uint, address[] memory) {
        // require(_defaulters.length > 0, "No defaulters"); // todo: needed? only call this function when there are defaulters

        address[] memory expellants;
        uint expellantsCounter;
        uint shareEth;
        uint shareUsdc;
        //uint currentDefaulterBank;
        uint contributionAmountWei = IGettersV2(address(this)).getToEthConversionRate(
            _term.contributionAmount * 10 ** 18
        );
        // Determine who will be expelled and who will just pay the contribution from their collateral.
        for (uint i; i < _defaulters.length; ) {
            //currentDefaulterBank = _collateral.collateralMembersBank[_defaulters[i]];

            if (
                (!_fund.isBeneficiary[_defaulters[i]] &&
                    (_collateral.collateralMembersBank[_defaulters[i]] >= contributionAmountWei)) ||
                (_fund.isBeneficiary[_defaulters[i]] &&
                    !_isUnderCollaterized(_term.termId, _defaulters[i])) ||
                (_fund.isBeneficiary[_defaulters[i]] &&
                    _isUnderCollaterized(_term.termId, _defaulters[i]) &&
                    _fund.beneficiariesFrozenPool[_defaulters[i]] &&
                    (_collateral.collateralMembersBank[_defaulters[i]] >= contributionAmountWei))
            ) {
                // Pay with collateral
                // Not expelled
                _payDefaulterContribution(
                    _collateral,
                    _fund,
                    _term,
                    _defaulters[i],
                    contributionAmountWei,
                    true, // Pay with collateral
                    false, // Does not pay with frozen pool
                    false // Not expelled
                );
            }

            if (
                (!_fund.isBeneficiary[_defaulters[i]] &&
                    (_collateral.collateralMembersBank[_defaulters[i]] < contributionAmountWei)) ||
                (_fund.isBeneficiary[_defaulters[i]] &&
                    _isUnderCollaterized(_term.termId, _defaulters[i]) &&
                    !_fund.beneficiariesFrozenPool[_defaulters[i]])
            ) {
                _payDefaulterContribution(
                    _collateral,
                    _fund,
                    _term,
                    _defaulters[i],
                    contributionAmountWei,
                    true,
                    false, // Does not pay with frozen pool
                    true // Expelled
                );
                if (_fund.isBeneficiary[_defaulters[i]]) {
                    // Expelled
                    // Remaining collateral distributed
                    shareEth += _collateral.collateralMembersBank[_defaulters[i]];
                } else {
                    // Expelled
                    // Keep remaining collateral
                    _collateral.collateralPaymentBank[_defaulters[i]] += _collateral
                        .collateralMembersBank[_defaulters[i]];
                }

                expellants[i] = _defaulters[i];

                unchecked {
                    ++expellantsCounter;
                }
            }

            if (
                _fund.isBeneficiary[_defaulters[i]] &&
                _isUnderCollaterized(_term.termId, _defaulters[i]) &&
                _fund.beneficiariesFrozenPool[_defaulters[i]] &&
                (_collateral.collateralMembersBank[_defaulters[i]] < contributionAmountWei)
            ) {
                if (_fund.beneficiariesPool[_defaulters[i]] >= _term.contributionAmount) {
                    // Pay with frozen pool
                    // Not expelled
                    _payDefaulterContribution(
                        _collateral,
                        _fund,
                        _term,
                        _defaulters[i],
                        contributionAmountWei,
                        false, // Does not pay with collateral
                        true, // Pay with frozen pool
                        false // Not expelled
                    );
                } else {
                    uint totalAmountWei = _collateral.collateralMembersBank[_defaulters[i]] +
                        IGettersV2(address(this)).getToEthConversionRate(
                            _fund.beneficiariesPool[_defaulters[i]] * 10 ** 18
                        );
                    if (
                        totalAmountWei >=
                        IGettersV2(address(this)).getRemainingCyclesContributionWei(_term.termId)
                    ) {
                        // Pay with collateral and frozen pool
                        // First with collateral, leftover with frozen pool
                        // Not expelled
                        _payDefaulterContribution(
                            _collateral,
                            _fund,
                            _term,
                            _defaulters[i],
                            contributionAmountWei,
                            true, // Pay with collateral
                            true, // Pay with frozen pool
                            false // Not expelled
                        );
                    } else {
                        // Expelled
                        // Distribute collateral and frozen money pot
                        _payDefaulterContribution(
                            _collateral,
                            _fund,
                            _term,
                            _defaulters[i],
                            contributionAmountWei,
                            true,
                            false,
                            true
                        );
                        shareEth += _collateral.collateralMembersBank[_defaulters[i]];
                        shareUsdc += _fund.beneficiariesPool[_defaulters[i]];
                        _fund.beneficiariesPool[_defaulters[i]] = 0;
                        expellants[i] = _defaulters[i];

                        unchecked {
                            ++expellantsCounter;
                        }
                    }
                }
            }

            unchecked {
                ++i;
            }
        }

        return (shareEth, shareUsdc, expellants);
    }

    /// @notice called internally to pay defaulter contribution
    function _payDefaulterContribution(
        LibCollateralV2.Collateral storage _collateral,
        LibFundV2.Fund storage _fund,
        LibTermV2.Term memory _term,
        address _defaulter,
        uint _contributionAmountWei,
        bool _payWithCollateral,
        bool _payWithFrozenPool,
        bool _isExpelled
    ) internal {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[_term.termId];

        address beneficiary = _fund.lastBeneficiary;

        if (_payWithCollateral && !_payWithFrozenPool) {
            if (!_isExpelled) {
                _withdrawFromYield(_term.termId, _defaulter, _contributionAmountWei, yield);

                // Subtract contribution from defaulter and add to beneficiary.
                _collateral.collateralMembersBank[_defaulter] -= _contributionAmountWei;
                _collateral.collateralPaymentBank[beneficiary] += _contributionAmountWei;
            } else {
                _withdrawFromYield(
                    _term.termId,
                    _defaulter,
                    _collateral.collateralMembersBank[_defaulter],
                    yield
                );

                // Expelled
                _collateral.isCollateralMember[_defaulter] = false;
                _collateral.collateralMembersBank[_defaulter] = 0;
            }
            emit OnCollateralLiquidated(_term.termId, _defaulter, _contributionAmountWei);
        }
        if (_payWithFrozenPool && !_payWithCollateral) {
            _fund.beneficiariesPool[_defaulter] -= _term.contributionAmount;
            _fund.beneficiariesPool[beneficiary] += _term.contributionAmount;

            emit OnFrozenMoneyPotLiquidated(_term.termId, _defaulter, _term.contributionAmount);
        }
        if (_payWithCollateral && _payWithFrozenPool) {
            _withdrawFromYield(
                _term.termId,
                _defaulter,
                _collateral.collateralMembersBank[_defaulter],
                yield
            );

            uint leftover = IGettersV2(address(this)).getToEthConversionRate(
                _term.contributionAmount * 10 ** 18
            ) - _collateral.collateralMembersBank[_defaulter];

            uint leftoverUSDC = IGettersV2(address(this)).getToUSDConversionRate(leftover);

            _collateral.collateralPaymentBank[beneficiary] += _collateral.collateralMembersBank[
                _defaulter
            ];
            _collateral.collateralMembersBank[_defaulter] = 0;
            _fund.beneficiariesPool[_fund.lastBeneficiary] += leftoverUSDC;
            _fund.beneficiariesPool[_defaulter] -= leftoverUSDC;

            emit OnCollateralLiquidated(
                _term.termId,
                _defaulter,
                _collateral.collateralMembersBank[_defaulter]
            );

            emit OnFrozenMoneyPotLiquidated(_term.termId, _defaulter, leftoverUSDC);
        }
    }

    /// @param _collateral Collateral storage
    /// @param _term Term storage
    /// @return nonBeneficiaryCounter The total amount of collateral to be divided among non-beneficiaries
    /// @return nonBeneficiaries array of addresses that were expelled
    function _liquidateCollateral(
        LibCollateralV2.Collateral storage _collateral,
        LibTermV2.Term memory _term
    ) internal view returns (uint, address[] memory) {
        address currentDepositor;
        address[] memory nonBeneficiaries = new address[](_collateral.depositors.length);

        uint nonBeneficiaryCounter;

        // Divide and Liquidate
        uint depositorsLength = _collateral.depositors.length;
        for (uint i; i < depositorsLength; ) {
            currentDepositor = _collateral.depositors[i];
            if (
                !IFundV2(address(this)).isBeneficiary(_term.termId, currentDepositor) &&
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
        uint _id,
        address _user,
        uint _amount,
        LibYieldGeneration.YieldGeneration storage _yield
    ) internal {
        if (_yield.hasOptedIn[_user]) {
            IYGFacetZaynFi(address(this)).withdrawYG(_id, _user, _amount);
        }
    }
}
