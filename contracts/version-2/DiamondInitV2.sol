// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import {LibTermV2} from "./libraries/LibTermV2.sol";

contract DiamondInitV2 {
    function init(address _aggregatorAddress, address _sequencerUptimeFeedAddress) external {
        LibTermV2.TermConsts storage termConsts = LibTermV2._termConsts();
        termConsts.sequencerStartupTime = 3600; // The sequencer must be running for at least an hour before it's reliable
        termConsts.aggregatorAddress = _aggregatorAddress;
        termConsts.sequencerUptimeFeedAddress = _sequencerUptimeFeedAddress;
    }
}
