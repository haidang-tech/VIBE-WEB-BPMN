-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('STUDENT', 'ORGANIZER', 'MEDICAL', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."RegStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHECKED_IN', 'ELIGIBLE', 'HEALTH_CHECK_FAILED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."BloodType" AS ENUM ('A', 'B', 'AB', 'O');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'STUDENT',
    "cccdCiphertext" TEXT,
    "cccdIv" TEXT,
    "cccdAuthTag" TEXT,
    "cccdHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "overbookRate" DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    "status" "public"."CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Registration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" "public"."RegStatus" NOT NULL DEFAULT 'PENDING',
    "checkInTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HealthCheck" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "bloodPressure" TEXT NOT NULL,
    "heartRate" INTEGER NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "bloodType" "public"."BloodType",
    "bloodVolume" INTEGER NOT NULL,
    "isPassed" BOOLEAN NOT NULL DEFAULT false,
    "medicalStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_cccdHash_key" ON "public"."User"("cccdHash");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "public"."User"("role");

-- CreateIndex
CREATE INDEX "Campaign_date_idx" ON "public"."Campaign"("date");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "public"."Campaign"("status");

-- CreateIndex
CREATE INDEX "Registration_userId_campaignId_idx" ON "public"."Registration"("userId", "campaignId");

-- CreateIndex
CREATE INDEX "Registration_campaignId_status_idx" ON "public"."Registration"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Registration_status_idx" ON "public"."Registration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HealthCheck_registrationId_key" ON "public"."HealthCheck"("registrationId");

-- CreateIndex
CREATE INDEX "HealthCheck_medicalStaffId_idx" ON "public"."HealthCheck"("medicalStaffId");

-- CreateIndex
CREATE INDEX "HealthCheck_isPassed_idx" ON "public"."HealthCheck"("isPassed");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "public"."AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "public"."AuditLog"("timestamp");

-- AddForeignKey
ALTER TABLE "public"."Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Registration" ADD CONSTRAINT "Registration_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HealthCheck" ADD CONSTRAINT "HealthCheck_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "public"."Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HealthCheck" ADD CONSTRAINT "HealthCheck_medicalStaffId_fkey" FOREIGN KEY ("medicalStaffId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Ràng buộc bổ sung (Prisma schema không biểu diễn được CHECK / partial index)
-- ---------------------------------------------------------------------------

-- XOR 1: mỗi sinh viên chỉ có tối đa 1 hồ sơ đang hoạt động trong 1 chiến dịch.
-- Hồ sơ REJECTED được phép đăng ký lại => dùng partial unique index thay vì
-- @@unique([userId, campaignId]).
CREATE UNIQUE INDEX "Registration_active_per_campaign_key"
  ON "public"."Registration" ("userId", "campaignId")
  WHERE "status" IN ('PENDING', 'APPROVED', 'COMPLETED');

-- Lượng máu hiến chỉ nhận 250ml hoặc 350ml
ALTER TABLE "public"."HealthCheck"
  ADD CONSTRAINT "HealthCheck_bloodVolume_check"
  CHECK ("bloodVolume" IN (250, 350));

-- Chỉ số sinh lý trong ngưỡng có thể tồn tại
ALTER TABLE "public"."HealthCheck"
  ADD CONSTRAINT "HealthCheck_heartRate_check"
  CHECK ("heartRate" BETWEEN 20 AND 250);

ALTER TABLE "public"."HealthCheck"
  ADD CONSTRAINT "HealthCheck_weight_check"
  CHECK ("weight" > 0);

-- Campaign: chỉ tiêu dương và overbookRate không được nhỏ hơn 1.0
ALTER TABLE "public"."Campaign"
  ADD CONSTRAINT "Campaign_capacity_check"
  CHECK ("capacity" > 0);

ALTER TABLE "public"."Campaign"
  ADD CONSTRAINT "Campaign_overbookRate_check"
  CHECK ("overbookRate" >= 1.0);
