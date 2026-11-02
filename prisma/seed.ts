/**
 * Seed dữ liệu mẫu cho môi trường dev/demo.
 * Chạy: npm run db:seed
 *
 * Tài khoản demo (mật khẩu giống nhau): DUE@12345
 *   admin@due.edu.vn      / ADMIN
 *   organizer@due.edu.vn  / ORGANIZER
 *   medical@due.edu.vn    / MEDICAL
 *   student@due.edu.vn    / STUDENT
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { encryptCccd } from "../src/lib/crypto";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "DUE@12345";
const BCRYPT_ROUNDS = 12;

type SeedUser = {
  email: string;
  name: string;
  role: "STUDENT" | "ORGANIZER" | "MEDICAL" | "ADMIN";
  cccd?: string;
};

const USERS: SeedUser[] = [
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

async function main() {
  const password = await hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  for (const item of USERS) {
    const cccdData = item.cccd ? encryptCccd(item.cccd) : null;

    await prisma.user.upsert({
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
    });
  }

  const campaign = await prisma.campaign.upsert({
    where: { id: "camp-demo-2026" },
    update: {},
    create: {
      id: "camp-demo-2026",
      name: "Hiến máu nhân đạo đợt 1 - 2026",
      date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      location: "Trường Đại học Kinh tế - ĐHĐN",
      capacity: 200,
      overbookRate: 1.2,
      status: "ACTIVE",
    },
  });

  console.log("✅ Seed hoàn tất");
  console.table(
    USERS.map((user) => ({
      email: user.email,
      role: user.role,
      password: DEMO_PASSWORD,
    })),
  );
  console.log(`Chiến dịch mẫu: ${campaign.name} (${campaign.id})`);
}

main()
  .catch((error) => {
    console.error("❌ Seed thất bại:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
