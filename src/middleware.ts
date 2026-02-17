import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow cron requests authenticated via CRON_SECRET
  if (pathname === "/api/refresh") {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      return NextResponse.next();
    }
  }

  // Check for auth cookie
  const token = request.cookies.get("auth_token")?.value;

  if (token !== "authenticated") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - /login
     * - /api/auth
     * - /_next (static files)
     * - /favicon.ico
     */
    "/((?!login|api/auth|api/health|_next|favicon.ico).*)",
  ],
};
