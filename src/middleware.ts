import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_COOKIE,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/jwt";
import {
  defaultAfterLogin,
  ROLE_HOME,
  canAccessPath,
  isPublicPath,
  roleForPath,
} from "@/lib/rbac";

/**
 * Middleware chạy trên Edge runtime:
 * 1. Xác thực JWT trong cookie HTTPOnly.
 * 2. RBAC: mỗi role chỉ được vào tiền tố route của mình.
 * 3. Gắn x-user-id / x-user-role cho server phía sau (đã xóa header do client gửi).
 * 4. Ghi AuditLog khi chặn truy cập (qua endpoint nội bộ, vì Edge không dùng Prisma).
 */

const AUTH_PATHS = new Set(["/login", "/register"]);

/** Chỉ nhận đường dẫn nội bộ để tránh open redirect. */
function safeNextPath(value: string | null): string | null {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : null;
}

function nextWithSession(req: NextRequest, session: SessionPayload | null) {
  const headers = new Headers(req.headers);

  // Chống header spoofing: client không được tự đặt x-user-*.
  headers.delete("x-user-id");
  headers.delete("x-user-role");

  if (session) {
    headers.set("x-user-id", session.userId);
    headers.set("x-user-role", session.role);
  }

  return NextResponse.next({ request: { headers } });
}

function forbiddenPage(session: SessionPayload): NextResponse {
  const home = ROLE_HOME[session.role];

  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>403 — Không có quyền truy cập</title>
  <style>
    :root {
      --bg: #fff7f8;
      --card: #ffffff;
      --fg: #1f2430;
      --muted: #6b7280;
      --primary: #e11d48;
      --primary-fg: #ffffff;
      --border: #f1d5da;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #171a22;
        --card: #1f232d;
        --fg: #e6e8ee;
        --muted: #a1a7b3;
        --primary: #f43f5e;
        --primary-fg: #1a1013;
        --border: rgba(255, 255, 255, 0.12);
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: var(--bg);
      color: var(--fg);
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    main {
      width: 100%;
      max-width: 440px;
      padding: 40px 32px;
      text-align: center;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: 0 18px 40px -24px rgba(0, 0, 0, 0.35);
    }
    .code { margin: 0; font-size: 64px; font-weight: 800; color: var(--primary); }
    h1 { margin: 8px 0 0; font-size: 22px; }
    p { margin: 8px 0 0; color: var(--muted); line-height: 1.6; }
    a {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 22px;
      border-radius: 14px;
      background: var(--primary);
      color: var(--primary-fg);
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <main>
    <p class="code">403</p>
    <h1>Không có quyền truy cập</h1>
    <p>Tài khoản của bạn không được phép truy cập trang này.</p>
    <a href="${home}">Về trang chủ</a>
  </main>
</body>
</html>`;

  return new NextResponse(html, {
    status: 403,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function reportAccessDenied(
  req: NextRequest,
  session: SessionPayload,
  requiredRole: string | null,
): Promise<void> {
  const secret = process.env.AUDIT_INTERNAL_SECRET;
  if (!secret) return;

  try {
    const url = new URL("/api/internal/audit", req.nextUrl.origin);

    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-audit-secret": secret,
      },
      body: JSON.stringify({
        action: "ACCESS_DENIED",
        userId: session.userId,
        details: {
          role: session.role,
          requiredRole,
          path: req.nextUrl.pathname,
          method: req.method,
          ip:
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            req.headers.get("x-real-ip") ??
            null,
          userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
  } catch (error) {
    console.error("[middleware] Không ghi được audit ACCESS_DENIED:", error);
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // --- Route công khai -----------------------------------------------------
  if (isPublicPath(pathname)) {
    // Đã đăng nhập mà vào /login hoặc /register => đưa về trang mặc định.
    // Riêng /login?next=... (ví dụ nút "Đặt lịch") thì tôn trọng đích đến.
    if (session && AUTH_PATHS.has(pathname)) {
      const nextParam =
        pathname === "/login"
          ? safeNextPath(req.nextUrl.searchParams.get("next"))
          : null;
      const target =
        nextParam &&
        !AUTH_PATHS.has(nextParam) &&
        canAccessPath(session.role, nextParam)
          ? nextParam
          : defaultAfterLogin(session.role);

      return NextResponse.redirect(new URL(target, req.url));
    }

    return nextWithSession(req, session);
  }

  // --- Chưa đăng nhập ------------------------------------------------------
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, message: "Chưa đăng nhập hoặc phiên đã hết hạn" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const loginUrl = new URL("/login", req.url);
    const nextPath = `${pathname}${search}`;

    // Chỉ nhận đường dẫn nội bộ, tránh open redirect.
    if (nextPath.startsWith("/") && !nextPath.startsWith("//")) {
      loginUrl.searchParams.set("next", nextPath);
    }

    return NextResponse.redirect(loginUrl);
  }

  // --- RBAC ----------------------------------------------------------------
  if (!canAccessPath(session.role, pathname)) {
    const requiredRole = roleForPath(pathname);

    // Không chặn request audit nội bộ (đã nằm trong PUBLIC_PATHS).
    await reportAccessDenied(req, session, requiredRole);

    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, message: "Bạn không có quyền thực hiện thao tác này" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    return forbiddenPage(session);
  }

  return nextWithSession(req, session);
}

export const config = {
  matcher: [
    /*
     * Bỏ qua: _next/static, _next/image, favicon, file tĩnh.
     * Mọi request còn lại đều đi qua middleware.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|woff|woff2|ttf|otf|wasm|gz)$).*)",
  ],
};
