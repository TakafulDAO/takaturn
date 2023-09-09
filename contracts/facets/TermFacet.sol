// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IFund} from "../interfaces/IFund.sol";
import {ICollateral} from "../interfaces/ICollateral.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ITerm} from "../interfaces/ITerm.sol";
import {IGetters} from "../interfaces/IGetters.sol";
import {IYGFacetZaynFi} from "../interfaces/IYGFacetZaynFi.sol";

import {LibFund} from "../libraries/LibFund.sol";
import {LibTerm} from "../libraries/LibTerm.sol";
import {LibCollateral} from "../libraries/LibCollateral.sol";
import {LibYieldGeneration} from "../libraries/LibYieldGeneration.sol";

/// @title Takaturn Term
/// @author Mohammed Haddouti
/// @notice This is used to deploy the collateral & fund contracts
/// @dev v3.0 (Diamond)
contract TermFacet is ITerm {
    uint public constant TERM_VERSION = 2;

    event OnTermCreated(uint indexed termId, address indexed termOwner);
    event OnCollateralDeposited(uint indexed termId, address indexed user, uint amount);
    event OnTermFilled(uint indexed termId);
    event OnTermExpired(uint indexed termId);

    function createTerm(
        uint totalParticipants,
        uint registrationPeriod,
        uint cycleTime,
        uint contributionAmount, // in stable token, without decimals
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

    function joinTerm(uint termId, bool optYield) external payable {
        _joinTerm(termId, optYield);
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

        LibTerm.TermStorage storage termStorage = LibTerm._termStorage();
        uint termId = termStorage.nextTermId;

        //require(!termStorage.terms[termId].initialized, "Term already exists");

        LibTerm.Term memory newTerm;

        newTerm.termId = termId;
        newTerm.totalParticipants = _totalParticipants;
        newTerm.registrationPeriod = _registrationPeriod;
        newTerm.cycleTime = _cycleTime;
        newTerm.contributionAmount = _contributionAmount; // stored without decimals
        newTerm.contributionPeriod = _contributionPeriod;
        newTerm.stableTokenAddress = _stableTokenAddress;
        newTerm.termOwner = msg.sender;
        newTerm.creationTime = block.timestamp;
        newTerm.initialized = true;
        newTerm.state = LibTerm.TermStates.InitializingTerm;

        termStorage.terms[termId] = newTerm;
        termStorage.nextTermId++;

        _createCollateral(termId, _totalParticipants);

        emit OnTermCreated(termId, msg.sender);

        return termId;
    }

    function _joinTerm(uint _termId, bool _optYield) internal {
        LibTerm.TermStorage storage termStorage = LibTerm._termStorage();
        LibTerm.Term memory term = termStorage.terms[_termId];
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[_termId];

        require(LibTerm._termExists(_termId) && LibCollateral._collateralExists(_termId));

        require(collateral.state == LibCollateral.CollateralStates.AcceptingCollateral, "Closed");

        require(collateral.counterMembers < term.totalParticipants, "No space");

        require(
            block.timestamp <= term.creationTime + term.registrationPeriod,
            "Registration period ended"
        );

        require(!collateral.isCollateralMember[msg.sender], "Reentry");

        uint memberIndex = collateral.counterMembers;

        uint minAmount = IGetters(address(this)).minCollateralToDeposit(_termId, memberIndex);
        require(msg.value >= minAmount, "Eth payment too low");

        collateral.collateralMembersBank[msg.sender] += msg.value;
        collateral.isCollateralMember[msg.sender] = true;
        collateral.depositors[memberIndex] = msg.sender;
        collateral.counterMembers++;
        collateral.collateralDepositByUser[msg.sender] += msg.value;

        termStorage.participantToTermId[msg.sender].push(_termId);

        emit OnCollateralDeposited(_termId, msg.sender, msg.value);

        if (collateral.counterMembers == 1) {
            collateral.firstDepositTime = block.timestamp;
        }

        // If all the spots are filled, change the collateral
        if (collateral.counterMembers == term.totalParticipants) {
            emit OnTermFilled(_termId);
        }

        IYGFacetZaynFi(address(this)).toggleOptInYG(_termId, _optYield);
    }

    function _startTerm(uint _termId) internal {
        LibTerm.Term memory term = LibTerm._termStorage().terms[_termId];
        LibCollateral.Collateral storage collateral = LibCollateral
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
                !ICollateral(address(this)).isUnderCollaterized(term.termId, depositors[i]),
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
        ICollateral(address(this)).setStateOwner(
            term.termId,
            LibCollateral.CollateralStates.CycleOngoing
        );

        term.state = LibTerm.TermStates.ActiveTerm;
    }

    function _createCollateral(uint _termId, uint _totalParticipants) internal {
        //require(!LibCollateral._collateralExists(termId), "Collateral already exists");
        LibCollateral.Collateral storage newCollateral = LibCollateral
            ._collateralStorage()
            .collaterals[_termId];

        newCollateral.initialized = true;
        newCollateral.state = LibCollateral.CollateralStates.AcceptingCollateral;
        newCollateral.depositors = new address[](_totalParticipants);
    }

    function _createFund(
        LibTerm.Term memory _term,
        LibCollateral.Collateral storage _collateral
    ) internal {
        require(!LibFund._fundExists(_term.termId), "Fund already exists");
        LibFund.Fund storage newFund = LibFund._fundStorage().funds[_term.termId];

        newFund.stableToken = IERC20(_term.stableTokenAddress);
        newFund.beneficiariesOrder = _collateral.depositors;
        newFund.initialized = true;
        newFund.totalAmountOfCycles = newFund.beneficiariesOrder.length;
        newFund.currentState = LibFund.FundStates.InitializingFund;

        IFund(address(this)).initFund(_term.termId);
    }

    function _expireTerm(uint _termId) internal {
        LibTerm.Term storage term = LibTerm._termStorage().terms[_termId];
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[_termId];

        require(LibTerm._termExists(_termId) && LibCollateral._collateralExists(_termId));

        require(
            block.timestamp > term.creationTime + term.registrationPeriod,
            "Registration period not ended"
        );

        require(
            collateral.counterMembers < term.totalParticipants,
            "All spots are filled, can't expire"
        );

        require(term.state != LibTerm.TermStates.ExpiredTerm, "Term already expired");

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

        term.state = LibTerm.TermStates.ExpiredTerm;
        collateral.initialized = false;
        collateral.state = LibCollateral.CollateralStates.Closed;

        emit OnTermExpired(_termId);
    }

    function _createYieldGenerator(
        LibTerm.Term memory _term,
        LibCollateral.Collateral storage _collateral
    ) internal {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[_term.termId];
        LibYieldGeneration.YieldProviders storage yieldProviders = LibYieldGeneration
            ._yieldProviders();

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

        if (amountDeposited > 0) {
            yield.startTimeStamp = block.timestamp;
            yield.initialized = true;
            yield.providerAddresses["ZaynZap"] = yieldProviders.providerAddresses["ZaynZap"];
            yield.providerAddresses["ZaynVault"] = yieldProviders.providerAddresses["ZaynVault"];

            IYGFacetZaynFi(address(this)).depositYG(_term.termId, amountDeposited);
        }
    }
}
