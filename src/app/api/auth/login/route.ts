import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { writeAuditLogFromRequest } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { ROLE_HOME } from "@/lib/rbac";
import {
  AUTH_COOKIE,
  getAuthCookieOptions,
  signSessionToken,
} from "@/lib/jwt";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { loginSchema, zodFieldErrors } from "@/lib/validations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hash giả để vẫn tiêu tốn thời gian bcrypt khi email không tồn tại,
 * tránh lộ thông tin qua timing (user enumeration).
 */
const DUMMY_BCRYPT_HASH =
  "$2b$10$ovOm8Je0bkFEeOojQc5SdeqV.Xm1bQnchWno.A.fIb7GKn89r0T0.";

const WINDOW_MS = 15 * 60 * 1000; // 15 phút
const ACCOUNT_LIMIT = 5;
const IP_LIMIT = 20;

function json(body: unknown, status = 200, extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store");

  return NextResponse.json(body, { status, headers });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return json(
        {
          success: false,
          message: "Dữ liệu không hợp lệ",
          errors: zodFieldErrors(parsed.error),
        },
        400,
      );
    }

    const { email, password } = parsed.data;

    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip =
      forwardedFor?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      "unknown";

    const ipKey = `login:ip:${ip}`;
    const accountKey = `login:account:${ip}:${email}`;

    const ipLimit = checkRateLimit(ipKey, {
      limit: IP_LIMIT,
      windowMs: WINDOW_MS,
    });
    const accountLimit = checkRateLimit(accountKey, {
      limit: ACCOUNT_LIMIT,
      windowMs: WINDOW_MS,
    });

    if (!ipLimit.allowed || !accountLimit.allowed) {
      const retryAfter = Math.max(
        ipLimit.retryAfterSeconds,
        accountLimit.retryAfterSeconds,
      );

      await writeAuditLogFromRequest(req, {
        action: "AUTH_LOGIN_RATE_LIMITED",
        details: { email, retryAfterSeconds: retryAfter },
      });

      return json(
        {
          success: false,
          message: `Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau ${Math.ceil(
            retryAfter / 60,
          )} phút.`,
        },
        429,
        { "Retry-After": String(retryAfter) },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        password: true,
      },
    });

    // Luôn chạy bcrypt dù user có tồn tại hay không.
    const passwordMatches = await compare(
      password,
      user?.password ?? DUMMY_BCRYPT_HASH,
    );

    if (!user || !passwordMatches) {
      await writeAuditLogFromRequest(req, {
        action: "AUTH_LOGIN_FAILED",
        userId: user?.id ?? null,
        details: {
          email,
          reason: user ? "WRONG_PASSWORD" : "EMAIL_NOT_FOUND",
        },
      });

      return json(
        {
          success: false,
          message: "Email hoặc mật khẩu không đúng",
        },
        401,
      );
    }

    resetRateLimit(accountKey);

    const token = await signSessionToken({
      userId: user.id,
      role: user.role,
    });

    await writeAuditLogFromRequest(req, {
      action: "AUTH_LOGIN_SUCCESS",
      userId: user.id,
      details: { role: user.role },
    });

    const response = json({
      success: true,
      message: "Đăng nhập thành công",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      redirectTo: ROLE_HOME[user.role],
    });

    response.cookies.set(AUTH_COOKIE, token, getAuthCookieOptions());

    return response;
  } catch (error) {
    console.error("[api/auth/login] Lỗi không mong đợi:", error);

    return json(
      {
        success: false,
        message: "Đã có lỗi xảy ra, vui lòng thử lại sau.",
      },
      500,
    );
  }
}

export async function GET() {
  return json(
    { success: false, message: "Method Not Allowed" },
    405,
    { Allow: "POST" },
  );
}
