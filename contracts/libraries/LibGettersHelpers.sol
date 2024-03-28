// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {LibCollateralStorage} from ".libraries/LibCollateralStorage.sol";
import {LibFundStorage} from "./LibFundStorage.sol";

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
        LibCollateralStorage.CollateralStates collateralState;
        // Fund related
        bool fundInitialized;
        uint fundStartTime; // In seconds
        uint fundEndTime; // In seconds
        uint fundCurrentCycle;
        uint fundExpellantsCount;
        uint fundTotalCycles;
        address[] fundBeneficiariesOrder;
        LibFundStorage.FundStates fundState;
        IERC20 stableToken;
        // Yield related
        bool yieldInitialized;
        uint yieldStartTime; // In seconds
        uint yieldTotalDeposit; // In wei
        uint yieldCurrentTotalDeposit; // In wei
        uint yieldTotalShares;
        address[] yieldUsers;
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
