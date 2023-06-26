// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {AppStorage} from "../../AppStorage.sol";

contract TestFacetAppStorage {
    AppStorage internal s;

    function saveNumber(uint256 v) external {
        s.value = v;
    }

    function getNumber() external view returns (uint256) {
        return s.value;
    }
}
