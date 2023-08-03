// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {LibTerm} from "../libraries/LibTerm.sol";
import {LibCollateral} from "../libraries/LibCollateral.sol";
import {LibFund} from "../libraries/LibFund.sol";

interface IGetters {
    function getTermsId() external view returns (uint, uint);

    function getTermSummary(uint id) external view returns (LibTerm.Term memory);

    function getRemainingCycleTime(uint id) external view returns (uint);

    function getDepositorCollateralSummary(
        address depositor,
        uint id
    ) external view returns (bool, uint, uint);

    function getCollateralSummary(
        uint id
    )
        external
        view
        returns (bool, LibCollateral.CollateralStates, uint, uint, address[] memory, uint);

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
            uint,
            uint
        );

    function getParticipantFundSummary(
        address participant,
        uint id
    ) external view returns (bool, bool, bool, bool, uint);

    function getRemainingContributionTime(uint id) external view returns (uint);
}
