/**
 * Unit test cho 3 cổng XOR ở Prompt 3 (`src/actions/blood-donation.ts`).
 *
 * Phạm vi:
 *   1. checkCanRegister — chặn đăng ký trùng + kiểm tra capacity/overbook.
 *   2. validateProfile  — rẽ nhánh tuổi >= 18 và cân nặng >= 45kg.
 *   3. evaluateHealth   — rẽ nhánh sức khỏe đạt/không đạt.
 *
 * Toàn bộ Prisma, session, audit và mã hóa CCCD đều được mock nên test chạy
 * độc lập, không cần PostgreSQL hay biến môi trường khóa PII.
 */

import {
  checkCanRegister,
  evaluateHealth,
  validateProfile,
} from "@/actions/blood-donation";
import { writeAuditLog } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { encryptCccd } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { pickLeastCrowdedSlot } from "@/lib/donation-rules";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: {
      findUnique: jest.fn(),
    },
    registration: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    healthCheck: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/audit", () => ({
  writeAuditLog: jest.fn(),
}));

jest.mock("@/lib/crypto", () => ({
  encryptCccd: jest.fn(),
  safeEqualHash: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type MockFn = jest.Mock;

const db = prisma as unknown as {
  campaign: { findUnique: MockFn };
  registration: {
    findFirst: MockFn;
    findUnique: MockFn;
    count: MockFn;
    create: MockFn;
    update: MockFn;
  };
  user: {
    findUnique: MockFn;
    findFirst: MockFn;
    update: MockFn;
  };
  healthCheck: { upsert: MockFn };
  $transaction: MockFn;
};

const mockGetSession = getSession as unknown as MockFn;
const mockWriteAuditLog = writeAuditLog as unknown as MockFn;
const mockEncryptCccd = encryptCccd as unknown as MockFn;

const STUDENT_ID = "student-1";
const CAMPAIGN_ID = "camp-1";

const studentSession = { userId: STUDENT_ID, role: "STUDENT" as const };
const medicalSession = { userId: "medical-1", role: "MEDICAL" as const };

function mockTransaction(): void {
  // Server Action dùng prisma.$transaction(async (tx) => ...). Trong unit test
  // cho tx chính là mock Prisma để assert trực tiếp các lời gọi bên trong.
  db.$transaction.mockImplementation(
    async (callback: (tx: typeof db) => unknown) => callback(db),
  );
}

function mockCampaign(): void {
  db.campaign.findUnique.mockResolvedValue({
    id: CAMPAIGN_ID,
    name: "Hiến máu nhân đạo đợt 1 - 2026",
    capacity: 10,
    overbookRate: 1.2, // maxSlots = floor(10 * 1.2) = 12
  });
}

function validRegistrationInput(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Nguyễn Văn An",
    studentCode: "2212345678",
    className: "46K21.1",
    faculty: "Khoa Kinh tế",
    email: "an.nguyen@due.edu.vn",
    phone: "0912345678",
    cccd: "012345678901",
    dateOfBirth: "2000-01-01", // 26 tuổi tại thời điểm test 2026-06-15
    gender: "MALE",
    weightKg: 50,
    heightCm: 170,
    bloodType: "A",
    lastDonationDate: "",
    usedAntibiotics: "NO",
    recentTattooOrSurgery: "NO",
    infectiousDiseaseHistory: "NO",
    campaignId: CAMPAIGN_ID,
    preferredSlots: ["07:30 - 08:30"],
    commitment: true,
    note: "",
    ...overrides,
  };
}

function validHealthCheckInput(overrides: Record<string, unknown> = {}) {
  return {
    registrationId: "reg-1",
    bloodPressure: "120/80",
    heartRate: 80,
    weight: 55,
    bloodType: "A",
    bloodVolume: 350,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup chung
// ---------------------------------------------------------------------------

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  mockTransaction();
  mockCampaign();

  db.registration.findFirst.mockResolvedValue(null);
  db.registration.findUnique.mockResolvedValue({
    id: "reg-1",
    status: "APPROVED",
  });
  db.registration.count.mockResolvedValue(0);
  db.registration.create.mockResolvedValue({ id: "reg-1" });
  db.registration.update.mockResolvedValue({ id: "reg-1" });

  db.user.findUnique.mockResolvedValue({
    id: STUDENT_ID,
    cccdHash: null,
  });
  db.user.findFirst.mockResolvedValue(null);
  db.user.update.mockResolvedValue({ id: STUDENT_ID });

  db.healthCheck.upsert.mockResolvedValue({ id: "health-1" });

  mockEncryptCccd.mockReturnValue({
    ciphertext: "ciphertext",
    iv: "iv",
    authTag: "auth-tag",
    hash: "cccd-hash",
  });

  mockGetSession.mockResolvedValue(studentSession);
  mockWriteAuditLog.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// XOR 1 — checkCanRegister
// ---------------------------------------------------------------------------

describe("checkCanRegister", () => {
  it("cho phép đăng ký khi chưa có hồ sơ và chiến dịch còn suất", async () => {
    db.registration.count.mockResolvedValue(3);

    const result = await checkCanRegister(STUDENT_ID, CAMPAIGN_ID);

    expect(result.success).toBe(true);
    expect(result.code).toBe("CAN_REGISTER");
    expect(result.data).toMatchObject({
      campaignId: CAMPAIGN_ID,
      maxSlots: 12,
      activeCount: 3,
      remainingSlots: 9,
    });
  });

  it("chặn đăng ký trùng khi đã có hồ sơ PENDING/APPROVED/COMPLETED", async () => {
    db.registration.findFirst.mockResolvedValue({ id: "reg-existing" });

    const result = await checkCanRegister(STUDENT_ID, CAMPAIGN_ID);

    expect(result.success).toBe(false);
    expect(result.code).toBe("ALREADY_REGISTERED");
    expect(result.data).toMatchObject({
      existingRegistrationId: "reg-existing",
    });
    expect(db.registration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: STUDENT_ID,
          campaignId: CAMPAIGN_ID,
          status: { in: ["PENDING", "APPROVED", "COMPLETED"] },
        }),
      }),
    );
  });

  it("chặn đăng ký khi chiến dịch đã đủ chỉ tiêu (gồm overbook)", async () => {
    db.registration.count.mockResolvedValue(12);

    const result = await checkCanRegister(STUDENT_ID, CAMPAIGN_ID);

    expect(result.success).toBe(false);
    expect(result.code).toBe("CAMPAIGN_FULL");
    expect(result.message).toContain("12/12");
    expect(result.data?.remainingSlots).toBe(0);
  });

  it("trả CAMPAIGN_NOT_FOUND khi chiến dịch không tồn tại", async () => {
    db.campaign.findUnique.mockResolvedValue(null);

    const result = await checkCanRegister(STUDENT_ID, CAMPAIGN_ID);

    expect(result.success).toBe(false);
    expect(result.code).toBe("CAMPAIGN_NOT_FOUND");
    expect(db.registration.findFirst).not.toHaveBeenCalled();
  });

  it("chặn người dùng kiểm tra hồ sơ của người khác", async () => {
    mockGetSession.mockResolvedValue({
      userId: "student-2",
      role: "STUDENT",
    });

    const result = await checkCanRegister(STUDENT_ID, CAMPAIGN_ID);

    expect(result.success).toBe(false);
    expect(result.code).toBe("FORBIDDEN");
    expect(db.campaign.findUnique).not.toHaveBeenCalled();
  });

  it("yêu cầu đăng nhập", async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await checkCanRegister(STUDENT_ID, CAMPAIGN_ID);

    expect(result.success).toBe(false);
    expect(result.code).toBe("UNAUTHENTICATED");
  });
});

// ---------------------------------------------------------------------------
// XOR 2 — validateProfile
// ---------------------------------------------------------------------------

describe("validateProfile", () => {
  it("duyệt hồ sơ khi tuổi >= 18 và cân nặng >= 45kg", async () => {
    const result = await validateProfile(validRegistrationInput());

    expect(result.success).toBe(true);
    expect(result.code).toBe("PROFILE_APPROVED");
    expect(result.data).toMatchObject({
      registrationId: "reg-1",
      status: "APPROVED",
      eligible: true,
      age: 26,
      reasons: [],
    });

    expect(db.registration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "APPROVED",
          slotTime: "07:30 - 08:30",
          preferredSlots: ["07:30 - 08:30"],
        }),
      }),
    );
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cccdCiphertext: "ciphertext",
          cccdHash: "cccd-hash",
        }),
      }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "REGISTRATION_APPROVED" }),
    );
  });

  it("loại hồ sơ khi cân nặng < 45kg dù tuổi đã đủ", async () => {
    const result = await validateProfile(
      validRegistrationInput({ weightKg: 44 }),
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe("PROFILE_REJECTED");
    expect(result.data).toMatchObject({
      status: "REJECTED",
      eligible: false,
      age: 26,
    });
    expect(result.data?.reasons.join(" ")).toContain("44kg");

    expect(db.registration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REJECTED" }),
      }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "REGISTRATION_REJECTED" }),
    );
  });

  it("loại hồ sơ khi tuổi < 18 dù cân nặng đã đủ", async () => {
    const result = await validateProfile(
      validRegistrationInput({ dateOfBirth: "2010-01-01", weightKg: 55 }),
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe("PROFILE_REJECTED");
    expect(result.data).toMatchObject({ status: "REJECTED", age: 16 });
    expect(result.data?.reasons.join(" ")).toContain("Tuổi 16");
  });

  it("ghi nhận đủ cả hai lý do khi vừa thiếu tuổi vừa thiếu cân", async () => {
    const result = await validateProfile(
      validRegistrationInput({ dateOfBirth: "2010-01-01", weightKg: 40 }),
    );

    expect(result.success).toBe(false);
    expect(result.data?.reasons).toHaveLength(2);
    expect(result.data?.reasons.join(" ")).toContain("Tuổi 16");
    expect(result.data?.reasons.join(" ")).toContain("40kg");
  });

  it("chặn đăng ký trùng ở bước transaction, không tạo hồ sơ mới", async () => {
    db.registration.findFirst.mockResolvedValue({ id: "reg-existing" });

    const result = await validateProfile(validRegistrationInput());

    expect(result.success).toBe(false);
    expect(result.code).toBe("ALREADY_REGISTERED");
    expect(db.registration.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("chặn khi chiến dịch đã đủ chỉ tiêu", async () => {
    db.registration.count.mockResolvedValue(12);

    const result = await validateProfile(validRegistrationInput());

    expect(result.success).toBe(false);
    expect(result.code).toBe("CAMPAIGN_FULL");
    expect(db.registration.create).not.toHaveBeenCalled();
  });

  it("chỉ cho phép role STUDENT đăng ký", async () => {
    mockGetSession.mockResolvedValue(medicalSession);

    const result = await validateProfile(validRegistrationInput());

    expect(result.success).toBe(false);
    expect(result.code).toBe("FORBIDDEN");
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("trả lỗi validate khi dữ liệu đầu vào không hợp lệ", async () => {
    const result = await validateProfile(
      validRegistrationInput({ cccd: "123", weightKg: 10 }),
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe("INVALID_INPUT");
    expect(result.errors).toHaveProperty("cccd");
    expect(result.errors).toHaveProperty("weightKg");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cân bằng khung giờ
// ---------------------------------------------------------------------------

describe("pickLeastCrowdedSlot", () => {
  it("chọn khung ít đông nhất trong các lựa chọn", () => {
    expect(
      pickLeastCrowdedSlot(
        ["07:30 - 08:30", "08:30 - 09:30", "09:30 - 10:30"],
        {
          "07:30 - 08:30": 10,
          "08:30 - 09:30": 3,
          "09:30 - 10:30": 7,
        },
      ),
    ).toBe("08:30 - 09:30");
  });

  it("ưu tiên khung sớm hơn khi tải bằng nhau", () => {
    expect(
      pickLeastCrowdedSlot(["07:30 - 08:30", "08:30 - 09:30"], {
        "07:30 - 08:30": 4,
        "08:30 - 09:30": 4,
      }),
    ).toBe("07:30 - 08:30");
  });

  it("trả null khi không có lựa chọn", () => {
    expect(pickLeastCrowdedSlot([], {})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// XOR 3 — evaluateHealth
// ---------------------------------------------------------------------------

describe("evaluateHealth", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(medicalSession);
  });

  it("đạt sức khỏe -> ELIGIBLE và ghi audit HEALTH_CHECK_PASSED", async () => {
    const result = await evaluateHealth(validHealthCheckInput());

    expect(result.success).toBe(true);
    expect(result.code).toBe("ELIGIBLE");
    expect(result.data).toMatchObject({
      healthCheckId: "health-1",
      status: "ELIGIBLE",
      isPassed: true,
      reasons: [],
    });

    expect(db.healthCheck.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ isPassed: true }),
        update: expect.objectContaining({ isPassed: true }),
      }),
    );
    expect(db.registration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ELIGIBLE" } }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "HEALTH_CHECK_PASSED" }),
    );
  });

  it("huyết áp ngoài ngưỡng -> HEALTH_CHECK_FAILED nhưng vẫn lưu kết quả", async () => {
    const result = await evaluateHealth(
      validHealthCheckInput({ bloodPressure: "150/95" }),
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe("HEALTH_CHECK_FAILED");
    expect(result.data).toMatchObject({
      status: "HEALTH_CHECK_FAILED",
      isPassed: false,
    });
    expect(result.data?.reasons.join(" ")).toContain("Huyết áp 150/95");

    expect(db.healthCheck.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ isPassed: false }),
      }),
    );
    expect(db.registration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "HEALTH_CHECK_FAILED" } }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "HEALTH_CHECK_FAILED" }),
    );
  });

  it("nhịp tim ngoài ngưỡng -> HEALTH_CHECK_FAILED", async () => {
    const result = await evaluateHealth(
      validHealthCheckInput({ heartRate: 120 }),
    );

    expect(result.success).toBe(false);
    expect(result.data?.reasons.join(" ")).toContain("Nhịp tim 120");
  });

  it("chặn nhập kết quả khi hồ sơ chưa ở trạng thái APPROVED/CHECKED_IN", async () => {
    db.registration.findUnique.mockResolvedValue({
      id: "reg-1",
      status: "PENDING",
    });

    const result = await evaluateHealth(validHealthCheckInput());

    expect(result.success).toBe(false);
    expect(result.code).toBe("INVALID_STATUS");
    expect(result.message).toContain("PENDING");
    expect(db.healthCheck.upsert).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("cho phép nhập kết quả khi hồ sơ đã CHECKED_IN", async () => {
    db.registration.findUnique.mockResolvedValue({
      id: "reg-1",
      status: "CHECKED_IN",
    });

    const result = await evaluateHealth(validHealthCheckInput());

    expect(result.success).toBe(true);
    expect(result.code).toBe("ELIGIBLE");
  });

  it("trả REGISTRATION_NOT_FOUND khi hồ sơ không tồn tại", async () => {
    db.registration.findUnique.mockResolvedValue(null);

    const result = await evaluateHealth(validHealthCheckInput());

    expect(result.success).toBe(false);
    expect(result.code).toBe("REGISTRATION_NOT_FOUND");
    expect(db.healthCheck.upsert).not.toHaveBeenCalled();
  });

  it("chỉ cho phép role MEDICAL nhập kết quả", async () => {
    mockGetSession.mockResolvedValue(studentSession);

    const result = await evaluateHealth(validHealthCheckInput());

    expect(result.success).toBe(false);
    expect(result.code).toBe("FORBIDDEN");
    expect(db.registration.findUnique).not.toHaveBeenCalled();
  });

  it("trả lỗi validate khi chỉ số không hợp lệ", async () => {
    const result = await evaluateHealth(
      validHealthCheckInput({ bloodPressure: "abc", bloodVolume: 400 }),
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe("INVALID_INPUT");
    expect(result.errors).toHaveProperty("bloodPressure");
    expect(result.errors).toHaveProperty("bloodVolume");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
