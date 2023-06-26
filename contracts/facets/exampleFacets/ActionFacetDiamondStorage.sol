// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {LibDiamondStorageExample} from "../../libraries/exampleLibraries/LibDiamondStorageExample.sol";

contract ActionFacetDiamondStorage {
    function save(string calldata _name) external {
        LibDiamondStorageExample._myStructStorage().name = _name;
    }

    function action(uint256 _value) external {
        LibDiamondStorageExample._myStructStorage().value = _value;
    }
}
