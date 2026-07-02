/**
 * IpfsService — client-side helper for pinning + reading blobs on IPFS.
 *
 * Replaces the Sui-era WalrusService. Uploads go through the server route
 * `/api/ipfs` (which holds the Pinata JWT); reads go directly through a public
 * gateway. Blobs are expected to be encrypted client-side before upload for
 * private data.
 */

const GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs/";

export interface IpfsUploadResult {
  cid: string;
  size: number;
}

/** Pin raw bytes to IPFS via the server route. Returns the CID. */
export async function uploadToIpfs(
  data: Uint8Array | Blob,
  filename = "ghostpay-blob",
): Promise<IpfsUploadResult> {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart]);
  const form = new FormData();
  form.append("file", blob, filename);

  const res = await fetch("/api/ipfs", { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IPFS upload failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return { cid: json.cid, size: json.size ?? blob.size };
}

/** Fetch a blob from IPFS by CID. */
export async function downloadFromIpfs(
  cid: string,
): Promise<{ data: Uint8Array; contentType: string }> {
  const res = await fetch(getIpfsUrl(cid));
  if (!res.ok) {
    throw new Error(`IPFS download failed (${res.status})`);
  }
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const buf = await res.arrayBuffer();
  return { data: new Uint8Array(buf), contentType };
}

export function getIpfsUrl(cid: string): string {
  const clean = cid.startsWith("ipfs://") ? cid.slice(7) : cid;
  return `${GATEWAY}${clean}`;
}
