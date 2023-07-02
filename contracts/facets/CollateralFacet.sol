// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import "../interfaces/ITakaturnFactory.sol";
import "../interfaces/ICollateralFacet.sol";
import "../interfaces/IFundFacet.sol";

/// @title Takaturn
/// @author Aisha El Allam
/// @notice This is used to operate the Takaturn fund
/// @dev v2.0 (post-deploy)
contract CollateralFacet is ICollateralFacet, Ownable {
    uint public constant VERSION = 2;

    IFundFacet private _fundInstance;

    uint public firstDepositTime;

    uint public counterMembers;

    address[] public depositors;
    address public fundContract;

    address public factoryContract;

    // Function cannot be called at this time.
    error FunctionInvalidAtThisState();

    // Current state.
    CollateralStates public state = CollateralStates.AcceptingCollateral;
    uint public creationTime = block.timestamp;
    modifier atState(CollateralStates _state) {
        if (state != _state) revert FunctionInvalidAtThisState();
        _;
    }

    // ! For now here, later I'll move it
    uint public termId; // The id of the term, incremented on every new term
    mapping(uint => CollateralData) private collateralById; // Collateral Id => Collateral Data

    struct CollateralData {
        uint totalDepositors;
        uint cycleTime;
        uint contributionAmount;
        uint contributionPeriod;
        uint collateralDeposit;
        uint fixedCollateralEth;
        address stableCoinAddress;
        AggregatorV3Interface priceFeed;
        mapping(address => bool) public isCollateralMember; // Determines if a depositor is a valid user
        mapping(address => uint) public collateralMembersBank; // Users main balance
        mapping(address => uint) public collateralPaymentBank; // Users reimbursement balance after someone defaults
    }

    function newCollateral(
        uint totalDepositors,
        uint cycleTime,
        uint contributionAmount,
        uint contributionPeriod,
        uint collateralAmount,
        uint fixedCollateralEth,
        address stableCoinAddress,
        address aggregatorAddress,
        address creator
    ) external {
        _newCollateral(
            totalDepositors,
            cycleTime,
            contributionAmount,
            contributionPeriod,
            collateralAmount,
            fixedCollateralEth,
            stableCoinAddress,
            aggregatorAddress,
            creator
        );
    }

    // TODO: For now just moving constructor here, later I'll see how to interact with the Fund Facet
    /// @notice Constructor Function
    /// @dev Network is Arbitrum One and Aggregator is ETH/USD
    /// @param _totalDepositors Max number of depositors
    /// @param _cycleTime Time for single cycle (seconds)
    /// @param _contributionAmount Amount user must pay per cycle (USD)
    /// @param _contributionPeriod The portion of cycle user must make payment
    /// @param _collateralAmount Total value of collateral in USD (1.5x of total fund)
    /// @param _creator owner of contract
    function _newCollateral(
        uint _totalDepositors,
        uint _cycleTime,
        uint _contributionAmount,
        uint _contributionPeriod,
        uint _collateralAmount,
        uint _fixedCollateralEth,
        address _stableCoinAddress,
        address _aggregatorAddress,
        address _creator
    ) internal returns (uint) {
        require(
            _totalDepositors != 0 &&
                _cycleTime != 0 &&
                _contributionAmount != 0 &&
                _contributionPeriod != 0 &&
                _collateralAmount != 0 &&
                _fixedCollateralEth != 0,
            "Invalid inputs"
        );
        require(
            _stableCoinAddress != address(0x00) && _stableCoinAddress != address(this),
            "Invalid inputs"
        );
        require(
            _aggregatorAddress != address(0x00) && _aggregatorAddress != address(this),
            "Invalid inputs"
        );
        require(_creator != address(0x00) && _creator != address(this), "Invalid inputs");
        // ! Viene del constructor
        transferOwnership(_creator); // TODO: later change for access control

        CollateralData storage collateral = collateralById[termId];

        collateral.totalDepositors = _totalDepositors;
        collateral.cycleTime = _cycleTime;
        collateral.contributionAmount = _contributionAmount;
        collateral.contributionPeriod = _contributionPeriod;
        collateral.collateralDeposit = _collateralAmount * 10 ** 18; // Convert to Wei
        collateral.fixedCollateralEth = _fixedCollateralEth;
        collateral.stableCoinAddress = _stableCoinAddress;
        collateral.priceFeed = AggregatorV3Interface(_aggregatorAddress); // TODO: Where to initialize

        // ! Hasta aqui viene del constructor
        ++termId;
        return termId;
    }

    function setStateOwner(CollateralStates newState) external onlyOwner {
        _setState(newState);
    }

    /// @notice Called by the manager when the cons job goes off
    /// @dev consider making the duration a variable
    function initiateFundContract(
        uint termId
    ) external onlyOwner atState(CollateralStates.AcceptingCollateral) {
        require(fundContract == address(0));
        require(counterMembers == totalDepositors);
        // If one user is under collaterized, then all are.
        require(!_isUnderCollaterized(termId, depositors[0]), "Eth prices dropped");

        fundContract = ITakaturnFactory(factoryContract).createFund(
            stableCoinAddress,
            depositors,
            cycleTime,
            contributionAmount,
            contributionPeriod
        );

        // TODO: check for success before initiating instance
        _fundInstance = IFundFacet(fundContract);
        _setState(CollateralStates.CycleOngoing);
        //emit OnFundStarted(fundContract, address(this));
    }

    /// @notice Called by each member to enter the term
    function depositCollateral() external payable atState(CollateralStates.AcceptingCollateral) {
        require(counterMembers < totalDepositors, "Members pending");
        require(!isCollateralMember[msg.sender], "Reentry");
        require(msg.value >= fixedCollateralEth, "Eth payment too low");

        collateralMembersBank[msg.sender] += msg.value;
        isCollateralMember[msg.sender] = true;
        depositors.push(msg.sender);
        counterMembers++;

        emit OnCollateralDeposited(termId, msg.sender);

        if (counterMembers == 1) {
            firstDepositTime = block.timestamp;
        }
    }

    /// @notice Called from Fund contract when someone defaults
    /// @dev Check EnumerableMap (openzeppelin) for arrays that are being accessed from Fund contract
    /// @param beneficiary Address that was randomly selected for the current cycle
    /// @param defaulters Address that was randomly selected for the current cycle
    function requestContribution(
        uint termId,
        address beneficiary,
        address[] calldata defaulters
    ) external atState(CollateralStates.CycleOngoing) returns (address[] memory) {
        require(fundContract == msg.sender, "Wrong caller");
        require(defaulters.length > 0, "No defaulters");

        address ben = beneficiary;
        bool wasBeneficiary = false;
        address currentDefaulter;
        address currentDepositor;
        address[] memory nonBeneficiaries = new address[](depositors.length);
        address[] memory expellants = new address[](defaulters.length);

        uint totalExpellants;
        uint nonBeneficiaryCounter;
        uint share;
        uint currentDefaulterBank;

        uint contributionAmountWei = _getToEthConversionRate(contributionAmount * 10 ** 18);

        // Determine who will be expelled and who will just pay the contribution
        // From their collateral.
        for (uint i = 0; i < defaulters.length; i++) {
            currentDefaulter = defaulters[i];
            wasBeneficiary = _fundInstance.isBeneficiary(currentDefaulter, termId);
            currentDefaulterBank = collateralMembersBank[currentDefaulter];

            if (currentDefaulter == ben) continue; // Avoid expelling graced defaulter

            if (
                (wasBeneficiary && _isUnderCollaterized(termId, currentDefaulter)) ||
                (currentDefaulterBank < contributionAmountWei)
            ) {
                isCollateralMember[currentDefaulter] = false; // Expelled!
                expellants[i] = currentDefaulter;
                share += currentDefaulterBank;
                collateralMembersBank[currentDefaulter] = 0;
                totalExpellants++;

                emit OnCollateralLiquidated(termId, address(currentDefaulter), currentDefaulterBank);
            } else {
                // Subtract contribution from defaulter and add to beneficiary.
                collateralMembersBank[currentDefaulter] -= contributionAmountWei;
                collateralPaymentBank[ben] += contributionAmountWei;
            }
        }

        totalDepositors = totalDepositors - totalExpellants;

        // Divide and Liquidate
        for (uint i = 0; i < depositors.length; i++) {
            currentDepositor = depositors[i];
            if (
                !_fundInstance.isBeneficiary(currentDepositor, termId) &&
                isCollateralMember[currentDepositor]
            ) {
                nonBeneficiaries[nonBeneficiaryCounter] = currentDepositor;
                nonBeneficiaryCounter++;
            }
        }

        // Finally, divide the share equally among non-beneficiaries
        if (nonBeneficiaryCounter > 0) {
            // This case can only happen when what?
            share = share / nonBeneficiaryCounter;
            for (uint i = 0; i < nonBeneficiaryCounter; i++) {
                collateralPaymentBank[nonBeneficiaries[i]] += share;
            }
        }

        return (expellants);
    }

    /// @notice Called by each member after the end of the cycle to withraw collateral
    /// @dev This follows the pull-over-push pattern.
    function withdrawCollateral() external atState(CollateralStates.ReleasingCollateral) {
        uint amount = collateralMembersBank[msg.sender] + collateralPaymentBank[msg.sender];
        require(amount > 0, "Nothing to claim");

        collateralMembersBank[msg.sender] = 0;
        collateralPaymentBank[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success);

        emit OnCollateralWithdrawn(termId, msg.sender, amount);

        --counterMembers;
        // If last person withdraws, then change state to EOL
        if (counterMembers == 0) {
            _setState(CollateralStates.Closed);
        }
    }

    function withdrawReimbursement(address depositor) external {
        require(address(fundContract) == address(msg.sender), "Wrong caller");
        uint amount = collateralPaymentBank[depositor];
        require(amount > 0, "Nothing to claim");
        collateralPaymentBank[depositor] = 0;

        (bool success, ) = payable(depositor).call{value: amount}("");
        require(success);

        emit OnReimbursementWithdrawn(termId, depositor, amount);
    }

    function releaseCollateral() external {
        require(address(fundContract) == address(msg.sender), "Wrong caller");
        _setState(CollateralStates.ReleasingCollateral);
    }

    /// @notice Checks if a user has a collateral below 1.0x of total contribution amount
    /// @dev This will revert if called during ReleasingCollateral or after
    /// @param member The user to check for
    /// @return Bool check if member is below 1.0x of collateralDeposit
    function isUnderCollaterized(uint termId, address member) external view returns (bool) {
        return _isUnderCollaterized(termId, member);
    }

    /// @notice allow the owner to empty the Collateral after 180 days
    function emptyCollateralAfterEnd(
        uint termId
    ) external onlyOwner atState(CollateralStates.ReleasingCollateral) {
        require(block.timestamp > (_fundInstance.fundEnd(termId)) + 180 days, "Can't empty yet");

        for (uint i = 0; i < depositors.length; i++) {
            address depositor = depositors[i];
            collateralMembersBank[depositor] = 0;
            collateralPaymentBank[depositor] = 0;
        }
        _setState(CollateralStates.Closed);

        (bool success, ) = payable(msg.sender).call{value: address(this).balance}("");
        require(success);
    }

    function getCollateralSummary()
        external
        view
        returns (CollateralStates, uint, uint, uint, uint, uint, uint, uint)
    {
        return (
            state, // Current state of Collateral
            cycleTime, // Cycle duration
            totalDepositors, // Total no. of depositors
            collateralDeposit, // Collateral
            contributionAmount, // Required contribution per cycle
            contributionPeriod, // Time to contribute
            counterMembers, // Current member count
            fixedCollateralEth // Fixed ether to deposit
        );
    }

    function getDepositorSummary(address depositor) external view returns (uint, uint, bool) {
        return (
            collateralMembersBank[depositor],
            collateralPaymentBank[depositor],
            isCollateralMember[depositor]
        );
    }

    /// @notice Gets latest ETH / USD price
    /// @return uint latest price in Wei
    function getLatestPrice() public view returns (uint) {

        (, int price, , , ) = priceFeed.latestRoundData(); //8 decimals
        return uint(price * 10 ** 10); //18 decimals
    }

    function _setState(CollateralStates newState) internal {
        CollateralStates oldState = state;
        state = newState;
        emit OnStateChanged(termId, oldState, newState);
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
    function _isUnderCollaterized(uint termId, address member) internal view returns (bool) {
        uint collateralLimit;
        uint memberCollateralUSD;
        if (fundContract == address(0)) {
            collateralLimit = totalDepositors * contributionAmount * 10 ** 18;
        } else {
            uint remainingCycles = 1 + counterMembers - _fundInstance.currentCycle(termId);
            collateralLimit = remainingCycles * contributionAmount * 10 ** 18; // Convert to Wei
        }

        memberCollateralUSD = _getToUSDConversionRate(collateralMembersBank[member]);

        return (memberCollateralUSD < collateralLimit);
    }
}
