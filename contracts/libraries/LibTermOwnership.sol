// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import {LibTerm} from "../libraries/LibTerm.sol";

library LibTermOwnership {
    /**
     * @dev Throws if the sender is not the term owner.
     * @dev Used for internal calls
     */
    function _ensureTermOwner(uint termId) internal view {
        require(
            LibTerm._termStorage().terms[termId].termOwner == msg.sender,
            "TermOwnable: caller is not the owner"
        );
    }
}
