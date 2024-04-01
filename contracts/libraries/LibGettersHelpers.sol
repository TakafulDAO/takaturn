// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

library LibGettersHelpers {
    struct NonUserRelated {
        // Positions and security deposits related
        uint[] availablePositions;
        uint[] securityDeposits;
        // Times and contributions related
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
        address[] collateralMembers;
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
        address[] yieldUsers;
        address vaultAddress;
        address zapAddress;
    }

    struct UserRelated {
        // Collateral related
        bool collateralMember;
        bool isUnderCollaterized;
        uint membersBank;
        uint paymentBank;
        uint deposited;
        uint expulsonLimit;
        uint withdrawableBalance;
        // Fund related
        bool fundMember;
        bool beneficiary;
        bool currentCyclePaid;
        bool nextCyclePaid;
        bool autoPayer;
        bool moneyPotFrozen;
        bool exemptedThisCycle;
        uint pool;
        uint cycleExpelled;
        // Yield related
        bool yieldMember;
        uint collateralDepositedInYield;
        uint collateralWithdrawnFromYield;
        uint yieldAvailable;
        uint yieldWithdrawn;
        uint distributedYield;
    }
}
