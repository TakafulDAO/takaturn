// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {LibTermV2} from "../libraries/LibTermV2.sol";

interface IYGFacetZaynFi {
    function depositYG(uint termId, uint amount) external;

    function withdrawYG(
        uint termId,
        uint256 ethAmount,
        address user
    ) external returns (uint neededShares);

    function toggleOptInYG(uint termId) external;

    function updateYieldProvider(string memory providerString, address providerAddress) external;
}
