import { type Instrumentation } from "next";
import { logger } from "@/lib/logger";

export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  logger.error("Unhandled request error", {
    message: err instanceof Error ? err.message : String(err),
    digest: (err as { digest?: string }).digest,
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
  });
};
