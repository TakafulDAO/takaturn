// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {AppStorage} from "../../AppStorage.sol";

contract ActionFacetAppStorage {
    AppStorage internal s;

    function save(string calldata _name) external {
        s.name = _name;
    }

    function action() external {
        s.name = string(abi.encodePacked(s.name, "_1"));
    }
}
