// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IFundV2} from "../interfaces/IFundV2.sol";
import {ICollateralV2} from "../interfaces/ICollateralV2.sol";
import {IGettersV2} from "../interfaces/IGettersV2.sol";

import {LibFundV2} from "../libraries/LibFundV2.sol";
import {LibTermV2} from "../libraries/LibTermV2.sol";
import {LibCollateralV2} from "../libraries/LibCollateralV2.sol";

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
    event OnReimbursementWithdrawn(uint indexed termId, address indexed user, uint indexed amount);
    event OnCollateralWithdrawn(uint indexed termId, address indexed user, uint indexed amount);
    event OnCollateralLiquidated(uint indexed termId, address indexed user, uint indexed amount);

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
    /// @param beneficiary Address that will be receiving the cycle pot
    /// @param defaulters Address that was randomly selected for the current cycle
    /// @return expellants array of addresses that were expelled
    function requestContribution(
        LibTermV2.Term memory term,
        address beneficiary,
        address[] calldata defaulters
    )
        external
        atState(term.termId, LibCollateralV2.CollateralStates.CycleOngoing)
        returns (address[] memory)
    {
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[term.termId];
        // LibTermV2.Term storage term = LibTermV2._termStorage().terms[id];
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[term.termId];

        (uint share, address[] memory expellants) = _whoExpelled(
            collateral,
            term,
            fund,
            beneficiary,
            defaulters
        );

        (uint nonBeneficiaryCounter, address[] memory nonBeneficiaries) = _liquidateCollateral(
            collateral,
            term
        );

        // Finally, divide the share equally among non-beneficiaries //todo: check if this is still needed
        if (nonBeneficiaryCounter > 0) {
            // This case can only happen when what?
            share = share / nonBeneficiaryCounter;
            for (uint i = 0; i < nonBeneficiaryCounter; i++) {
                collateral.collateralPaymentBank[nonBeneficiaries[i]] += share;
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
        require(fund.paidThisCycle[msg.sender], "You have not paid this cycle");
        require(fund.currentState == LibFundV2.FundStates.CycleOngoing, "Wrong state");

        uint remainingCycles = 1 + fund.totalAmountOfCycles - fund.currentCycle;

        uint contributionAmountWei = IGettersV2(address(this)).getToEthConversionRate(
            term.contributionAmount * 10 ** 18
        );
        uint remainingContribution = contributionAmountWei * remainingCycles;

        uint userSecurity = collateral.collateralDepositByUser[msg.sender]; // todo: or collateralMembersBank?

        uint allowedWithdraw = ((userSecurity - remainingContribution) / remainingCycles) +
            contributionAmountWei;

        if (allowedWithdraw <= collateral.collateralPaymentBank[msg.sender]) {
            collateral.collateralPaymentBank[msg.sender] -= allowedWithdraw;
            (bool success, ) = payable(msg.sender).call{value: allowedWithdraw}("");
            require(success);
        } else {
            uint neededAmount = allowedWithdraw - collateral.collateralPaymentBank[msg.sender];
            if (neededAmount <= collateral.collateralMembersBank[msg.sender]) {
                collateral.collateralPaymentBank[msg.sender] -= 0;
                collateral.collateralMembersBank[msg.sender] -= neededAmount;
                (bool success, ) = payable(msg.sender).call{value: allowedWithdraw}("");
                require(success);
            } else {
                uint amount = collateral.collateralMembersBank[msg.sender] +
                    collateral.collateralPaymentBank[msg.sender];
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
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[id];
        require(LibFundV2._fundExists(id), "Fund does not exists");
        uint amount = collateral.collateralPaymentBank[depositor];
        require(amount > 0, "Nothing to claim");

        collateral.collateralPaymentBank[depositor] = 0;

        (bool success, ) = payable(depositor).call{value: amount}("");
        require(success);

        emit OnReimbursementWithdrawn(id, depositor, amount);
    }

    /// @param id term id
    function releaseCollateral(uint id) external {
        require(LibFundV2._fundExists(id), "Fund does not exists");
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
        (, , , , , uint fundEnd, , , ) = IGettersV2(address(this)).getFundSummary(id);
        require(block.timestamp > fundEnd + 180 days, "Can't empty yet");

        uint depositorsLength = collateral.depositors.length;
        for (uint i; i < depositorsLength; i++) {
            address depositor = collateral.depositors[i];
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

    /// @notice Internal function to freeze the pot for the beneficiary
    function freezePot(LibTermV2.Term memory term) external view returns (bool freeze) {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[term.termId];
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[term.termId];
        uint remainingCycles = 1 + fund.totalAmountOfCycles - fund.currentCycle;

        uint contributionAmountWei = IGettersV2(address(this)).getToEthConversionRate(
            term.contributionAmount * 10 ** 18
        );

        uint neededCollateral = (110 * contributionAmountWei * remainingCycles) / 100; // 1.1 x RCC

        return (collateral.collateralMembersBank[fund.lastBeneficiary] < neededCollateral);
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
        LibTermV2.Term storage term = LibTermV2._termStorage().terms[_id];

        uint collateralLimit;
        uint memberCollateralUSD;
        (, , , , , , uint currentCycle, , uint totalAmountOfCycles) = IGettersV2(address(this))
            .getFundSummary(_id);

        if (!LibFundV2._fundExists(_id)) {
            // Only check here when starting the term
            (, , , collateralLimit) = IGettersV2(address(this)).getDepositorCollateralSummary(
                _member,
                _id
            );
        } else {
            uint remainingCycles = 1 + totalAmountOfCycles - currentCycle;

            collateralLimit = remainingCycles * term.contributionAmount * 10 ** 18; // 18 decimals
        }

        memberCollateralUSD = IGettersV2(address(this)).getToUSDConversionRate(
            collateral.collateralMembersBank[_member]
        );
        return (memberCollateralUSD < collateralLimit);
    }

    /// @param _collateral Collateral storage
    /// @param _term Term storage
    /// @param _beneficiary Address that will be receiving the cycle pot
    /// @param _defaulters Defaulters array
    /// @return share The total amount of collateral to be divided among non-beneficiaries
    /// @return expellants array of addresses that were expelled
    function _whoExpelled(
        LibCollateralV2.Collateral storage _collateral,
        LibTermV2.Term memory _term,
        LibFundV2.Fund storage _fund,
        address _beneficiary,
        address[] memory _defaulters
    ) internal returns (uint, address[] memory) {
        // require(_defaulters.length > 0, "No defaulters"); // todo: needed? only call this function when there are defaulters

        bool wasBeneficiary;
        uint8 totalExpellants;
        address[] memory expellants = new address[](_defaulters.length);
        uint share;
        uint currentDefaulterBank;
        uint contributionAmountWei = IGettersV2(address(this)).getToEthConversionRate(
            _term.contributionAmount * 10 ** 18
        );
        // Determine who will be expelled and who will just pay the contribution from their collateral.
        for (uint i; i < _defaulters.length; ) {
            wasBeneficiary = IFundV2(address(this)).isBeneficiary(_term.termId, _defaulters[i]);
            currentDefaulterBank = _collateral.collateralMembersBank[_defaulters[i]];
            // Avoid expelling graced defaulter

            if (
                (wasBeneficiary && _isUnderCollaterized(_term.termId, _defaulters[i])) ||
                (currentDefaulterBank < contributionAmountWei)
            ) {
                if (_fund.beneficiariesFrozenPool[_defaulters[i]] >= _term.contributionAmount) {
                    _fund.beneficiariesFrozenPool[_defaulters[i]] -= _term.contributionAmount;
                    _fund.beneficiariesPool[_beneficiary] += _term.contributionAmount;
                } else {
                    // If enter this statement through the second condition, then the defaulter may not be a beneficiary
                    // In that case
                    if (!wasBeneficiary) {
                        // Nothing to share, reimburse all the securities left
                        // share = 0;
                        _collateral.collateralPaymentBank[_defaulters[i]] += currentDefaulterBank;
                    } else {
                        share += currentDefaulterBank;
                    }

                    _collateral.isCollateralMember[_defaulters[i]] = false; // Expelled!
                    expellants[i] = _defaulters[i];
                    _collateral.collateralMembersBank[_defaulters[i]] = 0;
                    ++totalExpellants;

                    emit OnCollateralLiquidated(
                        _term.termId,
                        address(_defaulters[i]),
                        currentDefaulterBank
                    );
                }
            } else {
                // Subtract contribution from defaulter and add to beneficiary.
                _collateral.collateralMembersBank[_defaulters[i]] -= contributionAmountWei;
                _collateral.collateralPaymentBank[_beneficiary] += contributionAmountWei;
            }
            unchecked {
                ++i;
            }
        }

        _term.totalParticipants = _term.totalParticipants - totalExpellants;
        return (share, expellants);
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
}
