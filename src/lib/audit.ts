/**
 * Audit Log helper.
 *
 * Nguyên tắc:
 * - Ghi log KHÔNG được làm hỏng luồng nghiệp vụ => mọi lỗi đều bị nuốt và chỉ
 *   ghi ra console.
 * - KHÔNG bao giờ đưa mật khẩu / token / CCCD plaintext vào `details`.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type AuditContext = {
  ip: string | null;
  userAgent: string | null;
  path: string | null;
  method: string | null;
};

export function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  const candidate =
    forwarded?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim();

  if (!candidate) return null;

  // Chuẩn hóa IPv4-mapped IPv6 (::ffff:127.0.0.1 -> 127.0.0.1) và giới hạn độ dài.
  return candidate.replace(/^::ffff:/, "").slice(0, 64);
}

export function getRequestContext(req: Request): AuditContext {
  let path: string | null = null;

  try {
    path = new URL(req.url).pathname.slice(0, 300);
  } catch {
    path = null;
  }

  return {
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    path,
    method: req.method,
  };
}

export async function writeAuditLog(input: {
  action: string;
  userId?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        userId: input.userId ?? null,
        details: input.details
          ? (input.details as Prisma.InputJsonValue)
          : undefined,
      },
    });
  } catch (error) {
    console.error(`[audit] Không ghi được log "${input.action}":`, error);
  }
}

/** Ghi audit kèm metadata của request hiện tại. */
export async function writeAuditLogFromRequest(
  req: Request,
  input: {
    action: string;
    userId?: string | null;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await writeAuditLog({
    action: input.action,
    userId: input.userId,
    details: {
      ...input.details,
      request: getRequestContext(req),
    },
  });
}
