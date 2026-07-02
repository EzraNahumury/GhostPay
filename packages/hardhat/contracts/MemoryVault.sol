// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IAgentRegistry.sol";

/**
 * @title MemoryVault
 * @notice On-chain pointers to off-chain encrypted blobs. Ported from Sui `memory.move`.
 *
 * Design note (Move -> EVM):
 *   Sui stored a Walrus blob id. On Celo the blob lives on IPFS (pinned via
 *   Pinata/Lighthouse) and this contract stores the IPFS CID plus metadata.
 *   The blob itself is encrypted client-side (Lit Protocol) before pinning;
 *   this contract only holds the pointer and visibility flag.
 */
contract MemoryVault {
    enum Visibility { Private, Shared, SharedWithAuditor }

    struct Record {
        string     cid;        // IPFS content id
        string     dataType;   // "payslip" | "kyc" | "agent_reasoning" | ...
        uint64     ts;
        Visibility visibility;
        uint64     size;       // original byte size
        string     label;
    }

    uint256 public constant MAX_CID_LEN = 200;
    uint256 public constant MAX_DATATYPE_LEN = 50;

    IAgentRegistry public immutable registry;

    mapping(uint256 => Record[]) private _records;

    event MemoryStored(uint256 indexed agentId, uint256 seq, string cid, string dataType);
    event VisibilityChanged(uint256 indexed agentId, uint256 seq, Visibility newVisibility);

    error NotAuthorized();
    error AgentInactive();
    error TooLong();
    error BadSeq();

    constructor(address registry_) {
        registry = IAgentRegistry(registry_);
    }

    function store(
        uint256 agentId,
        string calldata cid,
        string calldata dataType,
        Visibility visibility,
        uint64 size,
        string calldata label
    ) external returns (uint256 seq) {
        if (!registry.isAuthorized(agentId, msg.sender)) revert NotAuthorized();
        if (!registry.isActive(agentId)) revert AgentInactive();
        if (bytes(cid).length > MAX_CID_LEN || bytes(dataType).length > MAX_DATATYPE_LEN) revert TooLong();

        seq = _records[agentId].length;
        _records[agentId].push(
            Record({
                cid: cid,
                dataType: dataType,
                ts: uint64(block.timestamp),
                visibility: visibility,
                size: size,
                label: label
            })
        );
        emit MemoryStored(agentId, seq, cid, dataType);
    }

    function updateVisibility(uint256 agentId, uint256 seq, Visibility v) external {
        if (registry.ownerOf(agentId) != msg.sender) revert NotAuthorized();
        if (seq >= _records[agentId].length) revert BadSeq();
        _records[agentId][seq].visibility = v;
        emit VisibilityChanged(agentId, seq, v);
    }

    // === Views ===

    function count(uint256 agentId) external view returns (uint256) {
        return _records[agentId].length;
    }

    function recordAt(uint256 agentId, uint256 seq) external view returns (Record memory) {
        return _records[agentId][seq];
    }

    function all(uint256 agentId) external view returns (Record[] memory) {
        return _records[agentId];
    }
}
