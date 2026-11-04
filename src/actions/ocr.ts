"use server";

/**
 * Xử lý check-in bằng CCCD cho Ban tổ chức và nhân viên y tế.
 *
 * Client dùng OCR (Tesseract) để nhận diện số CCCD in trên mặt trước thẻ,
 * sau đó gửi một hoặc nhiều ứng viên 12 chữ số lên server. Server dùng
 * blind index (HMAC-SHA256) để matching với User.cccdHash mà không cần
 * giải mã / quét toàn bộ bảng.
 *
 * Server chỉ check-in khi ứng viên khớp duy nhất một hồ sơ trong chiến dịch.
 * Nếu OCR trả về nhiều số khớp nhiều sinh viên khác nhau, server từ chối
 * để tránh check-in sai người.
 */

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { blindIndex, maskCccd } from "@/lib/crypto";
import {
  normalizeCccdCandidate,
  parseCccdCandidates,
} from "@/lib/cccd-ocr-parse";
import { prisma } from "@/lib/prisma";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = /^image\/(?:jpe?g|png|webp|gif|heic|heif)$/i;
const campaignIdSchema = z.string().trim().min(1).max(64);
const OCR_SOURCES = ["CAMERA_AUTO", "CAMERA_MANUAL", "UPLOAD"] as const;
type OcrSource = (typeof OCR_SOURCES)[number];
const MAX_CCCD_CANDIDATES = 10;

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

type RegistrationSummary = {
  id: string;
  status: string;
  campaignId: string;
  createdAt: Date;
  campaign: { name: string; date: Date };
};

type MatchedUser = {
  id: string;
  name: string;
  email: string;
  registrations: RegistrationSummary[];
};

type CandidateMatch =
  | { type: "not_found" }
  | { type: "no_registration" }
  | { type: "ambiguous" }
  | { type: "matched"; cccd: string; user: MatchedUser };

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

function parseOcrSource(value: FormDataEntryValue | null): OcrSource {
  if (
    typeof value === "string" &&
    (OCR_SOURCES as readonly string[]).includes(value)
  ) {
    return value as OcrSource;
  }

  return "UPLOAD";
}

function normalizeCccdValue(value: string): string | null {
  return normalizeCccdCandidate(value);
}

/**
 * Đọc dữ liệu CCCD do client gửi lên:
 * - `cccd`: số nhập tay (ưu tiên tuyệt đối).
 * - `cccdCandidates`: mảng JSON các số OCR nhận diện được, xếp hạng sẵn.
 */
function resolveCccdInput(formData: FormData): {
  manual: string | null;
  candidates: string[];
} {
  const rawManual = formData.get("cccd");
  const manual =
    typeof rawManual === "string" && rawManual.trim() !== ""
      ? normalizeCccdValue(rawManual)
      : null;

  if (manual) {
    return { manual, candidates: [] };
  }

  const rawCandidates = formData.get("cccdCandidates");

  return {
    manual: null,
    candidates: parseCccdCandidates(
      typeof rawCandidates === "string" ? rawCandidates : null,
      MAX_CCCD_CANDIDATES,
    ),
  };
}

async function findUserByCccd(
  cccd: string,
  campaignId: string | null,
): Promise<MatchedUser | null> {
  return prisma.user.findFirst({
    where: { cccdHash: blindIndex(cccd) },
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
}

/**
 * Đối chiếu nhiều ứng viên OCR với DB.
 *
 * Chỉ chấp nhận khi tất cả ứng viên khớp cùng một sinh viên. Nếu hai ứng
 * viên khớp hai sinh viên khác nhau, trả "ambiguous" và không check-in ai.
 */
async function findUserByCandidates(
  candidates: string[],
  campaignId: string | null,
): Promise<CandidateMatch> {
  const users = await prisma.user.findMany({
    where: {
      cccdHash: { in: candidates.map((candidate) => blindIndex(candidate)) },
    },
    select: {
      id: true,
      name: true,
      email: true,
      cccdHash: true,
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

  if (users.length === 0) {
    return { type: "not_found" };
  }

  const userByHash = new Map(
    users
      .filter(
        (user): user is (typeof users)[number] & { cccdHash: string } =>
          typeof user.cccdHash === "string" && user.cccdHash.length > 0,
      )
      .map((user) => [user.cccdHash, user]),
  );

  const matches: Array<{
    cccd: string;
    user: (typeof users)[number];
  }> = [];

  for (const candidate of candidates) {
    const user = userByHash.get(blindIndex(candidate));

    if (!user) continue;

    matches.push({ cccd: candidate, user });
  }

  if (matches.length === 0) {
    return { type: "not_found" };
  }

  const withRegistration = matches.filter(
    (match) => match.user.registrations.length > 0,
  );

  if (withRegistration.length === 0) {
    return { type: "no_registration" };
  }

  const distinctUsers = new Set(
    withRegistration.map((match) => match.user.id),
  );

  if (distinctUsers.size > 1) {
    return { type: "ambiguous" };
  }

  const matched = withRegistration[0];

  return {
    type: "matched",
    cccd: matched.cccd,
    user: matched.user,
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

    if (session.role !== "ORGANIZER" && session.role !== "MEDICAL") {
      return {
        success: false,
        code: "FORBIDDEN",
        message:
          "Chỉ Ban tổ chức hoặc nhân viên y tế mới có quyền check-in bằng CCCD.",
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
    const source = parseOcrSource(formData.get("source"));
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

    const { manual, candidates } = resolveCccdInput(formData);

    if (!manual && candidates.length === 0) {
      return {
        success: false,
        code: "INVALID_CCCD",
        message:
          "Không nhận diện được số CCCD hợp lệ. Vui lòng đưa phần số CCCD trên thẻ vào khung hình hoặc nhập tay 12 chữ số.",
      };
    }

    let matchedCccd: string;
    let user: MatchedUser;

    if (manual) {
      const manualUser = await findUserByCccd(manual, campaignId);

      if (!manualUser) {
        return {
          success: false,
          code: "CCCD_NOT_FOUND",
          message:
            "Không tìm thấy sinh viên khớp với số CCCD đã nhập. Vui lòng kiểm tra lại số trên thẻ hoặc hồ sơ.",
        };
      }

      if (manualUser.registrations.length === 0) {
        return {
          success: false,
          code: "REGISTRATION_NOT_FOUND",
          message: campaignId
            ? "Sinh viên này chưa đăng ký chiến dịch đang chọn."
            : "Sinh viên này chưa có hồ sơ đăng ký đang hoạt động.",
        };
      }

      matchedCccd = manual;
      user = manualUser;
    } else {
      const match = await findUserByCandidates(candidates, campaignId);

      if (match.type === "not_found") {
        return {
          success: false,
          code: "CCCD_NOT_FOUND",
          message:
            "Không tìm thấy sinh viên khớp với số CCCD nhận diện được. Vui lòng chụp lại rõ hơn, kiểm tra ánh sáng hoặc nhập tay 12 số trên thẻ.",
        };
      }

      if (match.type === "no_registration") {
        return {
          success: false,
          code: "REGISTRATION_NOT_FOUND",
          message: campaignId
            ? "Sinh viên này chưa đăng ký chiến dịch đang chọn."
            : "Sinh viên này chưa có hồ sơ đăng ký đang hoạt động.",
        };
      }

      if (match.type === "ambiguous") {
        return {
          success: false,
          code: "AMBIGUOUS_CCCD",
          message:
            "Nhận diện được nhiều số CCCD khác nhau trên ảnh. Vui lòng chụp lại rõ hơn hoặc nhập tay 12 số in trên thẻ.",
        };
      }

      matchedCccd = match.cccd;
      user = match.user;
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
        method: "OCR",
        source,
        role: session.role,
        cccdLast4: matchedCccd.slice(-4),
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
        cccdMasked: maskCccd(matchedCccd),
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
