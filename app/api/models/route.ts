import { NextResponse } from "next/server";

/**
 * GET /api/models — list the free models from the configured OpenAI-compatible
 * provider (OpenRouter). "Free" = every pricing field is 0. The LLM itself is
 * free; GhostPay still charges a small on-chain fee per call (that's the point).
 *
 * Cached briefly so we don't hit the provider on every page load.
 */
export const runtime = "nodejs";
export const revalidate = 600; // 10 min

interface ProviderModel {
  id: string;
  name?: string;
  pricing?: Record<string, string | number>;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
}

export async function GET() {
  const base = process.env.LLM_API_BASE ?? "https://api.openai.com/v1";
  try {
    const res = await fetch(`${base}/models`, {
      headers: process.env.LLM_API_KEY ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` } : {},
      next: { revalidate: 600 },
    });
    if (!res.ok) {
      return NextResponse.json({ models: [], error: `provider ${res.status}` }, { status: 200 });
    }
    const json = await res.json();
    const all: ProviderModel[] = json.data ?? [];

    const isFree = (m: ProviderModel) => {
      const p = m.pricing;
      if (!p) return false;
      // free = prompt/completion/request/image all zero
      return ["prompt", "completion", "request", "image"].every(
        (k) => p[k] === undefined || Number(p[k]) === 0,
      );
    };

    // Only chat-capable models (must output text) — drops image/audio models.
    const isChatText = (m: ProviderModel) => {
      const out = m.architecture?.output_modalities;
      return !Array.isArray(out) || out.includes("text");
    };

    const models = all
      .filter((m) => isFree(m) && isChatText(m))
      .map((m) => ({ id: m.id, label: (m.name ?? m.id).replace(/\s*\(free\)\s*$/i, "") }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return NextResponse.json({ models });
  } catch (e) {
    return NextResponse.json(
      { models: [], error: e instanceof Error ? e.message : "fetch failed" },
      { status: 200 },
    );
  }
}
