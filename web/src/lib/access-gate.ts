/** Cookie name for optional friends-only gate (see middleware + `/api/auth/unlock`). */
export const ACCESS_COOKIE_NAME = "scholarai_access";

/** Gate is on only when both env vars are non-empty (trimmed). */
export function accessGateConfigured(): boolean {
  const code = process.env.SCHOLARAI_ACCESS_CODE?.trim();
  const secret = process.env.ACCESS_GATE_SECRET?.trim();
  return Boolean(code && secret);
}

/** HS256 signing key for the session cookie; null if misconfigured. */
export function accessGateSecretBytes(): Uint8Array | null {
  const s = process.env.ACCESS_GATE_SECRET?.trim();
  if (!s) return null;
  return new TextEncoder().encode(s);
}
