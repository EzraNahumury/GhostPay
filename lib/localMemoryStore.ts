/**
 * localMemoryStore — localStorage fallback index for Walrus blobs.
 *
 * When the on-chain memory::store_memory Move call fails (e.g. because the
 * package is not deployed), uploaded blobs would be invisible in the Vault.
 * This module persists blob metadata to localStorage so the Vault can display
 * them with no on-chain dependency.
 *
 * On-chain records always take precedence — the Vault merges chain records
 * with local records, deduplicating by blobId.
 */

export interface LocalMemoryRecord {
  /** Synthetic local ID (never an on-chain object ID). */
  id: string;
  /** Walrus blob ID. */
  blobId: string;
  /** On-chain data type classification. */
  dataType: string;
  /** Display label. */
  label: string;
  /** "private" or "public". */
  visibility: string;
  /** File size in bytes. */
  dataSize: number;
  /** Unix timestamp (ms) when the blob was uploaded. */
  timestamp: number;
}

const STORAGE_KEY = "ghostpay:local-memories";

/** Load all locally-stored memory records. */
export function loadLocalMemories(): LocalMemoryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as LocalMemoryRecord[];
  } catch {
    return [];
  }
}

/** Persist a new memory record to localStorage. */
export function saveLocalMemory(record: LocalMemoryRecord): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadLocalMemories();
    // Deduplicate by blobId
    const filtered = existing.filter((r) => r.blobId !== record.blobId);
    filtered.unshift(record); // newest first
    // Keep at most 200 entries to avoid filling storage
    const trimmed = filtered.slice(0, 200);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage quota exceeded or unavailable — silently ignore
  }
}

/** Remove a local memory record by ID. */
export function removeLocalMemory(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadLocalMemories();
    const filtered = existing.filter((r) => r.id !== id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {}
}

/** Clear all local memory records (e.g. on logout). */
export function clearLocalMemories(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
