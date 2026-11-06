import {
  analyzeSlotLoads,
  computeCapacityPerSlot,
  optimizeSlotAssignments,
  pickOptimizedSlot,
} from "@/lib/slot-optimizer";

const SLOTS = [
  "07:30 - 08:30",
  "08:30 - 09:30",
  "09:30 - 10:30",
] as const;

describe("computeCapacityPerSlot", () => {
  it("chia đều chỉ tiêu và làm tròn lên", () => {
    expect(computeCapacityPerSlot(12, 7)).toBe(2);
    expect(computeCapacityPerSlot(10, 3)).toBe(4);
  });

  it("trả 0 khi dữ liệu không hợp lệ", () => {
    expect(computeCapacityPerSlot(0, 7)).toBe(0);
    expect(computeCapacityPerSlot(10, 0)).toBe(0);
  });
});

describe("pickOptimizedSlot", () => {
  it("chọn khung ít tải nhất trong nguyện vọng", () => {
    expect(
      pickOptimizedSlot(SLOTS, {
        "07:30 - 08:30": 4,
        "08:30 - 09:30": 1,
        "09:30 - 10:30": 3,
      }, 4),
    ).toBe("08:30 - 09:30");
  });

  it("giữ thứ tự thời gian khi tải bằng nhau", () => {
    expect(
      pickOptimizedSlot(SLOTS, {
        "07:30 - 08:30": 2,
        "08:30 - 09:30": 2,
        "09:30 - 10:30": 2,
      }, 4),
    ).toBe("07:30 - 08:30");
  });

  it("trả null khi không có nguyện vọng", () => {
    expect(pickOptimizedSlot([], {}, 4)).toBeNull();
  });
});

describe("optimizeSlotAssignments", () => {
  it("chia đều hồ sơ trong đúng các khung đã chọn", () => {
    const result = optimizeSlotAssignments({
      slots: SLOTS,
      capacityPerSlot: 2,
      registrations: [
        {
          id: "a",
          preferredSlots: [SLOTS[0], SLOTS[1]],
          currentSlot: SLOTS[0],
        },
        { id: "b", preferredSlots: [SLOTS[0]], currentSlot: SLOTS[0] },
        {
          id: "c",
          preferredSlots: [SLOTS[0], SLOTS[1]],
          currentSlot: SLOTS[0],
        },
        { id: "d", preferredSlots: [SLOTS[1]], currentSlot: SLOTS[1] },
      ],
    });

    expect(result.loads.map((load) => load.count)).toEqual([2, 2, 0]);
    expect(result.assignments).toEqual([
      {
        registrationId: "c",
        from: SLOTS[0],
        to: SLOTS[1],
      },
    ]);
    expect(result.balanced).toBe(true);
  });

  it("không đẩy sinh viên ra ngoài nguyện vọng", () => {
    const result = optimizeSlotAssignments({
      slots: SLOTS,
      capacityPerSlot: 1,
      registrations: [
        { id: "a", preferredSlots: [SLOTS[2]], currentSlot: SLOTS[0] },
      ],
    });

    expect(result.assignments[0]).toMatchObject({
      registrationId: "a",
      to: SLOTS[2],
    });
    expect(result.loads[2].count).toBe(1);
    expect(result.loads[0].count).toBe(0);
  });

  it("giữ nguyên khi khung hiện tại đã nhẹ tải như khung tốt nhất", () => {
    const result = optimizeSlotAssignments({
      slots: SLOTS,
      capacityPerSlot: 3,
      registrations: [
        { id: "a", preferredSlots: [SLOTS[0], SLOTS[1]], currentSlot: SLOTS[1] },
      ],
    });

    expect(result.assignments).toHaveLength(0);
  });

  it("tính cả tải cố định khi chọn khung", () => {
    const result = optimizeSlotAssignments({
      slots: SLOTS,
      capacityPerSlot: 2,
      initialCounts: { [SLOTS[0]]: 2 },
      registrations: [
        {
          id: "a",
          preferredSlots: [SLOTS[0], SLOTS[1]],
          currentSlot: SLOTS[0],
        },
      ],
    });

    expect(result.assignments[0]).toMatchObject({
      registrationId: "a",
      to: SLOTS[1],
    });
  });

  it("báo khung quá tải khi không còn lựa chọn", () => {
    const result = optimizeSlotAssignments({
      slots: SLOTS,
      capacityPerSlot: 1,
      registrations: [
        { id: "a", preferredSlots: [SLOTS[0]], currentSlot: SLOTS[0] },
        { id: "b", preferredSlots: [SLOTS[0]], currentSlot: SLOTS[0] },
        { id: "c", preferredSlots: [SLOTS[0]], currentSlot: SLOTS[0] },
      ],
    });

    expect(result.balanced).toBe(false);
    expect(result.bottleneckSlots).toEqual([SLOTS[0]]);
  });
});

describe("analyzeSlotLoads", () => {
  it("phân loại under / balanced / over", () => {
    const loads = analyzeSlotLoads(
      {
        [SLOTS[0]]: 1,
        [SLOTS[1]]: 2,
        [SLOTS[2]]: 3,
      },
      SLOTS,
      2,
    );

    expect(loads.map((load) => load.status)).toEqual([
      "under",
      "balanced",
      "over",
    ]);
    expect(loads[0].free).toBe(1);
    expect(loads[2].free).toBe(0);
  });
});
