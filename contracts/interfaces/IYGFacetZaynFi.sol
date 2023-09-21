// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {LibTerm} from "../libraries/LibTerm.sol";

interface IYGFacetZaynFi {
    function depositYG(uint termId, uint amount) external;

    function withdrawYG(
        uint termId,
        uint256 ethAmount,
        address user
    ) external returns (uint neededShares);

    function claimAvailableYield(uint termId) external;

    function claimAvailableYield(uint termId, address user) external;

    function toggleOptInYG(uint termId) external;

    function updateYieldProvider(string memory providerString, address providerAddress) external;
}
