import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { auditLogInputSchema, zodFieldErrors } from "@/lib/validations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  return (
    bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB)
  );
}

/**
 * Endpoint nội bộ để middleware (Edge) ghi AuditLog thông qua Node runtime.
 * Yêu cầu header `x-audit-secret` khớp AUDIT_INTERNAL_SECRET.
 */
export async function POST(req: Request) {
  const expectedSecret = process.env.AUDIT_INTERNAL_SECRET;
  const providedSecret = req.headers.get("x-audit-secret");

  if (
    !expectedSecret ||
    !providedSecret ||
    !safeEqual(expectedSecret, providedSecret)
  ) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = auditLogInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Dữ liệu audit không hợp lệ",
        errors: zodFieldErrors(parsed.error),
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  await writeAuditLog({
    action: parsed.data.action,
    userId: parsed.data.userId ?? null,
    details: parsed.data.details,
  });

  return NextResponse.json(
    { success: true, message: "Đã ghi audit log" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
