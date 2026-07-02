// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentRegistry
 * @notice GhostPay agent identity on Celo. Ported from Sui `agent.move`.
 *
 * Design note (Move -> EVM):
 *   Sui modeled the Agent as an owned object transferred to the user.
 *   On EVM the natural equivalent is an ERC-721 token: `agentId` == `tokenId`,
 *   so the agent is ownable and transferable, preserving the
 *   "the agent IS an object you own" narrative.
 *
 *   Per-agent monotonic sequence numbers (payment_seq / memory_seq in Move)
 *   are derived from array length inside PaymentLog / MemoryVault instead of
 *   being stored here — avoids cross-contract writes and keeps this contract
 *   the single source of identity + authorization.
 */
contract AgentRegistry is ERC721, Ownable {
    // === Structs ===

    struct Agent {
        string  displayName;
        bytes32 emailHash;   // keccak256(email) — Move stored a SHA256 hex string
        uint64  createdAt;   // block.timestamp (seconds)
        bool    active;
    }

    // === Storage ===

    uint256 public totalAgents;
    bool    public paused;

    /// agentId => agent record
    mapping(uint256 => Agent) public agents;

    /// Delegated authority (← AgentCap). agentId => grantee => expiry (unix seconds).
    mapping(uint256 => mapping(address => uint64)) public capExpiry;

    /// First agent minted by an address (0 = none). Convenience for one-agent-per-user UX.
    mapping(address => uint256) public primaryAgentOf;

    // === Events ===

    event AgentCreated(uint256 indexed agentId, address indexed owner, uint64 createdAt);
    event AgentUpdated(uint256 indexed agentId, string newDisplayName);
    event AgentDeactivated(uint256 indexed agentId);
    event CapabilityGranted(uint256 indexed agentId, address indexed grantee, uint64 expiresAt);
    event CapabilityRevoked(uint256 indexed agentId, address indexed grantee);
    event PausedSet(bool paused);

    // === Errors ===

    error ContractPaused();
    error NotAgentOwner();
    error AgentInactive();
    error ZeroDuration();

    constructor() ERC721("GhostPay Agent", "GHOST-AGENT") Ownable(msg.sender) {}

    // === Modifiers ===

    modifier onlyAgentOwner(uint256 agentId) {
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        _;
    }

    // === Admin ===

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PausedSet(p);
    }

    // === Core ===

    /**
     * @notice Create (mint) a new agent for the caller.
     * @param name       Display name.
     * @param emailHash  keccak256 of the user's email (privacy-preserving).
     * @return agentId   The new agent's id / ERC-721 tokenId.
     */
    function createAgent(string calldata name, bytes32 emailHash)
        external
        returns (uint256 agentId)
    {
        if (paused) revert ContractPaused();
        agentId = ++totalAgents;
        _safeMint(msg.sender, agentId);
        if (primaryAgentOf[msg.sender] == 0) {
            primaryAgentOf[msg.sender] = agentId;
        }
        agents[agentId] = Agent({
            displayName: name,
            emailHash: emailHash,
            createdAt: uint64(block.timestamp),
            active: true
        });
        emit AgentCreated(agentId, msg.sender, uint64(block.timestamp));
    }

    function updateDisplayName(uint256 agentId, string calldata newName)
        external
        onlyAgentOwner(agentId)
    {
        if (!agents[agentId].active) revert AgentInactive();
        agents[agentId].displayName = newName;
        emit AgentUpdated(agentId, newName);
    }

    function deactivateAgent(uint256 agentId) external onlyAgentOwner(agentId) {
        agents[agentId].active = false;
        emit AgentDeactivated(agentId);
    }

    /**
     * @notice Grant a time-boxed capability to another address.
     * @dev FIX vs Sui port: the argument is a DURATION (ms) and expiry is
     *      computed as now + duration. The Sui frontend mislabeled this as an
     *      absolute `expiresAt`, producing garbage expiries. Here it is
     *      unambiguous: pass milliseconds of validity.
     * @param durationMs  Validity window in milliseconds (converted to seconds).
     */
    function grantCapability(uint256 agentId, address grantee, uint64 durationMs)
        external
        onlyAgentOwner(agentId)
    {
        if (!agents[agentId].active) revert AgentInactive();
        if (durationMs == 0) revert ZeroDuration();
        uint64 expiresAt = uint64(block.timestamp) + durationMs / 1000;
        capExpiry[agentId][grantee] = expiresAt;
        emit CapabilityGranted(agentId, grantee, expiresAt);
    }

    function revokeCapability(uint256 agentId, address grantee)
        external
        onlyAgentOwner(agentId)
    {
        capExpiry[agentId][grantee] = 0;
        emit CapabilityRevoked(agentId, grantee);
    }

    // === Views ===

    /// @notice True if `who` is the owner or holds an unexpired capability.
    function isAuthorized(uint256 agentId, address who) public view returns (bool) {
        if (_ownerOf(agentId) == who) return true;
        return capExpiry[agentId][who] >= block.timestamp;
    }

    function isActive(uint256 agentId) external view returns (bool) {
        return agents[agentId].active;
    }

    function exists(uint256 agentId) external view returns (bool) {
        return _ownerOf(agentId) != address(0);
    }
}
