// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

interface ITermV2 {
    function createTerm(
        uint totalParticipants,
        uint cycleTime,
        uint contributionAmount,
        uint contributionPeriod,
        uint fixedCollateralEth,
        uint collateralAmount,
        address stableTokenAddress,
        address aggregatorAddress
    ) external returns (uint);

    function joinTerm(uint termId) external payable;

    function startTerm(uint termId) external;
}
