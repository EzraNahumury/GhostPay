/**
 * agentEngine — GhostPay autonomous agent runtime.
 *
 * The Agent is a deterministic rule-based engine that:
 *   1. Gathers context (memory, wallet, payments, preferences)
 *   2. Applies rules to decide what action (if any) is needed
 *   3. Records EVERY reasoning step as a structured JSON blob
 *   4. Encrypts sensitive reasoning via SEAL
 *   5. Persists reasoning to Walrus + on-chain memory
 *   6. Queues actions for human approval where required
 *   7. Executes approved actions through existing transaction hooks
 *
 * ── No fake AI ─────────────────────────────────────────────────
 * No LLM calls. No random outputs. Every decision is deterministic,
 * auditable, and persisted. The agent is transparent about why it
 * chose each action.
 *
 * ── Every reasoning step persisted ─────────────────────────────
 * Before any action, the agent writes a ReasoningRecord to Walrus
 * (encrypted via SEAL), then stores the blob ID on-chain as a
 * MemoryRecord with data_type="agent_reasoning".
 */

import { uploadToIpfs } from "./IpfsService";

// ══════════════════════════════════════════════════════════════════════════
//  Types
// ══════════════════════════════════════════════════════════════════════════

/** Snapshot of everything the agent knows at a decision point. */
export interface AgentContext {
  timestamp: number;
  /** The user's agent object ID (may be undefined if not yet created). */
  agentId: string | undefined;
  /** Wallet balances (human-readable). */
  wallet: {
    sui: number;
    usdc: number;
    deep: number;
  };
  /** Recent payment receipts (most recent first). */
  recentPayments: AgentPaymentInfo[];
  /** Recent memory records (most recent first). */
  recentMemories: AgentMemoryInfo[];
  /** Parsed user preferences from memory records. */
  preferences: AgentPreferences;
  /** Number of times the engine has run (monotonic counter). */
  runCount: number;
  /** Enriched memory content fetched from Walrus blobs (lazy-loaded). */
  memoryContent?: AgentMemoryContent[];
  /** Whether any blobs were unavailable. */
  hasOrphanRecords?: boolean;
}

/** Enriched memory with its Walrus blob content. */
export interface AgentMemoryContent {
  memoryId: string;
  seq: number;
  blobId: string;
  dataType: string;
  label: string;
  category: string;
  /** Parsed blob content (JSON or string). */
  content: unknown;
  /** Whether the blob was verified as available. */
  available: boolean;
}

/** Payment info the agent can read. */
export interface AgentPaymentInfo {
  id: string;
  seq: number;
  amount: number;
  currency: string;
  recipient: string;
  memo: string;
  status: string;
  timestamp: number;
}

/** Memory info the agent can read. */
export interface AgentMemoryInfo {
  id: string;
  seq: number;
  blobId: string;
  dataType: string;
  visibility: string;
  label: string;
  timestamp: number;
}

/** Parsed user preferences derived from agent_preference memory records. */
export interface AgentPreferences {
  /** Preferred currency for conversions (e.g. "USDC"). */
  preferredCurrency: string;
  /** Maximum SUI to auto-convert without approval (0 = never auto). */
  autoConvertThresholdSui: number;
  /** Whether swap receipts should be stored publicly or privately. */
  privateSwapReceipts: boolean;
  /** Last-known user intent or goal (free-text, from memory). */
  currentGoal: string;
}

/** A single deterministic reasoning step. */
export interface AgentReasoning {
  /** Monotonic step number across the agent's lifetime. */
  stepNumber: number;
  /** ISO timestamp of when this reasoning was generated. */
  timestamp: string;
  /** What the agent observed at this point. */
  observations: string[];
  /** Options the agent considered. */
  options: AgentOption[];
  /** The selected option index (or -1 if none). */
  selectedOptionIndex: number;
  /** Plain-English justification for the decision. */
  justification: string;
  /** The action decided upon (or null if no action needed). */
  action: AgentAction | null;
  /** Confidence level: "high" | "medium" | "low". */
  confidence: "high" | "medium" | "low";
}

/** A single option the agent evaluated. */
export interface AgentOption {
  label: string;
  description: string;
  /** Why this option was considered. */
  rationale: string;
  /** Why this option was rejected (empty if selected). */
  rejectionReason: string;
}

/** An action the agent can decide to execute. */
export type AgentAction =
  | AgentActionNoop
  | AgentActionSwap
  | AgentActionTransfer
  | AgentActionRecordPayment
  | AgentActionStoreMemory;

/** No operation — agent determined nothing needs to happen. */
export interface AgentActionNoop {
  type: "noop";
  reason: string;
}

/** Swap one asset for another via DeepBook. */
export interface AgentActionSwap {
  type: "swap";
  poolKey: string;
  sellAmount: bigint;
  minBuyAmount: bigint;
  sellBase: boolean;
  /** Human-readable description. */
  description: string;
  /** Whether user approval is required before execution. */
  requiresApproval: boolean;
}

/** Transfer tokens to a recipient. */
export interface AgentActionTransfer {
  type: "transfer";
  recipient: string;
  amount: number;
  currency: string;
  memo: string;
  requiresApproval: boolean;
  description: string;
}

/** Record a payment receipt on-chain (metadata only, no transfer). */
export interface AgentActionRecordPayment {
  type: "record_payment";
  recipient: string;
  amount: number;
  currency: string;
  memo: string;
  requiresApproval: boolean;
  description: string;
}

/** Store reasoning or data as a memory record. */
export interface AgentActionStoreMemory {
  type: "store_memory";
  dataType: string;
  label: string;
  /** The JSON payload to upload to Walrus. */
  payload: string;
  /** Whether to encrypt with SEAL before upload. */
  encrypt: boolean;
  requiresApproval: boolean;
  description: string;
}

/** A planned sequence of actions with its reasoning. */
export interface AgentPlan {
  /** Unique plan ID (UUID v4). */
  id: string;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** The context snapshot at plan time. */
  contextSnapshot: AgentContext;
  /** The reasoning that led to this plan. */
  reasoning: AgentReasoning;
  /** Ordered list of actions to execute. */
  actions: AgentAction[];
  /** Current status. */
  status: "pending_approval" | "approved" | "executing" | "completed" | "rejected" | "failed";
  /** Walrus blob ID for the persisted reasoning (set after upload). */
  reasoningBlobId?: string;
  /** On-chain memory record ID for the reasoning (set after on-chain store). */
  reasoningMemoryId?: string;
  /** Error message if failed. */
  error?: string;
}

/** Result of a persisted reasoning. */
export interface PersistReasoningResult {
  blobId: string;
  memoryRecordId?: string;
}

// ══════════════════════════════════════════════════════════════════════════
//  Constants
// ══════════════════════════════════════════════════════════════════════════

const DEFAULT_PREFERENCES: AgentPreferences = {
  preferredCurrency: "USDC",
  autoConvertThresholdSui: 0,
  privateSwapReceipts: true,
  currentGoal: "",
};

// ══════════════════════════════════════════════════════════════════════════
//  Context Building
// ══════════════════════════════════════════════════════════════════════════

/**
 * Build a complete AgentContext from raw data sources.
 * Pure function — no side effects.
 */
export function buildAgentContext(params: {
  agentId: string | undefined;
  sui: number;
  usdc: number;
  deep: number;
  payments: AgentPaymentInfo[];
  memories: AgentMemoryInfo[];
  runCount: number;
  memoryContent?: AgentMemoryContent[];
  hasOrphanRecords?: boolean;
}): AgentContext {
  const preferences = extractPreferences(params.memories);

  return {
    timestamp: Date.now(),
    agentId: params.agentId,
    wallet: {
      sui: params.sui,
      usdc: params.usdc,
      deep: params.deep,
    },
    recentPayments: params.payments.slice(0, 20),
    recentMemories: params.memories.slice(0, 20),
    preferences,
    runCount: params.runCount,
    memoryContent: params.memoryContent,
    hasOrphanRecords: params.hasOrphanRecords,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  Preference Extraction
// ══════════════════════════════════════════════════════════════════════════

/**
 * Extract user preferences from memory records with data_type="agent_preference".
 * Falls back to defaults if no preferences are stored.
 */
export function extractPreferences(memories: AgentMemoryInfo[]): AgentPreferences {
  const prefs = { ...DEFAULT_PREFERENCES };

  for (const mem of memories) {
    if (mem.dataType !== "agent_preference") continue;

    const label = mem.label.toLowerCase();

    if (label.startsWith("currency:")) {
      prefs.preferredCurrency = label.replace("currency:", "").trim().toUpperCase();
    } else if (label.startsWith("autoconvert:")) {
      const val = parseFloat(label.replace("autoconvert:", "").trim());
      if (!isNaN(val) && val >= 0) prefs.autoConvertThresholdSui = val;
    } else if (label.startsWith("privacy:")) {
      prefs.privateSwapReceipts = label.includes("private");
    } else if (label.startsWith("goal:")) {
      prefs.currentGoal = label.replace("goal:", "").trim();
    }
  }

  return prefs;
}

// ══════════════════════════════════════════════════════════════════════════
//  Rule-Based Decision Engine
// ══════════════════════════════════════════════════════════════════════════

/**
 * Analyze the current context and determine what action (if any) the
 * agent should take.
 *
 * Rules (applied in order, first match wins):
 *   1. No agent → noop (agent not yet created)
 *   2. SUI balance > threshold AND user has auto-convert enabled
 *      → swap SUI → USDC
 *   3. Unusual inflow detected (SUI) → notify / record observation
 *   4. No recent activity → noop (agent is idle)
 *   5. Default → noop
 */
export function analyzeContext(ctx: AgentContext): AgentReasoning {
  const observations: string[] = [];
  const options: AgentOption[] = [];
  const stepNumber = ctx.runCount;

  // ── Gather observations ──────────────────────────────────────────────

  if (!ctx.agentId) {
    observations.push("No Agent object exists yet — agent cannot act without an on-chain Agent.");
  } else {
    observations.push(`Agent ${ctx.agentId.slice(0, 10)}... is active.`);
  }

  observations.push(
    `Wallet: ${ctx.wallet.sui.toFixed(4)} SUI, ${ctx.wallet.usdc.toFixed(4)} USDC, ${ctx.wallet.deep.toFixed(4)} DEEP.`,
  );

  if (ctx.recentPayments.length > 0) {
    const last = ctx.recentPayments[0];
    observations.push(
      `Last payment: ${last.amount} ${last.currency} to ${last.recipient.slice(0, 6)}... (${last.status}).`,
    );
  } else {
    observations.push("No payment history.");
  }

  observations.push(`User preferences: auto-convert >= ${ctx.preferences.autoConvertThresholdSui} SUI, prefer ${ctx.preferences.preferredCurrency}.`);
  if (ctx.preferences.currentGoal) {
    observations.push(`User goal: ${ctx.preferences.currentGoal}`);
  }

  // ── Memory content observations ──────────────────────────────────────
  if (ctx.memoryContent && ctx.memoryContent.length > 0) {
    const available = ctx.memoryContent.filter(m => m.available).length;
    const total = ctx.memoryContent.length;
    observations.push(`Retrieved ${available}/${total} memory blobs from Walrus.`);

    // Categorize what was retrieved
    const byType = new Map<string, number>();
    for (const m of ctx.memoryContent) {
      if (m.available) {
        byType.set(m.dataType, (byType.get(m.dataType) ?? 0) + 1);
      }
    }
    for (const [type, count] of byType) {
      observations.push(`  ${count}x ${type} memory records retrieved.`);
    }

    if (ctx.hasOrphanRecords) {
      observations.push("Warning: Some memory records reference unavailable Walrus blobs (orphan records).");
    }
  }

  // ── Evaluate options ─────────────────────────────────────────────────

  const selectedOptionIndex = evaluateRules(ctx, observations, options);

  const justification = selectedOptionIndex >= 0
    ? options[selectedOptionIndex].rationale
    : "No action needed at this time.";

  const action = selectedOptionIndex >= 0
    ? buildActionForOption(ctx, selectedOptionIndex, options)
    : null;

  const confidence = determineConfidence(ctx, selectedOptionIndex);

  return {
    stepNumber,
    timestamp: new Date().toISOString(),
    observations,
    options,
    selectedOptionIndex,
    justification,
    action,
    confidence,
  };
}

/**
 * Evaluate rules and populate the options array.
 * Returns the index of the selected option, or -1 for noop.
 */
function evaluateRules(
  ctx: AgentContext,
  _observations: string[],
  options: AgentOption[],
): number {
  // Rule 1: No agent → noop
  if (!ctx.agentId) {
    options.push({
      label: "No action (waiting for agent creation)",
      description: "Agent object has not been created on-chain.",
      rationale: "Cannot execute transactions without an Agent object. Waiting for user to create an agent.",
      rejectionReason: "",
    });
    return 0;
  }

  // Rule 2: SUI balance exceeds auto-convert threshold
  if (
    ctx.preferences.autoConvertThresholdSui > 0 &&
    ctx.wallet.sui >= ctx.preferences.autoConvertThresholdSui
  ) {
    const surplus = ctx.wallet.sui - ctx.preferences.autoConvertThresholdSui;
    if (surplus >= 0.5) {
      options.push({
        label: `Convert ${surplus.toFixed(2)} SUI → USDC`,
        description: `Swap ${surplus.toFixed(2)} SUI for ${ctx.preferences.preferredCurrency} via DeepBook.`,
        rationale: `SUI balance (${ctx.wallet.sui.toFixed(2)}) exceeds auto-convert threshold (${ctx.preferences.autoConvertThresholdSui}). Converting surplus ${surplus.toFixed(2)} SUI to ${ctx.preferences.preferredCurrency}.`,
        rejectionReason: "",
      });
      return 0;
    }
  }

  // Rule 3: Significant USDC inflow detected (compare payments trend)
  // (Simplified: if last payment was a large receipt marked "pending", flag it)
  const pendingReceipt = ctx.recentPayments.find(p => p.status === "pending" || p.status === "created");
  if (pendingReceipt && pendingReceipt.currency === ctx.preferences.preferredCurrency) {
    options.push({
      label: `Process pending ${pendingReceipt.amount} ${pendingReceipt.currency} payment`,
      description: `Payment #${pendingReceipt.seq} (${pendingReceipt.amount} ${pendingReceipt.currency}) is pending. Mark as completed if funds received.`,
      rationale: `Detected pending payment receipt #${pendingReceipt.seq} for ${pendingReceipt.amount} ${pendingReceipt.currency} from ${pendingReceipt.recipient.slice(0, 6)}.... Update status if confirmed.`,
      rejectionReason: "",
    });
    return 0;
  }

  // Rule 4: Default — no action needed
  options.push({
    label: "No action needed",
    description: "All conditions are nominal. No transaction required.",
    rationale: "Checked balances, payments, and preferences. No surplus SUI above threshold, no pending payments, no unusual activity.",
    rejectionReason: "",
  });
  return 0;
}

/**
 * Build the AgentAction corresponding to the selected option index.
 */
function buildActionForOption(
  ctx: AgentContext,
  selectedIndex: number,
  options: AgentOption[],
): AgentAction | null {
  const selected = options[selectedIndex];
  if (!selected) return null;

  const label = selected.label;

  // Rule 2: Auto-convert
  if (label.startsWith("Convert")) {
    const surplus = ctx.wallet.sui - ctx.preferences.autoConvertThresholdSui;
    const amountMist = BigInt(Math.floor(Math.max(0, surplus) * 1_000_000_000));
    // 0.5% slippage
    // The actual quote comes from getSwapQuote; this is the planned action
    return {
      type: "swap",
      poolKey: "SUI_DBUSDC",
      sellAmount: amountMist,
      minBuyAmount: 0n, // filled in by executor after getting quote
      sellBase: true,
      description: `Auto-convert ${surplus.toFixed(4)} SUI → USDC (threshold: ${ctx.preferences.autoConvertThresholdSui} SUI)`,
      requiresApproval: true, // always require human approval for financial actions
    };
  }

  // Rule 3: Process pending payment
  if (label.startsWith("Process pending")) {
    const pendingReceipt = ctx.recentPayments.find(
      p => p.status === "pending" || p.status === "created",
    );
    if (pendingReceipt) {
      return {
        type: "record_payment",
        recipient: pendingReceipt.recipient,
        amount: pendingReceipt.amount,
        currency: pendingReceipt.currency,
        memo: `Auto-processed pending payment #${pendingReceipt.seq}: ${pendingReceipt.memo}`,
        requiresApproval: true,
        description: `Process pending ${pendingReceipt.amount} ${pendingReceipt.currency} payment to ${pendingReceipt.recipient.slice(0, 6)}...`,
      };
    }
  }

  return null;
}

/**
 * Determine confidence level based on context certainty.
 */
function determineConfidence(
  ctx: AgentContext,
  _selectedIndex: number,
): "high" | "medium" | "low" {
  if (!ctx.agentId) return "low";
  if (ctx.wallet.sui === 0 && ctx.wallet.usdc === 0) return "medium";
  return "high";
}

// ══════════════════════════════════════════════════════════════════════════
//  Plan Building
// ══════════════════════════════════════════════════════════════════════════

let planCounter = 0;

/**
 * Build a complete AgentPlan from context and reasoning.
 * Generates a unique ID and wraps the reasoning + actions together.
 */
export function buildPlan(ctx: AgentContext, reasoning: AgentReasoning): AgentPlan {
  planCounter++;
  const id = `plan_${Date.now()}_${planCounter}`;

  const actions: AgentAction[] = reasoning.action
    ? [reasoning.action]
    : [{ type: "noop", reason: reasoning.justification }];

  return {
    id,
    createdAt: new Date().toISOString(),
    contextSnapshot: ctx,
    reasoning,
    actions,
    status: actions.length > 0 && actions[0].type !== "noop" && actions.some(a => "requiresApproval" in a && (a as any).requiresApproval)
      ? "pending_approval"
      : "approved",
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  Reasoning Persistence
// ══════════════════════════════════════════════════════════════════════════

/**
 * Persist a reasoning step to IPFS.
 *
 * The reasoning JSON includes the full reasoning record, a context snapshot,
 * and the resulting plan. Returns the IPFS CID (stored in `blobId` for API
 * stability with the on-chain MemoryVault pointer).
 */
export async function persistReasoningToIpfs(
  plan: AgentPlan,
): Promise<PersistReasoningResult> {
  const payload = JSON.stringify(
    {
      type: "agent_reasoning",
      version: 2,
      planId: plan.id,
      createdAt: plan.createdAt,
      reasoning: plan.reasoning,
      context: {
        wallet: plan.contextSnapshot.wallet,
        recentPaymentsCount: plan.contextSnapshot.recentPayments.length,
        recentMemoriesCount: plan.contextSnapshot.recentMemories.length,
        preferences: plan.contextSnapshot.preferences,
      },
    },
    null,
    2,
  );

  const bytes = new TextEncoder().encode(payload);
  const result = await uploadToIpfs(bytes, `reasoning-${plan.id}.json`);

  return {
    blobId: result.cid,
  };
}

/**
 * Format a reasoning payload for on-chain memory storage.
 * Returns the label and data type for the MemoryVault.store call.
 */
export function formatReasoningMemoryParams(plan: AgentPlan): {
  blobId: string;
  dataType: string;
  size: number;
  visibility: boolean;
  label: string;
} {
  const actionType = plan.actions[0]?.type ?? "noop";
  const encoder = new TextEncoder();
  const payloadStr = JSON.stringify({
    type: "agent_reasoning",
    planId: plan.id,
    reasoning: plan.reasoning,
  });
  const bytes = encoder.encode(payloadStr);

  return {
    blobId: plan.reasoningBlobId ?? "",
    dataType: "agent_reasoning",
    size: bytes.length,
    visibility: true, // private by default
    label: `step_${plan.reasoning.stepNumber}_${actionType}`,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  Plan Execution
// ══════════════════════════════════════════════════════════════════════════

/**
 * Describe an agent action for the hook layer.
 *
 * The engine layer is chain-agnostic: it decides WHAT to do. The React hook
 * layer (usePayments, useMemories, useLlm) holds the wagmi write calls and
 * does HOW. This keeps the rule engine reusable and testable without wallet
 * dependencies.
 */
export function describeAgentAction(action: AgentAction): string {
  switch (action.type) {
    case "noop":
      return `No action: ${action.reason}`;
    case "swap":
      return action.description;
    case "transfer":
      return action.description;
    case "record_payment":
      return action.description;
    case "store_memory":
      return action.description;
  }
}
