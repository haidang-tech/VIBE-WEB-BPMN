-- Prompt 11: hồ sơ đăng ký hiến máu đầy đủ (thông tin sinh viên, thể trạng,
-- tiền sử sức khỏe, khung giờ và cam kết khai báo).

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable User
ALTER TABLE "public"."User"
  ADD COLUMN "studentCode" TEXT,
  ADD COLUMN "className" TEXT,
  ADD COLUMN "faculty" TEXT,
  ADD COLUMN "dateOfBirth" TIMESTAMP(3),
  ADD COLUMN "gender" "public"."Gender",
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "bloodType" "public"."BloodType",
  ADD COLUMN "lastDonationDate" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_studentCode_key" ON "public"."User"("studentCode");

-- AlterTable Registration
ALTER TABLE "public"."Registration"
  ADD COLUMN "weightKg" DECIMAL(5,2),
  ADD COLUMN "heightCm" INTEGER,
  ADD COLUMN "slotTime" TEXT,
  ADD COLUMN "usedAntibiotics" BOOLEAN,
  ADD COLUMN "recentTattooOrSurgery" BOOLEAN,
  ADD COLUMN "infectiousDiseaseHistory" BOOLEAN,
  ADD COLUMN "healthDeclarationConfirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "note" TEXT;

-- Ràng buộc dữ liệu thể trạng (chỉ áp dụng khi có giá trị)
ALTER TABLE "public"."Registration"
  ADD CONSTRAINT "Registration_weightKg_check"
  CHECK ("weightKg" IS NULL OR ("weightKg" >= 30 AND "weightKg" <= 250));

ALTER TABLE "public"."Registration"
  ADD CONSTRAINT "Registration_heightCm_check"
  CHECK ("heightCm" IS NULL OR ("heightCm" >= 100 AND "heightCm" <= 250));
