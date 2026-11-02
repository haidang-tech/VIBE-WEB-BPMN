import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { writeAuditLogFromRequest } from "@/lib/audit";
import { AUTH_COOKIE, getClearAuthCookieOptions } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();

  if (session) {
    await writeAuditLogFromRequest(req, {
      action: "AUTH_LOGOUT",
      userId: session.userId,
      details: { role: session.role },
    });
  }

  const response = NextResponse.json(
    { success: true, message: "Đã đăng xuất" },
    { headers: { "Cache-Control": "no-store" } },
  );

  response.cookies.set(AUTH_COOKIE, "", getClearAuthCookieOptions());

  return response;
}
