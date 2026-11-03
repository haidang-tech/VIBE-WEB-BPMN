"use server";

/**
 * Server Actions cho phân hệ Admin (Prompt 7).
 *
 * Phạm vi: CRUD Campaign. Mọi action đều kiểm tra role ADMIN ở server và ghi
 * AuditLog khi thay đổi dữ liệu. Không tin dữ liệu/trạng thái do client gửi lên.
 */

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import type { SessionPayload } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { campaignFormSchema, zodFieldErrors } from "@/lib/validations";

export type AdminActionResult<T = undefined> = {
  success: boolean;
  message: string;
  code?: string;
  data?: T;
  errors?: Record<string, string>;
};

export type CampaignActionResultData = {
  campaignId: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
};

const idSchema = z.string().trim().min(1, "Thiếu ID").max(64, "ID quá dài");

const updateCampaignSchema = campaignFormSchema.extend({ id: idSchema });

type AdminGuard =
  | { session: SessionPayload }
  | { error: AdminActionResult<never> };

async function requireAdmin(): Promise<AdminGuard> {
  const session = await getSession();

  if (!session) {
    return {
      error: {
        success: false,
        code: "UNAUTHENTICATED",
        message: "Bạn cần đăng nhập để thực hiện thao tác này.",
      },
    };
  }

  if (session.role !== "ADMIN") {
    return {
      error: {
        success: false,
        code: "FORBIDDEN",
        message: "Chỉ quản trị viên mới có quyền quản lý chiến dịch.",
      },
    };
  }

  return { session };
}

function isPrismaError(
  error: unknown,
  code: string,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00+07:00`);
}

export async function createCampaign(
  data: unknown,
): Promise<AdminActionResult<CampaignActionResultData>> {
  try {
    const guard = await requireAdmin();
    if ("error" in guard) return guard.error;

    const parsed = campaignFormSchema.safeParse(data);

    if (!parsed.success) {
      return {
        success: false,
        code: "INVALID_INPUT",
        message: "Thông tin chiến dịch không hợp lệ.",
        errors: zodFieldErrors(parsed.error),
      };
    }

    const { name, date, location, capacity, overbookRate, status } =
      parsed.data;

    const campaign = await prisma.campaign.create({
      data: {
        name,
        date: toDate(date),
        location,
        capacity,
        overbookRate,
        status,
      },
      select: { id: true, name: true, status: true },
    });

    await writeAuditLog({
      action: "CAMPAIGN_CREATED",
      userId: guard.session.userId,
      details: {
        campaignId: campaign.id,
        name,
        date,
        location,
        capacity,
        overbookRate,
        status,
      },
    });

    return {
      success: true,
      code: "CAMPAIGN_CREATED",
      message: `Đã tạo chiến dịch "${campaign.name}".`,
      data: {
        campaignId: campaign.id,
        name: campaign.name,
        status: campaign.status,
      },
    };
  } catch (error) {
    console.error("[createCampaign] Lỗi:", error);

    return {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Không thể tạo chiến dịch. Vui lòng thử lại sau.",
    };
  }
}

export async function updateCampaign(
  data: unknown,
): Promise<AdminActionResult<CampaignActionResultData>> {
  try {
    const guard = await requireAdmin();
    if ("error" in guard) return guard.error;

    const parsed = updateCampaignSchema.safeParse(data);

    if (!parsed.success) {
      return {
        success: false,
        code: "INVALID_INPUT",
        message: "Thông tin chiến dịch không hợp lệ.",
        errors: zodFieldErrors(parsed.error),
      };
    }

    const { id, name, date, location, capacity, overbookRate, status } =
      parsed.data;

    const existing = await prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        date: true,
        location: true,
        capacity: true,
        overbookRate: true,
        status: true,
      },
    });

    if (!existing) {
      return {
        success: false,
        code: "CAMPAIGN_NOT_FOUND",
        message: "Không tìm thấy chiến dịch cần cập nhật.",
      };
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        name,
        date: toDate(date),
        location,
        capacity,
        overbookRate,
        status,
      },
      select: { id: true, name: true, status: true },
    });

    await writeAuditLog({
      action: "CAMPAIGN_UPDATED",
      userId: guard.session.userId,
      details: {
        campaignId: campaign.id,
        before: {
          name: existing.name,
          date: existing.date.toISOString(),
          location: existing.location,
          capacity: existing.capacity,
          overbookRate: Number(existing.overbookRate),
          status: existing.status,
        },
        after: {
          name,
          date,
          location,
          capacity,
          overbookRate,
          status,
        },
      },
    });

    return {
      success: true,
      code: "CAMPAIGN_UPDATED",
      message: `Đã cập nhật chiến dịch "${campaign.name}".`,
      data: {
        campaignId: campaign.id,
        name: campaign.name,
        status: campaign.status,
      },
    };
  } catch (error) {
    if (isPrismaError(error, "P2025")) {
      return {
        success: false,
        code: "CAMPAIGN_NOT_FOUND",
        message: "Không tìm thấy chiến dịch cần cập nhật.",
      };
    }

    console.error("[updateCampaign] Lỗi:", error);

    return {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Không thể cập nhật chiến dịch. Vui lòng thử lại sau.",
    };
  }
}

export async function deleteCampaign(
  campaignId: string,
): Promise<AdminActionResult<{ campaignId: string }>> {
  try {
    const guard = await requireAdmin();
    if ("error" in guard) return guard.error;

    const parsed = idSchema.safeParse(campaignId);

    if (!parsed.success) {
      return {
        success: false,
        code: "INVALID_INPUT",
        message: "ID chiến dịch không hợp lệ.",
      };
    }

    const existing = await prisma.campaign.findUnique({
      where: { id: parsed.data },
      select: {
        id: true,
        name: true,
        date: true,
        capacity: true,
        _count: { select: { registrations: true } },
      },
    });

    if (!existing) {
      return {
        success: false,
        code: "CAMPAIGN_NOT_FOUND",
        message: "Không tìm thấy chiến dịch cần xóa.",
      };
    }

    // Bảo vệ dữ liệu: không xóa chiến dịch đã có hồ sơ đăng ký.
    if (existing._count.registrations > 0) {
      return {
        success: false,
        code: "CAMPAIGN_HAS_REGISTRATIONS",
        message: `Không thể xóa chiến dịch đã có ${existing._count.registrations} hồ sơ đăng ký. Hãy chuyển trạng thái sang Đã hủy thay vì xóa.`,
      };
    }

    await prisma.campaign.delete({ where: { id: existing.id } });

    await writeAuditLog({
      action: "CAMPAIGN_DELETED",
      userId: guard.session.userId,
      details: {
        campaignId: existing.id,
        name: existing.name,
        date: existing.date.toISOString(),
        capacity: existing.capacity,
      },
    });

    return {
      success: true,
      code: "CAMPAIGN_DELETED",
      message: `Đã xóa chiến dịch "${existing.name}".`,
      data: { campaignId: existing.id },
    };
  } catch (error) {
    if (isPrismaError(error, "P2025")) {
      return {
        success: false,
        code: "CAMPAIGN_NOT_FOUND",
        message: "Không tìm thấy chiến dịch cần xóa.",
      };
    }

    console.error("[deleteCampaign] Lỗi:", error);

    return {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Không thể xóa chiến dịch. Vui lòng thử lại sau.",
    };
  }
}
