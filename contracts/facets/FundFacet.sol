// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../interfaces/IFund.sol";
import "../interfaces/ICollateral.sol";

/// @title Takaturn Fund
/// @author Mohammed Haddouti
/// @notice This is used to operate the Takaturn fund
/// @dev v2.0 (post-deploy)
contract FundFacet is IFund, Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    /// Insufficient balance for transfer. Needed `required` but only
    /// `available` available.
    /// @param available balance available.
    /// @param required requested amount to transfer.
    error InsufficientBalance(uint available, uint required);

    event OnStateChanged(uint indexed fundId, States indexed newState); // Emits when state has updated
    event OnPaidContribution(uint fundId, address indexed payer, uint indexed currentCycle); // Emits when participant pays the contribution
    event OnBeneficiarySelected(uint fundId, address indexed beneficiary); // Emits when beneficiary is selected for this cycle
    event OnFundWithdrawn(uint fundId, address indexed claimant, uint indexed amount); // Emits when a chosen beneficiary claims their fund
    event OnParticipantDefaulted(uint fundId, address indexed defaulter); // Emits when a participant didn't pay this cycle's contribution
    event OnParticipantUndefaulted(uint indexed fundId, address indexed undefaulter); // Emits when a participant was a defaulter before but started paying on time again for this cycle
    event OnDefaulterExpelled(uint indexed fundId, address indexed expellant); // Emits when a defaulter can't compensate with the collateral
    event OnTotalParticipantsUpdated(uint indexed fundId, uint indexed newLength); // Emits when the total participants lengths has changed from its initial value
    event OnAutoPayToggled(address indexed participant, bool indexed enabled); // Emits when a participant succesfully toggles autopay

    uint public constant version = 2; // The version of the contract

    ICollateral public collateral; // Instance of the collateral
    IERC20 public stableToken; // Instance of the stable token

    mapping(address => bool) public isParticipant; // Mapping to keep track of who's a participant or not
    mapping(address => bool) public isBeneficiary; // Mapping to keep track of who's a beneficiary or not
    mapping(address => bool) public paidThisCycle; // Mapping to keep track of who paid for this cycle
    mapping(address => bool) public autoPayEnabled; // Wheter to attempt to automate payments at the end of the contribution period
    mapping(address => uint) public beneficiariesPool; // Mapping to keep track on how much each beneficiary can claim

    //TODO: New functions that create a new fund.
    //TODO: For now here Everything here. Easier to follow.
    //TODO: When finish moved to where it  belongs
    //? Params from constructor?
    //? Non reentrant?
    uint private _fundId;

    function newFund(
        uint cycleTime,
        uint contributionAmount,
        uint contributionPeriod,
        address stableTokenAddress,
        address[] memory participantsArray
    ) external {
        _newFund(
            cycleTime,
            contributionAmount,
            contributionPeriod,
            stableTokenAddress,
            participantsArray
        );
    }

    // TODO: Need other ones. For now this is ok. Later move the rest
    struct FundData {
        uint cycleTime; // time for a single cycle in seconds, default is 30 days
        uint contributionAmount; // amount in stable token currency, 6 decimals
        uint contributionPeriod; // time for participants to contribute this cycle
        uint totalParticipants; // Total amount of starting participants
        uint expelledParticipants; // Total amount of participants that have been expelled so far
        address lastBeneficiary; // The last selected beneficiary, updates with every cycle
        uint currentCycle; // Index of current cycle
        uint totalAmountOfCycles; // Amount of cycles that this fund will have
        uint fundStart; // Timestamp of the start of the fund
        uint fundEnd; // Timestamp of the end of the fund
        address fundOwner;
        address stableTokenAddress;
        States currentState; // Current state of the fund
        EnumerableSet.AddressSet participants; // Those who have not been beneficiaries yet and have not defaulted this cycle
        EnumerableSet.AddressSet beneficiaries; // Those who have been beneficiaries and have not defaulted this cycle
        EnumerableSet.AddressSet defaulters; // Both participants and beneficiaries who have defaulted this cycle
        address[] beneficiariesOrder; // The correct order of who gets to be next beneficiary, determined by collateral contract
    }

    event OnNewFund(
        uint indexed fundId,
        address indexed fundOwner,
        address _stableTokenAddress,
        uint cycleTime,
        uint _contributionAmount
    );

    mapping(uint => FundData) private fundsById; // Fund Id => Fund

    /// @dev Network is Arbitrum One and Stable Token is USDC
    /// @param _cycleTime The time it takes to finish 1 cycle
    /// @param _contributionAmount The amount participants need to pay per cycle, amount in whole dollars
    /// @param _contributionPeriod The amount of time participants have to pay the contribution of a cycle, must be less than cycle time
    /// @param _stableTokenAddress Address of the stable token contract
    /// @param _participantsArray An array of all participants
    function _newFund(
        uint _cycleTime,
        uint _contributionAmount,
        uint _contributionPeriod,
        address _stableTokenAddress,
        address[] memory _participantsArray
    ) internal returns (uint) {
        uint participantsArrayLength = _participantsArray.length;
        require(
            _cycleTime != 0 &&
                _contributionAmount != 0 &&
                _contributionPeriod != 0 &&
                participantsArrayLength != 0,
            "Invalid inputs"
        );
        for (uint i; i < participantsArrayLength; ) {
            require(
                _participantsArray[i] != address(0x00) && _participantsArray[i] != address(this),
                "Invalid inputs"
            );
            unchecked {
                ++i;
            }
        }
        collateral = ICollateral(msg.sender);
        stableToken = IERC20(_stableTokenAddress);

        transferOwnership(Ownable(msg.sender).owner()); // ? Needed? Role access control?

        FundData storage fund = fundsById[_fundId];

        // Sets some cycle-related parameters
        fund.cycleTime = _cycleTime;
        fund.contributionAmount = _contributionAmount * 10 ** 6; // Convert to 6 decimals
        fund.contributionPeriod = _contributionPeriod;
        fund.totalParticipants = participantsArrayLength;
        fund.totalAmountOfCycles = participantsArrayLength;
        fund.currentCycle = 0;
        fund.fundOwner = msg.sender;
        fund.stableTokenAddress = _stableTokenAddress;
        fund.currentState = States.InitializingFund; // ? Needed? AcceptingContributions?
        fund.beneficiariesOrder = _participantsArray;

        // Set and track participants

        for (uint i; i < participantsArrayLength; ) {
            EnumerableSet.add(fund.participants, _participantsArray[i]);
            isParticipant[_participantsArray[i]] = true;
            unchecked {
                ++i;
            }
        }
        // Starts the first cycle
        _startNewCycle(_fundId);

        // Set timestamp of deployment, which will be used to determine cycle times
        // We do this after starting the first cycle to make sure the first cycle starts smoothly
        fund.fundStart = block.timestamp;

        emit OnNewFund(_fundId, msg.sender, _stableTokenAddress, _cycleTime, _contributionAmount);
        ++_fundId;

        return _fundId;
    }

    /// @notice starts a new cycle manually called by the owner. Only the first cycle starts automatically upon deploy
    function startNewCycle(uint fundId) external onlyOwner {
        _startNewCycle(fundId);
    }

    /// @notice This starts the new cycle and can only be called internally. Used upon deploy
    function _startNewCycle(uint fundId) internal {
        FundData storage fund = fundsById[fundId];
        // currentCycle is 0 when this is called for the first time
        require(
            block.timestamp > fund.cycleTime * fund.currentCycle + fund.fundStart,
            "Too early to start new cycle"
        );
        require(
            fund.currentState == States.InitializingFund ||
                fund.currentState == States.CycleOngoing,
            "Wrong state"
        );

        ++fund.currentCycle;
        uint length = fund.beneficiariesOrder.length;
        for (uint i; i < length; ) {
            paidThisCycle[fund.beneficiariesOrder[i]] = false;
            unchecked {
                ++i;
            }
        }

        _setState(fundId, States.AcceptingContributions);

        // We attempt to make the autopayers pay their contribution right away
        _autoPay(fundId);
    }

    /// @notice updates the state according to the input and makes sure the state can't be changed if the fund is closed. Also emits an event that this happened
    /// @param newState The new state of the fund
    function _setState(uint fundId, States newState) internal {
        FundData storage fund = fundsById[fundId];
        require(fund.currentState != States.FundClosed, "Fund closed");
        fund.currentState = newState;
        emit OnStateChanged(fundId, newState);
    }

    // TODO: Set allowance to always auto pay
    /// @notice function to attempt to make autopayers pay their contribution
    function _autoPay(uint fundId) internal {
        FundData storage fund = fundsById[fundId];
        address[] memory autoPayers = fund.beneficiariesOrder;
        uint amount = fund.contributionAmount;

        uint length = autoPayers.length;
        for (uint i; i < length; ) {
            if (
                autoPayEnabled[autoPayers[i]] &&
                !paidThisCycle[autoPayers[i]] &&
                amount <= stableToken.allowance(autoPayers[i], address(this)) &&
                amount <= stableToken.balanceOf(autoPayers[i])
            ) {
                _payContribution(fundId, autoPayers[i], autoPayers[i]);
            }
            unchecked {
                ++i;
            }
        }
    }

    /// @notice function to enable/disable autopay
    function toggleAutoPay() external {
        require(isParticipant[msg.sender], "Not a participant");
        bool enabled = !autoPayEnabled[msg.sender];
        autoPayEnabled[msg.sender] = enabled;

        emit OnAutoPayToggled(msg.sender, enabled);
    }

    /// @notice function to pay the actual contribution for the cycle
    /// @param payer the address that's paying
    /// @param participant the (participant) address that's being paid for
    function _payContribution(uint fundId, address payer, address participant) internal {
        FundData storage fund = fundsById[fundId];
        // Get the amount and do the actual transfer
        // This will only succeed if the sender approved this contract address beforehand
        uint amount = fund.contributionAmount;

        bool success = stableToken.transferFrom(payer, address(this), amount);
        require(success, "Contribution failed, did you approve stable token?");

        // Finish up, set that the participant paid for this cycle and emit an event that it's been done
        paidThisCycle[participant] = true;
        emit OnPaidContribution(fundId, participant, fund.currentCycle);
    }

    /// @notice This is the function participants call to pay the contribution
    function payContribution(uint fundId) external {
        FundData storage fund = fundsById[fundId];
        require(fund.currentState == States.AcceptingContributions, "Wrong state");
        require(isParticipant[msg.sender], "Not a participant");
        require(!paidThisCycle[msg.sender], "Already paid for cycle");
        _payContribution(fundId, msg.sender, msg.sender);
    }

    /// @notice This function is here to give the possibility to pay using a different wallet
    /// @param participant the address the msg.sender is paying for, the address must be part of the fund
    function payContributionOnBehalfOf(uint fundId, address participant) external {
        FundData storage fund = fundsById[fundId];
        require(fund.currentState == States.AcceptingContributions, "Wrong state");
        require(isParticipant[participant], "Not a participant");
        require(!paidThisCycle[participant], "Already paid for cycle");
        _payContribution(fundId, msg.sender, participant);
    }

    /// @notice Must be called at the end of the contribution period after the time has passed by the owner
    function closeFundingPeriod(uint fundId) external onlyOwner {
        FundData storage fund = fundsById[fundId];
        // Current cycle minus 1 because we use the previous cycle time as start point then add contribution period
        require(
            block.timestamp >
                fund.cycleTime * (fund.currentCycle - 1) + fund.fundStart + fund.contributionPeriod,
            "Still time to contribute"
        );
        require(fund.currentState == States.AcceptingContributions, "Wrong state");

        // We attempt to make the autopayers pay their contribution right away
        _autoPay(fundId);

        // Only then start choosing beneficiary
        _setState(fundId, States.ChoosingBeneficiary);

        // We must check who hasn't paid and default them, check all participants based on beneficiariesOrder
        // To maintain the order and to properly push defaulters to the back based on that same order
        // And we make sure that existing defaulters are ignored
        address[] memory currentParticipants = fund.beneficiariesOrder;

        uint currentParticipantsLength = currentParticipants.length;

        for (uint i; i < currentParticipantsLength; ) {
            address p = currentParticipants[i];
            if (paidThisCycle[p]) {
                // check where to restore the defaulter to, participants or beneficiaries
                if (isBeneficiary[p]) {
                    EnumerableSet.add(fund.beneficiaries, p);
                } else {
                    EnumerableSet.add(fund.participants, p);
                }

                if (EnumerableSet.remove(fund.defaulters, p)) {
                    emit OnParticipantUndefaulted(fundId, p);
                }
            } else if (!EnumerableSet.contains(fund.defaulters, p)) {
                _defaultParticipant(fundId, p);
            }
            unchecked {
                ++i;
            }
        }

        // Once we decided who defaulted and who paid, we can select the beneficiary for this cycle
        _selectBeneficiary(fundId);

        if (!(fund.currentCycle < fund.totalAmountOfCycles)) {
            // If all cycles have passed, and the last cycle's time has passed, close the fund
            _closeFund(fundId);
            return;
        }
    }

    /// @notice Internal function for close fund which is used by _startNewCycle & _chooseBeneficiary to cover some edge-cases
    function _closeFund(uint fundId) internal {
        FundData storage fund = fundsById[fundId];
        fund.fundEnd = block.timestamp;
        _setState(fundId, States.FundClosed);
        collateral.releaseCollateral();
    }

    /// @notice called by the owner to close the fund for emergency reasons.
    function closeFund(uint fundId) external onlyOwner {
        //require (!(currentCycle < totalAmountOfCycles), "Not all cycles have happened yet");
        _closeFund(fundId);
    }

    /// @notice Default the participant/beneficiary by checking the mapping first, then remove them from the appropriate array
    /// @param defaulter The participant to default
    function _defaultParticipant(uint fundId, address defaulter) internal {
        FundData storage fund = fundsById[fundId];
        // Try removing from participants first
        bool success = EnumerableSet.remove(fund.participants, defaulter);

        // If that fails, we try removing from beneficiaries
        if (!success) {
            success = EnumerableSet.remove(fund.beneficiaries, defaulter);
        }

        require(success, "Can't remove defaulter");
        EnumerableSet.add(fund.defaulters, defaulter);

        emit OnParticipantDefaulted(fundId, defaulter);
    }

    /// @notice The beneficiary will be selected here based on the beneficiariesOrder array.
    /// @notice It will loop through the array and choose the first in line to be eligible to be beneficiary.
    function _selectBeneficiary(uint fundId) internal {
        FundData storage fund = fundsById[fundId];
        // check if there are any participants left, else use the defaulters
        address selectedBeneficiary; // By default initialization is address(0)
        address[] memory arrayToCheck = fund.beneficiariesOrder;
        uint arrayToCheckLength = arrayToCheck.length;
        uint beneficiaryIndex; // By default uint initialization is 0;

        for (uint i; i < arrayToCheckLength; ) {
            address b = arrayToCheck[i];
            if (!isBeneficiary[b]) {
                selectedBeneficiary = b;
                beneficiaryIndex = i;
                break;
            }
            unchecked {
                ++i;
            }
        }

        // If the defaulter didn't pay this cycle, we move the first elligible beneficiary forward and everyone in between forward
        if (!paidThisCycle[selectedBeneficiary]) {
            // Find the index of the beneficiary to move to the end
            for (uint i = beneficiaryIndex; i < arrayToCheckLength; ) {
                address b = arrayToCheck[i];
                // Find the first eligible beneficiary
                if (paidThisCycle[b]) {
                    selectedBeneficiary = b;
                    address[] memory newOrder = fund.beneficiariesOrder;
                    // Move each defaulter between current beneficiary and new beneficiary 1 position forward
                    for (uint j = beneficiaryIndex; j < i; ) {
                        newOrder[j + 1] = arrayToCheck[j];
                        unchecked {
                            ++j;
                        }
                    }
                    // Move new beneficiary to original beneficiary's position
                    newOrder[beneficiaryIndex] = selectedBeneficiary;
                    fund.beneficiariesOrder = newOrder;
                    break;
                }
                unchecked {
                    ++i;
                }
            }
        }

        // Request contribution from the collateral for those who haven't paid this cycle
        if (EnumerableSet.length(fund.defaulters) > 0) {
            address[] memory expellants = collateral.requestContribution(
                fundId,
                selectedBeneficiary,
                EnumerableSet.values(fund.defaulters)
            );

            uint expellantsLength = expellants.length;
            for (uint i; i < expellantsLength; ) {
                if (expellants[i] == address(0)) {
                    continue;
                }
                _expelDefaulter(fundId, expellants[i]);
                unchecked {
                    ++i;
                }
            }
        }

        // Remove participant from participants set..
        if (EnumerableSet.remove(fund.participants, selectedBeneficiary)) {
            // ..Then add them to the benificiaries set
            EnumerableSet.add(fund.beneficiaries, selectedBeneficiary);
        } // If this if-statement fails, this means we're dealing with a graced defaulter

        // Update the mapping to track who's been beneficiary
        isBeneficiary[selectedBeneficiary] = true;

        // Get the amount of participants that paid this cycle, and add that amount to the beneficiary's pool
        uint paidCount;
        address[] memory allParticipants = fund.beneficiariesOrder; // Use beneficiariesOrder here because it contains all active participants in a single array
        for (uint i = 0; i < allParticipants.length; i++) {
            if (paidThisCycle[allParticipants[i]]) {
                paidCount++;
            }
        }

        // Award the beneficiary with the pool and update the lastBeneficiary
        beneficiariesPool[selectedBeneficiary] = fund.contributionAmount * paidCount;
        fund.lastBeneficiary = selectedBeneficiary;

        emit OnBeneficiarySelected(fundId, selectedBeneficiary);
        _setState(fundId, States.CycleOngoing);
    }

    /// @notice Fallback function, if the internal call fails somehow and the state gets stuck, allow owner to call the function again manually
    /// @dev This shouldn't happen, but is here in case there's an edge-case we didn't take into account, can possibly be removed in the future
    function selectBeneficiary(uint fundId) external onlyOwner {
        FundData storage fund = fundsById[fundId];
        require(fund.currentState == States.ChoosingBeneficiary, "Wrong state");
        _selectBeneficiary(fundId);
    }

    /// @notice called internally to expel a participant. It should not be possible to expel non-defaulters, so those arrays are not checked.
    /// @param expellant The address of the defaulter that will be expelled
    function _expelDefaulter(uint fundId, address expellant) internal {
        FundData storage fund = fundsById[fundId];
        //require(msg.sender == address(collateral), "Caller is not collateral");
        require(
            isParticipant[expellant] && EnumerableSet.remove(fund.defaulters, expellant),
            "Expellant not found"
        );

        // Expellants should only be in the defauters set so no need to touch the other sets
        //require(EnumerableSet.remove(_defaulters, expellant), "Expellant not found");

        // Remove expellant from beneficiaries order
        // Remove expellants from participants tracker and emit that they've been expelled
        // Update the defaulters array
        _removeBeneficiaryFromOrder(fundId, expellant);

        isParticipant[expellant] = false;
        emit OnDefaulterExpelled(fundId, expellant);

        // If the participant is expelled before becoming beneficiary, we lose a cycle, the one which this expellant is becoming beneficiary
        if (!isBeneficiary[expellant]) {
            fund.totalAmountOfCycles--;
        }

        // Lastly, lower the amount of participants with the amount expelled
        uint newLength = fund.totalParticipants - 1;
        fund.totalParticipants = newLength;
        ++fund.expelledParticipants;

        emit OnTotalParticipantsUpdated(fundId, newLength);
    }

    /// @notice Called internally to move a defaulter in the beneficiariesOrder to the end, so that people who have paid get chosen first as beneficiary
    /// @param _beneficiary The defaulter that could have been beneficiary
    function _removeBeneficiaryFromOrder(uint fundId, address _beneficiary) internal {
        FundData storage fund = fundsById[fundId];
        address[] memory arrayToCheck = fund.beneficiariesOrder;
        uint arrayToCheckLength = arrayToCheck.length;
        address[] memory newArray = new address[](arrayToCheck.length - 1);
        uint j;
        for (uint i; i < arrayToCheckLength; ) {
            address b = arrayToCheck[i];
            if (b != _beneficiary) {
                newArray[j] = b;
                unchecked {
                    ++j;
                }
            }
            unchecked {
                ++i;
            }
        }

        fund.beneficiariesOrder = newArray;
    }

    /// @notice allow the owner to empty the fund if there's any excess fund left after 180 days,
    ///         this with the assumption that beneficiaries can't claim it themselves due to losing their keys for example,
    ///         and prevent the fund to be stuck in limbo
    function emptyFundAfterEnd(uint fundId) external onlyOwner {
        FundData storage fund = fundsById[fundId];
        require(
            fund.currentState == States.FundClosed && block.timestamp > fund.fundEnd + 180 days,
            "Can't empty yet"
        );

        uint balance = stableToken.balanceOf(address(this));
        if (balance > 0) {
            stableToken.transfer(msg.sender, balance);
        }
    }

    /// @notice Called by the beneficiary to withdraw the fund
    /// @dev This follows the pull-over-push pattern.
    function withdrawFund(uint fundId) external {
        FundData storage fund = fundsById[fundId];
        require(
            fund.currentState == States.FundClosed || paidThisCycle[msg.sender],
            "You must pay your cycle before withdrawing"
        );

        bool hasFundPool = beneficiariesPool[msg.sender] > 0;
        (, uint collateralPool, ) = collateral.getParticipantSummary(msg.sender);
        bool hasCollateralPool = collateralPool > 0;
        require(hasFundPool || hasCollateralPool, "Nothing to withdraw");

        if (hasFundPool) {
            // Get the amount this beneficiary can withdraw
            uint transferAmount = beneficiariesPool[msg.sender];
            uint contractBalance = stableToken.balanceOf(address(this));
            if (contractBalance < transferAmount) {
                revert InsufficientBalance({available: contractBalance, required: transferAmount});
            } else {
                beneficiariesPool[msg.sender] = 0;
                stableToken.transfer(msg.sender, transferAmount); // Untrusted
            }
            emit OnFundWithdrawn(fundId, msg.sender, transferAmount);
        }

        if (hasCollateralPool) {
            collateral.withdrawReimbursement(msg.sender);
        }
    }

    // @notice returns the time left for this cycle to end
    function getRemainingCycleTime(uint fundId) external view returns (uint) {
        FundData storage fund = fundsById[fundId];
        uint cycleEndTimestamp = fund.cycleTime * fund.currentCycle + fund.fundStart;
        if (block.timestamp > cycleEndTimestamp) {
            return 0;
        } else {
            return cycleEndTimestamp - block.timestamp;
        }
    }

    // @notice returns the time left to contribute for this cycle
    function getRemainingContributionTime(uint fundId) external view returns (uint) {
        FundData storage fund = fundsById[fundId];
        if (fund.currentState != States.AcceptingContributions) {
            return 0;
        }

        // Current cycle minus 1 because we use the previous cycle time as start point then add contribution period
        uint contributionEndTimestamp = fund.cycleTime *
            (fund.currentCycle - 1) +
            fund.fundStart +
            fund.contributionPeriod;
        if (block.timestamp > contributionEndTimestamp) {
            return 0;
        } else {
            return contributionEndTimestamp - block.timestamp;
        }
    }

    /// @notice returns the beneficiaries order as an array
    function getBeneficiariesOrder(uint fundId) external view returns (address[] memory) {
        FundData storage fund = fundsById[fundId];
        return fund.beneficiariesOrder;
    }

    /// @notice function to get the cycle information in one go
    function getFundSummary(uint fundId) external view returns (States, uint, address) {
        FundData storage fund = fundsById[fundId];
        return (fund.currentState, fund.currentCycle, fund.lastBeneficiary);
    }

    /// @notice function to get cycle information of a specific participant
    /// @param participant the user to get the info from
    function getParticipantSummary(
        address participant
    ) external view returns (uint, bool, bool, bool, bool) {
        return (
            beneficiariesPool[participant],
            isBeneficiary[participant],
            paidThisCycle[participant],
            autoPayEnabled[participant],
            isParticipant[participant]
        );
    }

    function currentCycle(uint fundId) external view returns (uint) {
        FundData storage fund = fundsById[fundId];
        return fund.currentCycle;
    }

    function fundEnd(uint fundId) external view returns (uint) {
        FundData storage fund = fundsById[fundId];
        return fund.fundEnd;
    }
}
