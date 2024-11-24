// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IGetters} from "../interfaces/IGetters.sol";
import {IZaynVaultV2TakaDao} from "../interfaces/IZaynVaultV2TakaDao.sol";

import {LibFundStorage} from "../libraries/LibFundStorage.sol";
import {LibCollateralStorage} from "../libraries/LibCollateralStorage.sol";
import {LibTermStorage} from "../libraries/LibTermStorage.sol";
import {LibYieldGenerationStorage} from "../libraries/LibYieldGenerationStorage.sol";

import "hardhat/console.sol";

contract TestHelperFacet {
    /// @notice Helper function to test the error InsufficientBalance on FundFacet is working
    function testHelper_InsufficientBalance(uint termId) external {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        uint balance = fund.stableToken.balanceOf(address(this));
        bool success = fund.stableToken.transfer(msg.sender, balance);
        require(success, "Transfer failed");
    }

    /// @notice Helper function to test the Github CD workflows, and multisig deploys
    function testHelper_GithubCDWorkflowsAndMultisigDeploys()
        external
        pure
        returns (string memory)
    {
        return "Test Workflow [demo]";
    }

    function testHelper_setCollateralMembersBank(
        uint termId,
        uint amount,
        address participant
    ) external {
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];

        collateral.collateralMembersBank[participant] = amount;
    }

    function testHelper_setCollateralPaymentBank(
        uint termId,
        uint amount,
        address participant
    ) external {
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];

        collateral.collateralPaymentBank[participant] = amount;
    }

    function testHelper_setBeneficiariesPool(
        uint termId,
        uint amount,
        address participant
    ) external {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];

        fund.beneficiariesPool[participant] = amount;
    }

    function testHelper_positiveReimbursement(
        uint originalWithdrawal,
        uint originalShares,
        uint termId
    ) external {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];
        uint correctedShares = (originalWithdrawal * yield.totalShares) / yield.totalDeposit;

        if (correctedShares < originalShares) {
            uint correction = (originalShares - correctedShares) * 2;
            yield.totalShares =
                yield.totalShares +
                (correction * (yield.totalDeposit / originalWithdrawal));
        }

        uint newCorrectedShares = (originalWithdrawal * yield.totalShares) / yield.totalDeposit;

        assert(newCorrectedShares > originalShares);
    }

    function testHelper_reimburseExtraYield(uint termId) external {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];

        yield.totalShares = yield.totalShares / 2;
    }

    function testHelper_reimburseExtraYieldSmallAmounts(uint termId) external {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];

        address vaultAddress = yield.providerAddresses["ZaynVault"];

        uint neededShares = (yield.currentTotalDeposit * yield.totalShares) / yield.totalDeposit;
        uint actualShares = IZaynVaultV2TakaDao(vaultAddress).balanceOf(termId);

        if (actualShares == neededShares) {
            yield.totalShares = yield.totalShares - 1;
        }

        uint newNeededShares = (yield.currentTotalDeposit * yield.totalShares) / yield.totalDeposit;

        assert((actualShares - newNeededShares) < 100000);
    }

    function testHelper_restoreYieldBalanceInvalidCurrentTotalDeposit(
        uint termId,
        address user
    ) external {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];

        uint withdraw = yield.withdrawnCollateral[user];
        uint deposit = yield.depositedCollateralByUser[user];

        if (withdraw < deposit) {
            console.log("User has not withdrawn enough");
            yield.withdrawnCollateral[user] = deposit + 1;
        }
    }

    function testHelper_restoreYieldBalanceWithdrawnTooMuch(uint termId, address user) external {
        LibYieldGenerationStorage.YieldGeneration storage yield = LibYieldGenerationStorage
            ._yieldStorage()
            .yields[termId];

        uint withdraw = yield.withdrawnCollateral[user];
        uint deposit = yield.depositedCollateralByUser[user];

        if (withdraw < deposit) {
            console.log("User has not withdrawn enough");
            yield.withdrawnCollateral[user] = deposit + 1;
        }
    }
}
