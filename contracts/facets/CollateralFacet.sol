// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import {ITakaturnFactory} from "../interfaces/ITakaturnFactory.sol"; // TODO: remove?
import {ICollateral} from "../interfaces/ICollateral.sol";
import {IFund} from "../interfaces/IFund.sol";

import {LibCollateral} from "../libraries/LibCollateral.sol";

/// @title Takaturn
/// @author Aisha El Allam
/// @notice This is used to operate the Takaturn fund
/// @dev v2.0 (post-deploy)
contract CollateralFacet is ICollateral, Ownable {
    IFund private _fundInstance; // ? How to correctly initialize interfaces on facets?
    AggregatorV3Interface public immutable priceFeed;

    // Current state.
    States public state = States.AcceptingCollateral; // ? Can be set here? or on the DiamondInit contract?
    // uint public creationTime = block.timestamp; // ? Needed if there is no factory?
    modifier atState(States _state) {
        if (state != _state) revert FunctionInvalidAtThisState();
        _;
    }

    // ! Can not initialize storage variables on facets. Review what is needed to initialize and move it
    // ! to the DiamondInit.sol contract
    /// @notice Constructor Function
    /// @dev Network is Arbitrum One and Aggregator is ETH/USD
    /// @param _creator owner of contract
    constructor(address _aggregatorAddress, address _creator) {
        transferOwnership(_creator); // ? Nedded?
        priceFeed = AggregatorV3Interface(_aggregatorAddress);
    }

    function setStateOwner(States newState) external onlyOwner {
        _setState(newState);
    }

    // TODO: This now has to create a new fund and store on a mapping? with an id? an array and remove it when finished?
    /// @notice Called by the manager when the cons job goes off
    /// @dev consider making the duration a variable
    function initiateFundContract() external onlyOwner atState(States.AcceptingCollateral) {
        require(LibCollateral._turnGroupData().fundContract == address(0));
        require(
            LibCollateral._turnSpecs().counterMembers ==
                LibCollateral._turnSpecs().totalParticipants
        );
        // If one user is under collaterized, then all are.
        require(
            !_isUnderCollaterized(LibCollateral._turnGroupData().participants[0]),
            "Eth prices dropped"
        );

        // TODO: remove
        LibCollateral._turnGroupData().fundContract = ITakaturnFactory(
            LibCollateral._turnGroupData().factoryContract
        ).createFund(
                LibCollateral._turnGroupData().stableCoinAddress,
                LibCollateral._turnGroupData().participants,
                LibCollateral._turnSpecs().cycleTime,
                LibCollateral._turnSpecs().contributionAmount,
                LibCollateral._turnSpecs().contributionPeriod
            );

        // TODO: check for success before initiating instance
        _fundInstance = IFund(LibCollateral._turnGroupData().fundContract);
        _setState(States.CycleOngoing);
        emit OnFundContractDeployed(LibCollateral._turnGroupData().fundContract, address(this));
    }

    /// @notice Called by each member to enter the term
    function depositCollateral() external payable atState(States.AcceptingCollateral) {
        require(
            LibCollateral._turnSpecs().counterMembers <
                LibCollateral._turnSpecs().totalParticipants,
            "Members pending"
        );
        require(!LibCollateral._collateralMappings().isCollateralMember[msg.sender], "Reentry");
        require(msg.value >= LibCollateral._turnSpecs().fixedCollateralEth, "Eth payment too low");

        LibCollateral._collateralMappings().collateralMembersBank[msg.sender] += msg.value;
        LibCollateral._collateralMappings().isCollateralMember[msg.sender] = true;
        LibCollateral._turnGroupData().participants.push(msg.sender);
        LibCollateral._turnSpecs().counterMembers++;

        emit OnCollateralDeposited(msg.sender);

        if (LibCollateral._turnSpecs().counterMembers == 1) {
            LibCollateral._turnSpecs().firstDepositTime = block.timestamp;
        }
    }

    /// @notice Called from Fund contract when someone defaults
    /// @dev Check EnumerableMap (openzeppelin) for arrays that are being accessed from Fund contract
    /// @param beneficiary Address that was randomly selected for the current cycle
    /// @param defaulters Address that was randomly selected for the current cycle
    function requestContribution(
        address beneficiary,
        address[] calldata defaulters
    ) external atState(States.CycleOngoing) returns (address[] memory) {
        require(LibCollateral._turnGroupData().fundContract == msg.sender, "Wrong caller");
        require(defaulters.length > 0, "No defaulters");

        address ben = beneficiary;
        bool wasBeneficiary = false;
        address currentDefaulter;
        address currentParticipant;
        address[] memory nonBeneficiaries = new address[](
            LibCollateral._turnGroupData().participants.length
        );
        address[] memory expellants = new address[](defaulters.length);

        uint totalExpellants;
        uint nonBeneficiaryCounter;
        uint share;
        uint currentDefaulterBank;

        uint contributionAmountWei = _getToEthConversionRate(
            LibCollateral._turnSpecs().contributionAmount * 10 ** 18
        );

        // Determine who will be expelled and who will just pay the contribution
        // From their collateral.
        for (uint i = 0; i < defaulters.length; i++) {
            currentDefaulter = defaulters[i];
            wasBeneficiary = _fundInstance.isBeneficiary(currentDefaulter);
            currentDefaulterBank = LibCollateral._collateralMappings().collateralMembersBank[
                currentDefaulter
            ];

            if (currentDefaulter == ben) continue; // Avoid expelling graced defaulter

            if (
                (wasBeneficiary && _isUnderCollaterized(currentDefaulter)) ||
                (currentDefaulterBank < contributionAmountWei)
            ) {
                LibCollateral._collateralMappings().isCollateralMember[currentDefaulter] = false; // Expelled!
                expellants[i] = currentDefaulter;
                share += currentDefaulterBank;
                LibCollateral._collateralMappings().collateralMembersBank[currentDefaulter] = 0;
                totalExpellants++;

                emit OnCollateralLiquidated(address(currentDefaulter), currentDefaulterBank);
            } else {
                // Subtract contribution from defaulter and add to beneficiary.
                LibCollateral._collateralMappings().collateralMembersBank[
                    currentDefaulter
                ] -= contributionAmountWei;
                LibCollateral._collateralMappings().collateralPaymentBank[
                    ben
                ] += contributionAmountWei;
            }
        }

        LibCollateral._turnSpecs().totalParticipants =
            LibCollateral._turnSpecs().totalParticipants -
            totalExpellants;

        // Divide and Liquidate
        for (uint i = 0; i < LibCollateral._turnGroupData().participants.length; i++) {
            currentParticipant = LibCollateral._turnGroupData().participants[i];
            if (
                !_fundInstance.isBeneficiary(currentParticipant) &&
                LibCollateral._collateralMappings().isCollateralMember[currentParticipant]
            ) {
                nonBeneficiaries[nonBeneficiaryCounter] = currentParticipant;
                nonBeneficiaryCounter++;
            }
        }

        // Finally, divide the share equally among non-beneficiaries
        if (nonBeneficiaryCounter > 0) {
            // This case can only happen when what?
            share = share / nonBeneficiaryCounter;
            for (uint i = 0; i < nonBeneficiaryCounter; i++) {
                LibCollateral._collateralMappings().collateralPaymentBank[
                    nonBeneficiaries[i]
                ] += share;
            }
        }

        return (expellants);
    }

    /// @notice Called by each member after the end of the cycle to withraw collateral
    /// @dev This follows the pull-over-push pattern.
    function withdrawCollateral() external atState(States.ReleasingCollateral) {
        uint amount = LibCollateral._collateralMappings().collateralMembersBank[msg.sender] +
            LibCollateral._collateralMappings().collateralPaymentBank[msg.sender];
        require(amount > 0, "Nothing to claim");

        LibCollateral._collateralMappings().collateralMembersBank[msg.sender] = 0;
        LibCollateral._collateralMappings().collateralPaymentBank[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success);

        emit OnCollateralWithdrawn(msg.sender, amount);

        --LibCollateral._turnSpecs().counterMembers;
        // If last person withdraws, then change state to EOL
        if (LibCollateral._turnSpecs().counterMembers == 0) {
            _setState(States.Closed);
        }
    }

    function withdrawReimbursement(address participant) external {
        require(
            address(LibCollateral._turnGroupData().fundContract) == address(msg.sender),
            "Wrong caller"
        );
        uint amount = LibCollateral._collateralMappings().collateralPaymentBank[participant];
        require(amount > 0, "Nothing to claim");
        LibCollateral._collateralMappings().collateralPaymentBank[participant] = 0;

        (bool success, ) = payable(participant).call{value: amount}("");
        require(success);

        emit OnReimbursementWithdrawn(participant, amount);
    }

    function releaseCollateral() external {
        require(
            address(LibCollateral._turnGroupData().fundContract) == address(msg.sender),
            "Wrong caller"
        );
        _setState(States.ReleasingCollateral);
    }

    /// @notice Checks if a user has a collateral below 1.0x of total contribution amount
    /// @dev This will revert if called during ReleasingCollateral or after
    /// @param member The user to check for
    /// @return Bool check if member is below 1.0x of collateralDeposit
    function isUnderCollaterized(address member) external view returns (bool) {
        return _isUnderCollaterized(member);
    }

    /// @notice allow the owner to empty the Collateral after 180 days
    function emptyCollateralAfterEnd() external onlyOwner atState(States.ReleasingCollateral) {
        require(block.timestamp > (_fundInstance.fundEnd()) + 180 days, "Can't empty yet");

        for (uint i = 0; i < LibCollateral._turnGroupData().participants.length; i++) {
            address participant = LibCollateral._turnGroupData().participants[i];
            LibCollateral._collateralMappings().collateralMembersBank[participant] = 0;
            LibCollateral._collateralMappings().collateralPaymentBank[participant] = 0;
        }
        _setState(States.Closed);

        (bool success, ) = payable(msg.sender).call{value: address(this).balance}("");
        require(success);
    }

    function getCollateralSummary()
        external
        view
        returns (States, uint, uint, uint, uint, uint, uint, uint)
    {
        return (
            state, // Current state of Collateral
            LibCollateral._turnSpecs().cycleTime, // Cycle duration
            LibCollateral._turnSpecs().totalParticipants, // Total no. of participants
            LibCollateral._turnSpecs().collateralDeposit, // Collateral
            LibCollateral._turnSpecs().contributionAmount, // Required contribution per cycle
            LibCollateral._turnSpecs().contributionPeriod, // Time to contribute
            LibCollateral._turnSpecs().counterMembers, // Current member count
            LibCollateral._turnSpecs().fixedCollateralEth // Fixed ether to deposit
        );
    }

    function getParticipantSummary(address participant) external view returns (uint, uint, bool) {
        return (
            LibCollateral._collateralMappings().collateralMembersBank[participant],
            LibCollateral._collateralMappings().collateralPaymentBank[participant],
            LibCollateral._collateralMappings().isCollateralMember[participant]
        );
    }

    /// @notice Gets latest ETH / USD price
    /// @return uint latest price in Wei
    function getLatestPrice() public view returns (uint) {
        (, int price, , , ) = priceFeed.latestRoundData(); //8 decimals
        return uint(price * 10 ** 10); //18 decimals
    }

    function _setState(States newState) internal {
        States oldState = state;
        state = newState;
        emit OnStateChanged(oldState, newState);
    }

    /// @notice Gets the conversion rate of an amount in USD to ETH
    /// @dev should we always deal with in Wei?
    /// @return uint converted amount in wei
    function _getToEthConversionRate(uint USDAmount) public view returns (uint) {
        uint ethPrice = getLatestPrice();
        uint USDAmountInEth = (USDAmount * 10 ** 18) / ethPrice; //* 10 ** 18;
        return USDAmountInEth;
    }

    /// @notice Gets the conversion rate of an amount in ETH to USD
    /// @dev should we always deal with in Wei?
    /// @return uint converted amount in USD correct to 18 decimals
    function _getToUSDConversionRate(uint ethAmount) public view returns (uint) {
        // NOTE: This will be made internal
        uint ethPrice = getLatestPrice();
        uint ethAmountInUSD = (ethPrice * ethAmount) / 10 ** 18;
        return ethAmountInUSD;
    }

    /// @notice Checks if a user has a collateral below 1.0x of total contribution amount
    /// @dev This will revert if called during ReleasingCollateral or after
    /// @param member The user to check for
    /// @return Bool check if member is below 1.0x of collateralDeposit
    function _isUnderCollaterized(address member) internal view returns (bool) {
        uint collateralLimit;
        uint memberCollateralUSD;
        if (LibCollateral._turnGroupData().fundContract == address(0)) {
            collateralLimit =
                LibCollateral._turnSpecs().totalParticipants *
                LibCollateral._turnSpecs().contributionAmount *
                10 ** 18;
        } else {
            uint remainingCycles = 1 +
                LibCollateral._turnSpecs().counterMembers -
                _fundInstance.currentCycle();
            collateralLimit =
                remainingCycles *
                LibCollateral._turnSpecs().contributionAmount *
                10 ** 18; // Convert to Wei
        }

        memberCollateralUSD = _getToUSDConversionRate(
            LibCollateral._collateralMappings().collateralMembersBank[member]
        );

        return (memberCollateralUSD < collateralLimit);
    }
}