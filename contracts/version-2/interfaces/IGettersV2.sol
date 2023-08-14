// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {LibTermV2} from "../libraries/LibTermV2.sol";
import {LibCollateralV2} from "../libraries/LibCollateralV2.sol";
import {LibFundV2} from "../libraries/LibFundV2.sol";

interface IGettersV2 {
    function getTermsId() external view returns (uint, uint);

    function getTermSummary(uint id) external view returns (LibTermV2.Term memory);

    function getParticipantTerms(address participant) external view returns (uint[] memory);

    function getRemainingCycleTime(uint id) external view returns (uint);

    function minCollateralToDeposit(
        LibTermV2.Term memory term,
        uint depositorIndex
    ) external view returns (uint);

    function getDepositorCollateralSummary(
        address depositor,
        uint id
    ) external view returns (bool, uint, uint, uint);

    function getCollateralSummary(
        uint id
    ) external view returns (bool, LibCollateralV2.CollateralStates, uint, uint, address[] memory);

    function getFundSummary(
        uint id
    )
        external
        view
        returns (
            bool,
            LibFundV2.FundStates,
            IERC20,
            address[] memory,
            uint,
            uint,
            uint,
            address,
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
