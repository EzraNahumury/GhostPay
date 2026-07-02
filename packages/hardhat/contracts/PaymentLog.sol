// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "./interfaces/IAgentRegistry.sol";

/**
 * @title PaymentLog
 * @notice Real stablecoin payments + on-chain receipts. Ported from Sui `payment.move`.
 *
 * Design note (Move -> EVM):
 *   The Sui module only RECORDED metadata and hard-coded status "completed"
 *   even though `record_payment` never moved funds — a receipt could claim a
 *   payment that never happened. Here `pay()` ACTUALLY transfers the ERC-20
 *   (cUSD / USDC) from sender to recipient in the same transaction, so the
 *   receipt cannot lie: it only exists if the transfer succeeded.
 *
 *   Sequence numbers are derived from `receipts[agentId].length`.
 */
contract PaymentLog {
    using SafeERC20 for IERC20;

    enum Status { Pending, Completed, Refunded, Failed }

    struct Receipt {
        uint64  ts;
        uint256 amount;
        address token;      // ERC-20 paid (cUSD, USDC, ...)
        address recipient;
        string  memo;
        Status  status;
        string  cid;        // optional IPFS receipt pointer
    }

    IAgentRegistry public immutable registry;

    /// agentId => receipts
    mapping(uint256 => Receipt[]) private _receipts;

    event PaymentSettled(
        uint256 indexed agentId,
        uint256 seq,
        uint256 amount,
        address indexed token,
        address indexed recipient,
        string memo
    );
    event PaymentStatusChanged(uint256 indexed agentId, uint256 seq, Status newStatus);

    error NotAuthorized();
    error AgentInactive();
    error ZeroAmount();
    error BadSeq();

    constructor(address registry_) {
        registry = IAgentRegistry(registry_);
    }

    /**
     * @notice Transfer `amount` of `token` from caller to `recipient` and log a receipt.
     * @dev Caller must first `approve` this contract (or use `payWithPermit`).
     *      Requires the caller to be the agent owner or an authorized delegate.
     */
    function pay(
        uint256 agentId,
        address token,
        address recipient,
        uint256 amount,
        string calldata memo,
        string calldata cid
    ) public returns (uint256 seq) {
        if (!registry.isAuthorized(agentId, msg.sender)) revert NotAuthorized();
        if (!registry.isActive(agentId)) revert AgentInactive();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransferFrom(msg.sender, recipient, amount);

        seq = _receipts[agentId].length;
        _receipts[agentId].push(
            Receipt({
                ts: uint64(block.timestamp),
                amount: amount,
                token: token,
                recipient: recipient,
                memo: memo,
                status: Status.Completed,
                cid: cid
            })
        );
        emit PaymentSettled(agentId, seq, amount, token, recipient, memo);
    }

    /**
     * @notice Single-signature pay: run EIP-2612 permit then pay.
     * @dev cUSD and native USDC on Celo support permit. Avoids a separate approve tx.
     */
    function payWithPermit(
        uint256 agentId,
        address token,
        address recipient,
        uint256 amount,
        string calldata memo,
        string calldata cid,
        uint256 permitValue,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 seq) {
        IERC20Permit(token).permit(msg.sender, address(this), permitValue, deadline, v, r, s);
        return pay(agentId, token, recipient, amount, memo, cid);
    }

    function updateStatus(uint256 agentId, uint256 seq, Status newStatus) external {
        if (registry.ownerOf(agentId) != msg.sender) revert NotAuthorized();
        if (seq >= _receipts[agentId].length) revert BadSeq();
        _receipts[agentId][seq].status = newStatus;
        emit PaymentStatusChanged(agentId, seq, newStatus);
    }

    // === Views ===

    function count(uint256 agentId) external view returns (uint256) {
        return _receipts[agentId].length;
    }

    function receiptAt(uint256 agentId, uint256 seq) external view returns (Receipt memory) {
        return _receipts[agentId][seq];
    }

    function recent(uint256 agentId, uint256 limit) external view returns (Receipt[] memory out) {
        Receipt[] storage all = _receipts[agentId];
        uint256 n = all.length;
        uint256 k = limit > n ? n : limit;
        out = new Receipt[](k);
        for (uint256 i = 0; i < k; i++) {
            out[i] = all[n - 1 - i]; // most recent first
        }
    }
}
