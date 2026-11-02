/**
 * JWT phiên đăng nhập (HS256) — tương thích cả Node runtime và Edge runtime.
 * Không import Prisma / node:crypto ở file này.
 */

import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { isUserRole, type UserRole } from "./rbac";

export const AUTH_COOKIE = "due_session";

const ISSUER = "due-blood";
const AUDIENCE = "due-blood-web";
const DEFAULT_TTL_SECONDS = 8 * 60 * 60; // 8 giờ

export type SessionPayload = {
  userId: string;
  role: UserRole;
};

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET phải có tối thiểu 32 ký tự (xem .env.example).");
  }

  return new TextEncoder().encode(secret);
}

export function getSessionTtlSeconds(): number {
  const raw = Number(process.env.SESSION_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);

  if (!Number.isFinite(raw) || raw < 60 || raw > 30 * 24 * 60 * 60) {
    return DEFAULT_TTL_SECONDS;
  }

  return Math.floor(raw);
}

export async function signSessionToken(session: SessionPayload): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);

  return new SignJWT({
    role: session.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(session.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + getSessionTtlSeconds())
    .sign(getSecret());
}

/** Trả về payload nếu token hợp lệ, ngược lại null (không throw). */
export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    if (
      typeof payload.sub !== "string" ||
      payload.sub.length === 0 ||
      !isUserRole(payload.role)
    ) {
      return null;
    }

    return {
      userId: payload.sub,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

/** Thuộc tính cookie phiên (HTTPOnly + Secure + SameSite=Lax). */
export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== "false",
    sameSite: "lax" as const,
    path: "/",
    maxAge: getSessionTtlSeconds(),
  };
}

export function getClearAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== "false",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
