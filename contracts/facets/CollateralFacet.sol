// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.20;

import {IFund} from "../interfaces/IFund.sol";
import {ITerm} from "../interfaces/ITerm.sol";
import {ICollateral} from "../interfaces/ICollateral.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import {LibFund} from "../libraries/LibFund.sol";
import {LibTerm} from "../libraries/LibTerm.sol";
import {LibCollateral} from "../libraries/LibCollateral.sol";

/// @title Takaturn
/// @author Aisha El Allam
/// @notice This is used to operate the Takaturn fund
/// @dev v2.0 (post-deploy)
contract CollateralFacet is ICollateral {
    IFund private _fundInstance; // TODO: init here?
    ITerm private _termInstance; // TODO: init here?
    AggregatorV3Interface priceFeed;

    uint public constant COLLATERAL_VERSION = 2; // TODO: initialize this on diamond init?

    modifier atState(uint id, LibCollateral.CollateralStates _state) {
        LibCollateral.CollateralStates state = LibCollateral
            ._collateralStorage()
            .collaterals[id]
            .state;
        if (state != _state) revert FunctionInvalidAtThisState();
        _;
    }

    modifier onlyFundOwner(uint id) {
        LibTerm.Term storage term = LibTerm._termStorage().terms[id];
        require(term.owner == msg.sender);
        _;
    }

    // TODO: on the term facet?
    // function newCollateral(
    //     uint totalDepositors,
    //     uint cycleTime,
    //     uint contributionAmount,
    //     uint contributionPeriod,
    //     uint collateralAmount,
    //     uint fixedCollateralEth,
    //     address stableCoinAddress,
    //     address aggregatorAddress,
    //     address creator
    // ) external {
    //     _newCollateral(
    //         totalDepositors,
    //         cycleTime,
    //         contributionAmount,
    //         contributionPeriod,
    //         collateralAmount,
    //         fixedCollateralEth,
    //         stableCoinAddress,
    //         aggregatorAddress,
    //         creator
    //     );
    // }

    function setStateOwner(
        uint id,
        LibCollateral.CollateralStates newState
    ) external onlyFundOwner(id) {
        _setState(id, newState);
    }

    // TODO: Believe this function is not needed anymore
    /// @notice Called by the manager when the cons job goes off
    /// @dev consider making the duration a variable
    function initiateFund(
        uint id
    ) external onlyFundOwner(id) atState(id, LibCollateral.CollateralStates.AcceptingCollateral) {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[id];
        LibTerm.Term storage term = LibTerm._termStorage().terms[id];
        // TODO: I replace totalDepositors for totalParticipants from the term. Better totalDepositors on Collateral struct?
        //(collateral.counterMembers == collateral.totalDepositors);
        (collateral.counterMembers == term.totalParticipants);
        // If one user is under collaterized, then all are.
        require(!_isUnderCollaterized(id, collateral.depositors[0]), "Eth prices dropped");

        _termInstance.createTerm(
            term.totalParticipants,
            term.cycleTime,
            term.contributionAmount,
            term.contributionPeriod,
            term.fixedCollateralEth,
            term.stableTokenAddress,
            term.aggregatorAddress
        );

        _setState(id, LibCollateral.CollateralStates.CycleOngoing);
        //emit OnFundStarted(fundContract, address(this));
    }

    /// @notice Called by each member to enter the term
    // TODO: better internal?
    function depositCollateral(
        uint id
    ) external payable atState(id, LibCollateral.CollateralStates.AcceptingCollateral) {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[id];
        LibTerm.Term storage term = LibTerm._termStorage().terms[id];
        require(collateral.counterMembers < term.totalParticipants, "Members pending"); // TODO: this check is already on _joinTerm
        require(!collateral.isCollateralMember[msg.sender], "Reentry");
        require(msg.value >= term.fixedCollateralEth, "Eth payment too low");

        collateral.collateralMembersBank[msg.sender] += msg.value;
        collateral.isCollateralMember[msg.sender] = true;
        //collateral.depositors.push(msg.sender);
        //collaterall.counterMembers++;

        uint depositorsLength = collateral.depositors.length;
        for (uint i; i < depositorsLength; ) {
            if (collateral.depositors[i] == address(0)) {
                collateral.depositors[i] = msg.sender;
                emit LibCollateral.OnCollateralDeposited(id, msg.sender);
                if (collateral.counterMembers == 1) {
                    collateral.firstDepositTime = block.timestamp;
                }
                break;
            }
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Called from Fund contract when someone defaults
    /// @dev Check EnumerableMap (openzeppelin) for arrays that are being accessed from Fund contract
    /// @param beneficiary Address that was randomly selected for the current cycle
    /// @param defaulters Address that was randomly selected for the current cycle
    // TODO: Recheck this function, it was refactorized on internal functions because the stack was too deep and the EVM can not access variables
    function requestContribution(
        uint id,
        address beneficiary,
        address[] calldata defaulters
    ) external atState(id, LibCollateral.CollateralStates.CycleOngoing) returns (address[] memory) {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[id];
        LibTerm.Term storage term = LibTerm._termStorage().terms[id];

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

        emit LibCollateral.OnCollateralWithdrawn(id, msg.sender, amount);

        --collateral.counterMembers;
        // If last person withdraws, then change state to EOL
        if (collateral.counterMembers == 0) {
            _setState(id, LibCollateral.CollateralStates.Closed);
        }
    }

    // TODO: check this one
    function withdrawReimbursement(uint id, address depositor) external {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[id];
        require(!LibFund._fundExists(id), "Fund already exists");
        uint amount = collateral.collateralPaymentBank[depositor];
        require(amount > 0, "Nothing to claim");

        collateral.collateralPaymentBank[depositor] = 0;

        (bool success, ) = payable(depositor).call{value: amount}("");
        require(success);

        emit LibCollateral.OnReimbursementWithdrawn(id, depositor, amount);
    }

    function releaseCollateral(uint id) external {
        require(!LibFund._fundExists(id), "Fund already exists");
        _setState(id, LibCollateral.CollateralStates.ReleasingCollateral);
    }

    /// @notice Checks if a user has a collateral below 1.0x of total contribution amount
    /// @dev This will revert if called during ReleasingCollateral or after
    /// @param member The user to check for
    /// @return Bool check if member is below 1.0x of collateralDeposit
    function isUnderCollaterized(uint id, address member) external view returns (bool) {
        return _isUnderCollaterized(id, member);
    }

    /// @notice allow the owner to empty the Collateral after 180 days
    function emptyCollateralAfterEnd(
        uint id
    ) external onlyFundOwner(id) atState(id, LibCollateral.CollateralStates.ReleasingCollateral) {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[id];
        require(block.timestamp > (_fundInstance.fundEnd(id)) + 180 days, "Can't empty yet");

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

    function getCollateralSummary(
        uint id
    )
        external
        view
        returns (LibCollateral.CollateralStates, uint, uint, uint, uint, uint, uint, uint)
    {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[id];
        LibTerm.Term storage term = LibTerm._termStorage().terms[id];
        return (
            collateral.state, // Current state of Collateral
            term.cycleTime, // Cycle duration
            term.totalParticipants, // Total no. of depositors
            collateral.collateralDeposit, // Collateral
            term.contributionAmount, // Required contribution per cycle
            term.contributionPeriod, // Time to contribute
            collateral.counterMembers, // Current member count
            term.fixedCollateralEth // Fixed ether to deposit
        );
    }

    function getDepositorSummary(
        uint id,
        address depositor
    ) external view returns (uint, uint, bool) {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[id];
        return (
            collateral.collateralMembersBank[depositor],
            collateral.collateralPaymentBank[depositor],
            collateral.isCollateralMember[depositor]
        );
    }

    /// @notice Gets latest ETH / USD price
    /// @return uint latest price in Wei
    function getLatestPrice() public view returns (uint) {
        (, int price, , , ) = priceFeed.latestRoundData(); //8 decimals
        return uint(price * 10 ** 10); //18 decimals
    }

    /// @notice Gets the conversion rate of an amount in USD to ETH
    /// @dev should we always deal with in Wei?
    /// @return uint converted amount in wei
    function getToEthConversionRate(uint USDAmount) public view returns (uint) {
        uint ethPrice = getLatestPrice();
        uint USDAmountInEth = (USDAmount * 10 ** 18) / ethPrice; //* 10 ** 18;
        return USDAmountInEth;
    }

    /// @notice Gets the conversion rate of an amount in ETH to USD
    /// @dev should we always deal with in Wei?
    /// @return uint converted amount in USD correct to 18 decimals
    function getToUSDConversionRate(uint ethAmount) public view returns (uint) {
        // NOTE: This will be made internal
        uint ethPrice = getLatestPrice();
        uint ethAmountInUSD = (ethPrice * ethAmount) / 10 ** 18;
        return ethAmountInUSD;
    }

    // TODO: On the term facet?
    // /// @notice Constructor Function
    // /// @dev Network is Arbitrum One and Aggregator is ETH/USD
    // /// @param _totalDepositors Max number of depositors
    // /// @param _cycleTime Time for single cycle (seconds)
    // /// @param _contributionAmount Amount user must pay per cycle (USD)
    // /// @param _contributionPeriod The portion of cycle user must make payment
    // /// @param _collateralAmount Total value of collateral in USD (1.5x of total fund)
    // /// @param _creator owner of contract
    // function _newCollateral(
    //     uint _id,
    //     uint _totalDepositors,
    //     uint _cycleTime,
    //     uint _contributionAmount,
    //     uint _contributionPeriod,
    //     uint _collateralAmount,
    //     uint _fixedCollateralEth,
    //     address _stableCoinAddress,
    //     address _aggregatorAddress,
    //     address _creator
    // ) internal returns (uint) {
    //     require(
    //         _totalDepositors != 0 &&
    //             _cycleTime != 0 &&
    //             _contributionAmount != 0 &&
    //             _contributionPeriod != 0 &&
    //             _collateralAmount != 0 &&
    //             _fixedCollateralEth != 0,
    //         "Invalid inputs"
    //     );
    //     require(
    //         _stableCoinAddress != address(0x00) && _stableCoinAddress != address(this),
    //         "Invalid inputs"
    //     );
    //     require(
    //         _aggregatorAddress != address(0x00) && _aggregatorAddress != address(this),
    //         "Invalid inputs"
    //     );
    //     require(_creator != address(0x00) && _creator != address(this), "Invalid inputs");
    //     // ! Viene del constructor
    //     transferOwnership(_creator);

    //     CollateralData storage collateral = collateralById[termId];

    //     collateral.totalDepositors = _totalDepositors;
    //     collateral.counterMembers;
    //     collateral.cycleTime = _cycleTime;
    //     collateral.contributionAmount = _contributionAmount;
    //     collateral.contributionPeriod = _contributionPeriod;
    //     collateral.collateralDeposit = _collateralAmount * 10 ** 18; // Convert to Wei
    //     collateral.fixedCollateralEth = _fixedCollateralEth;
    //     collateral.firstDepositTime;
    //     collateral.stableCoinAddress = _stableCoinAddress;
    //     collateral.currentCollateralState = CollateralStates.AcceptingCollateral;

    //     collateral.depositors = new address[](_totalDepositors);

    //     priceFeed = AggregatorV3Interface(_aggregatorAddress); // TODO: Where to initialize

    //     // ! Hasta aqui viene del constructor
    //     ++termId;
    //     return termId;
    // }

    function _setState(uint _id, LibCollateral.CollateralStates _newState) internal {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[_id];
        LibCollateral.CollateralStates oldState = collateral.state;
        collateral.state = _newState;
        emit LibCollateral.OnStateChanged(_id, oldState, _newState);
    }

    /// @notice Checks if a user has a collateral below 1.0x of total contribution amount
    /// @dev This will revert if called during ReleasingCollateral or after
    /// @param _member The user to check for
    /// @return Bool check if member is below 1.0x of collateralDeposit
    function _isUnderCollaterized(uint _id, address _member) internal view returns (bool) {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[_id];
        LibTerm.Term storage term = LibTerm._termStorage().terms[_id];
        uint collateralLimit;
        uint memberCollateralUSD;
        if (LibFund._fundExists(_id)) {
            collateralLimit = term.totalParticipants * term.contributionAmount * 10 ** 18;
        } else {
            uint remainingCycles = 1 + collateral.counterMembers - _fundInstance.currentCycle(_id); // TODO: check this call later. 02/07/2023 12:31

            collateralLimit = remainingCycles * term.contributionAmount * 10 ** 18; // Convert to Wei
        }

        memberCollateralUSD = getToUSDConversionRate(collateral.collateralMembersBank[_member]);

        return (memberCollateralUSD < collateralLimit);
    }

    function _whoExpelled(
        LibCollateral.Collateral storage _collateral,
        LibTerm.Term storage _term,
        address _beneficiary,
        address[] calldata _defaulters
    ) internal returns (uint, address[] memory) {
        require(_defaulters.length > 0, "No defaulters");

        bool wasBeneficiary;
        uint8 totalExpellants;
        address[] memory expellants = new address[](_defaulters.length);
        uint share;
        uint currentDefaulterBank;
        uint contributionAmountWei = getToEthConversionRate(_term.contributionAmount * 10 ** 18);

        // Determine who will be expelled and who will just pay the contribution
        // From their collateral.
        for (uint i; i < _defaulters.length; ) {
            wasBeneficiary = _fundInstance.isBeneficiary(_term.termId, _defaulters[i]);
            currentDefaulterBank = _collateral.collateralMembersBank[_defaulters[i]];

            if (_defaulters[i] == _beneficiary) continue; // Avoid expelling graced defaulter

            if (
                (wasBeneficiary && _isUnderCollaterized(_term.termId, _defaulters[i])) ||
                (currentDefaulterBank < contributionAmountWei)
            ) {
                _collateral.isCollateralMember[_defaulters[i]] = false; // Expelled!
                expellants[i] = _defaulters[i];
                share += currentDefaulterBank;
                _collateral.collateralMembersBank[_defaulters[i]] = 0;
                totalExpellants++;

                emit LibCollateral.OnCollateralLiquidated(
                    _term.termId,
                    address(_defaulters[i]),
                    currentDefaulterBank
                );
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

    function _liquidateCollateral(
        LibCollateral.Collateral storage _collateral,
        LibTerm.Term storage _term
    ) internal view returns (uint, address[] memory) {
        address currentDepositor;
        address[] memory nonBeneficiaries = new address[](_collateral.depositors.length);

        uint nonBeneficiaryCounter;

        // Divide and Liquidate
        uint depositorsLength = _collateral.depositors.length;
        for (uint i; i < depositorsLength; ) {
            currentDepositor = _collateral.depositors[i];
            if (
                !_fundInstance.isBeneficiary(_term.termId, currentDepositor) &&
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
