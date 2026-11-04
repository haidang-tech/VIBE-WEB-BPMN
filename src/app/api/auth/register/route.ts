import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { getClientIp, writeAuditLogFromRequest } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { registerSchema, zodFieldErrors } from "@/lib/validations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register
 *
 * Tạo tài khoản sinh viên mới:
 * - Validate input bằng Zod (dùng chung với form phía client).
 * - Chặn email trùng trước khi tạo bản ghi.
 * - Hash mật khẩu bằng bcrypt (12 rounds, giống seed).
 * - Role luôn được gán cứng là STUDENT, không nhận từ client.
 */

const BCRYPT_ROUNDS = 12;

const WINDOW_MS = 15 * 60 * 1000; // 15 phút
const IP_LIMIT = 10;
const EMAIL_LIMIT = 5;

function json(body: unknown, status = 200, extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store");

  return NextResponse.json(body, { status, headers });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);

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

    const { name, email, password } = parsed.data;
    const ip = getClientIp(req) ?? "unknown";

    const ipLimit = checkRateLimit(`register:ip:${ip}`, {
      limit: IP_LIMIT,
      windowMs: WINDOW_MS,
    });
    const emailLimit = checkRateLimit(`register:email:${email}`, {
      limit: EMAIL_LIMIT,
      windowMs: WINDOW_MS,
    });

    if (!ipLimit.allowed || !emailLimit.allowed) {
      const retryAfter = Math.max(
        ipLimit.retryAfterSeconds,
        emailLimit.retryAfterSeconds,
      );

      await writeAuditLogFromRequest(req, {
        action: "AUTH_REGISTER_RATE_LIMITED",
        details: { email, retryAfterSeconds: retryAfter },
      });

      return json(
        {
          success: false,
          message: `Bạn đã thử đăng ký quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(
            retryAfter / 60,
          )} phút.`,
        },
        429,
        { "Retry-After": String(retryAfter) },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      await writeAuditLogFromRequest(req, {
        action: "AUTH_REGISTER_DUPLICATE",
        userId: existingUser.id,
        details: { email },
      });

      return json(
        {
          success: false,
          message: "Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.",
          errors: { email: "Email đã tồn tại trong hệ thống" },
        },
        409,
      );
    }

    const passwordHash = await hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        role: "STUDENT",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    await writeAuditLogFromRequest(req, {
      action: "AUTH_REGISTER_SUCCESS",
      userId: user.id,
      details: { email: user.email, role: user.role },
    });

    return json(
      {
        success: true,
        message: "Đăng ký tài khoản thành công. Vui lòng đăng nhập để tiếp tục.",
        user,
      },
      201,
    );
  } catch (error) {
    // Xử lý race condition: hai request cùng email lọt qua bước kiểm tra.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return json(
        {
          success: false,
          message: "Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.",
          errors: { email: "Email đã tồn tại trong hệ thống" },
        },
        409,
      );
    }

    console.error("[api/auth/register] Lỗi không mong đợi:", error);

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
