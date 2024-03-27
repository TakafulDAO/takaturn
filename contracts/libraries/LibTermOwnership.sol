// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import {LibTermStorage} from "../libraries/LibTermStorage.sol";

library LibTermOwnership {
    /// @dev Revert if the sender is not the term owner.
    function _ensureTermOwner(uint termId) internal view {
        require(LibTermStorage._termStorage().terms[termId].termOwner == msg.sender, "TT-LTO-01");
    }
}
