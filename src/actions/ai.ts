"use server";

/**
 * Server Action cho sinh viên nhờ AI rà soát "Ghi chú thêm" trước khi gửi
 * hồ sơ. Việc rà soát luôn chạy bộ quy tắc y tế nội bộ; nếu quản trị viên đã
 * cấu hình `AI_API_KEY` thì gọi thêm mô hình ngôn ngữ để đọc hiểu ngữ nghĩa.
 */

import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  screenDonationNote,
  type NoteScreening,
} from "@/lib/ai-screening";
import {
  CAPACITY_CONSUMING_STATUSES,
  computeMaxSlots,
} from "@/lib/donation-rules";
import { prisma } from "@/lib/prisma";
import {
  analyzeSlotLoads,
  computeCapacityPerSlot,
  pickOptimizedSlot,
  type SlotLoad,
} from "@/lib/slot-optimizer";
import {
  DONATION_SLOTS,
  donationSlotListSchema,
} from "@/lib/validations";

export type NoteScreeningResult = {
  success: boolean;
  code?: string;
  message: string;
  data?: NoteScreening;
};

const noteSchema = z
  .string()
  .trim()
  .max(500, "Ghi chú tối đa 500 ký tự");

export async function screenNoteForStudent(
  note: string,
): Promise<NoteScreeningResult> {
  try {
    const session = await getSession();

    if (!session) {
      return {
        success: false,
        code: "UNAUTHENTICATED",
        message: "Bạn cần đăng nhập để rà soát ghi chú sức khỏe.",
      };
    }

    if (session.role !== "STUDENT") {
      return {
        success: false,
        code: "FORBIDDEN",
        message: "Chỉ sinh viên mới có thể rà soát ghi chú sức khỏe.",
      };
    }

    const parsed = noteSchema.safeParse(note ?? "");

    if (!parsed.success) {
      return {
        success: false,
        code: "INVALID_INPUT",
        message: parsed.error.issues[0]?.message ?? "Ghi chú không hợp lệ.",
      };
    }

    if (parsed.data === "") {
      return {
        success: false,
        code: "EMPTY_NOTE",
        message: "Hãy nhập ghi chú sức khỏe trước khi nhờ AI rà soát.",
      };
    }

    const data = await screenDonationNote(parsed.data, { useExternal: true });

    return {
      success: true,
      code: "SCREENED",
      message: "Đã rà soát ghi chú sức khỏe.",
      data,
    };
  } catch (error) {
    console.error("[screenNoteForStudent] Lỗi:", error);

    return {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Không thể rà soát ghi chú lúc này. Vui lòng thử lại sau.",
    };
  }
}

export type AiSchedulingPreviewData = {
  campaignId: string;
  campaignName: string;
  suggestedSlot: string | null;
  targetPerSlot: number;
  slotLoads: SlotLoad[];
  noteScreening: NoteScreening | null;
  blocked: boolean;
  message: string;
};

export type AiSchedulingPreviewResult = {
  success: boolean;
  code?: string;
  message: string;
  data?: AiSchedulingPreviewData;
};

const previewSchema = z.object({
  campaignId: z.string().trim().min(1).max(64),
  preferredSlots: donationSlotListSchema,
  note: z.string().trim().max(500).default(""),
});

/**
 * AI xếp khung giờ + rà soát ghi chú ngay khi sinh viên chọn lịch.
 *
 * Server đếm tải hiện tại của từng khung sinh viên đã tích, chọn khung nhẹ
 * tải nhất và trả kèm kết quả sàng lọc ghi chú để giao diện thông báo ngay.
 * Đây là bản xem trước; khi gửi hồ sơ, `validateProfile` sẽ tính lại trên dữ
 * liệu mới nhất để tránh hai sinh viên cùng nhận một suất.
 */
export async function previewAiScheduling(input: {
  campaignId: string;
  preferredSlots: string[];
  note?: string;
}): Promise<AiSchedulingPreviewResult> {
  try {
    const session = await getSession();

    if (!session) {
      return {
        success: false,
        code: "UNAUTHENTICATED",
        message: "Bạn cần đăng nhập để xếp lịch hiến máu.",
      };
    }

    if (session.role !== "STUDENT") {
      return {
        success: false,
        code: "FORBIDDEN",
        message: "Chỉ sinh viên mới có thể xếp lịch hiến máu.",
      };
    }

    const parsed = previewSchema.safeParse({
      campaignId: input.campaignId,
      preferredSlots: input.preferredSlots,
      note: input.note ?? "",
    });

    if (!parsed.success) {
      return {
        success: false,
        code: "INVALID_INPUT",
        message:
          parsed.error.issues[0]?.message ??
          "Khung giờ hoặc ghi chú không hợp lệ.",
      };
    }

    const { campaignId, preferredSlots, note } = parsed.data;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        capacity: true,
        overbookRate: true,
        status: true,
      },
    });

    if (!campaign) {
      return {
        success: false,
        code: "CAMPAIGN_NOT_FOUND",
        message: "Chiến dịch không tồn tại.",
      };
    }

    if (campaign.status !== "ACTIVE") {
      return {
        success: false,
        code: "CAMPAIGN_CLOSED",
        message: "Chiến dịch không còn nhận đăng ký.",
      };
    }

    const maxSlots = computeMaxSlots(
      campaign.capacity,
      Number(campaign.overbookRate),
    );

    if (maxSlots <= 0) {
      return {
        success: false,
        code: "CAMPAIGN_FULL",
        message: "Chiến dịch chưa có chỉ tiêu hợp lệ.",
      };
    }

    const [slotGroups] = await Promise.all([
      prisma.registration.groupBy({
        by: ["slotTime"],
        where: {
          campaignId,
          status: { in: [...CAPACITY_CONSUMING_STATUSES] },
          slotTime: { in: preferredSlots },
        },
        _count: { _all: true },
      }),
    ]);

    const counts: Record<string, number> = {};

    for (const slot of preferredSlots) {
      counts[slot] = 0;
    }

    for (const group of slotGroups) {
      if (group.slotTime) {
        counts[group.slotTime] = group._count._all;
      }
    }

    const targetPerSlot = computeCapacityPerSlot(
      maxSlots,
      DONATION_SLOTS.length,
    );
    const suggestedSlot = pickOptimizedSlot(
      preferredSlots,
      counts,
      targetPerSlot,
    );
    const slotLoads = analyzeSlotLoads(
      counts,
      preferredSlots,
      targetPerSlot,
    );
    const noteScreening =
      note === ""
        ? null
        : await screenDonationNote(note, { useExternal: true });
    const blocked = noteScreening?.level === "blocked";

    const notices: string[] = [];

    if (suggestedSlot) {
      notices.push(
        `AI đề xuất khung ${suggestedSlot} vì đang ít tải nhất trong các khung bạn chọn.`,
      );
    }

    if (blocked) {
      notices.push(
        "Ghi chú có dấu hiệu chưa đủ điều kiện hiến máu nên hồ sơ có thể bị từ chối.",
      );
    } else if (noteScreening?.level === "caution") {
      notices.push(
        "Ghi chú cần nhân viên y tế xác nhận thêm trước khi hiến.",
      );
    }

    return {
      success: true,
      code: "SCHEDULED",
      message: notices.join(" "),
      data: {
        campaignId,
        campaignName: campaign.name,
        suggestedSlot,
        targetPerSlot,
        slotLoads,
        noteScreening,
        blocked,
        message: notices.join(" "),
      },
    };
  } catch (error) {
    console.error("[previewAiScheduling] Lỗi:", error);

    return {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Không thể xếp lịch lúc này. Vui lòng thử lại sau.",
    };
  }
}
