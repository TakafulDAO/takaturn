// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IFund} from "../interfaces/IFund.sol";
import {ICollateral} from "../interfaces/ICollateral.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ITerm} from "../interfaces/ITerm.sol";
import {IGetters} from "../interfaces/IGetters.sol";
import {IYGFacetZaynFi} from "../interfaces/IYGFacetZaynFi.sol";

import {LibFundStorage} from "../libraries/LibFundStorage.sol";
import {LibFund} from "../libraries/LibFund.sol";
import {LibTermStorage} from "../libraries/LibTermStorage.sol";
import {LibCollateral} from "../libraries/LibCollateral.sol";
import {LibCollateralStorage} from "../libraries/LibCollateralStorage.sol";
import {LibYieldGenerationStorage} from "../libraries/LibYieldGenerationStorage.sol";
import {LibYieldGeneration} from "../libraries/LibYieldGeneration.sol";

/// @title Takaturn Term Facet
/// @author Mohammed Haddouti
/// @notice This is used to create terms
/// @dev v3.0 (Diamond)
contract TermFacet is ITerm {
    event OnTermCreated(uint indexed termId, address indexed termOwner); // Emits when a new term is created
    event OnCollateralDeposited(
        uint indexed termId,
        address payer,
        address indexed user,
        uint amount
    ); // TODO: To be deprecated, here to ensure backwards compatibility with the old event
    event OnCollateralDepositedNext(
        uint indexed termId,
        address payer,
        address indexed user,
        uint amount,
        uint indexed position
    ); // Emits when a user joins a term // Todo: To be renamed to OnCollateralDeposited
    event OnTermFilled(uint indexed termId); // Emits when all the spots are filled
    event OnTermExpired(uint indexed termId); // Emits when a term expires
    event OnTermStart(uint indexed termId); // Emits when a new term starts, this also marks the start of the first cycle

    /// @notice Create a new term
    /// @param totalParticipants The number of participants in the term
    /// @param registrationPeriod The time in seconds that the term will be open for registration
    /// @param cycleTime The time in seconds that the term will last
    /// @param contributionAmount The amount of stable token that each participant will have to contribute
    /// @param contributionPeriod The time in seconds that the participants will have to contribute
    /// @param stableTokenAddress The address of the stable token
    /// @return termId The id of the new term
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

    /// @notice Join a term at the next available position
    /// @param termId The id of the term
    /// @param optYield Whether the participant wants to opt in for yield generation
    function joinTerm(uint termId, bool optYield) external payable {
        _joinTerm(termId, optYield, msg.sender);
    }

    /// @notice Join a term at a specific position
    /// @param termId The id of the term
    /// @param optYield Whether the participant wants to opt in for yield generation
    /// @param position The position in the term
    // TODO: To be renamed to joinTerm, this name only to ensure backwards compatibility
    function joinTermOnPosition(uint termId, bool optYield, uint position) external payable {
        _joinTermByPosition(termId, optYield, position, msg.sender);
    }

    /// @notice Pay security deposit on behalf of someone else, at the next available position
    /// @param termId The id of the term
    /// @param optYield Whether the participant wants to opt in for yield generation
    /// @param newParticipant The address of the new participant
    function paySecurityOnBehalfOf(
        uint termId,
        bool optYield,
        address newParticipant
    ) external payable {
        _joinTerm(termId, optYield, newParticipant);
    }

    /// @notice Pay security deposit on behalf of someone else, at a specific position
    /// @param termId The id of the term
    /// @param optYield Whether the participant wants to opt in for yield generation
    /// @param newParticipant The address of the new participant
    /// @param position The position in the term
    function paySecurityOnBehalfOf(
        uint termId,
        bool optYield,
        address newParticipant,
        uint position
    ) external payable {
        _joinTermByPosition(termId, optYield, position, newParticipant);
    }

    /// @notice Start a term
    /// @param termId The id of the term
    function startTerm(uint termId) external {
        _startTerm(termId);
    }

    /// @notice Expire a term
    /// @param termId The id of the term
    function expireTerm(uint termId) external {
        _expireTerm(termId);
    }

    /// @dev Revert if the cycle time is 0
    /// @dev Revert if the contribution amount is 0
    /// @dev Revert if the contribution period is 0
    /// @dev Revert if the total participants is 0
    /// @dev Revert if the registration period is 0
    /// @dev Revert if the contribution period is greater than the cycle time
    /// @dev Revert if the stable token address is 0
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
            "TT-TF-01"
        );

        LibTermStorage.TermStorage storage termStorage = LibTermStorage._termStorage();
        uint termId = termStorage.nextTermId;

        LibTermStorage.Term memory newTerm;

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
        newTerm.state = LibTermStorage.TermStates.InitializingTerm;

        termStorage.terms[termId] = newTerm;
        termStorage.nextTermId++;

        _createCollateral(termId, _totalParticipants);

        emit OnTermCreated(termId, msg.sender);

        return termId;
    }

    /// @dev Revert if the term doesn't exist
    /// @dev Revert if the collateral is not accepting collateral
    /// @dev Revert if the collateral is full
    /// @dev Revert if the new participant is already a collateral member
    function _joinTerm(uint _termId, bool _optYield, address _newParticipant) internal {
        LibTermStorage.TermStorage storage termStorage = LibTermStorage._termStorage();
        LibTermStorage.Term memory term = termStorage.terms[_termId];
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[_termId];

        require(LibTermStorage._termExists(_termId), "TT-TF-02");

        require(
            collateral.state == LibCollateralStorage.CollateralStates.AcceptingCollateral,
            "TT-TF-03"
        );

        require(collateral.counterMembers < term.totalParticipants, "TT-TF-04");

        require(!collateral.isCollateralMember[_newParticipant], "TT-TF-05");

        uint memberIndex;

        for (uint i; i < term.totalParticipants; ) {
            if (collateral.depositors[i] == address(0)) {
                memberIndex = i;
                break;
            }

            /// @custom:unchecked-block without risk, i can't be higher than term total participants
            unchecked {
                ++i;
            }
        }

        _joinTermByPosition(_termId, _optYield, memberIndex, _newParticipant);
    }

    /// @dev Revert if the term doesn't exist
    /// @dev Revert if the collateral is not accepting collateral
    /// @dev Revert if the collateral is full
    /// @dev Revert if the new participant is already a collateral member
    /// @dev Revert if the position is higher than the total participants
    /// @dev Revert if the position is already taken
    /// @dev Revert if the msg.value is lower than the min amount
    function _joinTermByPosition(
        uint _termId,
        bool _optYield,
        uint _position,
        address _newParticipant
    ) internal {
        LibTermStorage.TermStorage storage termStorage = LibTermStorage._termStorage();
        LibTermStorage.Term memory term = termStorage.terms[_termId];
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[_termId];
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[_termId];

        require(LibTermStorage._termExists(_termId), "TT-TF-02");

        require(
            collateral.state == LibCollateralStorage.CollateralStates.AcceptingCollateral,
            "TT-TF-03"
        );

        require(collateral.counterMembers < term.totalParticipants, "TT-TF-04");

        require(!collateral.isCollateralMember[_newParticipant], "TT-TF-05");

        require(_position <= term.totalParticipants - 1, "TT-TF-06");

        require(collateral.depositors[_position] == address(0), "TT-TF-07");

        uint minAmount = IGetters(address(this)).minCollateralToDeposit(_termId, _position);
        require(msg.value >= minAmount, "TT-TF-08");

        collateral.collateralMembersBank[_newParticipant] += msg.value;
        collateral.isCollateralMember[_newParticipant] = true;
        collateral.depositors[_position] = _newParticipant;
        collateral.counterMembers++;
        collateral.collateralDepositByUser[_newParticipant] += msg.value;

        termStorage.participantToTermId[_newParticipant].push(_termId);

        // If the lock is false, I accept the opt in
        if (!LibYieldGenerationStorage._yieldLock().yieldLock) {
            yield.hasOptedIn[_newParticipant] = _optYield;
        } else {
            // If the lock is true, opt in is always false
            yield.hasOptedIn[_newParticipant] = false;
        }

        // TODO: Emit both events to ensure backwards compatibility
        emit OnCollateralDeposited(_termId, msg.sender, _newParticipant, msg.value);
        emit OnCollateralDepositedNext(_termId, msg.sender, _newParticipant, msg.value, _position);

        if (collateral.counterMembers == 1) {
            collateral.firstDepositTime = block.timestamp;
        }

        // If all the spots are filled, change the collateral
        if (collateral.counterMembers == term.totalParticipants) {
            emit OnTermFilled(_termId);
        }
    }

    /// @dev Revert if the term doesn't exist
    /// @dev Revert if the term is not ready to start
    /// @dev Revert if the term is already active
    /// @dev Revert if someone is undercollaterized
    function _startTerm(uint _termId) internal {
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[_termId];
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[_termId];
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[_termId];
        address[] memory depositors = collateral.depositors;

        uint depositorsArrayLength = depositors.length;

        require(
            block.timestamp > collateral.firstDepositTime + term.registrationPeriod,
            "TT-TF-09"
        );

        require(collateral.counterMembers == term.totalParticipants, "TT-TF-10");

        // Need to check each user because they can have different collateral amounts
        for (uint i; i < depositorsArrayLength; ) {
            require(!LibCollateral._isUnderCollaterized(term.termId, depositors[i]), "TT-TF-11");

            /// @custom:unchecked-block without risk, i can't be higher than depositors length
            unchecked {
                ++i;
            }
        }

        // Actually create and initialize the fund
        _createFund(term, collateral);

        // If the lock is false
        if (!LibYieldGenerationStorage._yieldLock().yieldLock) {
            // Check on each depositor if they opted in for yield generation
            for (uint i; i < depositorsArrayLength; ) {
                if (yield.hasOptedIn[depositors[i]]) {
                    // If someone opted in, create the yield generator
                    _createYieldGenerator(term, collateral);
                    break;
                }

                /// @custom:unchecked-block without risk, i can't be higher than depositors length
                unchecked {
                    ++i;
                }
            }
        } else {
            // If the lock is set to true, before the term starts and after users have joined term
            // There is a chance that somebody has opted in for yield generation
            for (uint i; i < depositorsArrayLength; ) {
                if (yield.hasOptedIn[depositors[i]]) {
                    yield.hasOptedIn[depositors[i]] = false;
                }

                /// @custom:unchecked-block without risk, i can't be higher than depositors length
                unchecked {
                    ++i;
                }
            }
        }

        // Tell the collateral that the term has started
        LibCollateral._setState(term.termId, LibCollateralStorage.CollateralStates.CycleOngoing);

        term.state = LibTermStorage.TermStates.ActiveTerm;
    }

    /// @notice Create a new collateral
    /// @param _termId The id of the term
    /// @param _totalParticipants The number of participants in the term
    function _createCollateral(uint _termId, uint _totalParticipants) internal {
        LibCollateralStorage.Collateral storage newCollateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[_termId];

        newCollateral.initialized = true;
        newCollateral.state = LibCollateralStorage.CollateralStates.AcceptingCollateral;
        newCollateral.depositors = new address[](_totalParticipants);
    }

    /// @notice Create a new fund
    /// @dev Revert if the fund already exists
    /// @param _term The term
    /// @param _collateral The collateral object
    function _createFund(
        LibTermStorage.Term memory _term,
        LibCollateralStorage.Collateral storage _collateral
    ) internal {
        require(!LibFundStorage._fundExists(_term.termId), "TT-TF-12");
        LibFundStorage.Fund storage newFund = LibFundStorage._fundStorage().funds[_term.termId];

        newFund.stableToken = IERC20(_term.stableTokenAddress);
        newFund.beneficiariesOrder = _collateral.depositors;
        newFund.initialized = true;
        newFund.totalAmountOfCycles = newFund.beneficiariesOrder.length;
        newFund.currentState = LibFundStorage.FundStates.InitializingFund;

        LibFund._initFund(_term.termId);
    }

    /// @dev Revert if the term or collateral doesn't exist
    /// @dev Revert if registration period is not ended
    /// @dev Revert if all spots are filled
    /// @dev Revert if the term is already expired
    function _expireTerm(uint _termId) internal {
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[_termId];
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[_termId];

        require(
            LibTermStorage._termExists(_termId) && LibCollateralStorage._collateralExists(_termId)
        );

        require(
            collateral.firstDepositTime != 0 &&
                block.timestamp > collateral.firstDepositTime + term.registrationPeriod,
            "TT-TF-13"
        );

        require(collateral.counterMembers < term.totalParticipants, "TT-TF-14");

        require(term.state != LibTermStorage.TermStates.ExpiredTerm, "TT-TF-15");

        term.state = LibTermStorage.TermStates.ExpiredTerm;
        collateral.state = LibCollateralStorage.CollateralStates.ReleasingCollateral;

        emit OnTermExpired(_termId);
    }

    /// @notice Create a new yield generator
    /// @param _term The term object
    /// @param _collateral The collateral object
    function _createYieldGenerator(
        LibTermStorage.Term memory _term,
        LibCollateralStorage.Collateral storage _collateral
    ) internal {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[_term.termId];
        LibYieldGenerationStorage.YieldProviders storage yieldProviders = LibYieldGenerationStorage
            ._yieldProviders();

        uint amountToYield;

        address[] memory depositors = _collateral.depositors;
        uint depositorsArrayLength = depositors.length;

        for (uint i; i < depositorsArrayLength; ) {
            if (yield.hasOptedIn[depositors[i]]) {
                yield.yieldUsers.push(depositors[i]);
                yield.depositedCollateralByUser[depositors[i]] =
                    (_collateral.collateralMembersBank[depositors[i]] * 95) /
                    100;
                amountToYield += yield.depositedCollateralByUser[depositors[i]];
            }

            /// @custom:unchecked-block without risk, i can't be higher than depositors length
            unchecked {
                ++i;
            }
        }

        if (amountToYield > 0) {
            yield.startTimeStamp = block.timestamp;
            yield.initialized = true;
            yield.providerAddresses["ZaynZap"] = yieldProviders.providerAddresses["ZaynZap"];
            yield.providerAddresses["ZaynVault"] = yieldProviders.providerAddresses["ZaynVault"];

            LibYieldGeneration._depositYG(_term.termId, amountToYield);
        }
    }
}
