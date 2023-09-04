// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import {LibTerm} from "./libraries/LibTerm.sol";

contract DiamondInit {
    function init(address _sequencerUptimeFeedAddress) external {
        LibTerm.TermConsts storage termConsts = LibTerm._termConsts();
        termConsts.sequencerStartupTime = 3600; // The sequencer must be running for at least an hour before it's reliable
        termConsts.sequencerUptimeFeedAddress = _sequencerUptimeFeedAddress;
    }
}
