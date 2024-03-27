// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

library LibGettersHelpers {
    struct TimesAndContributionsHelper {
        uint remainingRegistrationTime; // In seconds
        uint remainingContributionTime; // In seconds
        uint remainingCycleTime; // In seconds
        uint remainingCycles;
        uint rcc; // Remaining Contribution Cycles in wei
        uint latestPrice; // From Chainlink
    }

    struct CollateralNonUserRelatedHelper {
        uint collateralFirstDepositTime; // In seconds
        uint collateralCounterMembers; // Member count
    }

    struct FundNonUserRelatedHelper {
        uint fundStartTime; // In seconds
        uint fundEndTime; // In seconds
        uint fundCurrentCycle;
        uint fundExpellantsCount;
        uint fundTotalCycles;
    }

    struct YieldNonUserRelatedHelper {
        uint yieldStartTime; // In seconds
        uint yieldTotalDeposit; // In wei
        uint yieldCurrentTotalDeposit; // In wei
        uint yieldTotalShares;
    }

    struct NonUserRelatedHelper {
        uint remainingRegistrationTime; // In seconds
        uint remainingContributionTime; // In seconds
        uint remainingCycleTime; // In seconds
        uint remainingCycles;
        uint rcc; // Remaining Contribution Cycles in wei
        uint latestPrice; // From Chainlink
        uint collateralFirstDepositTime; // In seconds
        uint collateralCounterMembers; // Member count
        uint fundStartTime; // In seconds
        uint fundEndTime; // In seconds
        uint fundCurrentCycle;
        uint fundExpellantsCount;
        uint fundTotalCycles;
        uint yieldStartTime; // In seconds
        uint yieldTotalDeposit; // In wei
        uint yieldCurrentTotalDeposit; // In wei
        uint yieldTotalShares;
    }
}
