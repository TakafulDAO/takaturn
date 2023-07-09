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
abstract contract TermOwnable is Context {

    event TermOwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyTermOwner(uint termId) {
        _checkOwner(termId);
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner(uint termId) public view virtual returns (address) {
        return LibTerm._termStorage().terms[termId].owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner(uint termId) internal view virtual {
        require(owner(termId) == _msgSender(), "TermOwnable: caller is not the owner");
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyTermOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership(uint termId) public virtual onlyTermOwner(termId) {
        _transferOwnership(termId, address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(uint termId, address newOwner) public virtual onlyTermOwner(termId) {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(termId, newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(uint termId, address newOwner) internal virtual {
        LibTerm.Term storage term = LibTerm._termStorage().terms[termId];
        address oldOwner = term.owner;
        term.owner = newOwner;
        emit TermOwnershipTransferred(oldOwner, newOwner);
    }
}
