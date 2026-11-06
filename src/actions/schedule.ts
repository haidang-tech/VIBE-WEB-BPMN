"use server";

/**
 * Server Action "AI điều phối lịch".
 *
 * Chỉ di chuyển các hồ sơ đang APPROVED và chỉ trong đúng các khung giờ mà
 * sinh viên đã chọn. Hồ sơ đã check-in / đã khám / đã hiến được giữ nguyên
 * nhưng vẫn được tính vào tải hiện tại để tránh dồn người vào khung đã đông.
 */

import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import {
  CAPACITY_CONSUMING_STATUSES,
  computeMaxSlots,
} from "@/lib/donation-rules";
import { prisma } from "@/lib/prisma";
import {
  analyzeSlotLoads,
  computeCapacityPerSlot,
  optimizeSlotAssignments,
  type SlotLoad,
  type SlotOptimizerChange,
} from "@/lib/slot-optimizer";
import { DONATION_SLOTS } from "@/lib/validations";

export type RebalanceScheduleData = {
  campaignId: string;
  campaignName: string;
  maxSlots: number;
  capacityPerSlot: number;
  totalMovable: number;
  moved: number;
  balanced: boolean;
  bottleneckSlots: string[];
  before: SlotLoad[];
  after: SlotLoad[];
  changes: SlotOptimizerChange[];
};

export type RebalanceScheduleResult = {
  success: boolean;
  code?: string;
  message: string;
  data?: RebalanceScheduleData;
};

const rebalanceSchema = z.object({
  campaignId: z.string().trim().min(1).max(64),
});

const VALID_SLOTS = new Set<string>(DONATION_SLOTS);

function countBySlot(
  rows: ReadonlyArray<{ slotTime: string | null }>,
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const slot of DONATION_SLOTS) {
    counts[slot] = 0;
  }

  for (const row of rows) {
    if (!row.slotTime || !VALID_SLOTS.has(row.slotTime)) continue;
    counts[row.slotTime] = (counts[row.slotTime] ?? 0) + 1;
  }

  return counts;
}

export async function rebalanceSchedule(input: {
  campaignId: string;
}): Promise<RebalanceScheduleResult> {
  try {
    const session = await getSession();

    if (!session) {
      return {
        success: false,
        code: "UNAUTHENTICATED",
        message: "Bạn cần đăng nhập để điều phối lịch.",
      };
    }

    if (session.role !== "ORGANIZER") {
      return {
        success: false,
        code: "FORBIDDEN",
        message: "Chỉ Ban tổ chức mới có quyền điều phối lịch hiến máu.",
      };
    }

    const parsed = rebalanceSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        code: "INVALID_INPUT",
        message: "Chiến dịch không hợp lệ.",
      };
    }

    const { campaignId } = parsed.data;

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
        message: "Không tìm thấy chiến dịch.",
      };
    }

    const maxSlots = computeMaxSlots(
      campaign.capacity,
      Number(campaign.overbookRate),
    );
    const capacityPerSlot = computeCapacityPerSlot(
      maxSlots,
      DONATION_SLOTS.length,
    );

    if (maxSlots <= 0 || capacityPerSlot <= 0) {
      return {
        success: false,
        code: "INVALID_CAPACITY",
        message:
          "Chiến dịch chưa có chỉ tiêu hợp lệ nên chưa thể điều phối lịch.",
      };
    }

    const rows = await prisma.registration.findMany({
      where: {
        campaignId,
        status: { in: [...CAPACITY_CONSUMING_STATUSES] },
      },
      select: {
        id: true,
        status: true,
        slotTime: true,
        preferredSlots: true,
      },
    });

    const movable = rows.filter(
      (row) => row.status === "APPROVED" && row.preferredSlots.length > 0,
    );
    const movableIds = new Set(movable.map((row) => row.id));
    const fixedCounts = countBySlot(
      rows.filter((row) => !movableIds.has(row.id)),
    );
    const before = analyzeSlotLoads(
      countBySlot(rows),
      DONATION_SLOTS,
      capacityPerSlot,
    );

    const optimization = optimizeSlotAssignments({
      registrations: movable.map((row) => ({
        id: row.id,
        preferredSlots: row.preferredSlots,
        currentSlot: row.slotTime,
      })),
      slots: DONATION_SLOTS,
      capacityPerSlot,
      initialCounts: fixedCounts,
    });

    let moved = 0;

    if (optimization.assignments.length > 0) {
      moved = await prisma.$transaction(async (tx) => {
        let count = 0;

        for (const change of optimization.assignments) {
          const updated = await tx.registration.updateMany({
            where: {
              id: change.registrationId,
              campaignId,
              status: "APPROVED",
            },
            data: { slotTime: change.to },
          });

          count += updated.count;
        }

        return count;
      });
    }

    // Đọc lại tải thực tế sau khi cập nhật để phản ánh cả các thay đổi do
    // request khác tạo ra trong lúc điều phối.
    const afterRows = await prisma.registration.findMany({
      where: {
        campaignId,
        status: { in: [...CAPACITY_CONSUMING_STATUSES] },
      },
      select: { slotTime: true },
    });
    const after = analyzeSlotLoads(
      countBySlot(afterRows),
      DONATION_SLOTS,
      capacityPerSlot,
    );
    const bottleneckSlots = after
      .filter((load) => load.count > capacityPerSlot)
      .map((load) => load.slot);

    const balanced = bottleneckSlots.length === 0;

    await writeAuditLog({
      action: "SLOT_REBALANCE",
      userId: session.userId,
      details: {
        campaignId,
        maxSlots,
        capacityPerSlot,
        totalMovable: movable.length,
        moved,
        balanced,
        bottleneckSlots,
        changes: optimization.assignments.slice(0, 100),
      },
    });

    const message =
      movable.length === 0
        ? "Không có hồ sơ đã duyệt nào cần điều phối lịch."
        : moved === 0
          ? "Lịch hiến máu đang cân bằng, không cần di chuyển hồ sơ nào."
          : `Đã điều phối ${moved}/${movable.length} hồ sơ sang khung giờ nhẹ tải hơn trong đúng nguyện vọng đã chọn.`;

    return {
      success: true,
      code: "REBALANCED",
      message,
      data: {
        campaignId,
        campaignName: campaign.name,
        maxSlots,
        capacityPerSlot,
        totalMovable: movable.length,
        moved,
        balanced,
        bottleneckSlots,
        before,
        after,
        changes: optimization.assignments,
      },
    };
  } catch (error) {
    console.error("[rebalanceSchedule] Lỗi:", error);

    return {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Không thể điều phối lịch lúc này. Vui lòng thử lại sau.",
    };
  }
}
