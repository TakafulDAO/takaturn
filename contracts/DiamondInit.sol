// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {LibCollateral} from "./libraries/LibCollateral.sol";

contract DiamondInit {
    function init(address _aggregatorAddress) external {
        LibCollateral._aggregator().priceFeed = AggregatorV3Interface(_aggregatorAddress);
    }
}
