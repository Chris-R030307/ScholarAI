import { SignJWT } from "jose";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  accessGateConfigured,
  accessGateSecretBytes,
} from "@/lib/access-gate";

export const runtime = "nodejs";

const MAX_BODY = 4096;
const UNLOCK_WINDOW_MS = 60_000;
const UNLOCK_MAX_ATTEMPTS = 20;
const unlockFailures = new Map<string, { count: number; windowStart: number }>();

function clientKey(req: Request): string {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function unlockFailureCount(key: string, now: number): number {
  const row = unlockFailures.get(key);
  if (!row || now - row.windowStart > UNLOCK_WINDOW_MS) return 0;
  return row.count;
}

function recordUnlockFailure(key: string, now: number): void {
  let row = unlockFailures.get(key);
  if (!row || now - row.windowStart > UNLOCK_WINDOW_MS) {
    row = { count: 0, windowStart: now };
  }
  row.count += 1;
  unlockFailures.set(key, row);
  if (unlockFailures.size > 2000) {
    for (const [k, v] of unlockFailures) {
      if (now - v.windowStart > UNLOCK_WINDOW_MS * 2) unlockFailures.delete(k);
    }
  }
}

function clearUnlockFailures(key: string): void {
  unlockFailures.delete(key);
}

function codesMatch(expected: string, given: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(given, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!accessGateConfigured()) {
    return NextResponse.json(
      { ok: false, error: { code: "DISABLED", message: "Access gate is not enabled." } },
      { status: 404 },
    );
  }

  const key = accessGateSecretBytes();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: { code: "MISCONFIGURED", message: "Server access gate is misconfigured." } },
      { status: 503 },
    );
  }

  const ip = clientKey(req);
  const now = Date.now();
  if (unlockFailureCount(ip, now) >= UNLOCK_MAX_ATTEMPTS) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMIT", message: "Too many attempts. Wait a minute and try again." } },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Body too large." } },
        { status: 400 },
      );
    }
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "Invalid JSON." } },
      { status: 400 },
    );
  }

  const expected = process.env.SCHOLARAI_ACCESS_CODE?.trim() ?? "";
  const given =
    typeof body === "object" &&
    body !== null &&
    typeof (body as { code?: unknown }).code === "string"
      ? (body as { code: string }).code.trim()
      : "";

  if (!given || !codesMatch(expected, given)) {
    recordUnlockFailure(ip, now);
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CODE", message: "That code is not valid." } },
      { status: 401 },
    );
  }

  clearUnlockFailures(ip);

  const token = await new SignJWT({ v: 1 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);

  const res = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(ACCESS_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
