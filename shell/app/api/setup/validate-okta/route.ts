import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain")?.trim();

  if (!domain) {
    return NextResponse.json({ error: "domain parameter is required" }, { status: 400 });
  }

  // Validate domain is safe to use in a URL (no path traversal, scheme injection, etc.)
  if (!/^[a-zA-Z0-9.-]+$/.test(domain)) {
    return NextResponse.json({ error: "Invalid domain format" }, { status: 400 });
  }

  const discoveryUrl = `https://${domain}/.well-known/openid-configuration`;

  try {
    const res = await fetch(discoveryUrl, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Discovery endpoint returned HTTP ${res.status}` },
        { status: 400 }
      );
    }

    const json = (await res.json()) as Record<string, unknown>;

    // Minimal shape validation
    if (typeof json["issuer"] !== "string" || typeof json["authorization_endpoint"] !== "string") {
      return NextResponse.json(
        { error: "Discovery document is missing required fields" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, issuer: json["issuer"] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Could not reach ${discoveryUrl}: ${message}` }, { status: 400 });
  }
}
