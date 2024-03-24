// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

interface ITerm {
    /// @notice Create a new term
    /// @param totalParticipants The number of participants in the term
    /// @param registrationPeriod The time in seconds that the term will be open for registration
    /// @param cycleTime The time in seconds that the term will last
    /// @param contributionAmount The amount of stable token that each participant will have to contribute
    /// @param contributionPeriod The time in seconds that the participants will have to contribute
    /// @param stableTokenAddress The address of the stable token
    /// @return termId The id of the new term
    function createTerm(
        uint totalParticipants,
        uint registrationPeriod,
        uint cycleTime,
        uint contributionAmount,
        uint contributionPeriod,
        address stableTokenAddress
    ) external returns (uint);

    /// @notice Join a term at the next available position
    /// @param termId The id of the term
    /// @param optYield Whether the participant wants to opt in for yield generation
    function joinTerm(uint termId, bool optYield) external payable;

    /// @notice Join a term at a specific position
    /// @param termId The id of the term
    /// @param optYield Whether the participant wants to opt in for yield generation
    /// @param position The position in the term
    function joinTerm(uint termId, bool optYield, uint position) external payable;

    /// @notice Pay security deposit on behalf of someone else, at the next available position
    /// @param termId The id of the term
    /// @param optYield Whether the participant wants to opt in for yield generation
    /// @param newParticipant The address of the new participant
    function paySecurityOnBehalfOf(
        uint termId,
        bool optYield,
        address newParticipant
    ) external payable;

    /// @notice Pay security deposit on behalf of someone else, at a specific position
    /// @param termId The id of the term
    /// @param optYield Whether the participant wants to opt in for yield generation
    /// @param newParticipant The address of the new participant
    /// @param position The position in the term
    function paySecurityOnBehalfOf(
        uint termId,
        bool optYield,
        address newParticipant,
        uint position
    ) external payable;

    /// @notice Start a term
    /// @param termId The id of the term
    function startTerm(uint termId) external;

    /// @notice Expire a term
    /// @param termId The id of the term
    function expireTerm(uint termId) external;
}
