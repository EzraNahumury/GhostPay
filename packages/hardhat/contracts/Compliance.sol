// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IAgentRegistry.sol";

/**
 * @title Compliance
 * @notice Selective-disclosure view-keys + access logging. Ported from Sui `compliance.move`.
 *
 * Design note (Move -> EVM):
 *   Sui gated SEAL decryption through an on-chain `seal_approve` call. On Celo
 *   the equivalent is Lit Protocol: the encrypted blob's access-control
 *   condition points at `canView(agentId, viewer)` on this contract. Lit reads
 *   that view via an EVM condition before releasing decryption shares — so the
 *   grant/revoke lifecycle lives here and Lit enforces it off-chain.
 */
contract Compliance {
    struct ViewKey {
        address viewer;
        string  label;
        uint64  createdAt;
        uint64  expiresAt;
        bool    active;
    }

    IAgentRegistry public immutable registry;

    mapping(uint256 => ViewKey[]) private _viewKeys;

    event ViewKeyCreated(uint256 indexed agentId, uint256 idx, address indexed viewer, uint64 expiresAt);
    event ViewKeyRevoked(uint256 indexed agentId, uint256 idx);
    event DataAccessed(uint256 indexed agentId, address indexed viewer, string dataRef);

    error NotOwner();
    error AgentInactive();
    error ZeroDuration();
    error BadIndex();

    constructor(address registry_) {
        registry = IAgentRegistry(registry_);
    }

    /**
     * @param durationMs Validity window in milliseconds (converted to seconds).
     */
    function createViewKey(
        uint256 agentId,
        address viewer,
        string calldata label,
        uint64 durationMs
    ) external returns (uint256 idx) {
        if (registry.ownerOf(agentId) != msg.sender) revert NotOwner();
        if (!registry.isActive(agentId)) revert AgentInactive();
        if (durationMs == 0) revert ZeroDuration();

        uint64 expiresAt = uint64(block.timestamp) + durationMs / 1000;
        idx = _viewKeys[agentId].length;
        _viewKeys[agentId].push(
            ViewKey({
                viewer: viewer,
                label: label,
                createdAt: uint64(block.timestamp),
                expiresAt: expiresAt,
                active: true
            })
        );
        emit ViewKeyCreated(agentId, idx, viewer, expiresAt);
    }

    function revokeViewKey(uint256 agentId, uint256 idx) external {
        if (registry.ownerOf(agentId) != msg.sender) revert NotOwner();
        if (idx >= _viewKeys[agentId].length) revert BadIndex();
        _viewKeys[agentId][idx].active = false;
        emit ViewKeyRevoked(agentId, idx);
    }

    /// @notice Log an access event (callable by owner or the viewer).
    function logAccess(uint256 agentId, address viewer, string calldata dataRef) external {
        require(
            msg.sender == registry.ownerOf(agentId) || msg.sender == viewer,
            "unauthorized"
        );
        emit DataAccessed(agentId, viewer, dataRef);
    }

    // === Views (read by Lit access-control conditions) ===

    function canView(uint256 agentId, address who) external view returns (bool) {
        if (registry.ownerOf(agentId) == who) return true;
        ViewKey[] storage ks = _viewKeys[agentId];
        for (uint256 i = 0; i < ks.length; i++) {
            if (ks[i].active && ks[i].viewer == who && ks[i].expiresAt >= block.timestamp) {
                return true;
            }
        }
        return false;
    }

    function count(uint256 agentId) external view returns (uint256) {
        return _viewKeys[agentId].length;
    }

    function viewKeyAt(uint256 agentId, uint256 idx) external view returns (ViewKey memory) {
        return _viewKeys[agentId][idx];
    }
}
