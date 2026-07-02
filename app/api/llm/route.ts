import { NextRequest, NextResponse } from "next/server";
import { serverPublicClient, getOperatorWallet } from "@/lib/serverChain";
import { LlmMeterAbi } from "@/lib/abis";

/**
 * POST /api/llm — pay-as-you-go LLM proxy.
 *
 * Contract of trust (escrow model):
 *   1. Client escrows payment on-chain: LlmMeter.payForCall(agentId, requestId, price, model).
 *   2. Client posts { requestId, model, messages } here.
 *   3. Server verifies the escrow is Pending on-chain, then calls the LLM.
 *      - success -> operator SETTLE(requestId): escrow -> treasury; return completion.
 *      - failure -> operator REFUND(requestId): escrow -> payer; return error.
 *   If OPERATOR_PRIVATE_KEY is unset, settle/refund are skipped and the user can
 *   self-refund on-chain after REFUND_TIMEOUT.
 *
 * Note: consumed-requestId tracking is in-memory (per lambda) for this MVP.
 * For production, back it with a shared store (Redis/KV).
 */
export const runtime = "nodejs";

const consumed = new Set<string>();
const LLM_METER = (process.env.NEXT_PUBLIC_LLM_METER ?? "") as `0x${string}`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.LLM_API_KEY;
  const apiBase = process.env.LLM_API_BASE ?? "https://api.openai.com/v1";
  if (!apiKey) {
    return NextResponse.json({ error: "LLM not configured (missing LLM_API_KEY)" }, { status: 503 });
  }
  if (!LLM_METER || LLM_METER === "0x0000000000000000000000000000000000000000") {
    return NextResponse.json({ error: "LlmMeter contract not configured" }, { status: 503 });
  }

  let body: {
    requestId?: string;
    model?: string;
    messages?: { role: string; content: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { requestId, model, messages } = body;
  if (!requestId || !/^0x[0-9a-fA-F]{64}$/.test(requestId)) {
    return NextResponse.json({ error: "Invalid requestId (need bytes32 hex)" }, { status: 400 });
  }
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }
  if (consumed.has(requestId)) {
    return NextResponse.json({ error: "requestId already used" }, { status: 409 });
  }

  // ── Verify escrow is Pending on-chain ────────────────────────────────────
  let pending = false;
  try {
    pending = (await serverPublicClient.readContract({
      address: LLM_METER,
      abi: LlmMeterAbi,
      functionName: "isPending",
      args: [requestId as `0x${string}`],
    })) as boolean;
  } catch (e) {
    return NextResponse.json(
      { error: `Payment check failed: ${e instanceof Error ? e.message : "rpc error"}` },
      { status: 502 },
    );
  }
  if (!pending) {
    return NextResponse.json(
      { error: "No pending escrow found for this requestId" },
      { status: 402 },
    );
  }
  consumed.add(requestId);

  const operator = getOperatorWallet();

  // helper: operator settle/refund (best-effort; user can self-refund after timeout)
  const finalize = async (action: "settle" | "refund") => {
    if (!operator) return;
    try {
      await operator.writeContract({
        address: LLM_METER,
        abi: LlmMeterAbi,
        functionName: action,
        args: [requestId as `0x${string}`],
      });
    } catch (e) {
      console.warn(`[llm] ${action} failed for ${requestId}:`, (e as Error).message);
    }
  };

  // ── Call the LLM (OpenAI-compatible) ─────────────────────────────────────
  try {
    const res = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: model ?? "gpt-4o-mini", messages }),
    });
    if (!res.ok) {
      const text = await res.text();
      await finalize("refund"); // charge nothing for a failed call
      return NextResponse.json(
        { error: `LLM error: ${text.slice(0, 200)}`, refunded: Boolean(operator) },
        { status: 502 },
      );
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";
    await finalize("settle"); // release escrow to treasury only on success
    return NextResponse.json({ content, usage: json.usage ?? null });
  } catch (e) {
    await finalize("refund");
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "LLM request failed", refunded: Boolean(operator) },
      { status: 500 },
    );
  }
}
