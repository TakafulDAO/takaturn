// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.18;

import {LibTerm} from "../libraries/LibTerm.sol";

contract GettersFacet {
    function getLastTermId() external view returns (uint) {
        return (LibTerm._termStorage().nextTermId);
    }

    function getTermSummary(uint id) external view returns (LibTerm.Term memory) {
        return (LibTerm._termStorage().terms[id]);
    }
}
