// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.20;

interface ITerm {
    function createTerm(
        uint totalParticipants,
        uint cycleTime,
        uint contributionAmount,
        uint contributionPeriod,
        uint fixedCollateralEth,
        address stableTokenAddress,
        address aggregatorAddress
    ) external returns (uint);

    function joinTerm(uint termId) external;

    function startTerm(uint termId) external;
}
