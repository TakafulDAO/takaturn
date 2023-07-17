// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {LibTerm} from "../libraries/LibTerm.sol";
import {LibCollateral} from "../libraries/LibCollateral.sol";
import {LibFund} from "../libraries/LibFund.sol";

contract GettersFacet {
    function getTermsId() external view returns (uint, uint) {
        LibTerm.TermStorage storage termStorage = LibTerm._termStorage();
        uint lastTermId = termStorage.nextTermId - 1;
        uint nextTermId = termStorage.nextTermId;
        return (lastTermId, nextTermId);
    }

    function getTermSummary(uint id) external view returns (LibTerm.Term memory) {
        return (LibTerm._termStorage().terms[id]);
    }

    function getDepositorCollateralSummary(
        address depositor,
        uint id
    ) external view returns (bool, uint, uint) {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[id];
        return (
            collateral.isCollateralMember[depositor],
            collateral.collateralMembersBank[depositor],
            collateral.collateralPaymentBank[depositor]
        );
    }

    function getCollateralSummary(
        uint id
    )
        external
        view
        returns (bool, LibCollateral.CollateralStates, uint, uint, address[] memory, uint)
    {
        LibCollateral.Collateral storage collateral = LibCollateral
            ._collateralStorage()
            .collaterals[id];
        return (
            collateral.initialized,
            collateral.state, // Current state of Collateral
            collateral.firstDepositTime, // Time when the first deposit was made
            collateral.counterMembers, // Current member count
            collateral.depositors, // List of depositors
            collateral.collateralDeposit // Collateral
        );
    }

    /// @notice function to get the cycle information in one go
    function getFundSummary(
        uint id
    )
        external
        view
        returns (
            bool,
            LibFund.FundStates,
            IERC20,
            uint,
            address[] memory,
            uint,
            uint,
            address,
            uint
        )
    {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[id];
        return (
            fund.initialized,
            fund.currentState,
            fund.stableToken,
            fund.currentCycle,
            fund.beneficiariesOrder,
            fund.fundStart,
            fund.currentCycle,
            fund.lastBeneficiary,
            fund.totalAmountOfCycles
        );
    }

    /// @notice returns the beneficiaries order as an array
    function getBeneficiariesOrder(uint id) external view returns (address[] memory) {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[id];
        return fund.beneficiariesOrder;
    }

    /// @notice function to get cycle information of a specific participant
    /// @param participant the user to get the info from
    function getParticipantFundSummary(
        address participant,
        uint id
    ) external view returns (bool, bool, bool, bool, uint) {
        LibFund.Fund storage fund = LibFund._fundStorage().funds[id];
        return (
            fund.isParticipant[participant],
            fund.isBeneficiary[participant],
            fund.paidThisCycle[participant],
            fund.autoPayEnabled[participant],
            fund.beneficiariesPool[participant]
        );
    }
}
