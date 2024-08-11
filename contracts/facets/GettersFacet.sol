// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {IGetters} from "../interfaces/IGetters.sol";
import {IZaynVaultV2TakaDao} from "../interfaces/IZaynVaultV2TakaDao.sol";

import {LibTermStorage} from "../libraries/LibTermStorage.sol";
import {LibCollateral} from "../libraries/LibCollateral.sol";
import {LibCollateralStorage} from "../libraries/LibCollateralStorage.sol";
import {LibFundStorage} from "../libraries/LibFundStorage.sol";
import {LibYieldGenerationStorage} from "../libraries/LibYieldGenerationStorage.sol";
import {LibYieldGeneration} from "../libraries/LibYieldGeneration.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {LibGettersHelpers} from "../libraries/LibGettersHelpers.sol";

/// @title Takaturn Getters Facet
/// @author Maikel Ordaz
/// @notice Getters for Takaturn protocol
/// @dev v3.0 (Diamond)
contract GettersFacet is IGetters {
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice This function is used as a helper for front-end implementation
    /// @param termId The term id for which the summary is being requested
    /// @return term The term object
    /// @return collateralState The current state of the collateral
    /// @return fundState The current state of the fund
    /// @return nonUserRelated A helper struct with the following values:
    ///                        available positions, security deposits corresponding to each position,
    ///                        remaining registration time, remaining contribution time,
    ///                        remaining cycle time, remaining cycles, remaining cycles
    ///                        contribution in wei, latest price from Chainlink, collateral
    ///                        first deposit time in seconds, collateral counter members,
    ///                        fund start time in seconds, fund end time in seconds, current
    ///                        cycle, expelled participants, total amount of cycles, yield
    ///                        start time in seconds, total deposit in wei, current total
    ///                        deposit in wei, total shares, users opted in for yield
    function getTermRelatedSummary(
        uint termId
    )
        external
        view
        returns (
            LibTermStorage.Term memory term,
            LibCollateralStorage.CollateralStates collateralState,
            LibFundStorage.FundStates fundState,
            LibGettersHelpers.NonUserRelated memory nonUserRelated
        )
    {
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        term = LibTermStorage._termStorage().terms[termId];
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];

        (
            uint[] memory joinPositions,
            uint[] memory joinAmounts
        ) = getAvailablePositionsAndSecurityAmount(termId);

        collateralState = collateral.state;
        fundState = fund.currentState;

        nonUserRelated = LibGettersHelpers.NonUserRelated({
            availablePositions: joinPositions,
            securityDeposits: joinAmounts,
            remainingRegistrationTime: getRemainingRegistrationTime(termId),
            remainingContributionTime: getRemainingContributionTime(termId),
            remainingCycleTime: getRemainingCycleTime(termId),
            remainingCycles: getRemainingCycles(termId),
            rcc: getRemainingCyclesContributionWei(termId),
            latestPrice: getLatestPrice(),
            collateralInitialized: collateral.initialized,
            collateralFirstDepositTime: collateral.firstDepositTime,
            collateralCounterMembers: collateral.counterMembers,
            fundInitialized: fund.initialized,
            fundStartTime: fund.fundStart,
            fundEndTime: fund.fundEnd,
            fundCurrentCycle: fund.currentCycle,
            fundExpellantsCount: fund.expelledParticipants,
            fundTotalCycles: fund.totalAmountOfCycles,
            fundBeneficiariesOrder: fund.beneficiariesOrder,
            yieldInitialized: yield.initialized,
            yieldStartTime: yield.startTimeStamp,
            yieldTotalDeposit: yield.totalDeposit,
            yieldCurrentTotalDeposit: yield.currentTotalDeposit,
            yieldTotalShares: yield.totalShares,
            yieldUsers: yield.yieldUsers
        });
    }

    /// @notice This function is used as a helper for front-end implementation
    /// @param user the depositor address
    /// @param termId the collateral id
    /// @return userRelated an object that contains the following values:
    ///                     user is collateral member, user is undercollaterized,
    ///                     current collateral balance, received collateral from defaults,
    ///                     initial deposited collateral, collateral expulsion limit,
    ///                     currently withdrawable balance, is fund member, is or was beneficiary,
    ///                     user paid current cycle, user paid next cycle in advance,
    ///                     user enabled autopay, user's money pot is frozen, user is exempted this
    ///                     cycle, the money pot pool the user can withdraw, the cycle the user got
    ///                     expelled (if applicable), is yield member, amount of collateral deposited
    ///                     in yield pool, amount of collateral withdrawn from yield pool, available
    ///                     yield to withdraw, amount of yield withdrawn, yield to be distributed
    function getUserRelatedSummary(
        address user,
        uint termId
    ) external view returns (LibGettersHelpers.UserRelated memory userRelated) {
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[termId];
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];

        bool beneficiary = fund.isBeneficiary[user]; // true if user has been beneficiary

        userRelated.collateralMember = collateral.isCollateralMember[user]; // true if member
        userRelated.isUnderCollaterized = LibCollateral._isUnderCollaterized(termId, user); // checks if user is undercollaterized
        userRelated.membersBank = collateral.collateralMembersBank[user];
        userRelated.paymentBank = collateral.collateralPaymentBank[user];
        userRelated.deposited = collateral.collateralDepositByUser[user];
        userRelated.fundMember = fund.isParticipant[user]; // true if participant
        userRelated.beneficiary = beneficiary; // true if user has been beneficiary
        userRelated.currentCyclePaid = fund.paidThisCycle[user]; // true if has paid current cycle
        userRelated.nextCyclePaid = fund.paidNextCycle[user]; // true if has paid next cycle
        userRelated.autoPayer = fund.autoPayEnabled[user]; // true if enabled auto pay
        userRelated.moneyPotFrozen = _checkFrozenMoneyPot(user, termId); // true if money pot is frozen
        userRelated.exemptedThisCycle = fund.isExemptedOnCycle[fund.currentCycle].exempted[user];
        userRelated.yieldMember = yield.hasOptedIn[user]; // true if deposit on yield
        userRelated.withdrawableBalance = getWithdrawableUserBalance(termId, user); // Gets the amount of collateral the user can withdraw right now

        if (collateral.state != LibCollateralStorage.CollateralStates.AcceptingCollateral) {
            uint limit;
            if (beneficiary) {
                // limit is determined by whether the user is beneficiary or not
                limit = getRemainingCyclesContributionWei(termId);
            } else {
                limit = getToCollateralConversionRate(term.contributionAmount * 10 ** 18);
            }

            userRelated.expulsonLimit = limit;
            userRelated.pool = fund.beneficiariesPool[user];
            userRelated.cycleExpelled = fund.cycleOfExpulsion[user];

            if (yield.hasOptedIn[user]) {
                userRelated.collateralDepositedInYield = yield.depositedCollateralByUser[user];
                userRelated.collateralWithdrawnFromYield = yield.withdrawnCollateral[user];
                userRelated.yieldAvailable = yield.availableYield[user];
                userRelated.yieldWithdrawn = yield.withdrawnYield[user];
                userRelated.distributedYield = LibYieldGeneration._unwithdrawnUserYieldGenerated(
                    termId,
                    user
                );
            }
        }
    }

    /// @notice This function return the current constant values for oracles and yield providers
    /// @param firstAggregator The name of the first aggregator. Example: "ETH/USD"
    /// @param secondAggregator The name of the second aggregator. Example: "USDC/USD"
    /// @param zapAddress The name of the zap address. Example: "ZaynZap"
    /// @param vaultAddress The name of the vault address. Example: "ZaynVault"
    /// @return The addresses of the oracles and yield providers
    function getConstants(
        string memory firstAggregator,
        string memory secondAggregator,
        string memory zapAddress,
        string memory vaultAddress
    ) external view returns (address, address, address, address) {
        LibTermStorage.TermConsts storage termConsts = LibTermStorage._termConsts();
        LibYieldGenerationStorage.YieldProviders storage yieldProvider = LibYieldGenerationStorage
            ._yieldProviders();

        return (
            termConsts.aggregatorsAddresses[firstAggregator],
            termConsts.aggregatorsAddresses[secondAggregator],
            yieldProvider.providerAddresses[zapAddress],
            yieldProvider.providerAddresses[vaultAddress]
        );
    }

    /// @notice This function is used to get the current state of the yield lock
    /// @return The current state of the yield lock
    function getYieldLockState() external view returns (bool) {
        return LibYieldGenerationStorage._yieldLock().yieldLock;
    }

    /// @return the current term id
    /// @return the next term id
    function getTermsId() external view returns (uint, uint) {
        LibTermStorage.TermStorage storage termStorage = LibTermStorage._termStorage();
        uint lastTermId = termStorage.nextTermId - 1;
        uint nextTermId = termStorage.nextTermId;
        return (lastTermId, nextTermId);
    }

    /// @notice Gets the term object
    /// @param termId the term id
    /// @return the term object
    function getTermSummary(uint termId) external view returns (LibTermStorage.Term memory) {
        return (LibTermStorage._termStorage().terms[termId]);
    }

    /// @notice function to get the collateral object
    /// @param termId the collateral id
    /// @return if collateral initialized
    /// @return current collateral state
    /// @return time of first deposit
    /// @return current members count
    /// @return list of depositors
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

    /// @notice function to get the cycle information in one go
    /// @param termId the fund id
    /// @return if fund initialized
    /// @return current fund state
    /// @return stable token address used
    /// @return list of beneficiaries order
    /// @return when the fund starts in seconds
    /// @return when the fund ended, 0 if not ended
    /// @return current cycle number
    /// @return total amount of cycles
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

    /// @notice Gets the yield object
    /// @param termId the collateral id
    /// @return if the yield is initialized
    /// @return start time stamp for yield deposit
    /// @return total deposit
    /// @return current amount in yield
    /// @return amount of total shares
    /// @return list of yield users
    /// @return address of vault
    /// @return address of zap
    function getYieldSummary(
        uint termId
    ) external view returns (bool, uint, uint, uint, uint, address[] memory, address, address) {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];
        return (
            yield.initialized,
            yield.startTimeStamp,
            yield.totalDeposit,
            yield.currentTotalDeposit,
            yield.totalShares,
            yield.yieldUsers,
            yield.providerAddresses["ZaynVault"],
            yield.providerAddresses["ZaynZap"]
        );
    }

    /// @notice This function is used to get a term APY
    /// @param termId The term id for which the APY is being calculated
    /// @return The APY for the term
    function termAPY(uint termId) external view returns (uint256) {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];

        uint256 elaspedTime = block.timestamp - yield.startTimeStamp;

        return
            (((totalYieldGenerated(termId) * 10 ** 18) / yield.currentTotalDeposit) * 365 days) /
            elaspedTime;
    }

    /// @notice a function to get the needed allowance for every active term the user is part of
    /// @param user the user address
    /// @return the needed allowance
    function getNeededAllowance(address user) external view returns (uint) {
        uint neededAllowance;

        uint[] memory activeTerms = getJoinedTermsByState(
            user,
            LibTermStorage.TermStates.ActiveTerm
        );
        uint[] memory initializedTerms = getJoinedTermsByState(
            user,
            LibTermStorage.TermStates.InitializingTerm
        );

        uint activeTermsLength = activeTerms.length;
        uint initializedTermsLength = initializedTerms.length;

        for (uint i; i < activeTermsLength; ) {
            LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[activeTerms[i]];
            uint remainingPayments = term.contributionAmount *
                getRemainingCycles(activeTerms[i]) *
                10 ** 6;
            neededAllowance += remainingPayments;

            /// @custom:unchecked-block without risk, i can't be higher than activeTerms length
            unchecked {
                ++i;
            }
        }

        for (uint i; i < initializedTermsLength; ) {
            LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[
                initializedTerms[i]
            ];
            uint totalPayments = term.contributionAmount * term.totalParticipants * 10 ** 6;
            neededAllowance += totalPayments;

            /// @custom:unchecked-block without risk, i can't be higher than initializedTerms length
            unchecked {
                ++i;
            }
        }

        return neededAllowance;
    }

    /// @notice function to get the beneficiary from the current cycle
    /// @param termId the fund id
    /// @return the current beneficiary
    function getCurrentBeneficiary(uint termId) external view returns (address) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        return fund.beneficiariesOrder[fund.currentCycle - 1];
    }

    /// @notice function to get the beneficiary from the next cycle
    /// @param termId the fund id
    /// @return the next beneficiary
    function getNextBeneficiary(uint termId) external view returns (address) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        return fund.beneficiariesOrder[fund.currentCycle];
    }

    /// @notice function to get the depositor collateral summary
    /// @param depositor the depositor address
    /// @param termId the collateral id
    /// @return if the user is a true member of the term
    /// @return current users locked collateral balance in wei
    /// @return current users unlocked collateral balance in wei
    /// @return initial users deposit in wei
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
            limit = getToCollateralConversionRate(term.contributionAmount * 10 ** 18);
        } else {
            limit = getRemainingCyclesContributionWei(termId);
        }

        return (
            collateral.isCollateralMember[depositor],
            collateral.collateralMembersBank[depositor],
            collateral.collateralPaymentBank[depositor],
            collateral.collateralDepositByUser[depositor],
            limit
        );
    }

    /// @notice function to get fund information of a specific participant
    /// @param participant the user to get the info from
    /// @param termId the fund id
    /// @return isParticipant, true if is participant
    /// @return isBeneficiary, true if has been beneficiary
    /// @return paidThisCycle, true if has paid the current cycle
    /// @return autoPayEnabled, true if auto pay is enabled
    /// @return beneficiariesPool, the beneficiary pool, 6 decimals
    /// @return beneficiariesFrozenPool, true if the beneficiary pool is frozen
    function getParticipantFundSummary(
        address participant,
        uint termId
    ) external view returns (bool, bool, bool, bool, uint, bool) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];

        bool isMoneyPotFrozen = _checkFrozenMoneyPot(participant, termId);

        return (
            fund.isParticipant[participant],
            fund.isBeneficiary[participant],
            fund.paidThisCycle[participant],
            fund.autoPayEnabled[participant],
            fund.beneficiariesPool[participant],
            isMoneyPotFrozen
        );
    }

    /// @notice Gets the user yield summary
    /// @param user the depositor address
    /// @param termId the collateral id
    /// @return if the user opted in for yield
    /// @return amount withdrawn from yield
    /// @return amount withdrawn from collateral
    /// @return amount available in yield
    /// @return amount deposited by user in yield
    /// @return amount of yield distributed
    function getUserYieldSummary(
        address user,
        uint termId
    ) external view returns (bool, uint, uint, uint, uint, uint) {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];

        uint yieldDistributed = LibYieldGeneration._unwithdrawnUserYieldGenerated(termId, user);

        return (
            yield.hasOptedIn[user],
            yield.withdrawnYield[user],
            yield.withdrawnCollateral[user],
            yield.availableYield[user],
            yield.depositedCollateralByUser[user],
            yieldDistributed
        );
    }

    /// @notice function to get cycle information of a specific participant
    /// @param participant the user to get the info from
    /// @param termId the fund id
    /// @return on participant set
    /// @return on beneficiary set
    /// @return on defaulter set
    function getUserSet(address participant, uint termId) external view returns (bool, bool, bool) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        bool onParticipantSet = EnumerableSet.contains(fund._participants, participant);
        bool onBeneficiarySet = EnumerableSet.contains(fund._beneficiaries, participant);
        bool onDefaulterSet = EnumerableSet.contains(fund._defaulters, participant);
        return (onParticipantSet, onBeneficiarySet, onDefaulterSet);
    }

    /// @notice Called to check how much collateral a user can withdraw
    /// @param termId term id
    /// @param user depositor address
    /// @return allowedWithdrawal amount the amount of collateral the depositor can withdraw
    function getWithdrawableUserBalance(
        uint termId,
        address user
    ) public view returns (uint allowedWithdrawal) {
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[termId];
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];

        uint userCollateral = collateral.collateralMembersBank[user];
        uint availableYield = yield.availableYield[user];
        bool expelledBeforeBeingBeneficiary = fund.expelledBeforeBeneficiary[user];

        if (
            collateral.state == LibCollateralStorage.CollateralStates.ReleasingCollateral ||
            expelledBeforeBeingBeneficiary
        ) {
            allowedWithdrawal = userCollateral + availableYield;
        } else if (collateral.state == LibCollateralStorage.CollateralStates.CycleOngoing) {
            uint minRequiredCollateral;

            // Check if the user has paid this cycle or the next
            if (!fund.paidThisCycle[user] && !fund.paidNextCycle[user]) {
                // If none have been paid
                // Everything above 1.5 X remaining cycles contribution (RCC) can be withdrawn
                minRequiredCollateral = (getRemainingCyclesContributionWei(termId) * 15) / 10; // 1.5 X RCC in wei
            }

            // If the user has paid only one of the cycles, current or next
            if (
                (fund.paidThisCycle[user] && !fund.paidNextCycle[user]) ||
                (fund.paidNextCycle[user] && !fund.paidThisCycle[user])
            ) {
                // We need to check his remaining cycles and get the contribution amount for those
                uint remainingCycles = fund.totalAmountOfCycles - fund.currentCycle;
                uint contributionAmountWei = getToCollateralConversionRate(
                    term.contributionAmount * 10 ** 18
                );

                minRequiredCollateral = (remainingCycles * contributionAmountWei * 15) / 10; // 1.5 times of what the user needs to pay for the remaining cycles
            }

            // If the user has paid both cycles, current and next
            if (fund.paidThisCycle[user] && fund.paidNextCycle[user]) {
                // We need to check his remaining cycles and get the contribution amount for those
                uint remainingCycles = fund.totalAmountOfCycles - fund.currentCycle - 1;
                uint contributionAmountWei = getToCollateralConversionRate(
                    term.contributionAmount * 10 ** 18
                );

                minRequiredCollateral = (remainingCycles * contributionAmountWei * 15) / 10; // 1.5 times of what the user needs to pay for the remaining cycles
            }

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

    /// @notice Get all the terms a participant was expelled from
    /// @param participant the participant address
    /// @return an array the term ids on which the participant was expelled
    function getExpelledTerms(address participant) external view returns (uint[] memory) {
        uint[] memory joinedTerms = getAllJoinedTerms(participant);
        uint[] memory temporaryArray = new uint[](joinedTerms.length);
        uint termsCounter;
        uint joinedTermsLength = joinedTerms.length;

        for (uint i; i < joinedTermsLength; ) {
            if (wasExpelled(joinedTerms[i], participant)) {
                temporaryArray[termsCounter] = joinedTerms[i];

                /// @custom:unchecked-block without risk, termsCounter can't be higher than joinedTerms length
                unchecked {
                    ++termsCounter;
                }
            }

            /// @custom:unchecked-block without risk, i can't be higher than joinedTerms length
            unchecked {
                ++i;
            }
        }

        uint[] memory termsExpelled = new uint[](termsCounter);

        for (uint i; i < termsCounter; ) {
            termsExpelled[i] = temporaryArray[i];

            /// @custom:unchecked-block without risk, i can't be higher than termsCounter
            unchecked {
                ++i;
            }
        }

        return termsExpelled;
    }

    /// @notice Checks if a user has a collateral below 1.0x of total contribution amount
    /// @dev This will revert if called during ReleasingCollateral or after
    /// @param termId The term id
    /// @param member The user to check for
    /// @return Bool check if member is below 1.0x of collateralDeposit
    function isUnderCollaterized(uint termId, address member) external view returns (bool) {
        return LibCollateral._isUnderCollaterized(termId, member);
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

    /// @notice This function is used to check if a user has opted in for yield generation
    /// @param termId The term id for which the check is being made
    /// @param user The user for which the check is being made
    /// @return True if the user has opted in
    function userHasoptedInYG(uint termId, address user) external view returns (bool) {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];

        return yield.hasOptedIn[user];
    }

    /// @notice This function is used to get a user APY
    /// @param termId The term id for which the APY is being calculated
    /// @param user The user for which the APY is being calculated
    /// @return The APY for the user
    function userAPY(uint termId, address user) external view returns (uint256) {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];

        uint256 elaspedTime = block.timestamp - yield.startTimeStamp;

        uint userYieldGenerated = yield.withdrawnYield[user] +
            LibYieldGeneration._unwithdrawnUserYieldGenerated(termId, user);

        return
            (((userYieldGenerated * 10 ** 18) / collateral.collateralMembersBank[user]) *
                365 days) / elaspedTime;
    }

    /// @notice function to get fund information of a specific participant
    /// @param participant the user to get the info from
    /// @param termId the fund id
    /// @return paidThisCycle, true if has paid the current cycle
    /// @return paidNextCycle, true if has paid the next cycle
    function currentOrNextCyclePaid(
        address participant,
        uint termId
    ) external view returns (bool, bool) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];

        return (fund.paidThisCycle[participant], fund.paidNextCycle[participant]);
    }

    /// @notice checks if a participant have been a beneficiary
    /// @param termId the id of the term
    /// @param beneficiary the address of the participant to check
    /// @return true if the participant is a beneficiary
    function isBeneficiary(uint termId, address beneficiary) external view returns (bool) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        return fund.isBeneficiary[beneficiary];
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

    /// @notice checks if a participant have been expelled before being a beneficiary
    /// @param termId the id of the term
    /// @param user the address of the participant to check
    /// @return true if the participant is expelled before being a beneficiary
    function expelledBeforeBeneficiary(uint termId, address user) external view returns (bool) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        return fund.expelledBeforeBeneficiary[user];
    }

    /// @notice Gets the conversion rate of an amount in ETH to USD
    /// @param ethAmount The amount in ETH
    /// @return uint converted amount in USD correct to 18 decimals
    function getToStableConversionRate(uint ethAmount) external view returns (uint) {
        // NOTE: This will be made internal
        uint ethPrice = getLatestPrice();
        uint ethAmountInUSD = (ethPrice * ethAmount) / 10 ** 18;
        return ethAmountInUSD;
    }

    /// @notice Get the term's remaining cycles
    /// @param termId the term id
    /// @return remaining cycles
    function getRemainingCycles(uint termId) public view returns (uint) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];

        return (1 + fund.totalAmountOfCycles - fund.currentCycle);
    }

    /// @notice Get the term's remaining contribution amount converted from USDC to wei
    /// @param termId the term id
    /// @return remaining cycles contribution in wei
    function getRemainingCyclesContributionWei(uint termId) public view returns (uint) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[termId];

        uint remainingCycles;

        if (fund.currentState == LibFundStorage.FundStates.InitializingFund) {
            remainingCycles = term.totalParticipants;
        } else if (
            fund.currentState == LibFundStorage.FundStates.AcceptingContributions ||
            fund.currentState == LibFundStorage.FundStates.AwardingBeneficiary
        ) {
            remainingCycles = getRemainingCycles(termId);
        } else if (fund.currentState == LibFundStorage.FundStates.CycleOngoing) {
            remainingCycles = getRemainingCycles(termId) - 1;
        } else if (fund.currentState == LibFundStorage.FundStates.FundClosed) {
            remainingCycles = 0;
        }

        uint contributionAmountWei = getToCollateralConversionRate(
            term.contributionAmount * 10 ** 18
        );

        return remainingCycles * contributionAmountWei;
    }

    /// @notice Called to check the minimum collateral amount to deposit in wei
    /// @param termId term id
    /// @param depositorIndex the index the depositor wants to join
    /// @return amount the minimum collateral amount to deposit in wei
    /// @dev The minimum collateral amount is calculated based on the index on the depositors array
    /// @dev The return value should be the minimum msg.value when calling joinTerm
    /// @dev C = 1.5 Cp (Tp - I) where C = minimum collateral amount, Cp = contribution amount,
    ///      Tp = total participants, I = depositor index (starts at 0). 1.5
    function minCollateralToDeposit(
        uint termId,
        uint depositorIndex
    ) public view returns (uint amount) {
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[termId];

        require(depositorIndex < term.totalParticipants, "TT-GF-01");

        uint contributionAmountInWei = getToCollateralConversionRate(
            term.contributionAmount * 10 ** 18
        );

        amount = (contributionAmountInWei * (term.totalParticipants - depositorIndex) * 150) / 100;
    }

    /// @notice Gets latest ETH / USD price
    /// @dev Revert if there is problem with chainlink data
    /// @return uint latest price in Wei Note: 18 decimals
    function getLatestPrice() public view returns (uint) {
        LibTermStorage.TermConsts storage termConsts = LibTermStorage._termConsts();

        (
            ,
            int256 price_ethUSD,
            uint256 timeStamp_ethUSD,
            ,
            
        ) = AggregatorV3Interface(termConsts.aggregatorsAddresses["ETH/USD"]).latestRoundData(); //8 decimals

        // Check if chainlink data is not stale or incorrect
        require(
            timeStamp_ethUSD != 0 && price_ethUSD > 0,
            "TT-GF-02"
        );

        (
            ,
            int256 price_usdUSDC,
            uint256 timeStamp_usdUSDC,
            ,
        ) = AggregatorV3Interface(termConsts.aggregatorsAddresses["USDC/USD"]).latestRoundData(); //8 decimals

        require(
            timeStamp_usdUSDC != 0 &&
                price_usdUSDC > 0,
            "TT-GF-02"
        );

        int256 ethUSDC = price_ethUSD / price_usdUSDC;

        return uint(ethUSDC * 10 ** 18); //18 decimals
    }

    /// @notice Gets the conversion rate of an amount in USD to ETH
    /// @param USDAmount The amount in USD with 18 decimals
    /// @return uint converted amount in wei
    function getToCollateralConversionRate(uint USDAmount) public view returns (uint) {
        uint ethPrice = getLatestPrice();
        uint USDAmountInEth = (USDAmount * 10 ** 18) / ethPrice;
        return USDAmountInEth;
    }

    /// @notice This function is used to get the total yield generated for a term
    /// @param termId The term id for which the yield is being calculated
    /// @return The total yield generated for the term
    function totalYieldGenerated(uint termId) public view returns (uint) {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];

        uint totalWithdrawnYield;

        address[] memory arrayToCheck = yield.yieldUsers;
        uint arrayLength = arrayToCheck.length;

        for (uint i; i < arrayLength; ) {
            totalWithdrawnYield += yield.withdrawnYield[arrayToCheck[i]];

            /// @custom:unchecked-block without risk, i can't be higher than arrayLength
            unchecked {
                ++i;
            }
        }

        uint sharesInEth = LibYieldGeneration._sharesToEth(termId, yield);

        if (sharesInEth > yield.currentTotalDeposit) {
            return totalWithdrawnYield + sharesInEth - yield.currentTotalDeposit;
        } else {
            return totalWithdrawnYield;
        }
    }

    /// @notice Get all the terms a participant is part of
    /// @param participant the participant address
    /// @return an array with the term ids the participant is part of
    function getAllJoinedTerms(address participant) public view returns (uint[] memory) {
        LibTermStorage.TermStorage storage termStorage = LibTermStorage._termStorage();
        uint[] memory participantTermIds = termStorage.participantToTermId[participant];
        return participantTermIds;
    }

    /// @notice Get all the terms a participant is part of by a given state
    /// @param participant the participant address
    /// @param state the term state
    /// @return an array with the term ids the participant is part of, giving the state of the term
    function getJoinedTermsByState(
        address participant,
        LibTermStorage.TermStates state
    ) public view returns (uint[] memory) {
        uint[] memory joinedTerms = getAllJoinedTerms(participant);
        uint[] memory temporaryArray = new uint[](joinedTerms.length);
        uint termsCounter;
        uint joinedTermsLength = joinedTerms.length;

        for (uint i; i < joinedTermsLength; ) {
            if (LibTermStorage._termStorage().terms[joinedTerms[i]].state == state) {
                temporaryArray[termsCounter] = joinedTerms[i];

                /// @custom:unchecked-block without risk, termsCounter can't be higher than joinedTerms length
                unchecked {
                    ++termsCounter;
                }
            }

            /// @custom:unchecked-block without risk, i can't be higher than joinedTerms length
            unchecked {
                ++i;
            }
        }

        uint[] memory userTermsByState = new uint[](termsCounter);

        for (uint i; i < termsCounter; ) {
            userTermsByState[i] = temporaryArray[i];
            unchecked {
                ++i;
            }
        }

        return userTermsByState;
    }

    /// @notice Gets the remaining positions in a term and the corresponding security amount
    /// @param termId the term id
    /// @dev Available positions starts at 0
    /// @return availablePositions an array with the available positions
    /// @return securityAmount an array with the security amount for each available position
    function getAvailablePositionsAndSecurityAmount(
        uint termId
    ) public view returns (uint[] memory, uint[] memory) {
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];

        if (collateral.state != LibCollateralStorage.CollateralStates.AcceptingCollateral) {
            return (new uint[](0), new uint[](0));
        }

        uint depositorsLength = collateral.depositors.length;
        uint[] memory availablePositions = new uint[](depositorsLength);

        uint availablePositionsCounter;

        // Loop through the depositors array and get the available positions
        for (uint i; i < depositorsLength; ) {
            // The position is available if the depositor is address zero
            if (collateral.depositors[i] == address(0)) {
                // Add the position to the available positions array
                availablePositions[availablePositionsCounter] = i;

                // And increment the available positions counter
                unchecked {
                    ++availablePositionsCounter;
                }
            }

            /// @custom:unchecked-block without risk, i can't be higher than depositors length
            unchecked {
                ++i;
            }
        }

        // Create the arrays to return
        // The available positions array will have the length of the available positions counter
        // The security amount array will have the same length
        uint[] memory availablePositionsArray = new uint[](availablePositionsCounter);
        uint[] memory securityAmountArray = new uint[](availablePositionsCounter);

        // Loop through the available positions counter and fill the arrays
        for (uint i; i < availablePositionsCounter; ) {
            availablePositionsArray[i] = availablePositions[i];
            // Get the security amount for the position
            securityAmountArray[i] = minCollateralToDeposit(termId, availablePositions[i]);
            unchecked {
                ++i;
            }
        }

        // Return the arrays, the available positions array and the security amount array are coupled
        // availablePositionsArray[0] will have the securityAmountArray[0] and so on
        return (availablePositionsArray, securityAmountArray);
    }

    /// @notice Gets the remaining registration period for a term
    /// @dev Revert if nobody has deposited
    /// @param termId the term id
    /// @return remaining contribution period
    function getRemainingRegistrationTime(uint termId) public view returns (uint) {
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[termId];
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];
        if (
            collateral.firstDepositTime == 0 ||
            block.timestamp >= collateral.firstDepositTime + term.registrationPeriod
        ) {
            return 0;
        } else {
            return collateral.firstDepositTime + term.registrationPeriod - block.timestamp;
        }
    }

    /// @notice returns the time left to contribute for this cycle
    /// @param termId the fund id
    /// @return the time left to contribute
    function getRemainingContributionTime(uint termId) public view returns (uint) {
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

    /// @notice Get the term's remaining time in the current cycle
    /// @param termId the term id
    /// @return remaining time in the current cycle
    function getRemainingCycleTime(uint termId) public view returns (uint) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[termId];
        uint cycleEndTimestamp = term.cycleTime * fund.currentCycle + fund.fundStart;
        if (block.timestamp > cycleEndTimestamp) {
            return 0;
        } else {
            return cycleEndTimestamp - block.timestamp;
        }
    }

    /// @notice checks if the money pot is frozen for a participant
    /// @param _participant the user to check
    /// @param _termId the fund id
    /// @return _isMoneyPotFrozen true if the money pot is frozen
    function _checkFrozenMoneyPot(
        address _participant,
        uint _termId
    ) internal view returns (bool _isMoneyPotFrozen) {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[_termId];
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[_termId];

        if (fund.expelledBeforeBeneficiary[_participant]) {
            _isMoneyPotFrozen = false;
        } else {
            uint neededCollateral = (110 * getRemainingCyclesContributionWei(_termId)) / 100; // 1.1 x RCC

            if (collateral.collateralMembersBank[_participant] < neededCollateral) {
                _isMoneyPotFrozen = true;
            } else {
                _isMoneyPotFrozen = false;
            }
        }
    }
}
