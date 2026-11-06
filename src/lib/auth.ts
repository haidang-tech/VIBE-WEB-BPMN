/**
 * Truy cập phiên đăng nhập từ Server Component / Route Handler.
 * Chỉ dùng ở server (import next/headers, next/navigation).
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_COOKIE,
  verifySessionToken,
  type SessionPayload,
} from "./jwt";
import { defaultAfterLogin } from "./rbac";

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  if (!token) return null;

  return verifySessionToken(token);
}

/** Dùng trong Server Component: chưa đăng nhập thì chuyển về /login. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

/** Dùng trong Server Component: sai role thì đưa về trang chủ của role đó. */
export async function requireRole(
  role: SessionPayload["role"],
): Promise<SessionPayload> {
  const session = await requireSession();

  if (session.role !== role) {
    redirect(defaultAfterLogin(session.role));
  }

  return session;
}
