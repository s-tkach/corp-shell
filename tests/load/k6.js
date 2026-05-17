/**
 * k6 load test: 1,000 concurrent authenticated sessions
 *
 * Usage:
 *   SHELL_URL=https://app.corp.com SESSION_COOKIE=<value> k6 run tests/load/k6.js
 *
 * Requirements:
 *   - SESSION_COOKIE: a valid NextAuth.js session cookie value obtained from a
 *     pre-authenticated browser session (copy the __Secure-next-auth.session-token value)
 *   - SHELL_URL: base URL of the deployed shell
 *
 * Acceptance criteria (NFRs from M12-3):
 *   - Zero HTTP 5xx errors
 *   - P99 API response < 500ms
 *   - PostgreSQL stays within 2 ACU (monitor via CloudWatch during run)
 *   - Lambda concurrency headroom > 20% (monitor via CloudWatch during run)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("error_rate");
const apiLatency = new Trend("api_latency_ms", true);

const BASE_URL = __ENV.SHELL_URL ?? "https://app.corp.com";
const SESSION_COOKIE = __ENV.SESSION_COOKIE ?? "";

export const options = {
  scenarios: {
    mixed_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 200 },   // ramp up
        { duration: "5m", target: 1000 },  // ramp to peak
        { duration: "5m", target: 1000 },  // sustain peak
        { duration: "2m", target: 0 },     // ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],         // < 1% failure rate (covers 5xx)
    api_latency_ms: ["p(99)<500"],          // P99 API response < 500ms
    error_rate: ["rate<0.01"],
  },
};

const AUTH_HEADER = {
  Cookie: `__Secure-next-auth.session-token=${SESSION_COOKIE}`,
};

// Representative set of API calls that mix read and navigation
const API_ENDPOINTS = [
  "/api/menu",
  "/api/users/me/preferences",
];

const PAGE_ROUTES = [
  "/dashboard",
  "/admin/users",
  "/admin/menu",
];

export default function () {
  // Simulate mixed navigation + API calls
  const route = PAGE_ROUTES[Math.floor(Math.random() * PAGE_ROUTES.length)];
  const pageRes = http.get(`${BASE_URL}${route}`, {
    headers: AUTH_HEADER,
    tags: { name: "page_navigation" },
  });

  const pageOk = check(pageRes, {
    "page: status not 5xx": (r) => r.status < 500,
    "page: responds in <2s": (r) => r.timings.duration < 2000,
  });
  errorRate.add(!pageOk);

  sleep(Math.random() * 2 + 1);

  // Simulate an API call
  const endpoint = API_ENDPOINTS[Math.floor(Math.random() * API_ENDPOINTS.length)];
  const apiRes = http.get(`${BASE_URL}${endpoint}`, {
    headers: AUTH_HEADER,
    tags: { name: "api_call" },
  });

  apiLatency.add(apiRes.timings.duration);

  const apiOk = check(apiRes, {
    "api: status 200": (r) => r.status === 200,
    "api: no 5xx": (r) => r.status < 500,
  });
  errorRate.add(!apiOk);

  sleep(Math.random() * 3 + 2);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(
      {
        p99_api_latency_ms: data.metrics.api_latency_ms?.values?.["p(99)"],
        p95_api_latency_ms: data.metrics.api_latency_ms?.values?.["p(95)"],
        error_rate: data.metrics.error_rate?.values?.rate,
        http_req_failed: data.metrics.http_req_failed?.values?.rate,
        total_requests: data.metrics.http_reqs?.values?.count,
        vus_max: data.metrics.vus_max?.values?.max,
      },
      null,
      2
    ),
    "tests/load/results.json": JSON.stringify(data, null, 2),
  };
}
