// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {LibDiamondStorageExample} from "../../libraries/exampleLibraries/LibDiamondStorageExample.sol";

contract TestFacetDiamondStorage {
    function saveNumber(uint256 v) external {
        LibDiamondStorageExample._myStructStorage().value = v;
    }

    function getNumber() external view returns (uint256) {
        return LibDiamondStorageExample._myStructStorage().value;
    }
}
