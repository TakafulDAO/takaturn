// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {LibTermV2} from "../libraries/LibTermV2.sol";
import {LibCollateral} from "../../version-1/libraries/LibCollateral.sol";
import {LibFundV2} from "../libraries/LibFundV2.sol";

interface IGettersV2 {
    function getTermsId() external view returns (uint, uint);

    function getTermSummary(uint id) external view returns (LibTermV2.Term memory);

    function getParticipantTerms(address participant) external view returns (uint[] memory);

    function getRemainingCycleTime(uint id) external view returns (uint);

    function minCollateralToDeposit(uint id) external view returns (uint);

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
            LibFundV2.FundStates,
            IERC20,
            uint,
            address[] memory,
            uint,
            uint,
            address,
            uint,
            uint
        );

    function getCurrentBeneficiary(uint id) external view returns (address);

    function getParticipantFundSummary(
        address participant,
        uint id
    ) external view returns (bool, bool, bool, bool, uint);

    function getRemainingContributionTime(uint id) external view returns (uint);

    function getToEthConversionRate(uint USDAmount) external view returns (uint);

    function getToUSDConversionRate(uint ethAmount) external view returns (uint);
}
