// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {LibTermV2} from "../libraries/LibTermV2.sol";
import {LibCollateralV2} from "../libraries/LibCollateralV2.sol";
import {LibFundV2} from "../libraries/LibFundV2.sol";

interface IGettersV2 {
    // TERM GETTERS

    function getTermsId() external view returns (uint, uint);

    function getRemainingContributionPeriod(uint termId) external view returns (uint);

    function getTermSummary(uint id) external view returns (LibTermV2.Term memory);

    function getParticipantTerms(address participant) external view returns (uint[] memory);

    function getRemainingCycles(uint id) external view returns (uint);

    function getRemainingCycleTime(uint id) external view returns (uint);

    function getRemainingCyclesContributionWei(uint id) external view returns (uint);

    // COLLATERAL GETTERS

    function getDepositorCollateralSummary(
        address depositor,
        uint id
    ) external view returns (bool, uint, uint, uint);

    function getCollateralSummary(
        uint id
    ) external view returns (bool, LibCollateralV2.CollateralStates, uint, uint, address[] memory);

    function minCollateralToDeposit(
        LibTermV2.Term memory term,
        uint depositorIndex
    ) external view returns (uint);

    // FUND GETTERS

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

    function wasExpelled(uint id, address user) external view returns (bool);

    function getParticipantFundSummary(
        address participant,
        uint id
    ) external view returns (bool, bool, bool, bool, uint);

    function getRemainingContributionTime(uint id) external view returns (uint);

    // CONVERSION GETTERS

    function getToEthConversionRate(uint USDAmount) external view returns (uint);

    function getToUSDConversionRate(uint ethAmount) external view returns (uint);

    // YIELD GENERATION GETTERS

    function userAPR(uint termId, address user) external view returns (uint256);

    function termAPR(uint termId) external view returns (uint256);

    function yieldDistributionRatio(uint termId, address user) external view returns (uint256);

    function totalYieldGenerated(uint termId) external view returns (uint);

    function userYieldGenerated(uint termId, address user) external view returns (uint);
}
