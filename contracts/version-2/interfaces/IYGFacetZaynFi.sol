// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {LibTermV2} from "../libraries/LibTermV2.sol";

interface IYGFacetZaynFi {
    function depositYG(uint termId, uint amount) external;

    function withdrawYG(uint termId, address user, uint256 ethAmount) external;

    function toggleOptInYG(uint termId) external;
}
