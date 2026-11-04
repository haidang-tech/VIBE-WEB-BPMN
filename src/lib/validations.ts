/**
 * Zod schemas dùng chung cho Client Components và Server Actions / Route Handlers.
 * Mọi input từ bên ngoài đều phải đi qua các schema này trước khi chạm DB.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập email")
  .max(254, "Email quá dài")
  .toLowerCase()
  .email("Email không hợp lệ");

/** CCCD Việt Nam: đúng 12 chữ số, tự bỏ khoảng trắng / dấu gạch / dấu chấm. */
export const cccdSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.-]/g, ""))
  .refine((value) => /^\d{12}$/.test(value), "CCCD phải gồm đúng 12 chữ số");

/** Số điện thoại Việt Nam: 0xxxxxxxxx hoặc +84xxxxxxxxx */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.-]/g, ""))
  .refine(
    (value) => /^(?:0|\+84)\d{9}$/.test(value),
    "Số điện thoại không hợp lệ (ví dụ: 0912345678)",
  );

/** MSSV DUE: 6–12 chữ cái hoặc chữ số, tự bỏ khoảng trắng và chuyển hoa. */
export const studentCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase().replace(/\s+/g, ""))
  .refine(
    (value) => /^[A-Z0-9]{6,12}$/.test(value),
    "MSSV phải gồm 6–12 chữ cái hoặc chữ số",
  );

/** Email sinh viên: dùng chung validate email + bắt buộc đuôi @due.edu.vn. */
export const studentEmailSchema = emailSchema.refine(
  (value) => value.endsWith("@due.edu.vn"),
  "Email sinh viên phải có đuôi @due.edu.vn",
);

/** Ngày trong quá khứ dạng YYYY-MM-DD (dùng cho ngày hiến máu gần nhất). */
export const pastDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có dạng YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Ngày không hợp lệ")
  .refine(
    (value) => new Date(`${value}T00:00:00Z`).getTime() <= Date.now(),
    "Ngày không được ở tương lai",
  );

/** Cho phép bỏ trống; chuỗi rỗng được chuẩn hóa thành undefined. */
export const optionalPastDateSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  pastDateSchema.optional(),
);

/** Khung giờ hiến máu cố định trong ngày diễn ra chiến dịch. */
export const DONATION_SLOTS = [
  "07:30 - 08:30",
  "08:30 - 09:30",
  "09:30 - 10:30",
  "10:30 - 11:30",
  "13:30 - 14:30",
  "14:30 - 15:30",
  "15:30 - 16:30",
] as const;

export type DonationSlot = (typeof DONATION_SLOTS)[number];

export const donationSlotSchema = z.enum(DONATION_SLOTS, {
  error: "Vui lòng chọn khung giờ hiến máu",
});

/**
 * Sinh viên chọn một hoặc nhiều khung giờ mong muốn.
 * Danh sách được chuẩn hóa theo thứ tự thời gian và loại trùng.
 */
export const donationSlotListSchema = z
  .array(donationSlotSchema)
  .min(1, "Chọn ít nhất một khung giờ")
  .max(DONATION_SLOTS.length)
  .transform((slots) => DONATION_SLOTS.filter((slot) => slots.includes(slot)))
  .refine((slots) => slots.length > 0, "Chọn ít nhất một khung giờ");

export const genderSchema = z.enum(["MALE", "FEMALE", "OTHER"], {
  error: "Vui lòng chọn giới tính",
});

export const yesNoSchema = z.enum(["YES", "NO"], {
  error: "Vui lòng chọn Có hoặc Không",
});

/** Ngày sinh dạng YYYY-MM-DD, không được ở tương lai. */
export const dateOfBirthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày sinh phải có dạng YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Ngày sinh không hợp lệ")
  .refine(
    (value) => new Date(`${value}T00:00:00Z`).getTime() <= Date.now(),
    "Ngày sinh không được ở tương lai",
  );

/** Huyết áp dạng "120/80" */
export const bloodPressureSchema = z
  .string()
  .trim()
  .regex(/^\d{2,3}\/\d{2,3}$/, "Huyết áp phải có dạng tâm thu/tâm trương, ví dụ 120/80")
  .refine((value) => {
    const [systolic, diastolic] = value.split("/").map(Number);
    return (
      systolic >= 70 &&
      systolic <= 260 &&
      diastolic >= 40 &&
      diastolic <= 160 &&
      systolic > diastolic
    );
  }, "Chỉ số huyết áp không hợp lệ");

/** Mật khẩu khi tạo tài khoản: 8-72 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt. */
export const passwordPolicySchema = z
  .string()
  .min(8, "Mật khẩu tối thiểu 8 ký tự")
  .max(72, "Mật khẩu tối đa 72 ký tự (giới hạn của bcrypt)")
  .regex(/[A-Z]/, "Mật khẩu phải có ít nhất 1 chữ hoa")
  .regex(/[a-z]/, "Mật khẩu phải có ít nhất 1 chữ thường")
  .regex(/\d/, "Mật khẩu phải có ít nhất 1 chữ số")
  .regex(/[^A-Za-z0-9]/, "Mật khẩu phải có ít nhất 1 ký tự đặc biệt");

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: emailSchema,
  // Không áp chính sách độ phức tạp khi đăng nhập (tránh lộ policy + UX kém),
  // chỉ chặn input rỗng / vượt giới hạn bcrypt.
  password: z
    .string()
    .min(1, "Vui lòng nhập mật khẩu")
    .max(72, "Mật khẩu tối đa 72 ký tự"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Đăng ký tài khoản sinh viên
// ---------------------------------------------------------------------------

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Họ tên tối thiểu 2 ký tự")
      .max(100, "Họ tên tối đa 100 ký tự"),
    email: emailSchema,
    // Dùng chung policy với tài khoản nội bộ: tối thiểu 8 ký tự + độ phức tạp.
    password: passwordPolicySchema,
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Đăng ký hiến máu (XOR 2)
// ---------------------------------------------------------------------------

export const donationRegistrationSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Họ tên tối thiểu 2 ký tự")
    .max(100, "Họ tên tối đa 100 ký tự"),
  studentCode: studentCodeSchema,
  className: z
    .string()
    .trim()
    .min(2, "Lớp tối thiểu 2 ký tự")
    .max(50, "Lớp tối đa 50 ký tự"),
  faculty: z
    .string()
    .trim()
    .min(2, "Khoa tối thiểu 2 ký tự")
    .max(100, "Khoa tối đa 100 ký tự"),
  email: studentEmailSchema,
  phone: phoneSchema,
  cccd: cccdSchema,
  dateOfBirth: dateOfBirthSchema,
  gender: genderSchema,
  weightKg: z.coerce
    .number({ error: "Cân nặng phải là số" })
    .min(30, "Cân nặng tối thiểu 30kg")
    .max(250, "Cân nặng tối đa 250kg"),
  heightCm: z.coerce
    .number({ error: "Chiều cao phải là số" })
    .int("Chiều cao phải là số nguyên")
    .min(100, "Chiều cao tối thiểu 100cm")
    .max(250, "Chiều cao tối đa 250cm"),
  bloodType: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.enum(["A", "B", "AB", "O"], { error: "Nhóm máu không hợp lệ" }).optional(),
  ),
  lastDonationDate: optionalPastDateSchema,
  usedAntibiotics: yesNoSchema,
  recentTattooOrSurgery: yesNoSchema,
  infectiousDiseaseHistory: yesNoSchema,
  campaignId: z.string().trim().min(1, "Thiếu chiến dịch").max(64),
  preferredSlots: donationSlotListSchema,
  commitment: z
    .boolean()
    .refine((value) => value === true, {
      message: "Bạn cần cam kết khai báo thông tin trung thực",
    }),
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự").optional(),
});

export type DonationRegistrationInput = z.infer<typeof donationRegistrationSchema>;

// ---------------------------------------------------------------------------
// Khám sức khỏe (XOR 3)
// ---------------------------------------------------------------------------

export const healthCheckSchema = z.object({
  registrationId: z.string().trim().min(1, "Thiếu mã hồ sơ").max(64),
  bloodPressure: bloodPressureSchema,
  heartRate: z.coerce
    .number({ error: "Nhịp tim phải là số" })
    .int("Nhịp tim phải là số nguyên")
    .min(30, "Nhịp tim tối thiểu 30 lần/phút")
    .max(220, "Nhịp tim tối đa 220 lần/phút"),
  weight: z.coerce
    .number({ error: "Cân nặng phải là số" })
    .min(30, "Cân nặng tối thiểu 30kg")
    .max(250, "Cân nặng tối đa 250kg"),
  bloodType: z.enum(["A", "B", "AB", "O"], {
    error: "Nhóm máu phải là A, B, AB hoặc O",
  }),
  bloodVolume: z.coerce
    .number({ error: "Lượng máu phải là số" })
    .int()
    .refine((value) => value === 250 || value === 350, "Lượng máu chỉ nhận 250ml hoặc 350ml"),
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự").optional(),
});

export type HealthCheckInput = z.infer<typeof healthCheckSchema>;

// ---------------------------------------------------------------------------
// Quản trị chiến dịch (Admin)
// ---------------------------------------------------------------------------

/** Ngày chiến dịch dạng YYYY-MM-DD, diễn giải theo múi giờ Việt Nam (UTC+7). */
export const campaignDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày chiến dịch phải có dạng YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00+07:00`);
    return !Number.isNaN(date.getTime());
  }, "Ngày chiến dịch không hợp lệ");

export const campaignStatusSchema = z.enum(
  ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"],
  { error: "Trạng thái chiến dịch không hợp lệ" },
);

export const campaignFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Tên chiến dịch tối thiểu 3 ký tự")
    .max(150, "Tên chiến dịch tối đa 150 ký tự"),
  date: campaignDateSchema,
  location: z
    .string()
    .trim()
    .min(3, "Địa điểm tối thiểu 3 ký tự")
    .max(200, "Địa điểm tối đa 200 ký tự"),
  capacity: z.coerce
    .number({ error: "Chỉ tiêu phải là số" })
    .int("Chỉ tiêu phải là số nguyên")
    .min(1, "Chỉ tiêu tối thiểu 1 người")
    .max(100_000, "Chỉ tiêu tối đa 100.000 người"),
  overbookRate: z.coerce
    .number({ error: "Tỷ lệ overbook phải là số" })
    .min(1, "Tỷ lệ overbook tối thiểu 1.0")
    .max(3, "Tỷ lệ overbook tối đa 3.0"),
  status: campaignStatusSchema,
});

export type CampaignFormInput = z.infer<typeof campaignFormSchema>;

// ---------------------------------------------------------------------------
// Audit log nội bộ (middleware -> /api/internal/audit)
// ---------------------------------------------------------------------------

export const auditLogInputSchema = z.object({
  action: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]{2,99}$/, "Action phải là UPPER_SNAKE_CASE"),
  userId: z.string().trim().min(1).max(64).nullish(),
  details: z
    .record(z.string(), z.unknown())
    .refine(
      (value) => JSON.stringify(value).length <= 4000,
      "Details quá lớn (tối đa 4000 ký tự JSON)",
    )
    .optional(),
});

export type AuditLogInput = z.infer<typeof auditLogInputSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Rút gọn lỗi Zod thành map { field: message } để trả về client. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    if (!fields[key]) fields[key] = issue.message;
  }

  return fields;
}

/** Tính tuổi theo ngày (UTC) tại thời điểm hiện tại. */
export function calculateAge(dateOfBirth: string | Date): number {
  const dob =
    typeof dateOfBirth === "string"
      ? new Date(`${dateOfBirth}T00:00:00Z`)
      : dateOfBirth;

  if (Number.isNaN(dob.getTime())) {
    throw new Error("Ngày sinh không hợp lệ");
  }

  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }

  return age;
}
