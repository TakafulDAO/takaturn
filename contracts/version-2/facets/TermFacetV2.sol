// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IFundV2} from "../interfaces/IFundV2.sol";
import {ICollateralV2} from "../interfaces/ICollateralV2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ITermV2} from "../interfaces/ITermV2.sol";
import {IGettersV2} from "../interfaces/IGettersV2.sol";
import {IYGFacetZaynFi} from "../interfaces/IYGFacetZaynFi.sol";

import {LibFundV2} from "../libraries/LibFundV2.sol";
import {LibTermV2} from "../libraries/LibTermV2.sol";
import {LibCollateralV2} from "../libraries/LibCollateralV2.sol";
import {LibYieldGeneration} from "../libraries/LibYieldGeneration.sol";

/// @title Takaturn Term
/// @author Mohammed Haddouti
/// @notice This is used to deploy the collateral & fund contracts
/// @dev v3.0 (Diamond)
contract TermFacetV2 is ITermV2 {
    uint public constant TERM_VERSION = 2;

    event OnCollateralDeposited(uint indexed termId, address indexed user);

    function createTerm(
        uint totalParticipants,
        uint cycleTime,
        uint contributionAmount,
        uint contributionPeriod,
        address stableTokenAddress
    ) external returns (uint) {
        return
            _createTerm(
                totalParticipants,
                cycleTime,
                contributionAmount,
                contributionPeriod,
                stableTokenAddress
            );
    }

    function joinTerm(uint termId, bool optedYG) external payable {
        _joinTerm(termId, optedYG);
    }

    function startTerm(uint termId) external {
        _startTerm(termId);
    }

    function _createTerm(
        uint _totalParticipants,
        uint _cycleTime,
        uint _contributionAmount,
        uint _contributionPeriod,
        address _stableTokenAddress
    ) internal returns (uint) {
        require(
            _cycleTime != 0 &&
                _contributionAmount != 0 &&
                _contributionPeriod != 0 &&
                _totalParticipants != 0 &&
                _contributionPeriod < _cycleTime &&
                _stableTokenAddress != address(0),
            "Invalid inputs"
        );

        LibTermV2.TermStorage storage termStorage = LibTermV2._termStorage();
        uint termId = termStorage.nextTermId;

        //require(!termStorage.terms[termId].initialized, "Term already exists");

        LibTermV2.Term memory newTerm;

        newTerm.termId = termId;
        newTerm.totalParticipants = _totalParticipants;
        newTerm.cycleTime = _cycleTime;
        newTerm.contributionAmount = _contributionAmount;
        newTerm.contributionPeriod = _contributionPeriod;
        newTerm.stableTokenAddress = _stableTokenAddress;
        newTerm.termOwner = msg.sender;
        newTerm.creationTime = block.timestamp;
        newTerm.initialized = true;

        termStorage.terms[termId] = newTerm;
        termStorage.nextTermId++;

        _createCollateral(termId, _totalParticipants);

        return termId;
    }

    function _joinTerm(uint _termId, bool _optedYG) internal {
        LibTermV2.TermStorage storage termStorage = LibTermV2._termStorage();
        LibTermV2.Term memory term = termStorage.terms[_termId];
        LibYieldGeneration.YieldGeneration storage yieldGeneration = LibYieldGeneration
            ._yieldGeneration();

        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[_termId];

        require(LibTermV2._termExists(_termId) && LibCollateralV2._collateralExists(_termId));

        require(collateral.counterMembers < term.totalParticipants, "No space");

        require(!collateral.isCollateralMember[msg.sender], "Reentry");

        uint depositorsLength = collateral.depositors.length;
        for (uint i; i < depositorsLength; ) {
            if (collateral.depositors[i] == address(0)) {
                uint amount = IGettersV2(address(this)).minCollateralToDeposit(term, i);

                require(msg.value >= amount, "Eth payment too low");

                collateral.collateralMembersBank[msg.sender] += msg.value;
                collateral.isCollateralMember[msg.sender] = true;
                collateral.depositors[i] = msg.sender;
                collateral.counterMembers++;
                collateral.collateralDepositByUser[msg.sender] += msg.value;

                termStorage.participantToTermId[msg.sender].push(_termId);

                yieldGeneration.hasOptedIn[msg.sender] = _optedYG;

                emit OnCollateralDeposited(_termId, msg.sender);

                break;
            }

            unchecked {
                ++i;
            }
        }

        if (collateral.counterMembers == 1) {
            collateral.firstDepositTime = block.timestamp;
        }

        // If all the spots are filled, change the collateral
        if (collateral.counterMembers == term.totalParticipants) {
            collateral.state = LibCollateralV2.CollateralStates.CycleOngoing;
        }
    }

    function _startTerm(uint _termId) internal {
        require(LibTermV2._termExists(_termId) && LibCollateralV2._collateralExists(_termId));
        LibTermV2.Term memory term = LibTermV2._termStorage().terms[_termId];
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[_termId];

        address[] memory depositors = collateral.depositors;

        uint depositorsArrayLength = depositors.length;

        require(collateral.counterMembers == term.totalParticipants);

        // Need to check each user because they can have different collateral amounts
        for (uint i; i < depositorsArrayLength; ) {
            require(
                !ICollateralV2(address(this)).isUnderCollaterized(_termId, depositors[i]),
                "Eth prices dropped"
            );

            unchecked {
                ++i;
            }
        }

        // Actually create and initialize the fund
        _createFund(term, collateral);

        _createYieldGenerator(term, collateral);

        // Tell the collateral that the term has started
        ICollateralV2(address(this)).setStateOwner(
            _termId,
            LibCollateralV2.CollateralStates.CycleOngoing
        );
    }

    function _createCollateral(uint _termId, uint _totalParticipants) internal {
        //require(!LibCollateralV2._collateralExists(termId), "Collateral already exists");
        LibCollateralV2.Collateral storage newCollateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[_termId];

        newCollateral.initialized = true;
        newCollateral.state = LibCollateralV2.CollateralStates.AcceptingCollateral;
        newCollateral.depositors = new address[](_totalParticipants);
    }

    function _createFund(
        LibTermV2.Term memory _term,
        LibCollateralV2.Collateral storage _collateral
    ) internal {
        require(!LibFundV2._fundExists(_term.termId), "Fund already exists");
        LibFundV2.Fund storage newFund = LibFundV2._fundStorage().funds[_term.termId];

        newFund.stableToken = IERC20(_term.stableTokenAddress);
        newFund.beneficiariesOrder = _collateral.depositors;
        newFund.initialized = true;
        newFund.totalAmountOfCycles = newFund.beneficiariesOrder.length;

        IFundV2(address(this)).initFund(_term.termId);
    }

    function _createYieldGenerator(
        LibTermV2.Term memory _term,
        LibCollateralV2.Collateral storage _collateral
    ) internal {
        LibYieldGeneration.YieldGeneration storage yieldGeneration = LibYieldGeneration
            ._yieldGeneration();

        uint amountDeposited;

        address[] memory depositors = _collateral.depositors;
        uint depositorsArrayLength = depositors.length;

        for (uint i; i < depositorsArrayLength; ) {
            if (yieldGeneration.hasOptedIn[depositors[i]]) {
                amountDeposited += _collateral.collateralMembersBank[depositors[i]];
            }

            unchecked {
                ++i;
            }
        }

        IYGFacetZaynFi(address(this)).depositYG(_term.termId, amountDeposited);

        yieldGeneration.startTimeStamp = block.timestamp;
        yieldGeneration.initialized = true;
    }
}
