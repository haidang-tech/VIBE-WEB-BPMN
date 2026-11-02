/**
 * Quy tắc nghiệp vụ thuần (pure) cho 3 cổng XOR.
 * Không import Prisma / next/* để có thể unit-test độc lập.
 *
 * GHI CHÚ VỀ "XOR":
 * Blueprint gọi các bước kiểm tra là "cổng XOR". Nếu hiểu theo boolean XOR thật
 * (chỉ đạt khi ĐÚNG MỘT điều kiện đúng) thì:
 *   - Người 20 tuổi, 50kg sẽ bị LOẠI (vì cả hai cùng đúng).
 *   - Người 17 tuổi, 40kg cũng bị loại, nhưng người 17 tuổi, 50kg lại ĐẠT.
 * Điều này trái hoàn toàn với tiêu chuẩn hiến máu (18–60 tuổi, >= 45kg).
 * Vì vậy "cổng XOR" ở đây được hiện thực đúng nghĩa "cổng đạt/không đạt":
 * hồ sơ chỉ ĐẠT khi thỏa TẤT CẢ điều kiện (AND), và bị loại ngay khi có bất kỳ
 * điều kiện nào không đạt.
 */

export const MIN_AGE = 18;
export const MIN_WEIGHT_KG = 45;

/** Huyết áp tâm thu/tâm trương được chấp nhận khi hiến máu (mmHg) */
export const BLOOD_PRESSURE_RANGE = {
  systolicMin: 90,
  systolicMax: 140,
  diastolicMin: 60,
  diastolicMax: 90,
} as const;

/** Nhịp tim khi nghỉ được chấp nhận (lần/phút) */
export const HEART_RATE_RANGE = {
  min: 60,
  max: 100,
} as const;

/**
 * Hồ sơ đang "chiếm chỗ" của chiến dịch (dùng để tính capacity).
 * REJECTED và HEALTH_CHECK_FAILED không tính vì đã giải phóng chỉ tiêu.
 */
export const CAPACITY_CONSUMING_STATUSES = [
  "PENDING",
  "APPROVED",
  "CHECKED_IN",
  "ELIGIBLE",
  "COMPLETED",
] as const;

/**
 * Trạng thái chặn đăng ký trùng — đúng theo blueprint (XOR 1).
 * Khớp với partial unique index `Registration_active_per_campaign_key`.
 */
export const BLOCKING_REGISTRATION_STATUSES = [
  "PENDING",
  "APPROVED",
  "COMPLETED",
] as const;

/** Trạng thái cho phép nhập chỉ số khám sức khỏe. */
export const HEALTH_CHECK_ALLOWED_STATUSES = [
  "APPROVED",
  "CHECKED_IN",
] as const;

export type ProfileEvaluation = {
  eligible: boolean;
  age: number;
  ageOk: boolean;
  weightOk: boolean;
  reasons: string[];
};

export function evaluateProfileRules(
  age: number,
  weightKg: number,
): ProfileEvaluation {
  const ageOk = Number.isFinite(age) && age >= MIN_AGE;
  const weightOk = Number.isFinite(weightKg) && weightKg >= MIN_WEIGHT_KG;
  const reasons: string[] = [];

  if (!ageOk) {
    reasons.push(`Tuổi ${age} chưa đủ ${MIN_AGE}`);
  }

  if (!weightOk) {
    reasons.push(`Cân nặng ${weightKg}kg chưa đủ ${MIN_WEIGHT_KG}kg`);
  }

  return {
    eligible: ageOk && weightOk,
    age,
    ageOk,
    weightOk,
    reasons,
  };
}

export type BloodPressure = {
  systolic: number;
  diastolic: number;
};

/** Parse "120/80" -> { systolic: 120, diastolic: 80 }; trả null nếu sai định dạng. */
export function parseBloodPressure(value: string): BloodPressure | null {
  const match = /^(\d{2,3})\/(\d{2,3})$/.exec(value.trim());
  if (!match) return null;

  return {
    systolic: Number(match[1]),
    diastolic: Number(match[2]),
  };
}

export type HealthEvaluation = {
  isPassed: boolean;
  bloodPressureOk: boolean;
  heartRateOk: boolean;
  reasons: string[];
};

export function evaluateHealthRules(input: {
  bloodPressure: BloodPressure;
  heartRate: number;
}): HealthEvaluation {
  const { systolic, diastolic } = input.bloodPressure;
  const { heartRate } = input;

  const bloodPressureOk =
    systolic >= BLOOD_PRESSURE_RANGE.systolicMin &&
    systolic <= BLOOD_PRESSURE_RANGE.systolicMax &&
    diastolic >= BLOOD_PRESSURE_RANGE.diastolicMin &&
    diastolic <= BLOOD_PRESSURE_RANGE.diastolicMax;

  const heartRateOk =
    Number.isFinite(heartRate) &&
    heartRate >= HEART_RATE_RANGE.min &&
    heartRate <= HEART_RATE_RANGE.max;

  const reasons: string[] = [];

  if (!bloodPressureOk) {
    reasons.push(
      `Huyết áp ${systolic}/${diastolic} ngoài ngưỡng ${BLOOD_PRESSURE_RANGE.systolicMin}/${BLOOD_PRESSURE_RANGE.diastolicMin}–${BLOOD_PRESSURE_RANGE.systolicMax}/${BLOOD_PRESSURE_RANGE.diastolicMax} mmHg`,
    );
  }

  if (!heartRateOk) {
    reasons.push(
      `Nhịp tim ${heartRate} ngoài ngưỡng ${HEART_RATE_RANGE.min}–${HEART_RATE_RANGE.max} lần/phút`,
    );
  }

  return {
    isPassed: bloodPressureOk && heartRateOk,
    bloodPressureOk,
    heartRateOk,
    reasons,
  };
}

/**
 * Sức chứa tối đa = capacity * overbookRate (làm tròn xuống).
 * Trả 0 nếu dữ liệu campaign không hợp lệ.
 */
export function computeMaxSlots(
  capacity: number,
  overbookRate: number,
): number {
  if (
    !Number.isFinite(capacity) ||
    !Number.isFinite(overbookRate) ||
    capacity <= 0 ||
    overbookRate <= 0
  ) {
    return 0;
  }

  return Math.floor(capacity * overbookRate);
}
