"use server";

/**
 * OCR giả lập cho luồng check-in của Ban tổ chức (Prompt 5).
 *
 * Luồng thật: ảnh CCCD -> Google Cloud Vision API / FPT.AI -> chuỗi CCCD.
 * Luồng demo: chờ 1 giây rồi trả về CCCD mẫu, sau đó dùng blind index
 * (HMAC-SHA256) để matching với User.cccdHash mà không cần giải mã cả bảng.
 */

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { blindIndex, maskCccd, normalizeCccd } from "@/lib/crypto";
import { MOCK_OCR_CCCD, MOCK_OCR_DELAY_MS } from "@/lib/ocr-mock";
import { prisma } from "@/lib/prisma";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = /^image\/(?:jpe?g|png|webp|gif|heic|heif)$/i;
const campaignIdSchema = z.string().trim().min(1).max(64);

const ALREADY_CHECKED_IN_STATUSES = ["CHECKED_IN", "ELIGIBLE", "COMPLETED"];
const BLOCKED_STATUSES = ["REJECTED", "HEALTH_CHECK_FAILED"];

export type OcrCheckInData = {
  registrationId: string;
  studentName: string;
  studentEmail: string;
  cccdMasked: string;
  campaignId: string;
  campaignName: string;
  campaignDate: string;
  status: "CHECKED_IN";
  checkInTime: string;
};

export type OcrResult = {
  success: boolean;
  code?: string;
  message: string;
  data?: OcrCheckInData;
};

type TransactionOutcome =
  | { type: "not_found" }
  | { type: "invalid_status"; status: string }
  | {
      type: "updated";
      registrationId: string;
      checkInTime: Date;
      campaignId: string;
      campaignName: string;
      campaignDate: Date;
    };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "size" in value &&
    "type" in value
  );
}

function statusFailure(status: string): OcrResult {
  if (ALREADY_CHECKED_IN_STATUSES.includes(status)) {
    return {
      success: false,
      code: "ALREADY_CHECKED_IN",
      message: "Hồ sơ này đã được check-in trước đó.",
    };
  }

  if (BLOCKED_STATUSES.includes(status)) {
    return {
      success: false,
      code: "REGISTRATION_BLOCKED",
      message:
        "Hồ sơ đã bị từ chối hoặc không đạt khám sức khỏe, không thể check-in.",
    };
  }

  if (status === "PENDING") {
    return {
      success: false,
      code: "REGISTRATION_NOT_APPROVED",
      message: "Hồ sơ chưa được duyệt, chưa thể check-in.",
    };
  }

  return {
    success: false,
    code: "INVALID_STATUS",
    message: `Hồ sơ đang ở trạng thái ${status}, không thể check-in.`,
  };
}

export async function processCccdOcr(formData: FormData): Promise<OcrResult> {
  try {
    const session = await getSession();

    if (!session) {
      return {
        success: false,
        code: "UNAUTHENTICATED",
        message: "Bạn cần đăng nhập để thực hiện check-in.",
      };
    }

    if (session.role !== "ORGANIZER") {
      return {
        success: false,
        code: "FORBIDDEN",
        message: "Chỉ Ban tổ chức mới có quyền check-in bằng CCCD.",
      };
    }

    const file = formData.get("file");

    if (!isUploadedFile(file)) {
      return {
        success: false,
        code: "FILE_REQUIRED",
        message: "Vui lòng chọn ảnh CCCD cần quét.",
      };
    }

    if (file.size === 0) {
      return {
        success: false,
        code: "FILE_EMPTY",
        message: "Ảnh tải lên đang rỗng. Vui lòng chọn ảnh khác.",
      };
    }

    if (file.size > MAX_FILE_BYTES) {
      return {
        success: false,
        code: "FILE_TOO_LARGE",
        message: "Ảnh CCCD tối đa 5MB. Vui lòng chọn ảnh nhỏ hơn.",
      };
    }

    if (file.type && !ALLOWED_IMAGE_MIME.test(file.type)) {
      return {
        success: false,
        code: "INVALID_FILE_TYPE",
        message: "Chỉ chấp nhận ảnh JPG, PNG, WEBP, GIF hoặc HEIC.",
      };
    }

    const rawCampaignId = formData.get("campaignId");
    let campaignId: string | null = null;

    if (typeof rawCampaignId === "string" && rawCampaignId.trim() !== "") {
      const parsed = campaignIdSchema.safeParse(rawCampaignId);

      if (!parsed.success) {
        return {
          success: false,
          code: "INVALID_CAMPAIGN",
          message: "Chiến dịch không hợp lệ.",
        };
      }

      campaignId = parsed.data;
    }

    if (campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { id: true },
      });

      if (!campaign) {
        return {
          success: false,
          code: "CAMPAIGN_NOT_FOUND",
          message: "Không tìm thấy chiến dịch cần check-in.",
        };
      }
    }

    // Giả lập độ trễ gọi Google Cloud Vision API.
    await sleep(MOCK_OCR_DELAY_MS);

    const cccd = MOCK_OCR_CCCD;
    const cccdHash = blindIndex(normalizeCccd(cccd));

    const user = await prisma.user.findFirst({
      where: { cccdHash },
      select: {
        id: true,
        name: true,
        email: true,
        registrations: {
          where: campaignId
            ? { campaignId }
            : { campaign: { status: "ACTIVE" } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            campaignId: true,
            createdAt: true,
            campaign: { select: { name: true, date: true } },
          },
        },
      },
    });

    if (!user) {
      return {
        success: false,
        code: "CCCD_NOT_FOUND",
        message:
          "Không tìm thấy sinh viên khớp với CCCD trên ảnh. Vui lòng kiểm tra lại ảnh hoặc hồ sơ.",
      };
    }

    if (user.registrations.length === 0) {
      return {
        success: false,
        code: "REGISTRATION_NOT_FOUND",
        message: campaignId
          ? "Sinh viên này chưa đăng ký chiến dịch đang chọn."
          : "Sinh viên này chưa có hồ sơ đăng ký đang hoạt động.",
      };
    }

    const target =
      user.registrations.find((item) => item.status === "APPROVED") ??
      user.registrations[0];

    if (target.status !== "APPROVED") {
      return statusFailure(target.status);
    }

    const outcome = await prisma.$transaction<TransactionOutcome>(
      async (tx) => {
        const fresh = await tx.registration.findUnique({
          where: { id: target.id },
          select: { id: true, status: true },
        });

        if (!fresh) {
          return { type: "not_found" };
        }

        if (fresh.status !== "APPROVED") {
          return { type: "invalid_status", status: fresh.status };
        }

        const checkInTime = new Date();

        const updated = await tx.registration.update({
          where: { id: fresh.id },
          data: {
            status: "CHECKED_IN",
            checkInTime,
          },
          select: {
            id: true,
            checkInTime: true,
            campaignId: true,
            campaign: { select: { name: true, date: true } },
          },
        });

        return {
          type: "updated",
          registrationId: updated.id,
          checkInTime: updated.checkInTime ?? checkInTime,
          campaignId: updated.campaignId,
          campaignName: updated.campaign.name,
          campaignDate: updated.campaign.date,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (outcome.type === "not_found") {
      return {
        success: false,
        code: "REGISTRATION_NOT_FOUND",
        message: "Không tìm thấy hồ sơ đăng ký.",
      };
    }

    if (outcome.type === "invalid_status") {
      return statusFailure(outcome.status);
    }

    await writeAuditLog({
      action: "OCR_CHECK_IN",
      userId: session.userId,
      details: {
        registrationId: outcome.registrationId,
        campaignId: outcome.campaignId,
        method: "MOCK_OCR",
        cccdLast4: cccd.slice(-4),
      },
    });

    return {
      success: true,
      code: "CHECKED_IN",
      message: `Đã check-in thành công cho ${user.name}.`,
      data: {
        registrationId: outcome.registrationId,
        studentName: user.name,
        studentEmail: user.email,
        cccdMasked: maskCccd(cccd),
        campaignId: outcome.campaignId,
        campaignName: outcome.campaignName,
        campaignDate: outcome.campaignDate.toISOString(),
        status: "CHECKED_IN",
        checkInTime: outcome.checkInTime.toISOString(),
      },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return {
        success: false,
        code: "CONFLICT",
        message:
          "Hồ sơ đang được xử lý bởi thao tác khác. Vui lòng thử lại sau vài giây.",
      };
    }

    console.error("[processCccdOcr] Lỗi:", error);

    return {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Không thể xử lý ảnh CCCD. Vui lòng thử lại sau.",
    };
  }
}
