const PRIVATE_HOST = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/;

export function isSafeRemoteUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    if (PRIVATE_HOST.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}
