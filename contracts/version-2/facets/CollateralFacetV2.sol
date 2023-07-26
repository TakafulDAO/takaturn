// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IFund} from "../../version-1/interfaces/IFund.sol";
import {ICollateral} from "../../version-1/interfaces/ICollateral.sol";
import {IGettersV2} from "../interfaces/IGettersV2.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import {LibFund} from "../../version-1/libraries/LibFund.sol";
import {LibTermV2} from "../libraries/LibTermV2.sol";
import {LibCollateral} from "../../version-1/libraries/LibCollateral.sol";

import {TermOwnable} from "../../version-1/access/TermOwnable.sol";

/// @title Takaturn Collateral
/// @author Aisha El Allam
/// @notice This is used to operate the Takaturn collateral
/// @dev v3.0 (Diamond)
contract CollateralFacetV2 is ICollateral, TermOwnable {
    event OnCollateralStateChanged(
        uint indexed termId,
        LibCollateral.CollateralStates indexed oldState,
        LibCollateral.CollateralStates indexed newState
    );
    event OnReimbursementWithdrawn(uint indexed termId, address indexed user, uint indexed amount);
    event OnCollateralWithdrawn(uint indexed termId, address indexed user, uint indexed amount);
    event OnCollateralLiquidated(uint indexed termId, address indexed user, uint indexed amount);

    /// @param id term id
    /// @param _state collateral state
    modifier atState(uint id, LibCollateral.CollateralStates _state) {
        LibCollateral.CollateralStates state = LibCollateral
            ._collateralStorage()
            .collaterals[id]
            .state;
        if (state != _state) revert FunctionInvalidAtThisState();
        _;
    }

    /// @param id term id
    /// @param newState collateral state
    function setStateOwner(
        uint id,
        LibCollateral.CollateralStates newState
    ) external /*onlyTermOwner(id)*/ {
        _setState(id, newState);
    }

    /// @notice Called from Fund contract when someone defaults
    /// @dev Check EnumerableMap (openzeppelin) for arrays that are being accessed from Fund contract
    /// @param id term id
    /// @param beneficiary Address that was randomly selected for the current cycle
    /// @param defaulters Address that was randomly selected for the current cycle
    /// @return expellants array of addresses that were expelled
    // TODO: Recheck this function, it was refactorized on internal functions because the stack was too deep and the EVM can not access variables
    function requestContribution(
        uint id,
        address beneficiary,
        address[] calldata defaulters
    ) external atState(id, LibCollateral.CollateralStates.CycleOngoing) returns (address[] memory) {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[id];
        LibTermV2.Term storage term = LibTermV2._termStorage().terms[id];

        (uint share, address[] memory expellants) = _whoExpelled(
            collateral,
            term,
            beneficiary,
            defaulters
        );

        (uint nonBeneficiaryCounter, address[] memory nonBeneficiaries) = _liquidateCollateral(
            collateral,
            term
        );

        // Finally, divide the share equally among non-beneficiaries
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
    ) external atState(id, LibCollateral.CollateralStates.ReleasingCollateral) {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[id];
        uint amount = collateral.collateralMembersBank[msg.sender] +
            collateral.collateralPaymentBank[msg.sender];
        require(amount > 0, "Nothing to claim");

        collateral.collateralMembersBank[msg.sender] = 0;
        collateral.collateralPaymentBank[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success);

        emit OnCollateralWithdrawn(id, msg.sender, amount);

        --collateral.counterMembers;
        // If last person withdraws, then change state to EOL
        if (collateral.counterMembers == 0) {
            _setState(id, LibCollateral.CollateralStates.Closed);
        }
    }

    /// @param id term id
    /// @param depositor Address of the depositor
    function withdrawReimbursement(uint id, address depositor) external {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[id];
        require(LibFund._fundExists(id), "Fund does not exists");
        uint amount = collateral.collateralPaymentBank[depositor];
        require(amount > 0, "Nothing to claim");

        collateral.collateralPaymentBank[depositor] = 0;

        (bool success, ) = payable(depositor).call{value: amount}("");
        require(success);

        emit OnReimbursementWithdrawn(id, depositor, amount);
    }

    /// @param id term id
    function releaseCollateral(uint id) external {
        require(LibFund._fundExists(id), "Fund does not exists");
        _setState(id, LibCollateral.CollateralStates.ReleasingCollateral);
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
    ) external onlyTermOwner(id) atState(id, LibCollateral.CollateralStates.ReleasingCollateral) {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[id];
        (, , , , , , , , , uint fundEnd) = IGettersV2(address(this)).getFundSummary(id);
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
        _setState(id, LibCollateral.CollateralStates.Closed);

        (bool success, ) = payable(msg.sender).call{value: address(this).balance}("");
        require(success);
    }

    /// @notice Gets latest ETH / USD price
    /// @param id The term id
    /// @return uint latest price in Wei Note: 18 decimals
    function getLatestPrice(uint id) public view returns (uint) {
        LibTermV2.Term storage term = LibTermV2._termStorage().terms[id];
        LibTermV2.TermConsts storage termConsts = LibTermV2._termConsts();
        (
            ,
            /*uint80 roundID*/ int256 answer,
            uint256 startedAt /*uint256 updatedAt*/ /*uint80 answeredInRound*/,
            ,

        ) = AggregatorV3Interface(termConsts.sequencerUptimeFeedAddress).latestRoundData(); //8 decimals

        // Answer == 0: Sequencer is up
        // Answer == 1: Sequencer is down
        require(answer == 0, "Sequencer down");

        //We must wait at least an hour after the sequencer started up
        require(
            termConsts.sequencerStartupTime <= block.timestamp - startedAt,
            "Sequencer starting up"
        );

        (
            uint80 roundID,
            int256 price,
            ,
            /*uint startedAt*/ uint256 timeStamp,
            uint80 answeredInRound
        ) = AggregatorV3Interface(term.aggregatorAddress).latestRoundData(); //8 decimals

        // Check if chainlink data is not stale or incorrect
        require(
            timeStamp != 0 && answeredInRound >= roundID && price > 0,
            "ChainlinkOracle: stale data"
        );

        return uint(price * 10 ** 10); //18 decimals
    }

    /// @notice Gets the conversion rate of an amount in USD to ETH
    /// @dev should we always deal with in Wei?
    /// @param id The term id
    /// @param USDAmount The amount in USD
    /// @return uint converted amount in wei
    function getToEthConversionRate(uint id, uint USDAmount) public view returns (uint) {
        uint ethPrice = getLatestPrice(id);
        uint USDAmountInEth = (USDAmount * 10 ** 18) / ethPrice; //* 10 ** 18; // todo: fix this
        return USDAmountInEth;
    }

    /// @notice Gets the conversion rate of an amount in ETH to USD
    /// @dev should we always deal with in Wei?
    /// @param id The term id
    /// @param ethAmount The amount in ETH
    /// @return uint converted amount in USD correct to 18 decimals
    function getToUSDConversionRate(uint id, uint ethAmount) public view returns (uint) {
        // NOTE: This will be made internal
        uint ethPrice = getLatestPrice(id);
        uint ethAmountInUSD = (ethPrice * ethAmount) / 10 ** 18;
        return ethAmountInUSD;
    }

    /// @param _id term id
    /// @param _newState collateral state
    function _setState(uint _id, LibCollateral.CollateralStates _newState) internal {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[_id];
        LibCollateral.CollateralStates oldState = collateral.state;
        collateral.state = _newState;
        emit OnCollateralStateChanged(_id, oldState, _newState);
    }

    /// @notice Checks if a user has a collateral below 1.0x of total contribution amount
    /// @dev This will revert if called during ReleasingCollateral or after
    /// @param _id The fund id
    /// @param _member The user to check for
    /// @return Bool check if member is below 1.0x of collateralDeposit
    function _isUnderCollaterized(uint _id, address _member) internal view returns (bool) {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[_id];
        LibTermV2.Term storage term = LibTermV2._termStorage().terms[_id];

        uint collateralLimit;
        uint memberCollateralUSD;
        (, , , uint currentCycle, , , , , , ) = IGettersV2(address(this)).getFundSummary(_id);
        // todo: check this if statement. fund will always esist
        if (!LibFund._fundExists(_id)) {
            collateralLimit = term.totalParticipants * term.contributionAmount * 10 ** 18;
        } else {
            uint remainingCycles = 1 + collateral.counterMembers - currentCycle;

            collateralLimit = remainingCycles * term.contributionAmount * 10 ** 18; // 18 decimals
        }

        memberCollateralUSD = getToUSDConversionRate(
            _id,
            collateral.collateralMembersBank[_member]
        );
        // todo: check memberCollateralUSD is not in wei (18 decimals) collateralLimit is in wei (18 decimals)
        return (memberCollateralUSD < collateralLimit);
    }

    /// @param _collateral Collateral storage
    /// @param _term Term storage
    /// @param _beneficiary Address that was randomly selected for the current cycle
    /// @param _defaulters Address that was randomly selected for the current cycle
    /// @return share The total amount of collateral to be divided among non-beneficiaries
    /// @return expellants array of addresses that were expelled
    function _whoExpelled(
        LibCollateral.Collateral storage _collateral,
        LibTermV2.Term storage _term,
        address _beneficiary,
        address[] calldata _defaulters
    ) internal returns (uint, address[] memory) {
        require(_defaulters.length > 0, "No defaulters");

        bool wasBeneficiary;
        uint8 totalExpellants;
        address[] memory expellants = new address[](_defaulters.length);
        uint share;
        uint currentDefaulterBank;
        uint contributionAmountWei = getToEthConversionRate(
            _term.termId,
            _term.contributionAmount * 10 ** 18
        );
        // Determine who will be expelled and who will just pay the contribution from their collateral.
        for (uint i; i < _defaulters.length; ) {
            wasBeneficiary = IFund(address(this)).isBeneficiary(_term.termId, _defaulters[i]);
            currentDefaulterBank = _collateral.collateralMembersBank[_defaulters[i]];
            if (_defaulters[i] == _beneficiary) {
                unchecked {
                    ++i;
                }
                continue;
            } // Avoid expelling graced defaulter

            if (
                (wasBeneficiary && _isUnderCollaterized(_term.termId, _defaulters[i])) ||
                (currentDefaulterBank < contributionAmountWei)
            ) {
                // If enter this statement through the second condition, then the defaulter may not be a beneficiary
                // In that case
                if (!wasBeneficiary) {
                    // Nothing to share, reimburse all the securities left
                    // share = 0;
                    uint amount = _collateral.collateralMembersBank[_defaulters[i]];

                    (bool success, ) = payable(_defaulters[i]).call{value: amount}("");
                    require(success);
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
            } else {
                // Subtract contribution from defaulter and add to beneficiary.
                // todo: check if this is correct
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
        LibCollateral.Collateral storage _collateral,
        LibTermV2.Term storage _term
    ) internal view returns (uint, address[] memory) {
        address currentDepositor;
        address[] memory nonBeneficiaries = new address[](_collateral.depositors.length);

        uint nonBeneficiaryCounter;

        // Divide and Liquidate
        uint depositorsLength = _collateral.depositors.length;
        for (uint i; i < depositorsLength; ) {
            currentDepositor = _collateral.depositors[i];
            if (
                !IFund(address(this)).isBeneficiary(_term.termId, currentDepositor) &&
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
