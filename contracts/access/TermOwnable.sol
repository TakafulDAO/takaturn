// SPDX-License-Identifier: MIT
// Copied from OpenZeppelin Contracts (last updated v4.9.0) (access/Ownable.sol)

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Context.sol";

import {LibTerm} from "../libraries/LibTerm.sol";

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that starts a new term. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyTermOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
contract TermOwnable is Context {
    event TermOwnershipTransferred(address indexed previousTermOwner, address indexed newTermOwner);

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyTermOwner(uint termId) {
        _checkTermOwner(termId);
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function termOwner(uint termId) internal view virtual returns (address) {
        return LibTerm._termStorage().terms[termId].termOwner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkTermOwner(uint termId) internal view virtual {
        require(termOwner(termId) == _msgSender(), "TermOwnable: caller is not the owner");
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyTermOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceTermOwnership(uint termId) internal virtual onlyTermOwner(termId) {
        _transferTermOwnership(termId, address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferTermOwnership(
        uint termId,
        address newTermOwner
    ) internal virtual onlyTermOwner(termId) {
        require(newTermOwner != address(0), "Ownable: new owner is the zero address");
        _transferTermOwnership(termId, newTermOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferTermOwnership(uint termId, address newTermOwner) internal virtual {
        LibTerm.Term storage term = LibTerm._termStorage().terms[termId];
        address oldOwner = term.termOwner;
        term.termOwner = newTermOwner;
        emit TermOwnershipTransferred(oldOwner, newTermOwner);
    }
}
