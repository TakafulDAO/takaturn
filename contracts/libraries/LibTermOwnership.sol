// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import {LibTerm} from "../libraries/LibTerm.sol";

library LibTermOwnership {
    bytes32 constant TERM_OWNER_HELPER = keccak256("diamond.standard.term.owner.helper");

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
