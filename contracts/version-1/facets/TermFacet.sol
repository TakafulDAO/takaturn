// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IFund} from "../interfaces/IFund.sol";
import {ICollateral} from "../interfaces/ICollateral.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ITerm} from "../interfaces/ITerm.sol";

import {LibFund} from "../libraries/LibFund.sol";
import {LibTerm} from "../libraries/LibTerm.sol";
import {LibCollateral} from "../libraries/LibCollateral.sol";

/// @title Takaturn Term
/// @author Mohammed Haddouti
/// @notice This is used to deploy the collateral & fund contracts
/// @dev v3.0 (Diamond)
contract TermFacet is ITerm {
    uint public constant TERM_VERSION = 1;

    event OnCollateralDeposited(uint indexed termId, address indexed user);

    function createTerm(
        uint totalParticipants,
        uint cycleTime,
        uint contributionAmount,
        uint contributionPeriod,
        uint fixedCollateralEth,
        uint collateralAmount,
        address stableTokenAddress,
        address aggregatorAddress
    ) external returns (uint) {
        return
            _createTerm(
                totalParticipants,
                cycleTime,
                contributionAmount,
                contributionPeriod,
                fixedCollateralEth,
                collateralAmount,
                stableTokenAddress,
                aggregatorAddress
            );
    }

    function joinTerm(uint termId) external payable {
        _joinTerm(termId);
    }

    function startTerm(uint termId) external {
        _startTerm(termId);
    }

    function _createTerm(
        uint _totalParticipants,
        uint _cycleTime,
        uint _contributionAmount,
        uint _contributionPeriod,
        uint _fixedCollateralEth,
        uint _collateralAmount,
        address _stableTokenAddress,
        address _aggregatorAddress
    ) internal returns (uint) {
        require(
            _cycleTime != 0 &&
                _contributionAmount != 0 &&
                _contributionPeriod != 0 &&
                _totalParticipants != 0 &&
                _contributionPeriod < _cycleTime &&
                _collateralAmount != 0 &&
                _stableTokenAddress != address(0) &&
                _aggregatorAddress != address(0),
            "Invalid inputs"
        );

        LibTerm.TermStorage storage termStorage = LibTerm._termStorage();
        uint termId = termStorage.nextTermId;

        //require(!termStorage.terms[termId].initialized, "Term already exists");

        LibTerm.Term memory newTerm;

        newTerm.termId = termId;
        newTerm.totalParticipants = _totalParticipants;
        newTerm.cycleTime = _cycleTime;
        newTerm.contributionAmount = _contributionAmount;
        newTerm.contributionPeriod = _contributionPeriod;
        newTerm.fixedCollateralEth = _fixedCollateralEth;
        newTerm.stableTokenAddress = _stableTokenAddress;
        newTerm.aggregatorAddress = _aggregatorAddress;
        newTerm.termOwner = msg.sender;
        newTerm.creationTime = block.timestamp;
        newTerm.initialized = true;

        termStorage.terms[termId] = newTerm;
        termStorage.nextTermId++;

        _createCollateral(termId, _totalParticipants, _collateralAmount);

        return termId;
    }

    function _joinTerm(uint termId) internal {
        LibTerm.TermStorage storage termStorage = LibTerm._termStorage();
        LibTerm.Term memory term = termStorage.terms[termId];

        LibCollateral.CollateralStorage storage collateralStorage = LibCollateral
            ._collateralStorage();
        LibCollateral.Collateral storage collateral = collateralStorage.collaterals[termId];
        require(LibTerm._termExists(termId) && LibCollateral._collateralExists(termId));

        require(collateral.counterMembers < term.totalParticipants, "No space");

        require(!collateral.isCollateralMember[msg.sender], "Reentry");
        require(msg.value >= term.fixedCollateralEth, "Eth payment too low");

        collateral.collateralMembersBank[msg.sender] += msg.value;
        collateral.isCollateralMember[msg.sender] = true;

        uint depositorsLength = collateral.depositors.length;
        for (uint i; i < depositorsLength; ) {
            if (collateral.depositors[i] == address(0)) {
                collateral.depositors[i] = msg.sender;
                collateral.counterMembers++;
                emit OnCollateralDeposited(termId, msg.sender);
                if (collateral.counterMembers == 1) {
                    collateral.firstDepositTime = block.timestamp;
                }
                break;
            }
            unchecked {
                ++i;
            }
        }
        // If all the spots are filled, change the collateral
        if (collateral.counterMembers == term.totalParticipants) {
            collateral.state = LibCollateral.CollateralStates.CycleOngoing;
        }
    }

    function _startTerm(uint termId) internal {
        require(LibTerm._termExists(termId) && LibCollateral._collateralExists(termId));
        LibTerm.TermStorage storage termStorage = LibTerm._termStorage();
        LibTerm.Term memory term = termStorage.terms[termId];

        LibCollateral.CollateralStorage storage collateralStorage = LibCollateral
            ._collateralStorage();
        LibCollateral.Collateral storage collateral = collateralStorage.collaterals[termId];

        address[] memory depositors = collateral.depositors;

        uint depositorsArrayLength = depositors.length;

        require(collateral.counterMembers == term.totalParticipants);

        // Need to check each user because they can have different collateral amounts
        for (uint i; i < depositorsArrayLength; ) {
            require(
                !ICollateral(address(this)).isUnderCollaterized(termId, depositors[i]),
                "Eth prices dropped"
            );
            unchecked {
                ++i;
            }
        }

        // Actually create and initialize the fund
        _createFund(termId);

        // Tell the collateral that the term has started
        ICollateral(address(this)).setStateOwner(
            termId,
            LibCollateral.CollateralStates.CycleOngoing
        );
    }

    function _createCollateral(
        uint termId,
        uint _totalParticipants,
        uint _collateralAmount
    ) internal {
        //require(!LibCollateral._collateralExists(termId), "Collateral already exists");
        LibCollateral.Collateral storage newCollateral = LibCollateral
            ._collateralStorage()
            .collaterals[termId];

        newCollateral.initialized = true;
        newCollateral.state = LibCollateral.CollateralStates.AcceptingCollateral;
        newCollateral.depositors = new address[](_totalParticipants);
        newCollateral.collateralDeposit = _collateralAmount * 10 ** 18; // Convert to Wei; // TODO: This is the correct value?
    }

    function _createFund(uint termId) internal {
        require(!LibFund._fundExists(termId), "Fund already exists");
        LibFund.Fund storage newFund = LibFund._fundStorage().funds[termId];
        LibTerm.Term memory term = LibTerm._termStorage().terms[termId];
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[termId];

        newFund.stableToken = IERC20(term.stableTokenAddress);
        newFund.beneficiariesOrder = collateral.depositors;
        newFund.initialized = true;
        newFund.totalAmountOfCycles = newFund.beneficiariesOrder.length;

        IFund(address(this)).initFund(termId);
    }
}
