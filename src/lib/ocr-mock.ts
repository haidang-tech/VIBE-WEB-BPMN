/**
 * Cấu hình cho OCR giả lập (mock Google Cloud Vision API).
 *
 * File thuần, không import server-only để Client Component có thể hiển thị
 * thông tin minh bạch về chế độ demo.
 */

/** CCCD mẫu trùng với tài khoản student trong prisma/seed.ts */
export const MOCK_OCR_CCCD = "001203004567";

/** Bản che của CCCD mẫu để hiển thị trên UI (không lộ PII đầy đủ). */
export const MOCK_OCR_CCCD_MASKED = "001203******67";

/** Thời gian giả lập gọi API OCR (ms). */
export const MOCK_OCR_DELAY_MS = 1000;

export const MOCK_OCR_PROVIDER = "Google Cloud Vision API (mock)";
