// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IAgentRegistry.sol";

/**
 * @title LlmMeter
 * @notice Pay-as-you-go metering for LLM / image calls, with ESCROW + refund and
 *         MULTI-TOKEN support. GhostPay's primary Celo use-case.
 *
 * The user picks which accepted stablecoin to pay with (e.g. USDm / USDC / USDT).
 * Each call escrows the chosen token; the backend settles it to the treasury on
 * success or refunds it on failure. Users are never charged for failed calls.
 *
 * Escrow lifecycle (per requestId):
 *   payForCall -> token moves payer -> THIS CONTRACT, status Pending
 *   settle     -> operator releases escrow -> treasury (call succeeded)
 *   refund     -> escrow returned -> payer (failed, or self-refund after timeout)
 */
contract LlmMeter is Ownable {
    using SafeERC20 for IERC20;

    enum Status { None, Pending, Settled, Refunded }

    struct Escrow {
        address payer;
        address token;
        uint256 amount;
        uint256 agentId;
        uint64  paidAt;
        Status  status;
        string  model;
    }

    uint64 public constant REFUND_TIMEOUT = 15 minutes;

    IAgentRegistry public immutable registry;
    address public treasury;
    address public operator;

    /// Stablecoins accepted for payment.
    mapping(address => bool) public acceptedToken;

    mapping(bytes32 => Escrow) public escrows;
    /// settled totals per agent per token
    mapping(uint256 => mapping(address => uint256)) public spentByAgentToken;
    /// count of settled calls per agent
    mapping(uint256 => uint256) public callsByAgent;
    /// optional min price per (token, model)
    mapping(bytes32 => uint256) public minPrice;

    event TokenSet(address token, bool accepted);
    event UsagePaid(uint256 indexed agentId, address indexed user, bytes32 indexed requestId, address token, uint256 amount, string model);
    event UsageSettled(bytes32 indexed requestId, uint256 indexed agentId, address token, uint256 amount);
    event UsageRefunded(bytes32 indexed requestId, address indexed payer, address token, uint256 amount);
    event TreasurySet(address treasury);
    event OperatorSet(address operator);
    event MinPriceSet(address token, string model, uint256 minAmount);

    error NotAuthorized();
    error NotOperator();
    error Replayed();
    error TokenNotAccepted();
    error BelowMinPrice();
    error ZeroAmount();
    error NotPending();
    error RefundTooEarly();

    constructor(address registry_, address treasury_, address[] memory tokens) Ownable(msg.sender) {
        registry = IAgentRegistry(registry_);
        treasury = treasury_;
        operator = msg.sender;
        for (uint256 i = 0; i < tokens.length; i++) {
            acceptedToken[tokens[i]] = true;
            emit TokenSet(tokens[i], true);
        }
    }

    // === Admin ===

    function setToken(address token, bool accepted) external onlyOwner {
        acceptedToken[token] = accepted;
        emit TokenSet(token, accepted);
    }

    function setTreasury(address t) external onlyOwner {
        treasury = t;
        emit TreasurySet(t);
    }

    function setOperator(address o) external onlyOwner {
        operator = o;
        emit OperatorSet(o);
    }

    function setMinPrice(address token, string calldata model, uint256 minAmount) external onlyOwner {
        minPrice[_key(token, model)] = minAmount;
        emit MinPriceSet(token, model, minAmount);
    }

    // === Pay (escrow) ===

    /**
     * @notice Escrow payment for one call in the chosen accepted token.
     *         Caller must `approve` this contract first, or use the permit variant.
     */
    function payForCall(
        uint256 agentId,
        bytes32 requestId,
        address token,
        uint256 amount,
        string calldata model
    ) public {
        if (!registry.isAuthorized(agentId, msg.sender)) revert NotAuthorized();
        if (!acceptedToken[token]) revert TokenNotAccepted();
        if (escrows[requestId].status != Status.None) revert Replayed();
        if (amount == 0) revert ZeroAmount();
        uint256 floor = minPrice[_key(token, model)];
        if (floor != 0 && amount < floor) revert BelowMinPrice();

        escrows[requestId] = Escrow({
            payer: msg.sender,
            token: token,
            amount: amount,
            agentId: agentId,
            paidAt: uint64(block.timestamp),
            status: Status.Pending,
            model: model
        });

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit UsagePaid(agentId, msg.sender, requestId, token, amount, model);
    }

    function payForCallWithPermit(
        uint256 agentId,
        bytes32 requestId,
        address token,
        uint256 amount,
        string calldata model,
        uint256 permitValue,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        IERC20Permit(token).permit(msg.sender, address(this), permitValue, deadline, v, r, s);
        payForCall(agentId, requestId, token, amount, model);
    }

    // === Settle / Refund ===

    function settle(bytes32 requestId) external {
        if (msg.sender != operator) revert NotOperator();
        Escrow storage e = escrows[requestId];
        if (e.status != Status.Pending) revert NotPending();
        e.status = Status.Settled;
        spentByAgentToken[e.agentId][e.token] += e.amount;
        callsByAgent[e.agentId] += 1;
        IERC20(e.token).safeTransfer(treasury, e.amount);
        emit UsageSettled(requestId, e.agentId, e.token, e.amount);
    }

    function refund(bytes32 requestId) external {
        Escrow storage e = escrows[requestId];
        if (e.status != Status.Pending) revert NotPending();
        if (msg.sender != operator) {
            if (msg.sender != e.payer) revert NotAuthorized();
            if (block.timestamp < e.paidAt + REFUND_TIMEOUT) revert RefundTooEarly();
        }
        e.status = Status.Refunded;
        IERC20(e.token).safeTransfer(e.payer, e.amount);
        emit UsageRefunded(requestId, e.payer, e.token, e.amount);
    }

    // === Views ===

    function served(bytes32 requestId) external view returns (bool) {
        return escrows[requestId].status != Status.None;
    }

    function isPending(bytes32 requestId) external view returns (bool) {
        return escrows[requestId].status == Status.Pending;
    }

    function statusOf(bytes32 requestId) external view returns (Status) {
        return escrows[requestId].status;
    }

    function _key(address token, string calldata model) internal pure returns (bytes32) {
        return keccak256(abi.encode(token, model));
    }
}
