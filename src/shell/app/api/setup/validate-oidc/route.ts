import { NextResponse } from "next/server";
import { isSafeRemoteUrl } from "@/lib/url-guard";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const issuer = searchParams.get("issuer")?.trim();

  if (!issuer) {
    return NextResponse.json({ error: "issuer parameter is required" }, { status: 400 });
  }

  // Validate before any network access — blocks private-network probing
  if (!isSafeRemoteUrl(issuer)) {
    return NextResponse.json({ error: "issuer must be a valid HTTPS URL" }, { status: 400 });
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
  } catch {
    // Generic message — don't echo resolved host or network error details
    return NextResponse.json({ error: "Could not reach OIDC discovery endpoint" }, { status: 400 });
  }
}
