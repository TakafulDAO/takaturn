// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

contract NewFacet {
    function sayHello(string calldata name) external pure returns (string memory) {
        return string(abi.encodePacked("hello modified : ", name));
    }

    function sayHello2(string calldata name) external pure returns (string memory) {
        return string(abi.encodePacked("hello2 : ", name));
    }
}
