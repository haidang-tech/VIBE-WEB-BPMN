-- Prompt 13: sinh viên chọn nhiều khung giờ, hệ thống tự phân khung ít đông.
ALTER TABLE "Registration"
ADD COLUMN "preferredSlots" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
