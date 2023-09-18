// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

library LibWithdrawGoerliEth {
    bytes32 constant TRUSTED_MANAGERS_POSITION = keccak256("diamond.standard.trusted.managers");

    struct TrustedManagers {
        address[] managers;
    }

    function _trustedManagers() internal pure returns (TrustedManagers storage trustedManagers) {
        bytes32 position = TRUSTED_MANAGERS_POSITION;
        assembly {
            trustedManagers.slot := position
        }
    }

    function _addTrustedAddress(address newManager) internal {
        require(newManager != address(0), "Invalid address");
        TrustedManagers storage managers = _trustedManagers();
        managers.managers.push(newManager);
    }

    function _enforceIsTrustedManager(address managerCheck) internal view returns (bool) {
        TrustedManagers storage managers = _trustedManagers();
        uint length = managers.managers.length;
        for (uint i; i < length; ) {
            if (managers.managers[i] == managerCheck) {
                return true;
            }
            unchecked {
                ++i;
            }
        }
        return false;
    }
}
