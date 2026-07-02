// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal surface of AgentRegistry consumed by other GhostPay modules.
interface IAgentRegistry {
    function isAuthorized(uint256 agentId, address who) external view returns (bool);
    function isActive(uint256 agentId) external view returns (bool);
    function ownerOf(uint256 agentId) external view returns (address);
    function exists(uint256 agentId) external view returns (bool);
}
