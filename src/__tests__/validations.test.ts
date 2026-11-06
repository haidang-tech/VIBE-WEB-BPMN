import { z } from "zod";
import {
  auditLogInputSchema,
  calculateAge,
  campaignDateSchema,
  campaignFormSchema,
  donationSlotListSchema,
  optionalPastDateSchema,
  registerSchema,
  zodFieldErrors,
} from "@/lib/validations";

describe("optionalPastDateSchema", () => {
  it("chuẩn hóa chuỗi rỗng thành undefined", () => {
    expect(optionalPastDateSchema.parse("  ")).toBeUndefined();
  });

  it("chấp nhận ngày quá khứ và từ chối ngày tương lai", () => {
    expect(optionalPastDateSchema.safeParse("2020-02-29").success).toBe(true);

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    expect(optionalPastDateSchema.safeParse(tomorrow).success).toBe(false);
  });

  it("từ chối ngày lịch không tồn tại", () => {
    expect(optionalPastDateSchema.safeParse("2025-02-29").success).toBe(false);
  });
});

describe("donationSlotListSchema", () => {
  it("chuẩn hóa danh sách theo thứ tự và loại lựa chọn lặp", () => {
    expect(
      donationSlotListSchema.parse([
        "09:30 - 10:30",
        "07:30 - 08:30",
        "09:30 - 10:30",
      ]),
    ).toEqual(["07:30 - 08:30", "09:30 - 10:30"]);
  });

  it("từ chối danh sách rỗng và khung giờ không hợp lệ", () => {
    expect(donationSlotListSchema.safeParse([]).success).toBe(false);
    expect(donationSlotListSchema.safeParse(["00:00 - 01:00"]).success).toBe(
      false,
    );
  });
});

describe("registerSchema", () => {
  const validInput = {
    name: "Nguyễn Văn An",
    email: "an.nguyen@due.edu.vn",
    password: "Due@12345",
    confirmPassword: "Due@12345",
  };

  it("chấp nhận tài khoản sinh viên hợp lệ", () => {
    expect(registerSchema.safeParse(validInput).success).toBe(true);
  });

  it("từ chối email ngoài trường và mật khẩu xác nhận không khớp", () => {
    const result = registerSchema.safeParse({
      ...validInput,
      email: "student@example.com",
      confirmPassword: "Other@123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining(["email", "confirmPassword"]),
      );
    }
  });
});

describe("campaign schemas", () => {
  it("chấp nhận ngày chiến dịch hợp lệ và từ chối định dạng sai", () => {
    expect(campaignDateSchema.safeParse("2026-12-01").success).toBe(true);
    expect(campaignDateSchema.safeParse("01/12/2026").success).toBe(false);
  });

  it("coerce các trường số của chiến dịch và kiểm tra giới hạn", () => {
    const result = campaignFormSchema.safeParse({
      name: "  Chiến dịch hiến máu  ",
      date: "2026-12-01",
      location: "  Hội trường A  ",
      capacity: "100",
      overbookRate: "1.2",
      status: "ACTIVE",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        name: "Chiến dịch hiến máu",
        location: "Hội trường A",
        capacity: 100,
        overbookRate: 1.2,
      });
    }

    expect(
      campaignFormSchema.safeParse({
        name: "AB",
        date: "2026-12-01",
        location: "Hội trường A",
        capacity: 0,
        overbookRate: 4,
        status: "INVALID",
      }).success,
    ).toBe(false);
  });
});

describe("auditLogInputSchema", () => {
  it("chấp nhận audit hợp lệ và từ chối action hoặc details vượt giới hạn", () => {
    expect(
      auditLogInputSchema.safeParse({
        action: "AUTH_LOGIN_SUCCESS",
        userId: "user-1",
        details: { method: "password" },
      }).success,
    ).toBe(true);

    expect(
      auditLogInputSchema.safeParse({
        action: "invalid action",
        userId: "",
        details: { payload: "x".repeat(4_100) },
      }).success,
    ).toBe(false);
  });
});

describe("validation helpers", () => {
  it("gom lỗi theo field, dùng _form khi không có path và giữ lỗi đầu tiên", () => {
    const fieldResult = z
      .object({ value: z.string().min(2).max(1) })
      .safeParse({ value: "" });
    const rootResult = z.string().min(1).safeParse("");

    expect(fieldResult.success).toBe(false);
    expect(rootResult.success).toBe(false);
    if (!fieldResult.success && !rootResult.success) {
      expect(zodFieldErrors(fieldResult.error).value).toBe(
        fieldResult.error.issues[0].message,
      );
      expect(zodFieldErrors(rootResult.error)).toHaveProperty("_form");
    }
  });

  it("tính tuổi theo chuỗi/ngày và giảm tuổi nếu sinh nhật chưa tới", () => {
    const today = new Date();
    const beforeBirthday = new Date(
      Date.UTC(today.getUTCFullYear() - 20, today.getUTCMonth(), today.getUTCDate() + 1),
    );

    expect(calculateAge(new Date("2000-01-01T00:00:00Z"))).toBeGreaterThan(0);
    expect(calculateAge(beforeBirthday)).toBe(19);
    expect(() => calculateAge("not-a-date")).toThrow("Ngày sinh không hợp lệ");
  });
});
