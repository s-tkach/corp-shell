import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const issuer = searchParams.get("issuer")?.trim();

  if (!issuer) {
    return NextResponse.json({ error: "issuer parameter is required" }, { status: 400 });
  }

  let issuerUrl: URL;
  try {
    issuerUrl = new URL(issuer);
  } catch {
    return NextResponse.json({ error: "Invalid issuer URL" }, { status: 400 });
  }

  if (issuerUrl.protocol !== "https:") {
    return NextResponse.json({ error: "Issuer must use HTTPS" }, { status: 400 });
  }

  const discoveryUrl = `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`;

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
