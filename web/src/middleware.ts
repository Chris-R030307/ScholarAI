import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  accessGateConfigured,
  accessGateSecretBytes,
} from "@/lib/access-gate";

function redirectToAccess(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/access";
  url.search = "";
  const from =
    request.nextUrl.pathname +
    (request.nextUrl.search || "");
  if (from && from !== "/access") {
    url.searchParams.set("from", from);
  }
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  if (!accessGateConfigured()) {
    return NextResponse.next();
  }

  const key = accessGateSecretBytes();
  if (!key) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (pathname === "/access") {
    return NextResponse.next();
  }

  if (pathname === "/api/auth/unlock" && request.method === "POST") {
    return NextResponse.next();
  }

  const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  if (!token) {
    return redirectToAccess(request);
  }

  try {
    await jwtVerify(token, key, { algorithms: ["HS256"] });
    return NextResponse.next();
  } catch {
    const res = redirectToAccess(request);
    res.cookies.delete(ACCESS_COOKIE_NAME);
    return res;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
