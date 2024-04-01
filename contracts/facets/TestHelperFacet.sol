// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IGetters} from "../interfaces/IGetters.sol";

import {LibFundStorage} from "../libraries/LibFundStorage.sol";
import {LibCollateralStorage} from "../libraries/LibCollateralStorage.sol";
import {LibTermStorage} from "../libraries/LibTermStorage.sol";

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
}
