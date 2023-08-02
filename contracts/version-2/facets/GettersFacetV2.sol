// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {IGettersV2} from "../interfaces/IGettersV2.sol";

import {LibTermV2} from "../libraries/LibTermV2.sol";
import {LibCollateral} from "../../version-1/libraries/LibCollateral.sol";
import {LibFund} from "../../version-1/libraries/LibFund.sol";

contract GettersFacetV2 is IGettersV2 {
    // TERM GETTERS
    /// @return the current term id
    /// @return the next term id
    function getTermsId() external view returns (uint, uint) {
        LibTermV2.TermStorage storage termStorage = LibTermV2._termStorage();
        uint lastTermId = termStorage.nextTermId - 1;
        uint nextTermId = termStorage.nextTermId;
        return (lastTermId, nextTermId);
    }

    /// @param id the term id
    /// @return the term struct
    function getTermSummary(uint id) external view returns (LibTermV2.Term memory) {
        return (LibTermV2._termStorage().terms[id]);
    }

    /// @param participant the participant address
    /// @return the term ids the participant is part of
    function getParticipantTerms(address participant) external view returns (uint[] memory) {
        LibTermV2.TermStorage storage termStorage = LibTermV2._termStorage();
        uint[] memory participantTermIds = termStorage.participantToTermId[participant];
        return participantTermIds;
    }

    /// @param id the term id
    /// @return remaining time in the current cycle
    function getRemainingCycleTime(uint id) external view returns (uint) {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[id];
        LibTermV2.Term storage term = LibTermV2._termStorage().terms[id];
        uint cycleEndTimestamp = term.cycleTime * fund.currentCycle + fund.fundStart;
        if (block.timestamp > cycleEndTimestamp) {
            return 0;
        } else {
            return cycleEndTimestamp - block.timestamp;
        }
    }

    /// @notice Called to check the minimum collateral amount to deposit in wei
    /// @return the minimum collateral amount to deposit in wei
    /// @dev The minimum collateral amount is calculated based on the number of participants
    /// @dev The return value should be the msg.value when calling joinTerm
    function minCollateralToDeposit(uint id) external view returns (uint) {
        LibTermV2.TermStorage storage termStorage = LibTermV2._termStorage();
        LibTermV2.Term memory term = termStorage.terms[id];

        LibCollateral.CollateralStorage storage collateralStorage = LibCollateral
            ._collateralStorage();
        LibCollateral.Collateral storage collateral = collateralStorage.collaterals[id];

        uint amount;

        if (collateral.counterMembers == 0) {
            amount = term.maxCollateralEth;
        } else if (collateral.counterMembers == term.totalParticipants - 1) {
            amount = term.minCollateralEth;
        } else {
            amount = (term.maxCollateralEth + term.minCollateralEth) / 2;
        }
        return amount;
    }

    // COLLATERAL GETTERS

    /// @param depositor the depositor address
    /// @param id the collateral id
    /// @return isCollateralMember, collateralMembersBank, collateralPaymentBank
    function getDepositorCollateralSummary(
        address depositor,
        uint id
    ) external view returns (bool, uint, uint) {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[id];
        return (
            collateral.isCollateralMember[depositor],
            collateral.collateralMembersBank[depositor],
            collateral.collateralPaymentBank[depositor]
        );
    }

    /// @param id the collateral id
    /// @return collateral: initialized, state, firstDepositTime, counterMembers, depositors, collateralDeposit
    function getCollateralSummary(
        uint id
    )
        external
        view
        returns (bool, LibCollateral.CollateralStates, uint, uint, address[] memory, uint)
    {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[id];
        return (
            collateral.initialized,
            collateral.state, // Current state of Collateral
            collateral.firstDepositTime, // Time when the first deposit was made
            collateral.counterMembers, // Current member count
            collateral.depositors, // List of depositors
            collateral.collateralDeposit // Collateral
        );
    }

    // FUND GETTERS

    /// @notice function to get the cycle information in one go
    /// @param id the fund id
    /// @return initialized, currentState, stableToken, currentCycle, beneficiariesOrder, fundStart, currentCycle, lastBeneficiary, totalAmountOfCycles, fundEnd
    function getFundSummary(
        uint id
    )
        external
        view
        returns (
            bool,
            LibFund.FundStates,
            IERC20,
            uint,
            address[] memory,
            uint,
            uint,
            address,
            uint,
            uint
        )
    {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[id];
        return (
            fund.initialized,
            fund.currentState,
            fund.stableToken,
            fund.currentCycle,
            fund.beneficiariesOrder,
            fund.fundStart,
            fund.currentCycle,
            fund.lastBeneficiary,
            fund.totalAmountOfCycles,
            fund.fundEnd
        );
    }

    /// @notice returns the beneficiaries order as an array
    /// @param id the fund id
    /// @return the beneficiaries order
    function getBeneficiariesOrder(uint id) external view returns (address[] memory) {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[id];
        return fund.beneficiariesOrder;
    }

    /// @notice function to get cycle information of a specific participant
    /// @param participant the user to get the info from
    /// @param id the fund id
    /// @return isParticipant, isBeneficiary, paidThisCycle, autoPayEnabled, beneficiariesPool
    function getParticipantFundSummary(
        address participant,
        uint id
    ) external view returns (bool, bool, bool, bool, uint) {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[id];
        return (
            fund.isParticipant[participant],
            fund.isBeneficiary[participant],
            fund.paidThisCycle[participant],
            fund.autoPayEnabled[participant],
            fund.beneficiariesPool[participant]
        );
    }

    /// @notice returns the time left to contribute for this cycle
    /// @param id the fund id
    /// @return the time left to contribute
    function getRemainingContributionTime(uint id) external view returns (uint) {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[id];
        LibTermV2.Term storage term = LibTermV2._termStorage().terms[id];
        if (fund.currentState != LibFund.FundStates.AcceptingContributions) {
            return 0;
        }

        // Current cycle minus 1 because we use the previous cycle time as start point then add contribution period
        uint contributionEndTimestamp = term.cycleTime *
            (fund.currentCycle - 1) +
            fund.fundStart +
            term.contributionPeriod;
        if (block.timestamp > contributionEndTimestamp) {
            return 0;
        } else {
            return contributionEndTimestamp - block.timestamp;
        }
    }

    // CONVERSION GETTERS

    /// @notice Gets latest ETH / USD price
    /// @return uint latest price in Wei Note: 18 decimals
    function getLatestPrice() public view returns (uint) {
        LibTermV2.TermConsts storage termConsts = LibTermV2._termConsts();
        (
            ,
            /*uint80 roundID*/ int256 answer,
            uint256 startedAt /*uint256 updatedAt*/ /*uint80 answeredInRound*/,
            ,

        ) = AggregatorV3Interface(termConsts.sequencerUptimeFeedAddress).latestRoundData(); //8 decimals

        // Answer == 0: Sequencer is up
        // Answer == 1: Sequencer is down
        require(answer == 0, "Sequencer down");

        //We must wait at least an hour after the sequencer started up
        require(
            termConsts.sequencerStartupTime <= block.timestamp - startedAt,
            "Sequencer starting up"
        );

        (
            uint80 roundID,
            int256 price,
            ,
            /*uint startedAt*/ uint256 timeStamp,
            uint80 answeredInRound
        ) = AggregatorV3Interface(termConsts.aggregatorAddress).latestRoundData(); //8 decimals

        // Check if chainlink data is not stale or incorrect
        require(
            timeStamp != 0 && answeredInRound >= roundID && price > 0,
            "ChainlinkOracle: stale data"
        );

        return uint(price * 10 ** 10); //18 decimals
    }

    /// @notice Gets the conversion rate of an amount in USD to ETH
    /// @dev should we always deal with in Wei?
    /// @param USDAmount The amount in USD
    /// @return uint converted amount in wei
    function getToEthConversionRate(uint USDAmount) external view returns (uint) {
        uint ethPrice = getLatestPrice();
        uint USDAmountInEth = (USDAmount * 10 ** 18) / ethPrice;
        return USDAmountInEth;
    }

    /// @notice Gets the conversion rate of an amount in ETH to USD
    /// @dev should we always deal with in Wei?
    /// @param ethAmount The amount in ETH
    /// @return uint converted amount in USD correct to 18 decimals
    function getToUSDConversionRate(uint ethAmount) external view returns (uint) {
        // NOTE: This will be made internal
        uint ethPrice = getLatestPrice();
        uint ethAmountInUSD = (ethPrice * ethAmount) / 10 ** 18;
        return ethAmountInUSD;
    }
}
