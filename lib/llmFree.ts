/**
 * Ollama Cloud free-tier models (verified by probing /v1/chat/completions:
 * 200 = free, 403 = subscription). Ollama's /v1/models has no free/paid flag,
 * so we filter the picker to this allowlist. Update if Ollama changes tiers.
 */
export const OLLAMA_FREE_MODELS = [
  "gpt-oss:20b",
  "gpt-oss:120b",
  "gemma3:4b",
  "gemma3:12b",
  "gemma3:27b",
  "gemma4:31b",
  "glm-4.7",
  "qwen3-coder-next",
  "qwen3-coder:480b",
  "ministral-3:3b",
  "ministral-3:8b",
  "ministral-3:14b",
  "devstral-small-2:24b",
  "devstral-2:123b",
  "nemotron-3-nano:30b",
  "nemotron-3-super",
  "nemotron-3-ultra",
  "minimax-m2.1",
  "minimax-m2.5",
  "minimax-m3",
];

/** A few reliable general-chat free models used as automatic fallbacks. */
export const OLLAMA_FALLBACKS = ["gemma3:12b", "gpt-oss:20b", "qwen3-coder-next", "ministral-3:8b"];
