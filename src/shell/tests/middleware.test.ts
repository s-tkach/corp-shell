import { describe, it, expect } from "vitest";
import { mapRequestAccessOutcomeToDecision } from "@/lib/request-access";

describe("mapRequestAccessOutcomeToDecision", () => {
  it("redirects a suspended tenant on a protected page request", () => {
    expect(
      mapRequestAccessOutcomeToDecision({
        outcome: "suspended",
        pathname: "/dashboard",
        isApi: false,
      })
    ).toBe("redirect:/suspended");
  });

  it("returns 401 for login-required protected API requests", () => {
    expect(
      mapRequestAccessOutcomeToDecision({
        outcome: "login",
        pathname: "/api/menu",
        isApi: true,
      })
    ).toBe("401");
  });

  it("redirects to upgrade for page requests that lost subscription access", () => {
    expect(
      mapRequestAccessOutcomeToDecision({
        outcome: "upgrade",
        pathname: "/reports",
        isApi: false,
      })
    ).toBe("redirect:/upgrade");
  });

  it("rewrites to 403 for forbidden page requests", () => {
    expect(
      mapRequestAccessOutcomeToDecision({
        outcome: "forbidden",
        pathname: "/settings/menu",
        isApi: false,
      })
    ).toBe("rewrite:/403");
  });
});
