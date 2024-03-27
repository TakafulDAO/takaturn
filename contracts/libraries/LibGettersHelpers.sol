// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

library LibGettersHelpers {
    struct NonUserRelated {
        // Positions and security deposits related
        uint[] availablePositions;
        uint[] securityDeposits;
        // Times and com=ntributions related
        uint remainingRegistrationTime; // In seconds
        uint remainingContributionTime; // In seconds
        uint remainingCycleTime; // In seconds
        uint remainingCycles;
        uint rcc; // Remaining Contribution Cycles in wei
        uint latestPrice; // From Chainlink
        // Collateral related
        bool collateralInitialized;
        uint collateralFirstDepositTime; // In seconds
        uint collateralCounterMembers; // Member count
        // Fund related
        bool fundInitialized;
        uint fundStartTime; // In seconds
        uint fundEndTime; // In seconds
        uint fundCurrentCycle;
        uint fundExpellantsCount;
        uint fundTotalCycles;
        address[] fundBeneficiariesOrder;
        // Yield related
        bool yieldInitialized;
        uint yieldStartTime; // In seconds
        uint yieldTotalDeposit; // In wei
        uint yieldCurrentTotalDeposit; // In wei
        uint yieldTotalShares;
    }

    struct UserRelated {
        // Collateral related
        bool collateralMember;
        uint membersBank;
        uint paymentBank;
        uint deposited;
        uint expulsonLimit;
        // Fund related
        bool fundMember;
        bool beneficiary;
        bool currentCyclePaid;
        bool nextCyclePaid;
        bool autoPayer;
        bool moneyPotFrozen;
        uint pool;
        uint cycleExpelled;
        // Yield related
        bool yieldMember;
        uint yieldWithdrawn;
        uint collateralWithdrawnFromYield;
        uint yieldAvailable;
        uint collateralDepositedInYield;
        uint ditributedYield;
    }
}
