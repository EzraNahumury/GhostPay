import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/ipfs — pin an uploaded file to IPFS via Pinata.
 *
 * Server-side only: uses PINATA_JWT (never exposed to the client). Returns the
 * resulting CID. If PINATA_JWT is unset, returns 503 so the UI can surface a
 * clear "IPFS not configured" message.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json(
      { error: "IPFS not configured (missing PINATA_JWT)" },
      { status: 503 },
    );
  }

  try {
    const inForm = await req.formData();
    const file = inForm.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    // 50MB cap
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 413 });
    }

    const out = new FormData();
    out.append("file", file, (file as File).name ?? "ghostpay-blob");

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: out,
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Pinata error: ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const json = await res.json();
    return NextResponse.json({ cid: json.IpfsHash, size: file.size });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "IPFS upload failed" },
      { status: 500 },
    );
  }
}
