# 3 cổng XOR — Server Actions (Prompt 3)

## 1. File

```
src/lib/donation-rules.ts        # Quy tắc thuần (pure), unit-test được
src/actions/blood-donation.ts    # 3 Server Actions có "use server"
```

`donation-rules.ts` không import Prisma / `next/*` nên có thể test độc lập ở Prompt 8.

## 2. Quan trọng: "XOR" trong blueprint được hiểu đúng nghiệp vụ

Blueprint viết "Tuổi >= 18 **XOR** Cân nặng >= 45kg" và "Huyết áp ổn định **XOR** Nhịp tim
bình thường". Nếu hiểu là **boolean XOR thật** (chỉ đạt khi đúng một vế đúng) thì:

| Tuổi | Cân nặng | XOR thật | Thực tế cần |
| --- | --- | --- | --- |
| 20 | 55kg | ❌ Loại | ✅ Đạt |
| 17 | 55kg | ✅ Đạt | ❌ Loại |
| 20 | 40kg | ✅ Đạt | ❌ Loại |
| 16 | 40kg | ❌ Loại | ❌ Loại |

Tương tự với huyết áp/nhịp tim: người có **cả hai** chỉ số bình thường sẽ bị loại nếu dùng
XOR thật. Vì vậy code hiện thực **cổng đạt/không đạt** đúng nghĩa: chỉ ĐẠT khi **tất cả**
điều kiện đều đạt (AND), và trả về lý do cụ thể khi không đạt.

## 3. XOR 1 — `checkCanRegister(userId, campaignId)`

Điều kiện chặn:

1. Tồn tại hồ sơ của user trong campaign với status `PENDING`, `APPROVED` hoặc `COMPLETED`
   → `ALREADY_REGISTERED`.
2. `activeCount >= capacity * overbookRate` → `CAMPAIGN_FULL`.

- `activeCount` đếm các status đang chiếm suất: `PENDING`, `APPROVED`, `CHECKED_IN`,
  `ELIGIBLE`, `COMPLETED`. `REJECTED` / `HEALTH_CHECK_FAILED` được giải phóng suất.
- `maxSlots = floor(capacity * overbookRate)` (ví dụ 200 × 1.2 = 240).
- Chỉ role `STUDENT` và **đúng userId của phiên đăng nhập** mới được gọi (chống IDOR).

Kết quả thành công có `data`:

```json
{
  "success": true,
  "code": "CAN_REGISTER",
  "message": "...",
  "data": {
    "capacity": 200,
    "overbookRate": 1.2,
    "maxSlots": 240,
    "activeCount": 37,
    "remainingSlots": 203
  }
}
```

## 4. XOR 2 — `validateProfile(data)`

Luồng:

1. Yêu cầu session `STUDENT`.
2. Validate bằng `donationRegistrationSchema` (Zod).
3. `age = calculateAge(dateOfBirth)`.
4. Đánh giá: `age >= 18 AND weightKg >= 45`.
5. Mã hóa CCCD (AES-256-GCM) + blind index.
6. Kiểm tra CCCD:
   - Tài khoản đã có CCCD khác → `CCCD_MISMATCH`.
   - CCCD thuộc tài khoản khác → `CCCD_IN_USE`.
7. Trong **một transaction Serializable**:
   - Chạy lại XOR 1 (chống race condition).
   - Tạo `Registration` với `APPROVED` hoặc `REJECTED`.
   - Cập nhật `User.name` + CCCD đã mã hóa.
8. Ghi audit `REGISTRATION_APPROVED` / `REGISTRATION_REJECTED`.

> `Serializable` + partial unique index `Registration_active_per_campaign_key` đảm bảo
> hai request đồng thời không thể cùng vượt qua bước kiểm tra.

Response:

```json
{
  "success": true,
  "code": "PROFILE_APPROVED",
  "message": "Hồ sơ hợp lệ...",
  "data": {
    "registrationId": "...",
    "status": "APPROVED",
    "eligible": true,
    "age": 22,
    "reasons": []
  }
}
```

Hồ sơ không đạt vẫn được lưu với status `REJECTED`, `success: false`,
`code: "PROFILE_REJECTED"`, `data.reasons` liệt kê lý do (tuổi / cân nặng).

## 5. XOR 3 — `evaluateHealth(data)`

- Yêu cầu session `MEDICAL`; `medicalStaffId` lấy từ JWT, **không tin client**.
- Validate bằng `healthCheckSchema`.
- Ngưỡng:

| Chỉ số | Ngưỡng đạt |
| --- | --- |
| Huyết áp tâm thu | 90–140 mmHg |
| Huyết áp tâm trương | 60–90 mmHg |
| Nhịp tim | 60–100 lần/phút |

- Đạt cả hai → `isPassed = true`, `Registration.status = ELIGIBLE`.
- Không đạt → `isPassed = false`, `Registration.status = HEALTH_CHECK_FAILED`.
- `HealthCheck` được `upsert` theo `registrationId` (1-1), lưu lượng máu 250/350.
- Chỉ nhập được khi hồ sơ ở `APPROVED` hoặc `CHECKED_IN`; trạng thái khác trả
  `INVALID_STATUS`.
- Transaction Serializable + ghi audit `HEALTH_CHECK_PASSED` / `HEALTH_CHECK_FAILED`.

## 6. Cấu trúc kết quả chung

```ts
type ActionResult<T> = {
  success: boolean;
  message: string;
  code?: string;
  data?: T;
  errors?: Record<string, string>; // lỗi theo field khi INVALID_INPUT
};
```

Các `code` thường gặp:

| Code | Ý nghĩa |
| --- | --- |
| `CAN_REGISTER`, `PROFILE_APPROVED`, `ELIGIBLE` | Thành công |
| `ALREADY_REGISTERED` | Đã có hồ sơ đang hoạt động |
| `CAMPAIGN_FULL` | Hết chỉ tiêu (đã tính overbook) |
| `PROFILE_REJECTED` | Không đạt tuổi/cân nặng |
| `HEALTH_CHECK_FAILED` | Không đạt huyết áp/nhịp tim |
| `INVALID_STATUS` | Hồ sơ sai trạng thái để khám |
| `CCCD_MISMATCH`, `CCCD_IN_USE` | Xung đột CCCD |
| `UNAUTHENTICATED`, `FORBIDDEN` | Sai phiên / sai role |
| `INVALID_INPUT` | Zod validation thất bại |
| `CONFLICT` | Transaction Serializable bị retry (P2034) |
| `INTERNAL_ERROR` | Lỗi DB / lỗi không mong đợi |

## 7. Kiểm thử đã thực hiện

Chạy trên PostgreSQL thật + Next.js dev, đăng nhập bằng cookie thật:

| Kịch bản | Kết quả |
| --- | --- |
| Campaign 200 × 1.2, chưa đăng ký | `CAN_REGISTER`, 240 suất |
| Campaign capacity 1, đã có 1 hồ sơ | `CAMPAIGN_FULL` (1/1) |
| Tuổi 22, 55kg | `APPROVED` |
| Đăng ký lại cùng campaign | `ALREADY_REGISTERED` |
| Tuổi 16, 50kg | `REJECTED` (lý do tuổi) |
| Tuổi 22, 40kg | `REJECTED` (lý do cân nặng) |
| Tuổi 22, 55kg (sau 2 lần bị từ chối) | `APPROVED` (đúng: REJECTED không chặn) |
| CCCD khác CCCD tài khoản | `CCCD_MISMATCH` |
| CCCD của người khác | `CCCD_IN_USE` |
| Health 120/80, 80 bpm | `ELIGIBLE`, tạo HealthCheck |
| Health 160/100, 110 bpm | `HEALTH_CHECK_FAILED` |
| Khám lại hồ sơ đã ELIGIBLE | `INVALID_STATUS` |
| Student gọi `evaluateHealth` | `FORBIDDEN` |
| Medical gọi `validateProfile` | `FORBIDDEN` |
| Student check hồ sơ người khác | `FORBIDDEN` |

Dữ liệu DB sau test: Registration đúng trạng thái, HealthCheck đúng `isPassed`,
AuditLog có đủ 4 action nghiệp vụ, CCCD lưu dạng mã hóa (hash 64 ký tự).

## 8. Giới hạn đã biết (đúng theo blueprint)

- XOR 1 chỉ chặn 3 status `PENDING/APPROVED/COMPLETED` như tài liệu. Nếu một hồ sơ đã
  chuyển sang `CHECKED_IN`/`ELIGIBLE`, về lý thuyết sinh viên có thể tạo hồ sơ mới cho
  cùng campaign. DB partial index cũng chỉ phủ 3 status này.
- Schema chưa có cột tuổi/cân nặng/điện thoại, nên `dateOfBirth`, `weightKg`, `phone`,
  `note` chỉ dùng để validate, không lưu. Cân nặng chính thức được lưu ở `HealthCheck`.
- `validateProfile` cho phép cập nhật email tài khoản khi sinh viên sửa lại trong form;
  email phải có đuôi `@due.edu.vn` và không trùng tài khoản khác. Họ tên và CCCD
  cũng được cập nhật.
