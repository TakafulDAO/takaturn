// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.20;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "../interfaces/ICollateralFacet.sol";
import "../interfaces/IFund.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Takaturn
/// @author Aisha El Allam
/// @notice This is used to operate the Takaturn fund
/// @dev v2.0 (post-deploy)
contract CollateralFacet is ICollateralFacet, Ownable {
    // TODO: What it is on the storage, remove later
    IFund private _fundInstance;
    AggregatorV3Interface priceFeed;

    address public fundContract; // Todo: remove later
    uint public constant VERSION = 2;
    uint public creationTime = block.timestamp;
    uint public termId; // The id of the term, incremented on every new term
    // Current state.
    CollateralStates public state = CollateralStates.AcceptingCollateral; // todo: initialize on function

    struct CollateralData {
        uint totalDepositors;
        uint counterMembers;
        uint cycleTime;
        uint contributionAmount;
        uint contributionPeriod;
        uint collateralDeposit;
        uint fixedCollateralEth;
        uint firstDepositTime;
        address stableCoinAddress;
        CollateralStates currentCollateralState;
        address[] depositors;
    }

    enum CollateralStates {
        AcceptingCollateral, // Initial state where collateral are deposited
        CycleOngoing, // Triggered when a fund instance is created, no collateral can be accepted
        ReleasingCollateral, // Triggered when the fund closes
        Closed // Triggered when all depositors withdraw their collaterals
    }

    mapping(uint => CollateralData) private collateralById; // Collateral Id => Collateral Data
    mapping(address => bool) public isCollateralMember; // Determines if a depositor is a valid user
    mapping(address => uint) public collateralMembersBank; // Users main balance
    mapping(address => uint) public collateralPaymentBank; // Users reimbursement balance after someone defaults

    event OnStateChanged(
        uint indexed termId,
        CollateralStates indexed oldState,
        CollateralStates indexed newState
    );
    event OnCollateralDeposited(uint indexed termId, address indexed user);
    event OnReimbursementWithdrawn(uint indexed termId, address indexed user, uint indexed amount);
    event OnCollateralWithdrawn(uint indexed termId, address indexed user, uint indexed amount);
    event OnCollateralLiquidated(uint indexed termId, address indexed user, uint indexed amount);

    modifier atState(CollateralStates _state) {
        if (state != _state) revert FunctionInvalidAtThisState();
        _;
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

    function setStateOwner(uint id, CollateralStates newState) external onlyOwner {
        _setState(id, newState);
    }

    // TODO: Believe this function is not needed anymore
    /// @notice Called by the manager when the cons job goes off
    /// @dev consider making the duration a variable
    function initiateFund(
        uint id
    ) external onlyOwner atState(CollateralStates.AcceptingCollateral) {
        CollateralData storage collateral = collateralById[id];
        require(collateral.counterMembers == collateral.totalDepositors); // todo: This check is already on _joinTerm, leave for security reasons? or remove?
        // todo: check this call later. 02/07/2023 10:27
        // If one user is under collaterized, then all are.
        require(!_isUnderCollaterized(termId, collateral.depositors[0]), "Eth prices dropped");

        _fundInstance.createTerm(
            collateral.cycleTime,
            collateral.contributionAmount,
            collateral.contributionPeriod,
            collateral.totalDepositors,
            collateral.stableCoinAddress
        );

        // TODO: check for success before initiating instance
        //_fundInstance = IFundFacet(fundContract);
        _setState(id, CollateralStates.CycleOngoing);
        //emit OnFundStarted(fundContract, address(this));
    }

    /// @notice Called by each member to enter the term
    // TODO: better internal?
    function depositCollateral(
        uint id
    ) external payable atState(CollateralStates.AcceptingCollateral) {
        CollateralData storage collateral = collateralById[id];
        require(collateral.counterMembers < collateral.totalDepositors, "Members pending"); // TODO: this check is already on _joinTerm
        require(!isCollateralMember[msg.sender], "Reentry");
        require(msg.value >= collateral.fixedCollateralEth, "Eth payment too low");

        collateralMembersBank[msg.sender] += msg.value;
        isCollateralMember[msg.sender] = true;
        //collateral.depositors.push(msg.sender);
        //collaterall.counterMembers++;

        uint depositorsLength = collateral.depositors.length;
        for (uint i; i < depositorsLength; ) {
            if (collateral.depositors[i] == address(0)) {
                collateral.depositors[i] = msg.sender;
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
    }

    /// @notice Called from Fund contract when someone defaults
    /// @dev Check EnumerableMap (openzeppelin) for arrays that are being accessed from Fund contract
    /// @param beneficiary Address that was randomly selected for the current cycle
    /// @param defaulters Address that was randomly selected for the current cycle
    function requestContribution(
        uint id,
        address beneficiary,
        address[] calldata defaulters
    ) external atState(CollateralStates.CycleOngoing) returns (address[] memory) {
        CollateralData storage collateral = collateralById[id];
        //require(fundContract == msg.sender, "Wrong caller");
        require(defaulters.length > 0, "No defaulters");

        address ben = beneficiary;
        bool wasBeneficiary; // By default is false;
        address currentDefaulter;
        address currentDepositor;
        address[] memory nonBeneficiaries = new address[](collateral.depositors.length);
        address[] memory expellants = new address[](defaulters.length);

        uint totalExpellants;
        uint nonBeneficiaryCounter;
        uint share;
        uint currentDefaulterBank;

        uint contributionAmountWei = _getToEthConversionRate(
            collateral.contributionAmount * 10 ** 18
        );

        // Determine who will be expelled and who will just pay the contribution
        // From their collateral.
        uint defaultersLength = defaulters.length;
        for (uint i; i < defaultersLength; ) {
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

                emit OnCollateralLiquidated(
                    termId,
                    address(currentDefaulter),
                    currentDefaulterBank
                );
            } else {
                // Subtract contribution from defaulter and add to beneficiary.
                collateralMembersBank[currentDefaulter] -= contributionAmountWei;
                collateralPaymentBank[ben] += contributionAmountWei;
            }
            unchecked {
                ++i;
            }
        }

        collateral.totalDepositors = collateral.totalDepositors - totalExpellants;

        // Divide and Liquidate
        uint depositorsLength = collateral.depositors.length;
        for (uint i; i < depositorsLength; ) {
            currentDepositor = collateral.depositors[i];
            if (
                !_fundInstance.isBeneficiary(currentDepositor, termId) &&
                isCollateralMember[currentDepositor]
            ) {
                nonBeneficiaries[nonBeneficiaryCounter] = currentDepositor;
                nonBeneficiaryCounter++;
            }
            unchecked {
                ++i;
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
    function withdrawCollateral(uint id) external atState(CollateralStates.ReleasingCollateral) {
        CollateralData storage collateral = collateralById[id];
        uint amount = collateralMembersBank[msg.sender] + collateralPaymentBank[msg.sender];
        require(amount > 0, "Nothing to claim");

        collateralMembersBank[msg.sender] = 0;
        collateralPaymentBank[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success);

        emit OnCollateralWithdrawn(id, msg.sender, amount);

        --collateral.counterMembers;
        // If last person withdraws, then change state to EOL
        if (collateral.counterMembers == 0) {
            _setState(id, CollateralStates.Closed);
        }
    }

    // Todo: check this one
    function withdrawReimbursement(address depositor) external {
        require(address(fundContract) == address(msg.sender), "Wrong caller");
        uint amount = collateralPaymentBank[depositor];
        require(amount > 0, "Nothing to claim");
        collateralPaymentBank[depositor] = 0;

        (bool success, ) = payable(depositor).call{value: amount}("");
        require(success);

        emit OnReimbursementWithdrawn(termId, depositor, amount);
    }

    function releaseCollateral(uint id) external {
        require(address(fundContract) == address(msg.sender), "Wrong caller");
        _setState(id, CollateralStates.ReleasingCollateral);
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
    ) external onlyOwner atState(CollateralStates.ReleasingCollateral) {
        CollateralData storage collateral = collateralById[id];
        require(block.timestamp > (_fundInstance.fundEnd(termId)) + 180 days, "Can't empty yet");

        uint depositorsLength = collateral.depositors.length;
        for (uint i; i < depositorsLength; i++) {
            address depositor = collateral.depositors[i];
            collateralMembersBank[depositor] = 0;
            collateralPaymentBank[depositor] = 0;
            unchecked {
                ++i;
            }
        }
        _setState(id, CollateralStates.Closed);

        (bool success, ) = payable(msg.sender).call{value: address(this).balance}("");
        require(success);
    }

    function getCollateralSummary(
        uint id
    ) external view returns (/*CollateralStates,*/ uint, uint, uint, uint, uint, uint, uint) {
        CollateralData storage collateral = collateralById[id];
        return (
            //collateral.currentCollateralState, // Current state of Collateral
            collateral.cycleTime, // Cycle duration
            collateral.totalDepositors, // Total no. of depositors
            collateral.collateralDeposit, // Collateral
            collateral.contributionAmount, // Required contribution per cycle
            collateral.contributionPeriod, // Time to contribute
            collateral.counterMembers, // Current member count
            collateral.fixedCollateralEth // Fixed ether to deposit
        );
    }

    function getParticipantSummary(address participant) external view returns (uint, uint, bool) {
        return (
            collateralMembersBank[participant],
            collateralPaymentBank[participant],
            isCollateralMember[participant]
        );
    }

    //todo: is the same as the last one
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
        collateral.counterMembers;
        collateral.cycleTime = _cycleTime;
        collateral.contributionAmount = _contributionAmount;
        collateral.contributionPeriod = _contributionPeriod;
        collateral.collateralDeposit = _collateralAmount * 10 ** 18; // Convert to Wei
        collateral.fixedCollateralEth = _fixedCollateralEth;
        collateral.firstDepositTime;
        collateral.stableCoinAddress = _stableCoinAddress;
        collateral.currentCollateralState = CollateralStates.AcceptingCollateral;

        collateral.depositors = new address[](_totalDepositors);

        priceFeed = AggregatorV3Interface(_aggregatorAddress); // TODO: Where to initialize

        // ! Hasta aqui viene del constructor
        ++termId;
        return termId;
    }

    function _setState(uint id, CollateralStates newState) internal {
        CollateralData storage collateral = collateralById[id];
        CollateralStates oldState = collateral.currentCollateralState;
        collateral.currentCollateralState = newState;
        emit OnStateChanged(id, oldState, newState);
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
    function _isUnderCollaterized(uint id, address member) internal view returns (bool) {
        CollateralData storage collateral = collateralById[id];
        uint collateralLimit;
        uint memberCollateralUSD;
        // Todo: reference to the bool exist later
        if (fundContract == address(0)) {
            collateralLimit = collateral.totalDepositors * collateral.contributionAmount * 10 ** 18;
        } else {
            uint remainingCycles = 1 +
                collateral.counterMembers -
                _fundInstance.currentCycle(termId); // todo: check this call later. 02/07/2023 12:31

            collateralLimit = remainingCycles * collateral.contributionAmount * 10 ** 18; // Convert to Wei
        }

        memberCollateralUSD = _getToUSDConversionRate(collateralMembersBank[member]);

        return (memberCollateralUSD < collateralLimit);
    }
}
