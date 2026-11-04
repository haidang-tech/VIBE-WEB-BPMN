/**
 * Seed dữ liệu mẫu cho môi trường dev/demo.
 * Chạy: npm run db:seed
 *
 * Tài khoản demo (mật khẩu giống nhau): DUE@12345
 *   admin@due.edu.vn       / ADMIN
 *   organizer@due.edu.vn   / ORGANIZER
 *   medical@due.edu.vn     / MEDICAL
 *   student@due.edu.vn     / STUDENT
 *   student01..12@due.edu.vn / STUDENT (dữ liệu minh họa)
 *
 * Seed có thể chạy lại nhiều lần: user/campaign được upsert, còn các bản ghi
 * demo (registration / health check / audit log) được tạo lại từ đầu.
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { encryptCccd } from "../src/lib/crypto";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "DUE@12345";
const BCRYPT_ROUNDS = 12;

type SeedRole = "STUDENT" | "ORGANIZER" | "MEDICAL" | "ADMIN";

type SeedUser = {
  email: string;
  name: string;
  role: SeedRole;
  cccd?: string;
};

type SeedStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CHECKED_IN"
  | "ELIGIBLE"
  | "HEALTH_CHECK_FAILED"
  | "COMPLETED";

type SeedBloodType = "A" | "B" | "AB" | "O";

type SeedHealthCheck = {
  bloodPressure: string;
  heartRate: number;
  weight: number;
  bloodType: SeedBloodType;
  bloodVolume: 250 | 350;
  isPassed: boolean;
};

type SeedRegistration = {
  id: string;
  userEmail: string;
  campaignId: string;
  status: SeedStatus;
  createdAt: Date;
  checkInTime?: Date;
  healthCheck?: SeedHealthCheck;
};

const BASE_USERS: SeedUser[] = [
  { email: "admin@due.edu.vn", name: "Quản trị viên", role: "ADMIN" },
  { email: "organizer@due.edu.vn", name: "Ban tổ chức", role: "ORGANIZER" },
  { email: "medical@due.edu.vn", name: "Nhân viên y tế", role: "MEDICAL" },
  {
    email: "student@due.edu.vn",
    name: "Nguyễn Văn Sinh Viên",
    role: "STUDENT",
    cccd: "001203004567",
  },
];

const EXTRA_STUDENTS: SeedUser[] = [
  { email: "student01@due.edu.vn", name: "Trần Thị Mai", role: "STUDENT", cccd: "001204001234" },
  { email: "student02@due.edu.vn", name: "Lê Quang Huy", role: "STUDENT", cccd: "001205002345" },
  { email: "student03@due.edu.vn", name: "Phạm Thu Hà", role: "STUDENT", cccd: "001206003456" },
  { email: "student04@due.edu.vn", name: "Hoàng Minh Tuấn", role: "STUDENT", cccd: "001207004567" },
  { email: "student05@due.edu.vn", name: "Vũ Ngọc Anh", role: "STUDENT", cccd: "001208005678" },
  { email: "student06@due.edu.vn", name: "Đặng Văn Khoa", role: "STUDENT", cccd: "001209006789" },
  { email: "student07@due.edu.vn", name: "Bùi Thị Lan", role: "STUDENT", cccd: "001210007890" },
  { email: "student08@due.edu.vn", name: "Ngô Quốc Bảo", role: "STUDENT", cccd: "001211008901" },
  { email: "student09@due.edu.vn", name: "Đỗ Thùy Dương", role: "STUDENT", cccd: "001212009012" },
  { email: "student10@due.edu.vn", name: "Phan Anh Dũng", role: "STUDENT", cccd: "001213010123" },
  { email: "student11@due.edu.vn", name: "Lý Thanh Hương", role: "STUDENT", cccd: "001214011234" },
  { email: "student12@due.edu.vn", name: "Trịnh Đức Long", role: "STUDENT", cccd: "001215012345" },
];

const USERS: SeedUser[] = [...BASE_USERS, ...EXTRA_STUDENTS];

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Ngày `offsetDays` so với hôm nay, theo múi giờ Việt Nam (mặc định 08:00). */
function vnDate(offsetDays: number, hour = 8, minute = 0): Date {
  const now = new Date();
  const vnNow = new Date(now.getTime() + VN_OFFSET_MS);
  const utcMs =
    Date.UTC(
      vnNow.getUTCFullYear(),
      vnNow.getUTCMonth(),
      vnNow.getUTCDate() + offsetDays,
      hour - 7,
      minute,
    ) - 0;

  return new Date(utcMs);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

/** Chỉ số y tế mẫu, thay đổi nhẹ theo index để dữ liệu trông tự nhiên. */
function healthCheckFor(
  index: number,
  bloodType: SeedBloodType,
  passed = true,
): SeedHealthCheck {
  return {
    bloodPressure: passed
      ? `${115 + (index % 4) * 5}/${75 + (index % 3) * 3}`
      : "150/95",
    heartRate: passed ? 70 + (index % 6) * 3 : 112,
    weight: 50 + (index % 8) * 2.5,
    bloodType,
    bloodVolume: index % 2 === 0 ? 350 : 250,
    isPassed: passed,
  };
}

function buildRegistrations(): SeedRegistration[] {
  const todayCampaign = "camp-demo-2026";
  const pastCampaign = "camp-demo-past-2025";

  const today: SeedRegistration[] = [
    {
      id: "reg-demo-today-01",
      userEmail: "student@due.edu.vn",
      campaignId: todayCampaign,
      status: "APPROVED",
      createdAt: hoursAgo(20),
    },
    {
      id: "reg-demo-today-02",
      userEmail: "student01@due.edu.vn",
      campaignId: todayCampaign,
      status: "CHECKED_IN",
      createdAt: hoursAgo(19),
      checkInTime: vnDate(0, 8, 12),
    },
    {
      id: "reg-demo-today-03",
      userEmail: "student02@due.edu.vn",
      campaignId: todayCampaign,
      status: "CHECKED_IN",
      createdAt: hoursAgo(18),
      checkInTime: vnDate(0, 8, 20),
    },
    {
      id: "reg-demo-today-04",
      userEmail: "student03@due.edu.vn",
      campaignId: todayCampaign,
      status: "ELIGIBLE",
      createdAt: hoursAgo(17),
      checkInTime: vnDate(0, 8, 30),
      healthCheck: healthCheckFor(3, "A"),
    },
    {
      id: "reg-demo-today-05",
      userEmail: "student04@due.edu.vn",
      campaignId: todayCampaign,
      status: "HEALTH_CHECK_FAILED",
      createdAt: hoursAgo(16),
      checkInTime: vnDate(0, 8, 40),
      healthCheck: healthCheckFor(4, "B", false),
    },
    {
      id: "reg-demo-today-06",
      userEmail: "student05@due.edu.vn",
      campaignId: todayCampaign,
      status: "APPROVED",
      createdAt: hoursAgo(15),
    },
    {
      id: "reg-demo-today-07",
      userEmail: "student06@due.edu.vn",
      campaignId: todayCampaign,
      status: "APPROVED",
      createdAt: hoursAgo(14),
    },
    {
      id: "reg-demo-today-08",
      userEmail: "student07@due.edu.vn",
      campaignId: todayCampaign,
      status: "APPROVED",
      createdAt: hoursAgo(13),
    },
    {
      id: "reg-demo-today-09",
      userEmail: "student08@due.edu.vn",
      campaignId: todayCampaign,
      status: "PENDING",
      createdAt: hoursAgo(12),
    },
    {
      id: "reg-demo-today-10",
      userEmail: "student09@due.edu.vn",
      campaignId: todayCampaign,
      status: "REJECTED",
      createdAt: hoursAgo(11),
    },
    {
      id: "reg-demo-today-11",
      userEmail: "student10@due.edu.vn",
      campaignId: todayCampaign,
      status: "COMPLETED",
      createdAt: hoursAgo(10),
      checkInTime: vnDate(0, 9, 0),
      healthCheck: healthCheckFor(5, "AB"),
    },
    {
      id: "reg-demo-today-12",
      userEmail: "student11@due.edu.vn",
      campaignId: todayCampaign,
      status: "COMPLETED",
      createdAt: hoursAgo(9),
      checkInTime: vnDate(0, 9, 10),
      healthCheck: healthCheckFor(6, "A"),
    },
    {
      id: "reg-demo-today-13",
      userEmail: "student12@due.edu.vn",
      campaignId: todayCampaign,
      status: "COMPLETED",
      createdAt: hoursAgo(8),
      checkInTime: vnDate(0, 9, 20),
      healthCheck: healthCheckFor(7, "B"),
    },
  ];

  const pastStatuses: SeedStatus[] = [
    "COMPLETED",
    "COMPLETED",
    "COMPLETED",
    "COMPLETED",
    "COMPLETED",
    "COMPLETED",
    "COMPLETED",
    "COMPLETED",
    "HEALTH_CHECK_FAILED",
  ];
  const pastBloodTypes: SeedBloodType[] = [
    "A",
    "B",
    "AB",
    "O",
    "O",
    "A",
    "B",
    "AB",
    "O",
  ];

  const past: SeedRegistration[] = pastStatuses.map((status, index) => {
    const user = EXTRA_STUDENTS[index];
    const passed = status === "COMPLETED";

    return {
      id: `reg-demo-past-${String(index + 1).padStart(2, "0")}`,
      userEmail: user.email,
      campaignId: pastCampaign,
      status,
      createdAt: new Date(vnDate(-61, 9, index * 5).getTime()),
      checkInTime: vnDate(-60, 8, index * 5),
      healthCheck: healthCheckFor(index + 10, pastBloodTypes[index], passed),
    };
  });

  return [...today, ...past];
}

async function main() {
  const password = await hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  const userIdByEmail = new Map<string, string>();

  for (const item of USERS) {
    const cccdData = item.cccd ? encryptCccd(item.cccd) : null;

    const user = await prisma.user.upsert({
      where: { email: item.email },
      update: {
        name: item.name,
        role: item.role,
        password,
        ...(cccdData
          ? {
              cccdCiphertext: cccdData.ciphertext,
              cccdIv: cccdData.iv,
              cccdAuthTag: cccdData.authTag,
              cccdHash: cccdData.hash,
            }
          : {}),
      },
      create: {
        email: item.email,
        name: item.name,
        role: item.role,
        password,
        ...(cccdData
          ? {
              cccdCiphertext: cccdData.ciphertext,
              cccdIv: cccdData.iv,
              cccdAuthTag: cccdData.authTag,
              cccdHash: cccdData.hash,
            }
          : {}),
      },
      select: { id: true },
    });

    userIdByEmail.set(item.email, user.id);
  }

  const medicalUserId = userIdByEmail.get("medical@due.edu.vn");
  if (!medicalUserId) throw new Error("Thiếu tài khoản medical@due.edu.vn");

  const campaigns = [
    {
      id: "camp-demo-2026",
      name: "Hiến máu nhân đạo đợt 1 - 2026",
      date: vnDate(0),
      location: "Trường Đại học Kinh tế - ĐHĐN",
      capacity: 200,
      overbookRate: 1.2,
      status: "ACTIVE" as const,
    },
    {
      id: "camp-demo-upcoming-2026",
      name: "Hiến máu nhân đạo đợt 2 - 2026",
      date: vnDate(21),
      location: "Hội trường A - Trường Đại học Kinh tế",
      capacity: 250,
      overbookRate: 1.3,
      status: "ACTIVE" as const,
    },
    {
      id: "camp-demo-past-2025",
      name: "Hiến máu nhân đạo đợt 4 - 2025",
      date: vnDate(-60),
      location: "Trường Đại học Kinh tế - ĐHĐN",
      capacity: 150,
      overbookRate: 1.1,
      status: "COMPLETED" as const,
    },
  ];

  for (const campaign of campaigns) {
    await prisma.campaign.upsert({
      where: { id: campaign.id },
      update: {
        name: campaign.name,
        date: campaign.date,
        location: campaign.location,
        capacity: campaign.capacity,
        overbookRate: campaign.overbookRate,
        status: campaign.status,
      },
      create: campaign,
    });
  }

  // Tạo lại các bản ghi demo để seed luôn cho ra cùng một bộ dữ liệu.
  // Xóa theo campaign demo (không chỉ theo id) để tránh đụng unique index
  // (userId, campaignId) với các hồ sơ được tạo tay trước đó.
  await prisma.registration.deleteMany({
    where: {
      OR: [
        { id: { startsWith: "reg-demo-" } },
        { campaignId: { in: campaigns.map((campaign) => campaign.id) } },
      ],
    },
  });
  await prisma.auditLog.deleteMany({
    where: { id: { startsWith: "audit-demo-" } },
  });

  const registrations = buildRegistrations();

  for (const item of registrations) {
    const userId = userIdByEmail.get(item.userEmail);
    if (!userId) throw new Error(`Không tìm thấy user ${item.userEmail}`);

    const registration = await prisma.registration.create({
      data: {
        id: item.id,
        userId,
        campaignId: item.campaignId,
        status: item.status,
        checkInTime: item.checkInTime ?? null,
        createdAt: item.createdAt,
      },
    });

    if (item.healthCheck) {
      await prisma.healthCheck.create({
        data: {
          registrationId: registration.id,
          bloodPressure: item.healthCheck.bloodPressure,
          heartRate: item.healthCheck.heartRate,
          weight: item.healthCheck.weight,
          bloodType: item.healthCheck.bloodType,
          bloodVolume: item.healthCheck.bloodVolume,
          isPassed: item.healthCheck.isPassed,
          medicalStaffId: medicalUserId,
        },
      });
    }
  }

  const adminId = userIdByEmail.get("admin@due.edu.vn") ?? null;
  const organizerId = userIdByEmail.get("organizer@due.edu.vn") ?? null;
  const studentId = userIdByEmail.get("student@due.edu.vn") ?? null;

  const auditLogs = [
    {
      id: "audit-demo-01",
      action: "AUTH_LOGIN_SUCCESS",
      userId: studentId,
      details: { role: "STUDENT" },
      timestamp: hoursAgo(22),
    },
    {
      id: "audit-demo-02",
      action: "REGISTRATION_CREATED",
      userId: studentId,
      details: { campaignId: "camp-demo-2026" },
      timestamp: hoursAgo(20),
    },
    {
      id: "audit-demo-03",
      action: "CHECK_IN_SUCCESS",
      userId: organizerId,
      details: { campaignId: "camp-demo-2026", registrationId: "reg-demo-today-11" },
      timestamp: vnDate(0, 9, 0),
    },
    {
      id: "audit-demo-04",
      action: "HEALTH_CHECK_PASSED",
      userId: medicalUserId,
      details: { registrationId: "reg-demo-today-11", bloodType: "AB" },
      timestamp: vnDate(0, 9, 10),
    },
    {
      id: "audit-demo-05",
      action: "DONATION_COMPLETED",
      userId: medicalUserId,
      details: { registrationId: "reg-demo-today-11", bloodVolume: 350 },
      timestamp: vnDate(0, 9, 20),
    },
    {
      id: "audit-demo-06",
      action: "CAMPAIGN_CREATED",
      userId: adminId,
      details: { campaignId: "camp-demo-upcoming-2026" },
      timestamp: hoursAgo(48),
    },
  ];

  for (const log of auditLogs) {
    await prisma.auditLog.create({
      data: {
        id: log.id,
        action: log.action,
        userId: log.userId,
        details: log.details,
        timestamp: log.timestamp,
      },
    });
  }

  const completed = registrations.filter((item) => item.status === "COMPLETED");
  const totalVolume = completed.reduce(
    (sum, item) => sum + (item.healthCheck?.bloodVolume ?? 0),
    0,
  );

  console.log("✅ Seed hoàn tất");
  console.table(
    USERS.map((user) => ({
      email: user.email,
      role: user.role,
      password: DEMO_PASSWORD,
    })),
  );
  console.log(
    `Chiến dịch: ${campaigns.length} | Hồ sơ demo: ${registrations.length} | Ca hoàn thành: ${completed.length} | Máu thu được: ${totalVolume} ml`,
  );
  console.log(
    `Chiến dịch hôm nay: ${campaigns[0].name} (${campaigns[0].id})`,
  );
}

main()
  .catch((error) => {
    console.error("❌ Seed thất bại:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
