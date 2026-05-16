type LogLevel = "info" | "warn" | "error" | "debug";

interface LogMeta {
  traceId?: string;
  [key: string]: unknown;
}

function getTraceId(): string | undefined {
  // X-Amzn-Trace-Id format: Root=1-XXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXX;Parent=...;Sampled=1
  const header = process.env._X_AMZN_TRACE_ID;
  if (!header) return undefined;
  const match = /Root=([^;]+)/.exec(header);
  return match?.[1];
}

function log(level: LogLevel, message: string, meta: LogMeta = {}) {
  const entry = {
    level,
    message,
    traceId: meta.traceId ?? getTraceId(),
    timestamp: new Date().toISOString(),
    ...meta,
  };
  // CloudWatch captures stdout automatically; console.log works in both Node and Edge runtimes
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (message: string, meta?: LogMeta) => log("info", message, meta),
  warn: (message: string, meta?: LogMeta) => log("warn", message, meta),
  error: (message: string, meta?: LogMeta) => log("error", message, meta),
  debug: (message: string, meta?: LogMeta) => log("debug", message, meta),
};
