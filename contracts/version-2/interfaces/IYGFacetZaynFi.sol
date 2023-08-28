// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {LibTermV2} from "../libraries/LibTermV2.sol";

interface IYGFacetZaynFi {
    function depositYG(uint termId, uint amount, string memory providerName) external;

    function withdrawYG(
        uint termId,
        address user,
        uint256 ethAmount,
        string memory providerName
    ) external;

    function toggleOptInYG(uint termId) external;
}
