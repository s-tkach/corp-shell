import { validateRemoteUrl } from "@/lib/remote-target-guard";

export function isSafeRemoteUrl(raw: string): boolean {
  return validateRemoteUrl(raw).ok;
}
