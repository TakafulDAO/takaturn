// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract MockSequencer is AggregatorV3Interface {
    int256 price;
    uint8 numDecimals;
    int256 sequencerAnswer;
    uint256 time;

    constructor(uint8 _numDecimals, int256 _price) {
        price = _price;
        numDecimals = _numDecimals;
        sequencerAnswer = 0;
        time = block.timestamp;
    }

    function decimals() external view override returns (uint8) {
        return numDecimals;
    }

    function description() external pure override returns (string memory) {
        return "Mock Sequencer Uptime Feed";
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function setSequencerAnswer() public returns (int256) {
        if (sequencerAnswer == 0) {
            sequencerAnswer = 1;
        } else {
            sequencerAnswer = 0;
            time = block.timestamp;
        }
        return sequencerAnswer;
    }

    function setPrice(int256 _price) public {
        price = _price;
    }

    function setDecimals(uint8 _decimals) public {
        numDecimals = _decimals;
    }

    // getRoundData and latestRoundData should both raise "No data present"
    // if they do not have data to report, instead of returning unset values
    // which could be misinterpreted as actual reported values.
    function getRoundData(
        uint80 _roundId
    )
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        roundId = _roundId;
        answer = sequencerAnswer;
        startedAt = time;
        updatedAt = time;
        answeredInRound = 0;
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        roundId = 0;
        answer = sequencerAnswer;
        startedAt = time;
        updatedAt = time;
        answeredInRound = 0;
    }
}
