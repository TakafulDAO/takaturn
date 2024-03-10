// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

interface ITerm {
    function createTerm(
        uint totalParticipants,
        uint registrationPeriod,
        uint cycleTime,
        uint contributionAmount,
        uint contributionPeriod,
        address stableTokenAddress
    ) external returns (uint);

    function joinTerm(uint termId, bool optYield) external payable;

    function joinTerm(uint termId, bool optYield, uint position) external payable;

    function paySecurityOnBehalfOf(
        uint termId,
        bool optYield,
        address newParticipant
    ) external payable;

    function paySecurityOnBehalfOf(
        uint termId,
        bool optYield,
        address newParticipant,
        uint position
    ) external payable;

    function startTerm(uint termId) external;

    function expireTerm(uint termId) external;
}
