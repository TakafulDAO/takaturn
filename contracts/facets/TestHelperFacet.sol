// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IGetters} from "../interfaces/IGetters.sol";

import {LibFundStorage} from "../libraries/LibFundStorage.sol";
import {LibCollateralStorage} from "../libraries/LibCollateralStorage.sol";
import {LibTermStorage} from "../libraries/LibTermStorage.sol";

import "hardhat/console.sol";

contract TestHelperFacet {
    /// @notice Helper function to test the error InsufficientBalance on FundFacet is working
    function testInsufficientBalance(uint termId) external {
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];
        uint balance = fund.stableToken.balanceOf(address(this));
        bool success = fund.stableToken.transfer(msg.sender, balance);
        require(success, "Transfer failed");
    }

    /// @notice Helper function to test the Github CD workflows, and multisig deploys
    function testGithubCDWorkflowsAndMultisigDeploys() external pure returns (string memory) {
        return "Test Workflow [demo]";
    }

    /// @notice Helper function to test money pot liquidations
    function testLiquidateMoneyPot(uint termId, address participant) external {
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[termId];

        uint contributionAmountWei = IGetters(address(this)).getToCollateralConversionRate(
            term.contributionAmount * 10 ** 18
        );

        collateral.collateralMembersBank[participant] = contributionAmountWei / 2;
    }

    function testLiquidateCollateralAndMoneyPot(uint termId, address participant) external {
        LibCollateralStorage.Collateral storage collateral = LibCollateralStorage
            ._collateralStorage()
            .collaterals[termId];
        LibTermStorage.Term storage term = LibTermStorage._termStorage().terms[termId];
        LibFundStorage.Fund storage fund = LibFundStorage._fundStorage().funds[termId];

        uint contributionAmountWei = IGetters(address(this)).getToCollateralConversionRate(
            term.contributionAmount * 10 ** 18
        );

        collateral.collateralMembersBank[participant] = contributionAmountWei / 2;
        fund.beneficiariesPool[participant] = 0;
    }
}
