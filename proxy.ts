import { NextResponse, type NextRequest } from "next/server";
import { canAccessAdmin, canAccessWorker } from "@/lib/auth/rbac";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/test-report") return true;
  if (pathname.startsWith("/api/auth/send-code")) return true;
  if (pathname.startsWith("/api/auth/verify-code")) return true;
  if (pathname.startsWith("/api/auth/password-login")) return true;
  if (pathname.startsWith("/api/health/runtime")) return true;
  if (pathname.startsWith("/api/test-debug/")) return true;
  if (/^\/(zh|en)\/login$/.test(pathname)) return true;
  return false;
}

function isAdminPath(pathname: string): boolean {
  return /^\/(zh|en)\/admin(\/|$)/.test(pathname);
}

function isWorkerPath(pathname: string): boolean {
  return /^\/(zh|en)\/worker(\/|$)/.test(pathname);
}

function isProtectedApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth/") &&
    !pathname.startsWith("/api/test-debug/")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && (pathname === "/test-report" || pathname.startsWith("/api/test-debug/"))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/zh/login", request.url));
  }

  const session = await verifySessionToken(token);
  if (!session?.sub) {
    const response = NextResponse.redirect(new URL("/zh/login", request.url));
    response.cookies.set(SESSION_COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return response;
  }

  if (isAdminPath(pathname) && !canAccessAdmin(session.role)) {
    return NextResponse.redirect(new URL("/zh/worker", request.url));
  }

  if (isWorkerPath(pathname) && !canAccessWorker(session.role)) {
    return NextResponse.redirect(new URL("/zh/login", request.url));
  }

  if (isProtectedApiPath(pathname) && !session.orgId) {
    return NextResponse.json({ error: "Missing organization context." }, { status: 401 });
  }

  const headers = new Headers(request.headers);
  headers.set("x-gotiny-user-id", session.sub);
  if (session.orgId) headers.set("x-gotiny-org-id", session.orgId);
  if (session.role) headers.set("x-gotiny-role", session.role);

  return NextResponse.next({
    request: {
      headers,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
