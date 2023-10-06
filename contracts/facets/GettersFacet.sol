// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {IGetters} from "../interfaces/IGetters.sol";
import {IZaynVaultV2TakaDao} from "../interfaces/IZaynVaultV2TakaDao.sol";

import {LibTermStorage} from "../libraries/LibTermStorage.sol";
import {LibCollateralStorage} from "../libraries/LibCollateralStorage.sol";
import {LibFundStorage} from "../libraries/LibFundStorage.sol";
import {LibYieldGeneration} from "../libraries/LibYieldGeneration.sol";

contract GettersFacet is IGetters {
    // TERM GETTERS
    /// @return the current term id
    /// @return the next term id
    function getTermsId() external view returns (uint, uint) {
        LibTermStorage.TermStorage storage termStorage = LibTermStorage._termStorage();
        uint lastTermId = termStorage.nextTermId - 1;
        uint nextTermId = termStorage.nextTermId;
        return (lastTermId, nextTermId);
    }

    ///  @notice Gets the remaining registration period for a term
    ///  @param termId the term id
    ///  @return remaining contribution period
    function getRemainingRegistrationTime(uint termId) external view returns (uint) {
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[termId];
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];
        require(collateral.firstDepositTime != 0, "Nobody has deposited yet");
        if (block.timestamp >= collateral.firstDepositTime + term.registrationPeriod) {
            return 0;
        } else {
            return collateral.firstDepositTime + term.registrationPeriod - block.timestamp;
        }
    }

    /// @param termId the term id
    /// @return the term struct
    function getTermSummary(uint termId) external view returns (LibTermStorage.Term memory) {
        return (LibTermStorage._termStorage().terms[termId]);
    }

    /// @param participant the participant address
    /// @return an array with the term ids the participant is part of
    function getAllJoinedTerms(address participant) public view returns (uint[] memory) {
        LibTermStorage.TermStorage storage termStorage = LibTermStorage._termStorage();
        uint[] memory participantTermIds = termStorage.participantToTermId[participant];
        return participantTermIds;
    }

    /// @param participant the participant address
    /// @param state the term state
    /// @return an array with the term ids the participant is part of, giving the state of the term
    function getJoinedTermsByState(
        address participant,
        LibTermStorage.TermStates state
    ) external view returns (uint[] memory) {
        uint[] memory joinedTerms = getAllJoinedTerms(participant);
        uint[] memory userTermsByState;
        uint termscounter;
        uint joinedTermsLength = joinedTerms.length;
        for (uint i; i < joinedTermsLength; ) {
            if (LibTermStorage._termStorage().terms[joinedTerms[i]].state == state) {
                userTermsByState[termscounter] = i;
                unchecked {
                    ++termscounter;
                }
            }
            unchecked {
                ++i;
            }
        }
        return userTermsByState;
    }

    /// @param participant the participant address
    /// @return an array the term ids the participant is part of, giving the state of the term
    function getExpelledTerms(address participant) external view returns (uint[] memory) {
        uint[] memory joinedTerms = getAllJoinedTerms(participant);
        uint[] memory termsExpelled;
        uint termscounter;
        uint joinedTermsLength = joinedTerms.length;
        for (uint i; i < joinedTermsLength; ) {
            if (wasExpelled(joinedTerms[i], participant)) {
                termsExpelled[termscounter] = i;
                unchecked {
                    ++termscounter;
                }
            }
            unchecked {
                ++i;
            }
        }
        return termsExpelled;
    }

    /// @param termId the term id
    /// @return remaining cycles
    function getRemainingCycles(uint termId) external view returns (uint) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];

        return (1 + fund.totalAmountOfCycles - fund.currentCycle);
    }

    /// @param termId the term id
    /// @return remaining time in the current cycle
    function getRemainingCycleTime(uint termId) external view returns (uint) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[termId];
        uint cycleEndTimestamp = term.cycleTime * fund.currentCycle + fund.fundStart;
        if (block.timestamp > cycleEndTimestamp) {
            return 0;
        } else {
            return cycleEndTimestamp - block.timestamp;
        }
    }

    /// @param termId the term id
    /// @return remaining cycles contribution
    function getRemainingCyclesContributionWei(uint termId) external view returns (uint) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[termId];

        uint remainingCycles = 1 + fund.totalAmountOfCycles - fund.currentCycle;
        uint contributionAmountWei = IGetters(address(this)).getToCollateralConversionRate(
            term.contributionAmount * 10 ** 18
        );

        return remainingCycles * contributionAmountWei;
    }

    // COLLATERAL GETTERS

    /// @param depositor the depositor address
    /// @param termId the collateral id
    /// @return isCollateralMember
    /// @return collateralMembersBank
    /// @return collateralPaymentBank
    /// @return collateralDepositByUser
    /// @return expulsion limit
    function getDepositorCollateralSummary(
        address depositor,
        uint termId
    ) external view returns (bool, uint, uint, uint, uint) {
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[termId];

        uint limit;
        if (!fund.isBeneficiary[depositor]) {
            limit = IGetters(address(this)).getToCollateralConversionRate(
                term.contributionAmount * 10 ** 18
            );
        } else {
            limit = IGetters(address(this)).getRemainingCyclesContributionWei(termId);
        }

        return (
            collateral.isCollateralMember[depositor],
            collateral.collateralMembersBank[depositor],
            collateral.collateralPaymentBank[depositor],
            collateral.collateralDepositByUser[depositor],
            limit
        );
    }

    /// @param termId the collateral id
    /// @return collateral initialized
    /// @return collateral state
    /// @return collateral firstDepositTime
    /// @return counterMembers
    /// @return collateral depositors
    function getCollateralSummary(
        uint termId
    )
        external
        view
        returns (bool, LibCollateralStorage.CollateralStates, uint, uint, address[] memory)
    {
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];
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
        uint termId,
        uint depositorIndex
    ) external view returns (uint amount) {
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[termId];

        uint contributionAmountInWei = getToCollateralConversionRate(
            term.contributionAmount * 10 ** 18
        );

        amount = (contributionAmountInWei * (term.totalParticipants - depositorIndex) * 150) / 100;
    }

    /// @notice Called to check how much collateral a user can withdraw
    /// @param termId term id
    /// @param user depositor address
    /// @return allowedWithdrawal amount the amount of collateral the depositor can withdraw
    function getWithdrawableUserBalance(
        uint termId,
        address user
    ) external view returns (uint allowedWithdrawal) {
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        uint userCollateral = collateral.collateralMembersBank[user];
        uint availableYield = yield.availableYield[user];

        if (collateral.state == LibCollateralStorage.CollateralStates.ReleasingCollateral) {
            allowedWithdrawal = userCollateral + availableYield;
        } else if (collateral.state == LibCollateralStorage.CollateralStates.CycleOngoing) {
            // Everything above 1.5 X remaining cycles contribution (RCC) can be withdrawn
            uint minRequiredCollateral = (IGetters(address(this)).getRemainingCyclesContributionWei(
                termId
            ) * 15) / 10; // 1.5 X RCC in wei

            // Collateral must be higher than 1.5 X RCC
            if (userCollateral > minRequiredCollateral) {
                allowedWithdrawal = userCollateral - minRequiredCollateral + availableYield; // We allow to withdraw the positive difference
            } else {
                allowedWithdrawal = 0;
            }
        } else {
            allowedWithdrawal = 0;
        }
    }

    // FUND GETTERS

    /// @notice function to get the cycle information in one go
    /// @param termId the fund id
    /// @return fund initialized
    /// @return fund currentState
    /// @return fund stableToken
    /// @return fund beneficiariesOrder
    /// @return fund fundStart
    /// @return fund fundEnd
    /// @return fund currentCycle
    /// @return fund totalAmountOfCycles
    function getFundSummary(
        uint termId
    )
        external
        view
        returns (bool, LibFundStorage.FundStates, IERC20, address[] memory, uint, uint, uint, uint)
    {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        return (
            fund.initialized,
            fund.currentState,
            fund.stableToken,
            fund.beneficiariesOrder,
            fund.fundStart,
            fund.fundEnd,
            fund.currentCycle,
            fund.totalAmountOfCycles
        );
    }

    /// @notice function to get the current beneficiary
    /// @param termId the fund id
    /// @return the current beneficiary
    function getCurrentBeneficiary(uint termId) external view returns (address) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        return fund.beneficiariesOrder[fund.currentCycle - 1];
    }

    /// @notice function to know if a user was expelled before
    /// @param termId the fund id
    /// @param user the user to check
    /// @return true if the user was expelled before
    function wasExpelled(uint termId, address user) public view returns (bool) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];

        if (!fund.isParticipant[user] && !collateral.isCollateralMember[user]) {
            return true;
        } else {
            return false;
        }
    }

    /// @notice function to see if a user is exempted from paying a cycle
    /// @param termId the fund id
    /// @param cycle the cycle to check
    /// @param user the user to check
    /// @return true if the user is exempted
    function isExempted(uint termId, uint cycle, address user) external view returns (bool) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        return fund.isExemptedOnCycle[cycle].exempted[user];
    }

    /// @notice function to get cycle information of a specific participant
    /// @param participant the user to get the info from
    /// @param termId the fund id
    /// @return fund isParticipant, true if is participant
    /// @return fund isBeneficiary, true if has been beneficiary
    /// @return fund paidThisCycle, true if has paid the current cycle
    /// @return fund autoPayEnabled, true if auto pay is enabled
    /// @return fund beneficiariesPool, the beneficiary pool, 6 decimals
    /// @return fund beneficiariesFrozenPool, true if the beneficiary pool is frozen
    function getParticipantFundSummary(
        address participant,
        uint termId
    ) external view returns (bool, bool, bool, bool, uint, bool) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        return (
            fund.isParticipant[participant],
            fund.isBeneficiary[participant],
            fund.paidThisCycle[participant],
            fund.autoPayEnabled[participant],
            fund.beneficiariesPool[participant],
            fund.beneficiariesFrozenPool[participant]
        );
    }

    /// @notice returns the time left to contribute for this cycle
    /// @param termId the fund id
    /// @return the time left to contribute
    function getRemainingContributionTime(uint termId) external view returns (uint) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[termId];
        if (fund.currentState != LibFundStorage.FundStates.AcceptingContributions) {
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
        LibTermStorage.TermConsts storage termConsts = LibTermStorage._termConsts();

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
        ) = AggregatorV3Interface(termConsts.aggregatorsAddresses["USDC/USD"]).latestRoundData(); //8 decimals

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
    /// @param USDAmount The amount in USD with 18 decimals
    /// @return uint converted amount in wei
    function getToCollateralConversionRate(uint USDAmount) public view returns (uint) {
        uint ethPrice = getLatestPrice();
        uint USDAmountInEth = (USDAmount * 10 ** 18) / ethPrice;
        return USDAmountInEth;
    }

    /// @notice Gets the conversion rate of an amount in ETH to USD
    /// @dev should we always deal with in Wei?
    /// @param ethAmount The amount in ETH
    /// @return uint converted amount in USD correct to 18 decimals
    function getToStableConversionRate(uint ethAmount) external view returns (uint) {
        // NOTE: This will be made internal
        uint ethPrice = getLatestPrice();
        uint ethAmountInUSD = (ethPrice * ethAmount) / 10 ** 18;
        return ethAmountInUSD;
    }

    // YIELD GENERATION GETTERS

    /// @notice This function is used to check if a user has opted in for yield generation
    /// @param termId The term id for which the check is being made
    /// @param user The user for which the check is being made
    /// @return True if the user has opted in
    function userHasoptedInYG(uint termId, address user) external view returns (bool) {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        return yield.hasOptedIn[user];
    }

    /// @notice This function is used to get a user APY
    /// @param termId The term id for which the APY is being calculated
    /// @param user The user for which the APY is being calculated
    /// @return The APY for the user
    function userAPY(uint termId, address user) external returns (uint256) {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        uint256 elaspedTime = block.timestamp - yield.startTimeStamp;

        return
            ((userYieldGenerated(termId, user) / yield.currentTotalDeposit) * 365 days) /
            elaspedTime;
    }

    /// @notice This function is used to get a term APY
    /// @param termId The term id for which the APY is being calculated
    /// @return The APY for the term
    function termAPY(uint termId) external returns (uint256) {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        uint256 elaspedTime = block.timestamp - yield.startTimeStamp;

        return ((totalYieldGenerated(termId) / yield.currentTotalDeposit) * 365 days) / elaspedTime;
    }

    /// @notice This function is used to get the yield distribution ratio for a user
    /// @param termId The term id for which the ratio is being calculated
    /// @param user The user for which the ratio is being calculated
    /// @return The yield distribution ratio for the user
    function yieldDistributionRatio(uint termId, address user) public view returns (uint256) {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];

        if (yield.currentTotalDeposit == 0) {
            return 0;
        } else {
            return collateral.collateralMembersBank[user] / yield.currentTotalDeposit;
        }
    }

    /// @notice This function is used to get the total yield generated for a term
    /// @param termId The term id for which the yield is being calculated
    /// @return The total yield generated for the term
    function totalYieldGenerated(uint termId) public returns (uint) {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        uint totalWithdrawnYield;

        address[] memory arrayToCheck = yield.yieldUsers;
        uint arrayLength = arrayToCheck.length;

        for (uint i; i < arrayLength; ) {
            totalWithdrawnYield += yield.withdrawnYield[arrayToCheck[i]];

            unchecked {
                ++i;
            }
        }

        uint currentShares = IZaynVaultV2TakaDao(yield.providerAddresses["ZaynVault"]).balanceOf(
            termId
        );
        uint totalDeposit = yield.totalDeposit;
        uint totalShares = yield.totalShares;

        return
            totalWithdrawnYield +
            LibYieldGeneration._sharesToEth(currentShares, totalDeposit, totalShares) -
            yield.currentTotalDeposit;
    }

    /// @notice This function is used to get the total yield generated for a user
    /// @param termId The term id for which the yield is being calculated
    /// @param user The user for which the yield is being calculated
    /// @return The total yield generated for the user
    function userYieldGenerated(uint termId, address user) public returns (uint) {
        LibYieldGeneration.YieldGeneration storage yield = LibYieldGeneration
            ._yieldStorage()
            .yields[termId];

        return
            yield.withdrawnYield[user] +
            totalYieldGenerated(termId) *
            yieldDistributionRatio(termId, user);
    }
}
