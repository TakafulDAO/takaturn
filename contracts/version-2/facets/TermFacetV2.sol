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

    event OnTermCreated(uint indexed termId, address indexed termOwner);
    event OnCollateralDeposited(uint indexed termId, address indexed user, uint amount);
    event OnTermFilled(uint indexed termId);
    event OnTermExpired(uint indexed termId);

    function createTerm(
        uint totalParticipants,
        uint registrationPeriod,
        uint cycleTime,
        uint contributionAmount,
        uint contributionPeriod,
        address stableTokenAddress
    ) external returns (uint) {
        return
            _createTerm(
                totalParticipants,
                registrationPeriod,
                cycleTime,
                contributionAmount,
                contributionPeriod,
                stableTokenAddress
            );
    }

    function joinTerm(uint termId) external payable {
        _joinTerm(termId);
    }

    function startTerm(uint termId) external {
        _startTerm(termId);
    }

    function expireTerm(uint termId) external {
        _expireTerm(termId);
    }

    function _createTerm(
        uint _totalParticipants,
        uint _registrationPeriod,
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
                _registrationPeriod != 0 &&
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
        newTerm.registrationPeriod = _registrationPeriod;
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

        emit OnTermCreated(termId, msg.sender);

        return termId;
    }

    function _joinTerm(uint _termId) internal {
        LibTermV2.TermStorage storage termStorage = LibTermV2._termStorage();
        LibTermV2.Term memory term = termStorage.terms[_termId];
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[_termId];

        require(LibTermV2._termExists(_termId) && LibCollateralV2._collateralExists(_termId));

        require(collateral.state == LibCollateralV2.CollateralStates.AcceptingCollateral, "Closed");

        require(collateral.counterMembers < term.totalParticipants, "No space");

        require(
            block.timestamp <= term.creationTime + term.registrationPeriod,
            "Registration period ended"
        );

        require(!collateral.isCollateralMember[msg.sender], "Reentry");

        uint ethSended = msg.value;

        uint depositorsLength = collateral.depositors.length;
        for (uint i; i < depositorsLength; ) {
            if (collateral.depositors[i] == address(0)) {
                uint amount = IGettersV2(address(this)).minCollateralToDeposit(term, i);

                require(ethSended >= amount, "Eth payment too low");

                collateral.collateralMembersBank[msg.sender] += ethSended;
                collateral.isCollateralMember[msg.sender] = true;
                collateral.depositors[i] = msg.sender;
                collateral.counterMembers++;
                collateral.collateralDepositByUser[msg.sender] += ethSended;

                termStorage.participantToTermId[msg.sender].push(_termId);

                emit OnCollateralDeposited(_termId, msg.sender, ethSended);

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
            emit OnTermFilled(_termId);
        }
    }

    function _startTerm(uint _termId) internal {
        LibTermV2.Term memory term = LibTermV2._termStorage().terms[_termId];
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[_termId];
        address[] memory depositors = collateral.depositors;

        uint depositorsArrayLength = depositors.length;

        require(
            block.timestamp > term.creationTime + term.registrationPeriod,
            "Term not ready to start"
        );

        require(collateral.counterMembers == term.totalParticipants, "All spots are not filled");

        // Need to check each user because they can have different collateral amounts
        for (uint i; i < depositorsArrayLength; ) {
            require(
                !ICollateralV2(address(this)).isUnderCollaterized(term.termId, depositors[i]),
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
            term.termId,
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
        newFund.currentState = LibFundV2.FundStates.InitializingFund;

        IFundV2(address(this)).initFund(_term.termId);
    }

    function _expireTerm(uint _termId) internal {
        LibTermV2.Term storage term = LibTermV2._termStorage().terms[_termId];
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[_termId];

        require(LibTermV2._termExists(_termId) && LibCollateralV2._collateralExists(_termId));

        require(
            block.timestamp > term.creationTime + term.registrationPeriod,
            "Registration period not ended"
        );

        require(
            collateral.counterMembers < term.totalParticipants,
            "All spots are filled, can't expire"
        );

        require(!term.expired, "Term already expired");

        uint depositorsArrayLength = collateral.depositors.length;

        for (uint i; i < depositorsArrayLength; ) {
            address depositor = collateral.depositors[i];

            if (depositor != address(0)) {
                uint amount = collateral.collateralMembersBank[depositor];

                collateral.collateralPaymentBank[depositor] += amount;
                collateral.collateralMembersBank[depositor] = 0;
                collateral.isCollateralMember[depositor] = false;
                collateral.depositors[i] = address(0);
                --collateral.counterMembers;
            }

            unchecked {
                ++i;
            }
        }

        term.expired = true;
        collateral.initialized = false;
        collateral.state = LibCollateralV2.CollateralStates.Closed;

        emit OnTermExpired(_termId);
    }

    function _createYieldGenerator(
        LibTermV2.Term memory _term,
        LibCollateralV2.Collateral storage _collateral
    ) internal {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[_term.termId];

        uint amountDeposited;

        address[] memory depositors = _collateral.depositors;
        uint depositorsArrayLength = depositors.length;

        for (uint i; i < depositorsArrayLength; ) {
            if (yield.hasOptedIn[depositors[i]]) {
                yield.yieldUsers.push(depositors[i]);
                amountDeposited += _collateral.collateralMembersBank[depositors[i]];
            }

            unchecked {
                ++i;
            }
        }

        yield.startTimeStamp = block.timestamp;
        yield.initialized = true;

        IYGFacetZaynFi(address(this)).depositYG(_term.termId, amountDeposited);
    }
}
