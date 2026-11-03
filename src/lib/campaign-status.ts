/**
 * Nhãn/trạng thái chiến dịch dùng chung cho Admin và các khu vực khác.
 * File thuần (chỉ import type) để dùng được trong Client Component.
 */

import type { CampaignStatus } from "@prisma/client";
import type { StatusTone } from "./registration-status";

export type CampaignStatusMeta = {
  label: string;
  description: string;
  tone: StatusTone;
};

export const CAMPAIGN_STATUS_META: Record<
  CampaignStatus,
  CampaignStatusMeta
> = {
  DRAFT: {
    label: "Bản nháp",
    description: "Chiến dịch đang được chuẩn bị, chưa mở đăng ký.",
    tone: "neutral",
  },
  ACTIVE: {
    label: "Đang hoạt động",
    description: "Chiến dịch đang mở đăng ký và tiếp nhận hồ sơ.",
    tone: "success",
  },
  COMPLETED: {
    label: "Đã kết thúc",
    description: "Chiến dịch đã tổ chức xong.",
    tone: "info",
  },
  CANCELLED: {
    label: "Đã hủy",
    description: "Chiến dịch bị hủy, không tiếp nhận hồ sơ.",
    tone: "danger",
  },
};

export const CAMPAIGN_STATUS_OPTIONS = (
  Object.keys(CAMPAIGN_STATUS_META) as CampaignStatus[]
).map((value) => ({
  value,
  label: CAMPAIGN_STATUS_META[value].label,
}));
