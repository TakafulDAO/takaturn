// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import {IFund} from "../interfaces/IFund.sol";
import {ICollateral} from "../interfaces/ICollateral.sol";
import {ITakaturnFactory} from "../interfaces/ITakaturnFactory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {LibFund} from "../libraries/LibFund.sol";
import {LibTerm} from "../libraries/LibTerm.sol";
import {LibCollateral} from "../libraries/LibCollateral.sol";

import {FundFacet} from "./FundFacet.sol";
import {CollateralFacet} from "./CollateralFacet.sol";

/// @title Takaturn Factory
/// @author Aisha El Allam / Mohammed Haddouti
/// @notice This is used to deploy the collateral & fund contracts
/// @dev v2.0 (post-deploy)
// TODO: remove abstract keyword, missing implementations of createCollateral, createFund, getDeployedCollaterals, getDeployedFunds
abstract contract TermFacet is ITakaturnFactory {
    uint public constant VERSION = 1;

    function createTerm(
        uint totalParticipants,
        uint cycleTime,
        uint contributionAmount,
        uint contributionPeriod,
        uint fixedCollateralEth,
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
                stableTokenAddress,
                aggregatorAddress
            );
    }

    function joinTerm(uint termId) external {
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
        address _stableTokenAddress,
        address _aggregatorAddress
    ) internal returns (uint) {
        require(
            _cycleTime != 0 &&
                _contributionAmount != 0 &&
                _contributionPeriod != 0 &&
                _totalParticipants != 0 &&
                _contributionPeriod < _cycleTime &&
                _stableTokenAddress != address(0) &&
                _aggregatorAddress != address(0),
            "Invalid inputs"
        );

        LibTerm.TermStorage storage termStorage = LibTerm._termStorage();
        uint termId = termStorage.nextTermId;

        require(!termStorage.terms[termId].initialized, "Term already exists");

        LibTerm.Term memory newTerm;

        newTerm.termId = termId;
        newTerm.totalParticipants = _totalParticipants;
        newTerm.cycleTime = _cycleTime;
        newTerm.contributionAmount = _contributionAmount;
        newTerm.contributionPeriod = _contributionPeriod;
        newTerm.fixedCollateralEth = _fixedCollateralEth;
        newTerm.stableTokenAddress = _stableTokenAddress;
        newTerm.aggregatorAddress = _aggregatorAddress;
        newTerm.owner = msg.sender;
        newTerm.creationTime = block.timestamp;
        newTerm.initialized = true;

        termStorage.terms[termId] = newTerm;
        termStorage.nextTermId++;

        _createCollateral(termId);

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
        collateral.depositors.push(msg.sender);
        collateral.counterMembers++;

        emit LibCollateral.OnCollateralDeposited(termId, msg.sender);

        if (collateral.counterMembers == 1) {
            collateral.firstDepositTime = block.timestamp;
        }
    }

    function _startTerm(uint termId) internal {
        require(LibTerm._termExists(termId) && LibCollateral._collateralExists(termId));
        LibTerm.TermStorage storage termStorage = LibTerm._termStorage();
        LibTerm.Term memory term = termStorage.terms[termId];

        LibCollateral.CollateralStorage storage collateralStorage = LibCollateral
            ._collateralStorage();
        LibCollateral.Collateral storage collateral = collateralStorage.collaterals[termId];

        require(collateral.counterMembers == term.totalParticipants);
        // If one user is under collaterized, then all are.
        require(
            !ICollateral(address(this)).isUnderCollaterized(termId, collateral.depositors[0]),
            "Eth prices dropped"
        );

        // Actually reate and initialize the fund
        _createFund(termId);

        // Tell the collateral that the term has started
        ICollateral(address(this)).setStateOwner(
            termId,
            LibCollateral.CollateralStates.CycleOngoing
        );

        /*
        
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
        );*/
    }

    function _createCollateral(uint termId) internal {
        require(!LibCollateral._collateralExists(termId), "Collateral already exists");

        LibCollateral.CollateralStorage storage collateralStorage = LibCollateral
            ._collateralStorage();
        LibCollateral.Collateral storage newCollateral;
        newCollateral.initialized = true;

        collateralStorage.collaterals[termId] = newCollateral; // TODO: Can not be assigned this way due to have nested mappings
    }

    function _createFund(uint termId) internal {
        require(!LibFund._fundExists(termId), "Fund already exists");
        LibFund.Fund storage fund = LibFund._fundStorage().funds[termId];
        LibTerm.Term memory term = LibTerm._termStorage().terms[termId];
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[termId];
        LibFund.Fund storage newFund;

        fund.stableToken = IERC20(term.stableTokenAddress);
        fund.beneficiariesOrder = collateral.depositors;

        IFund(address(this)).initFund(termId);
        fund.initialized = true;

        fund.funds[termId] = newFund; // TODO: Can not be assigned this way due to have nested mappings
    }
}
