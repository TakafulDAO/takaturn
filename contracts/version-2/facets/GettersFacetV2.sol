// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {IGettersV2} from "../interfaces/IGettersV2.sol";

import {LibTermV2} from "../libraries/LibTermV2.sol";
import {LibCollateralV2} from "../libraries/LibCollateralV2.sol";
import {LibFundV2} from "../libraries/LibFundV2.sol";

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
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[id];
        LibTermV2.Term storage term = LibTermV2._termStorage().terms[id];
        uint cycleEndTimestamp = term.cycleTime * fund.currentCycle + fund.fundStart;
        if (block.timestamp > cycleEndTimestamp) {
            return 0;
        } else {
            return cycleEndTimestamp - block.timestamp;
        }
    }

    // COLLATERAL GETTERS

    /// @param depositor the depositor address
    /// @param id the collateral id
    /// @return isCollateralMember, collateralMembersBank, collateralPaymentBank
    function getDepositorCollateralSummary(
        address depositor,
        uint id
    ) external view returns (bool, uint, uint, uint) {
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[id];
        return (
            collateral.isCollateralMember[depositor],
            collateral.collateralMembersBank[depositor],
            collateral.collateralPaymentBank[depositor],
            collateral.collateralDepositByUser[depositor]
        );
    }

    /// @param id the collateral id
    /// @return collateral: initialized, state, firstDepositTime, counterMembers, depositors, collateralDeposit
    function getCollateralSummary(
        uint id
    ) external view returns (bool, LibCollateralV2.CollateralStates, uint, uint, address[] memory) {
        LibCollateralV2.Collateral storage collateral = LibCollateralV2
            ._collateralStorage()
            .collaterals[id];
        return (
            collateral.initialized,
            collateral.state, // Current state of Collateral
            collateral.firstDepositTime, // Time when the first deposit was made
            collateral.counterMembers, // Current member count
            collateral.depositors // List of depositors
        );
    }

    /// @notice Called to check the minimum collateral amount to deposit in wei
    /// @return amount the minimum collateral amount to deposit in wei
    /// @dev The minimum collateral amount is calculated based on the index on the depositors array
    /// @dev The return value should be the minimum msg.value when calling joinTerm
    /// @dev C = 1.5 Cp (Tp - I) where C = minimum collateral amount, Cp = contribution amount,
    /// Tp = total participants, I = depositor index (starts at 0). 1.5
    function minCollateralToDeposit(
        LibTermV2.Term memory term,
        uint depositorIndex
    ) external view returns (uint amount) {
        uint contributionAmountInWei = getToEthConversionRate(term.contributionAmount * 10 ** 18);

        amount = (contributionAmountInWei * (term.totalParticipants - depositorIndex) * 150) / 100;
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
            LibFundV2.FundStates,
            IERC20,
            address[] memory,
            uint,
            uint,
            uint,
            address,
            uint
        )
    {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[id];
        return (
            fund.initialized,
            fund.currentState,
            fund.stableToken,
            fund.beneficiariesOrder,
            fund.fundStart,
            fund.fundEnd,
            fund.currentCycle,
            fund.lastBeneficiary,
            fund.totalAmountOfCycles
        );
    }

    /// @notice function to get the current beneficiary
    /// @param id the fund id
    /// @return the current beneficiary
    function getCurrentBeneficiary(uint id) external view returns (address) {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[id];
        return fund.beneficiariesOrder[fund.currentCycle - 1];
    }

    /// @notice function to get cycle information of a specific participant
    /// @param participant the user to get the info from
    /// @param id the fund id
    /// @return isParticipant, isBeneficiary, paidThisCycle, autoPayEnabled, beneficiariesPool
    function getParticipantFundSummary(
        address participant,
        uint id
    ) external view returns (bool, bool, bool, bool, uint) {
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[id];
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
        LibFundV2.Fund storage fund = LibFundV2._fundStorage().funds[id];
        LibTermV2.Term storage term = LibTermV2._termStorage().terms[id];
        if (fund.currentState != LibFundV2.FundStates.AcceptingContributions) {
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
            uint80 roundID_ethUSD,
            int256 price_ethUSD,
            ,
            /*uint startedAt*/ uint256 timeStamp_ethUSD,
            uint80 answeredInRound_ethUSD
        ) = AggregatorV3Interface(termConsts.aggregatorsAddresses["ETH/USD"]).latestRoundData(); //8 decimals

        // Check if chainlink data is not stale or incorrect
        require(
            timeStamp_ethUSD != 0 && answeredInRound_ethUSD >= roundID_ethUSD && price_ethUSD > 0,
            "ChainlinkOracle: stale data"
        );

        (
            uint80 roundID_usdUSDC,
            int256 price_usdUSDC,
            ,
            /*uint startedAt*/ uint256 timeStamp_usdUSDC,
            uint80 answeredInRound_usdUSDC
        ) = AggregatorV3Interface(termConsts.aggregatorsAddresses["USD/USDC"]).latestRoundData(); //8 decimals

        require(
            timeStamp_usdUSDC != 0 &&
                answeredInRound_usdUSDC >= roundID_usdUSDC &&
                price_usdUSDC > 0,
            "ChainlinkOracle: stale data"
        );

        int256 ethUSDC = price_ethUSD / price_usdUSDC;

        return uint(ethUSDC * 10 ** 18); //18 decimals
    }

    /// @notice Gets the conversion rate of an amount in USD to ETH
    /// @dev should we always deal with in Wei?
    /// @param USDAmount The amount in USD
    /// @return uint converted amount in wei
    function getToEthConversionRate(uint USDAmount) public view returns (uint) {
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
