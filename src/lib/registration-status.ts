/**
 * Bản đồ trạng thái hồ sơ hiến máu -> thông tin hiển thị trên UI.
 * File thuần (không import Prisma runtime) để dùng được trong Client Component.
 */

import type { RegStatus } from "@prisma/client";

export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export type TrackingStep = {
  key: string;
  label: string;
  description: string;
};

/** 5 bước hiển thị trên Stepper, bám theo vòng đời RegStatus. */
export const TRACKING_STEPS: readonly TrackingStep[] = [
  {
    key: "registered",
    label: "Đăng ký",
    description: "Gửi hồ sơ đăng ký hiến máu",
  },
  {
    key: "approved",
    label: "Duyệt",
    description: "Kiểm tra tuổi và cân nặng",
  },
  {
    key: "checked-in",
    label: "Check-in",
    description: "Xác nhận danh tính tại chiến dịch",
  },
  {
    key: "health-check",
    label: "Khám",
    description: "Đo huyết áp và nhịp tim",
  },
  {
    key: "completed",
    label: "Hoàn thành",
    description: "Hiến máu thành công",
  },
] as const;

export type RegistrationStatusMeta = {
  label: string;
  description: string;
  tone: StatusTone;
  /** Số bước đã hoàn thành, tính từ bước 0. */
  completedSteps: number;
  /** Bước đang xử lý (0-4), null khi hồ sơ đã kết thúc. */
  activeStep: number | null;
  /** Bước bị đánh dấu thất bại (0-4), null nếu không có. */
  failedStep: number | null;
  isFailure: boolean;
  isFinished: boolean;
};

export const REGISTRATION_STATUS_META: Record<RegStatus, RegistrationStatusMeta> =
  {
    PENDING: {
      label: "Chờ duyệt",
      description:
        "Hồ sơ đã được ghi nhận và đang chờ ban tổ chức duyệt điều kiện sơ bộ.",
      tone: "warning",
      completedSteps: 1,
      activeStep: 1,
      failedStep: null,
      isFailure: false,
      isFinished: false,
    },
    APPROVED: {
      label: "Đã duyệt",
      description:
        "Hồ sơ đạt điều kiện tuổi và cân nặng. Vui lòng đến đúng địa điểm để check-in.",
      tone: "success",
      completedSteps: 2,
      activeStep: 2,
      failedStep: null,
      isFailure: false,
      isFinished: false,
    },
    REJECTED: {
      label: "Hồ sơ bị từ chối",
      description:
        "Hồ sơ chưa đạt điều kiện sơ bộ (tuổi hoặc cân nặng). Bạn có thể cập nhật thông tin và đăng ký lại.",
      tone: "danger",
      completedSteps: 1,
      activeStep: null,
      failedStep: 1,
      isFailure: true,
      isFinished: true,
    },
    CHECKED_IN: {
      label: "Đã check-in",
      description:
        "Bạn đã check-in tại chiến dịch. Vui lòng chờ đến lượt khám sức khỏe.",
      tone: "info",
      completedSteps: 3,
      activeStep: 3,
      failedStep: null,
      isFailure: false,
      isFinished: false,
    },
    ELIGIBLE: {
      label: "Đủ điều kiện hiến máu",
      description:
        "Sức khỏe đạt yêu cầu. Bạn đang chờ đến lượt lấy máu và hoàn tất hồ sơ.",
      tone: "success",
      completedSteps: 4,
      activeStep: 4,
      failedStep: null,
      isFailure: false,
      isFinished: false,
    },
    HEALTH_CHECK_FAILED: {
      label: "Không đạt khám sức khỏe",
      description:
        "Chỉ số huyết áp hoặc nhịp tim chưa đạt yêu cầu, hoặc ca hiến máu gặp sự cố. Vui lòng liên hệ nhân viên y tế để được tư vấn.",
      tone: "danger",
      completedSteps: 3,
      activeStep: null,
      failedStep: 3,
      isFailure: true,
      isFinished: true,
    },
    COMPLETED: {
      label: "Hoàn thành",
      description:
        "Cảm ơn bạn đã hiến máu! Hồ sơ của bạn đã hoàn tất.",
      tone: "success",
      completedSteps: TRACKING_STEPS.length,
      activeStep: null,
      failedStep: null,
      isFailure: false,
      isFinished: true,
    },
  };

export type StepState = "done" | "current" | "failed" | "upcoming";

export function getStepState(status: RegStatus, index: number): StepState {
  const meta = REGISTRATION_STATUS_META[status];

  if (meta.failedStep === index) return "failed";
  if (index < meta.completedSteps) return "done";
  if (meta.activeStep === index) return "current";

  return "upcoming";
}

export function getStatusMeta(status: RegStatus): RegistrationStatusMeta {
  return REGISTRATION_STATUS_META[status];
}
