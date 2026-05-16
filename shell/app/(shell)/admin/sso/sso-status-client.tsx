"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, RefreshCw } from "lucide-react";

interface SsoStatus {
  connected: boolean;
  domain?: string;
  clientId?: string | null;
  error?: string;
}

export function SsoStatusClient() {
  const [status, setStatus] = useState<SsoStatus | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sso");
      const data = await res.json() as SsoStatus;
      setStatus(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchStatus(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SSO Status</h1>
          <p className="text-muted-foreground">Okta OIDC connection health</p>
        </div>
        <Button variant="outline" onClick={() => void fetchStatus()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Connection Status
            {loading ? (
              <Badge variant="outline">Checking...</Badge>
            ) : status?.connected ? (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Connected
              </Badge>
            ) : (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" /> Disconnected
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status && (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Okta Domain</p>
                  <p className="font-mono">{status.domain ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Client ID</p>
                  <p className="font-mono">{status.clientId ?? "—"}</p>
                </div>
              </div>
              {status.error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {status.error}
                </div>
              )}
              {status.connected && (
                <p className="text-sm text-muted-foreground">
                  OpenID configuration endpoint is reachable. OIDC discovery document returned successfully.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
