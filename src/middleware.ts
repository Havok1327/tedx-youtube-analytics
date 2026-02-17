import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
