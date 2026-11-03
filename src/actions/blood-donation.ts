"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { encryptCccd, safeEqualHash } from "@/lib/crypto";
import {
  BLOCKING_REGISTRATION_STATUSES,
  CAPACITY_CONSUMING_STATUSES,
  HEALTH_CHECK_ALLOWED_STATUSES,
  computeMaxSlots,
  evaluateHealthRules,
  evaluateProfileRules,
  parseBloodPressure,
} from "@/lib/donation-rules";
import { prisma } from "@/lib/prisma";
import {
  calculateAge,
  donationRegistrationSchema,
  healthCheckSchema,
  zodFieldErrors,
} from "@/lib/validations";

// ---------------------------------------------------------------------------
// Kiểu kết quả chung
// ---------------------------------------------------------------------------

export type ActionResult<T = undefined> = {
  success: boolean;
  message: string;
  code?: string;
  data?: T;
  errors?: Record<string, string>;
};

export type CanRegisterData = {
  campaignId: string;
  campaignName: string;
  capacity: number;
  overbookRate: number;
  maxSlots: number;
  activeCount: number;
  remainingSlots: number;
  existingRegistrationId?: string;
};

export type ValidateProfileData = {
  registrationId: string;
  status: "APPROVED" | "REJECTED";
  eligible: boolean;
  age: number;
  reasons: string[];
};

export type EvaluateHealthData = {
  registrationId: string;
  healthCheckId: string;
  status: "ELIGIBLE" | "HEALTH_CHECK_FAILED";
  isPassed: boolean;
  reasons: string[];
};

export type FinalizeDonationData = {
  registrationId: string;
  status: "COMPLETED" | "HEALTH_CHECK_FAILED";
  outcome: "SUCCESS" | "INCIDENT";
};

const idSchema = z.string().trim().min(1, "Thiếu ID").max(64, "ID quá dài");

const finalizeDonationSchema = z.object({
  registrationId: idSchema,
  outcome: z.enum(["SUCCESS", "INCIDENT"], {
    error: "Kết quả hiến máu không hợp lệ",
  }),
});

// ---------------------------------------------------------------------------
// Helper nội bộ
// ---------------------------------------------------------------------------

function isPrismaError(
  error: unknown,
  code: string,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}

/**
 * XOR 1 (core): kiểm tra sinh viên có được tạo hồ sơ mới cho chiến dịch không.
 * Không kiểm tra session để có thể tái sử dụng trong transaction.
 */
async function checkCanRegisterCore(
  userId: string,
  campaignId: string,
): Promise<ActionResult<CanRegisterData>> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      capacity: true,
      overbookRate: true,
    },
  });

  if (!campaign) {
    return {
      success: false,
      code: "CAMPAIGN_NOT_FOUND",
      message: "Chiến dịch không tồn tại.",
    };
  }

  const existing = await prisma.registration.findFirst({
    where: {
      userId,
      campaignId,
      status: { in: [...BLOCKING_REGISTRATION_STATUSES] },
    },
    select: { id: true },
  });

  const activeCount = await prisma.registration.count({
    where: {
      campaignId,
      status: { in: [...CAPACITY_CONSUMING_STATUSES] },
    },
  });

  const overbookRate = Number(campaign.overbookRate);
  const maxSlots = computeMaxSlots(campaign.capacity, overbookRate);

  if (existing) {
    return {
      success: false,
      code: "ALREADY_REGISTERED",
      message:
        "Bạn đã có hồ sơ đang hoạt động cho chiến dịch này. Vui lòng theo dõi tại trang Tracking.",
      data: {
        campaignId,
        campaignName: campaign.name,
        capacity: campaign.capacity,
        overbookRate,
        maxSlots,
        activeCount,
        remainingSlots: Math.max(0, maxSlots - activeCount),
        existingRegistrationId: existing.id,
      },
    };
  }

  if (activeCount >= maxSlots) {
    return {
      success: false,
      code: "CAMPAIGN_FULL",
      message: `Chiến dịch đã đủ chỉ tiêu (${activeCount}/${maxSlots} suất, đã gồm overbook).`,
      data: {
        campaignId,
        campaignName: campaign.name,
        capacity: campaign.capacity,
        overbookRate,
        maxSlots,
        activeCount,
        remainingSlots: 0,
      },
    };
  }

  return {
    success: true,
    code: "CAN_REGISTER",
    message: "Bạn có thể đăng ký hiến máu cho chiến dịch này.",
    data: {
      campaignId,
      campaignName: campaign.name,
      capacity: campaign.capacity,
      overbookRate,
      maxSlots,
      activeCount,
      remainingSlots: maxSlots - activeCount,
    },
  };
}

// ---------------------------------------------------------------------------
// XOR 1 — Trước form: có được tạo hồ sơ mới không?
// ---------------------------------------------------------------------------

export async function checkCanRegister(
  userId: string,
  campaignId: string,
): Promise<ActionResult<CanRegisterData>> {
  try {
    const ids = z
      .object({ userId: idSchema, campaignId: idSchema })
      .safeParse({ userId, campaignId });

    if (!ids.success) {
      return {
        success: false,
        code: "INVALID_INPUT",
        message: "ID người dùng hoặc chiến dịch không hợp lệ.",
        errors: zodFieldErrors(ids.error),
      };
    }

    const session = await getSession();

    if (!session) {
      return {
        success: false,
        code: "UNAUTHENTICATED",
        message: "Bạn cần đăng nhập để thực hiện thao tác này.",
      };
    }

    if (session.role !== "STUDENT" || session.userId !== userId) {
      return {
        success: false,
        code: "FORBIDDEN",
        message: "Bạn không có quyền kiểm tra hồ sơ của người khác.",
      };
    }

    return await checkCanRegisterCore(session.userId, campaignId);
  } catch (error) {
    console.error("[checkCanRegister] Lỗi:", error);

    return {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Không thể kiểm tra điều kiện đăng ký. Vui lòng thử lại sau.",
    };
  }
}

// ---------------------------------------------------------------------------
// XOR 2 — Xử lý form: hồ sơ cơ bản có đạt không?
// ---------------------------------------------------------------------------

type ValidateProfileOutcome =
  | { type: "campaign_not_found" }
  | { type: "duplicate"; registrationId: string }
  | { type: "full"; maxSlots: number; activeCount: number }
  | {
      type: "created";
      registrationId: string;
      status: "APPROVED" | "REJECTED";
    };

export async function validateProfile(
  data: unknown,
): Promise<ActionResult<ValidateProfileData>> {
  try {
    const session = await getSession();

    if (!session) {
      return {
        success: false,
        code: "UNAUTHENTICATED",
        message: "Bạn cần đăng nhập để đăng ký hiến máu.",
      };
    }

    if (session.role !== "STUDENT") {
      return {
        success: false,
        code: "FORBIDDEN",
        message: "Chỉ sinh viên mới có thể đăng ký hiến máu.",
      };
    }

    const parsed = donationRegistrationSchema.safeParse(data);

    if (!parsed.success) {
      return {
        success: false,
        code: "INVALID_INPUT",
        message: "Thông tin đăng ký không hợp lệ.",
        errors: zodFieldErrors(parsed.error),
      };
    }

    const { fullName, cccd, dateOfBirth, weightKg, campaignId } = parsed.data;
    const age = calculateAge(dateOfBirth);
    const profile = evaluateProfileRules(age, weightKg);
    const encryptedCccd = encryptCccd(cccd);

    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, cccdHash: true },
    });

    if (!currentUser) {
      return {
        success: false,
        code: "USER_NOT_FOUND",
        message: "Không tìm thấy tài khoản. Vui lòng đăng nhập lại.",
      };
    }

    // CCCD đã gắn với tài khoản thì không được đổi sang số khác.
    if (
      currentUser.cccdHash &&
      !safeEqualHash(currentUser.cccdHash, encryptedCccd.hash)
    ) {
      return {
        success: false,
        code: "CCCD_MISMATCH",
        message:
          "CCCD không khớp với hồ sơ tài khoản. Vui lòng liên hệ ban tổ chức nếu cần thay đổi.",
      };
    }

    // CCCD đã thuộc về một tài khoản khác.
    const cccdOwner = await prisma.user.findFirst({
      where: {
        cccdHash: encryptedCccd.hash,
        NOT: { id: session.userId },
      },
      select: { id: true },
    });

    if (cccdOwner) {
      return {
        success: false,
        code: "CCCD_IN_USE",
        message: "Số CCCD này đã được sử dụng cho một tài khoản khác.",
      };
    }

    // Kiểm tra XOR 1 + ghi hồ sơ trong cùng transaction.
    // Serializable giúp tránh 2 request đồng thời cùng vượt qua bước đếm capacity.
    const outcome = await prisma.$transaction<ValidateProfileOutcome>(
      async (tx) => {
        const campaign = await tx.campaign.findUnique({
          where: { id: campaignId },
          select: { id: true, capacity: true, overbookRate: true },
        });

        if (!campaign) {
          return { type: "campaign_not_found" };
        }

        const existing = await tx.registration.findFirst({
          where: {
            userId: session.userId,
            campaignId,
            status: { in: [...BLOCKING_REGISTRATION_STATUSES] },
          },
          select: { id: true },
        });

        if (existing) {
          return { type: "duplicate", registrationId: existing.id };
        }

        const activeCount = await tx.registration.count({
          where: {
            campaignId,
            status: { in: [...CAPACITY_CONSUMING_STATUSES] },
          },
        });

        const maxSlots = computeMaxSlots(
          campaign.capacity,
          Number(campaign.overbookRate),
        );

        if (activeCount >= maxSlots) {
          return { type: "full", maxSlots, activeCount };
        }

        const status = profile.eligible ? "APPROVED" : "REJECTED";

        const registration = await tx.registration.create({
          data: {
            userId: session.userId,
            campaignId,
            status,
          },
          select: { id: true },
        });

        // Lưu họ tên + CCCD đã mã hóa vào hồ sơ người dùng.
        // Email/số điện thoại không ghi đè để tránh đổi danh tính tài khoản.
        await tx.user.update({
          where: { id: session.userId },
          data: {
            name: fullName,
            cccdCiphertext: encryptedCccd.ciphertext,
            cccdIv: encryptedCccd.iv,
            cccdAuthTag: encryptedCccd.authTag,
            cccdHash: encryptedCccd.hash,
          },
        });

        return {
          type: "created",
          registrationId: registration.id,
          status,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (outcome.type === "campaign_not_found") {
      return {
        success: false,
        code: "CAMPAIGN_NOT_FOUND",
        message: "Chiến dịch không tồn tại.",
      };
    }

    if (outcome.type === "duplicate") {
      return {
        success: false,
        code: "ALREADY_REGISTERED",
        message:
          "Bạn đã có hồ sơ đang hoạt động cho chiến dịch này. Vui lòng theo dõi tại trang Tracking.",
      };
    }

    if (outcome.type === "full") {
      return {
        success: false,
        code: "CAMPAIGN_FULL",
        message: `Chiến dịch đã đủ chỉ tiêu (${outcome.activeCount}/${outcome.maxSlots} suất, đã gồm overbook).`,
      };
    }

    await writeAuditLog({
      action: profile.eligible
        ? "REGISTRATION_APPROVED"
        : "REGISTRATION_REJECTED",
      userId: session.userId,
      details: {
        registrationId: outcome.registrationId,
        campaignId,
        status: outcome.status,
        age,
        weightKg,
        reasons: profile.reasons,
      },
    });

    if (!profile.eligible) {
      return {
        success: false,
        code: "PROFILE_REJECTED",
        message: `Hồ sơ chưa đủ điều kiện hiến máu: ${profile.reasons.join("; ")}.`,
        data: {
          registrationId: outcome.registrationId,
          status: "REJECTED",
          eligible: false,
          age,
          reasons: profile.reasons,
        },
      };
    }

    return {
      success: true,
      code: "PROFILE_APPROVED",
      message: "Hồ sơ hợp lệ. Bạn đã được duyệt tham gia hiến máu.",
      data: {
        registrationId: outcome.registrationId,
        status: "APPROVED",
        eligible: true,
        age,
        reasons: [],
      },
    };
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      return {
        success: false,
        code: "ALREADY_REGISTERED",
        message:
          "Bạn đã có hồ sơ đang hoạt động cho chiến dịch này. Vui lòng theo dõi tại trang Tracking.",
      };
    }

    if (isPrismaError(error, "P2034")) {
      return {
        success: false,
        code: "CONFLICT",
        message:
          "Hệ thống đang xử lý nhiều đăng ký cùng lúc. Vui lòng thử lại sau vài giây.",
      };
    }

    console.error("[validateProfile] Lỗi:", error);

    return {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Không thể lưu hồ sơ đăng ký. Vui lòng thử lại sau.",
    };
  }
}

// ---------------------------------------------------------------------------
// XOR 3 — Tại quầy y tế: sức khỏe lâm sàng có đạt không?
// ---------------------------------------------------------------------------

type EvaluateHealthOutcome =
  | { type: "not_found" }
  | { type: "invalid_status"; status: string }
  | { type: "saved"; healthCheckId: string; status: "ELIGIBLE" | "HEALTH_CHECK_FAILED" };

export async function evaluateHealth(
  data: unknown,
): Promise<ActionResult<EvaluateHealthData>> {
  try {
    const session = await getSession();

    if (!session) {
      return {
        success: false,
        code: "UNAUTHENTICATED",
        message: "Bạn cần đăng nhập để nhập kết quả khám sức khỏe.",
      };
    }

    if (session.role !== "MEDICAL") {
      return {
        success: false,
        code: "FORBIDDEN",
        message: "Chỉ nhân viên y tế mới có quyền nhập kết quả khám.",
      };
    }

    const parsed = healthCheckSchema.safeParse(data);

    if (!parsed.success) {
      return {
        success: false,
        code: "INVALID_INPUT",
        message: "Chỉ số khám sức khỏe không hợp lệ.",
        errors: zodFieldErrors(parsed.error),
      };
    }

    const {
      registrationId,
      bloodPressure,
      heartRate,
      weight,
      bloodType,
      bloodVolume,
    } = parsed.data;

    const pressure = parseBloodPressure(bloodPressure);

    if (!pressure) {
      return {
        success: false,
        code: "INVALID_INPUT",
        message: "Huyết áp không đúng định dạng (ví dụ 120/80).",
        errors: { bloodPressure: "Huyết áp không đúng định dạng" },
      };
    }

    const evaluation = evaluateHealthRules({
      bloodPressure: pressure,
      heartRate,
    });

    const outcome = await prisma.$transaction<EvaluateHealthOutcome>(
      async (tx) => {
        const registration = await tx.registration.findUnique({
          where: { id: registrationId },
          select: { id: true, status: true },
        });

        if (!registration) {
          return { type: "not_found" };
        }

        if (
          !(HEALTH_CHECK_ALLOWED_STATUSES as readonly string[]).includes(
            registration.status,
          )
        ) {
          return { type: "invalid_status", status: registration.status };
        }

        const healthCheck = await tx.healthCheck.upsert({
          where: { registrationId },
          create: {
            registrationId,
            bloodPressure,
            heartRate,
            weight,
            bloodType,
            bloodVolume,
            isPassed: evaluation.isPassed,
            medicalStaffId: session.userId,
          },
          update: {
            bloodPressure,
            heartRate,
            weight,
            bloodType,
            bloodVolume,
            isPassed: evaluation.isPassed,
            medicalStaffId: session.userId,
          },
          select: { id: true },
        });

        const status = evaluation.isPassed
          ? "ELIGIBLE"
          : "HEALTH_CHECK_FAILED";

        await tx.registration.update({
          where: { id: registrationId },
          data: { status },
        });

        return { type: "saved", healthCheckId: healthCheck.id, status };
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
      return {
        success: false,
        code: "INVALID_STATUS",
        message: `Hồ sơ đang ở trạng thái ${outcome.status}, không thể nhập kết quả khám.`,
      };
    }

    await writeAuditLog({
      action: evaluation.isPassed
        ? "HEALTH_CHECK_PASSED"
        : "HEALTH_CHECK_FAILED",
      userId: session.userId,
      details: {
        registrationId,
        healthCheckId: outcome.healthCheckId,
        status: outcome.status,
        isPassed: evaluation.isPassed,
      },
    });

    if (!evaluation.isPassed) {
      return {
        success: false,
        code: "HEALTH_CHECK_FAILED",
        message: `Sức khỏe chưa đạt: ${evaluation.reasons.join("; ")}.`,
        data: {
          registrationId,
          healthCheckId: outcome.healthCheckId,
          status: "HEALTH_CHECK_FAILED",
          isPassed: false,
          reasons: evaluation.reasons,
        },
      };
    }

    return {
      success: true,
      code: "ELIGIBLE",
      message: "Sức khỏe đạt yêu cầu. Hồ sơ đã chuyển sang trạng thái ELIGIBLE.",
      data: {
        registrationId,
        healthCheckId: outcome.healthCheckId,
        status: "ELIGIBLE",
        isPassed: true,
        reasons: [],
      },
    };
  } catch (error) {
    if (isPrismaError(error, "P2034")) {
      return {
        success: false,
        code: "CONFLICT",
        message:
          "Hệ thống đang xử lý nhiều hồ sơ cùng lúc. Vui lòng thử lại sau vài giây.",
      };
    }

    console.error("[evaluateHealth] Lỗi:", error);

    return {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Không thể lưu kết quả khám sức khỏe. Vui lòng thử lại sau.",
    };
  }
}

// ---------------------------------------------------------------------------
// Chốt kết quả hiến máu (sau khi hồ sơ đã ELIGIBLE)
// ---------------------------------------------------------------------------

type FinalizeDonationOutcome =
  | { type: "not_found" }
  | { type: "invalid_status"; status: string }
  | { type: "updated"; status: "COMPLETED" | "HEALTH_CHECK_FAILED" };

/**
 * Chốt kết quả sau khi lấy máu.
 *
 * - `SUCCESS`  : hiến máu thành công -> `COMPLETED`.
 * - `INCIDENT` : thất bại do sự cố (rút kim, máu đông, tai biến nhẹ...) ->
 *   `HEALTH_CHECK_FAILED`. Giữ nguyên `HealthCheck.isPassed = true` vì chỉ số
 *   khám lúc trước vẫn hợp lệ; sự cố xảy ra ở bước lấy máu.
 */
export async function finalizeDonation(
  data: unknown,
): Promise<ActionResult<FinalizeDonationData>> {
  try {
    const session = await getSession();

    if (!session) {
      return {
        success: false,
        code: "UNAUTHENTICATED",
        message: "Bạn cần đăng nhập để chốt kết quả hiến máu.",
      };
    }

    if (session.role !== "MEDICAL") {
      return {
        success: false,
        code: "FORBIDDEN",
        message: "Chỉ nhân viên y tế mới có quyền chốt kết quả hiến máu.",
      };
    }

    const parsed = finalizeDonationSchema.safeParse(data);

    if (!parsed.success) {
      return {
        success: false,
        code: "INVALID_INPUT",
        message: "Kết quả hiến máu không hợp lệ.",
        errors: zodFieldErrors(parsed.error),
      };
    }

    const { registrationId, outcome } = parsed.data;
    const nextStatus =
      outcome === "SUCCESS" ? "COMPLETED" : "HEALTH_CHECK_FAILED";

    const result = await prisma.$transaction<FinalizeDonationOutcome>(
      async (tx) => {
        const registration = await tx.registration.findUnique({
          where: { id: registrationId },
          select: { id: true, status: true },
        });

        if (!registration) {
          return { type: "not_found" };
        }

        // Chỉ chốt được hồ sơ đã qua khám sức khỏe (ELIGIBLE).
        if (registration.status !== "ELIGIBLE") {
          return { type: "invalid_status", status: registration.status };
        }

        await tx.registration.update({
          where: { id: registrationId },
          data: { status: nextStatus },
          select: { id: true },
        });

        return { type: "updated", status: nextStatus };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.type === "not_found") {
      return {
        success: false,
        code: "REGISTRATION_NOT_FOUND",
        message: "Không tìm thấy hồ sơ đăng ký.",
      };
    }

    if (result.type === "invalid_status") {
      return {
        success: false,
        code: "INVALID_STATUS",
        message: `Hồ sơ đang ở trạng thái ${result.status}, không thể chốt kết quả hiến máu.`,
      };
    }

    await writeAuditLog({
      action:
        outcome === "SUCCESS" ? "DONATION_COMPLETED" : "DONATION_FAILED",
      userId: session.userId,
      details: {
        registrationId,
        previousStatus: "ELIGIBLE",
        status: result.status,
        outcome,
      },
    });

    if (outcome === "INCIDENT") {
      return {
        success: true,
        code: "DONATION_FAILED",
        message:
          "Đã ghi nhận ca hiến máu thất bại do sự cố. Hồ sơ được đóng để không tính chỉ tiêu.",
        data: {
          registrationId,
          status: "HEALTH_CHECK_FAILED",
          outcome: "INCIDENT",
        },
      };
    }

    return {
      success: true,
      code: "DONATION_COMPLETED",
      message: "Đã chốt ca hiến máu thành công.",
      data: {
        registrationId,
        status: "COMPLETED",
        outcome: "SUCCESS",
      },
    };
  } catch (error) {
    if (isPrismaError(error, "P2034")) {
      return {
        success: false,
        code: "CONFLICT",
        message:
          "Hồ sơ đang được xử lý bởi thao tác khác. Vui lòng thử lại sau vài giây.",
      };
    }

    console.error("[finalizeDonation] Lỗi:", error);

    return {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Không thể chốt kết quả hiến máu. Vui lòng thử lại sau.",
    };
  }
}
