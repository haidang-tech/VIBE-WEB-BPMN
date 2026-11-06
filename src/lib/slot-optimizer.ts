/**
 * Tối ưu phân bổ khung giờ hiến máu (thuật toán cân bằng tải).
 *
 * Mục tiêu: tránh dồn quá nhiều sinh viên vào cùng một khung giờ gây tắc
 * nghẽn tại quầy tiếp nhận, nhưng tuyệt đối KHÔNG đẩy sinh viên ra khỏi các
 * khung giờ họ đã đăng ký nguyện vọng.
 *
 * Cách hoạt động:
 * - `pickOptimizedSlot` dùng lúc đăng ký: chọn khung ít tải nhất trong các
 *   nguyện vọng, có tính tới chỉ tiêu trung bình mỗi khung.
 * - `optimizeSlotAssignments` dùng cho Ban tổ chức: phân lại các hồ sơ đã
 *   duyệt bằng greedy "người ít lựa chọn trước", luôn chọn khung nguyện vọng
 *   đang nhẹ tải nhất. Thuật toán thuần (pure), deterministic và test được.
 */

export type SlotStatus = "under" | "balanced" | "over";

export type SlotLoad = {
  slot: string;
  /** Số hồ sơ đang chiếm chỗ tại khung này. */
  count: number;
  /** Chỉ tiêu trung bình mỗi khung. */
  target: number;
  /** count / target (0 nếu chưa có chỉ tiêu). */
  utilization: number;
  status: SlotStatus;
  /** Số suất còn trống tới chỉ tiêu (không âm). */
  free: number;
};

export type SlotOptimizerRegistration = {
  id: string;
  preferredSlots: readonly string[];
  currentSlot: string | null;
};

export type SlotOptimizerChange = {
  registrationId: string;
  from: string | null;
  to: string;
};

export type SlotOptimizationResult = {
  assignments: SlotOptimizerChange[];
  loads: SlotLoad[];
  balanced: boolean;
  bottleneckSlots: string[];
  capacityPerSlot: number;
};

/** Chỉ tiêu trung bình mỗi khung = ceil(maxSlots / số khung), tối thiểu 1. */
export function computeCapacityPerSlot(
  maxSlots: number,
  slotCount: number,
): number {
  if (
    !Number.isFinite(maxSlots) ||
    !Number.isFinite(slotCount) ||
    maxSlots <= 0 ||
    slotCount <= 0
  ) {
    return 0;
  }

  return Math.max(1, Math.ceil(maxSlots / slotCount));
}

/** Thống kê tải của từng khung giờ theo chỉ tiêu trung bình. */
export function analyzeSlotLoads(
  countsBySlot: Readonly<Record<string, number>>,
  slots: readonly string[],
  target: number,
): SlotLoad[] {
  return slots.map((slot) => {
    const rawCount = countsBySlot[slot] ?? 0;
    const count = Number.isFinite(rawCount) ? Math.max(0, rawCount) : 0;
    const utilization = target > 0 ? count / target : 0;

    return {
      slot,
      count,
      target,
      utilization,
      status:
        target <= 0
          ? "balanced"
          : count > target
            ? "over"
            : count === target
              ? "balanced"
              : "under",
      free: Math.max(0, target - count),
    };
  });
}

/**
 * Chọn khung tối ưu trong danh sách nguyện vọng của một sinh viên.
 * Ưu tiên khung có tỷ lệ tải thấp nhất; bằng nhau thì giữ thứ tự thời gian.
 */
export function pickOptimizedSlot(
  preferredSlots: readonly string[],
  countsBySlot: Readonly<Record<string, number>>,
  target: number,
): string | null {
  const candidates = preferredSlots.filter(
    (slot, index) => preferredSlots.indexOf(slot) === index,
  );
  const first = candidates[0];

  if (!first) return null;

  const score = (slot: string) => {
    const count = Math.max(0, countsBySlot[slot] ?? 0);
    return target > 0 ? count / target : count;
  };

  let best = first;
  let bestScore = score(first);

  for (const slot of candidates) {
    const nextScore = score(slot);

    if (nextScore < bestScore - Number.EPSILON) {
      best = slot;
      bestScore = nextScore;
    }
  }

  return best;
}

/**
 * Phân lại khung giờ cho danh sách hồ sơ có thể di chuyển.
 *
 * @param initialCounts Tải cố định đã có tại từng khung (hồ sơ không di
 *   chuyển như CHECKED_IN / ELIGIBLE / COMPLETED). KHÔNG bao gồm các hồ sơ
 *   trong `registrations` để tránh đếm trùng.
 */
export function optimizeSlotAssignments(input: {
  registrations: readonly SlotOptimizerRegistration[];
  slots: readonly string[];
  capacityPerSlot: number;
  initialCounts?: Readonly<Record<string, number>>;
}): SlotOptimizationResult {
  const { registrations, slots, capacityPerSlot } = input;
  const slotIndex = new Map(slots.map((slot, index) => [slot, index]));
  const counts: Record<string, number> = {};

  for (const slot of slots) {
    counts[slot] = Math.max(0, input.initialCounts?.[slot] ?? 0);
  }

  // Người có ít nguyện vọng hơn được xếp trước để không bị người linh hoạt
  // "chiếm mất" khung duy nhất mà họ có thể tham gia.
  const ordered = [...registrations].sort((left, right) => {
    const leftOptions = left.preferredSlots.filter((slot) =>
      slotIndex.has(slot),
    ).length;
    const rightOptions = right.preferredSlots.filter((slot) =>
      slotIndex.has(slot),
    ).length;

    if (leftOptions !== rightOptions) return leftOptions - rightOptions;

    return left.id.localeCompare(right.id);
  });

  const assignments: SlotOptimizerChange[] = [];

  for (const registration of ordered) {
    const preferred = registration.preferredSlots.filter((slot, index) => {
      return slotIndex.has(slot) && registration.preferredSlots.indexOf(slot) === index;
    });

    if (preferred.length === 0) continue;

    const candidates = [...preferred].sort((left, right) => {
      const diff = counts[left] - counts[right];
      if (diff !== 0) return diff;
      return (slotIndex.get(left) ?? 0) - (slotIndex.get(right) ?? 0);
    });
    const lightest = candidates[0];

    // Nếu khung hiện tại cũng nhẹ tải như khung nhẹ nhất thì giữ nguyên,
    // tránh xáo trộn không cần thiết.
    const keepCurrent =
      registration.currentSlot !== null &&
      preferred.includes(registration.currentSlot) &&
      counts[registration.currentSlot] <= counts[lightest];

    const chosen = keepCurrent
      ? (registration.currentSlot as string)
      : lightest;

    counts[chosen] += 1;

    if (chosen !== registration.currentSlot) {
      assignments.push({
        registrationId: registration.id,
        from: registration.currentSlot,
        to: chosen,
      });
    }
  }

  const loads = analyzeSlotLoads(counts, slots, capacityPerSlot);
  const bottleneckSlots = loads
    .filter((load) => load.count > capacityPerSlot)
    .map((load) => load.slot);

  return {
    assignments,
    loads,
    balanced: bottleneckSlots.length === 0,
    bottleneckSlots,
    capacityPerSlot,
  };
}
