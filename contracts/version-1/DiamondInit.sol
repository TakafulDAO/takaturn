// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import {LibTerm} from "./libraries/LibTerm.sol";

contract DiamondInit {
    function init() external {
        LibTerm.TermConsts storage termConsts = LibTerm._termConsts();
        termConsts.sequencerStartupTime = 3600; // The sequencer must be running for at least an hour before it's reliable
        termConsts.sequencerUptimeFeedAddress = address(0xFdB631F5EE196F0ed6FAa767959853A9F217697D); // TODO: make this a deploy parameter on the diamond
    }
}
