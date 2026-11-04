# Flow Nhân viên Y tế — Khám sức khỏe & chốt kết quả (Prompt 6)

Kết quả **Prompt 6**: màn hình thao tác nhanh cho nhân viên y tế, nhập chỉ số lâm sàng
(XOR 3) và chốt kết quả hiến máu (Thành công / Thất bại do sự cố).

## 1. Cấu trúc file

```
src/
  app/(roles)/medical/
    layout.tsx                 # Khung trang khu vực y tế
    medical-nav.tsx            # Điều hướng "Quét CCCD" / "Khám & chốt kết quả"
    page.tsx                   # /medical -> /medical/health-check
    scan-id/page.tsx           # Quét CCCD -> mở đúng hồ sơ khám (không check-in)
    blood-status/page.tsx      # Route blueprint -> redirect /health-check
    health-check/page.tsx      # Server Component: thống kê + hàng chờ + panel
  components/
    CccdUploader.tsx           # Camera/tải ảnh OCR; intent="medical" để tra cứu
    MedicalQueue.tsx           # Hàng chờ: chọn chiến dịch, tìm kiếm, lọc tab
    MedicalCheckPanel.tsx      # Form chỉ số + 2 nút chốt kết quả
  actions/
    ocr.ts                     # lookupCccdForMedical (không đổi trạng thái)
    blood-donation.ts          # Thêm finalizeDonation bên cạnh evaluateHealth
  lib/
    registration-status.ts     # Mô tả HEALTH_CHECK_FAILED bao gồm sự cố hiến máu
```

## 2. Quét CCCD để mở hồ sơ — `/medical/scan-id`

Nhân viên y tế quét CCCD để **mở đúng hồ sơ sinh viên và nhập chỉ số khám**, không
phải để check-in. Thao tác quét tuyệt đối không đổi trạng thái hồ sơ.

- `CccdUploader` nhận prop `intent="medical"` (mặc định `"checkin"` cho Ban tổ chức).
- Ở chế độ y tế, client gọi `lookupCccdForMedical(formData)` thay vì
  `processCccdOcr(formData)`. Action này:
  1. Yêu cầu phiên `MEDICAL`.
  2. Dùng chung phần validate ảnh + đọc `cccd` / `cccdCandidates` với luồng check-in.
  3. Đối chiếu blind index `User.cccdHash` như check-in.
  4. Chọn hồ sơ ưu tiên `APPROVED` / `CHECKED_IN`, sau đó `ELIGIBLE`, cuối cùng là
     hồ sơ mới nhất.
  5. Chỉ chấp nhận `APPROVED`, `CHECKED_IN`, `ELIGIBLE`, `HEALTH_CHECK_FAILED`,
     `COMPLETED`. `PENDING` và `REJECTED` bị từ chối.
  6. Ghi audit `MEDICAL_CCCD_LOOKUP` (chỉ `registrationId`, `campaignId`, 4 số cuối
     CCCD — không ghi plaintext).
  7. Trả `registrationId` để client chuyển sang
     `/medical/health-check?campaignId=...&registrationId=...`.
- Sau khi chuyển trang, panel nhập chỉ số của đúng hồ sơ mở ra; trạng thái vẫn là
  `APPROVED` và `checkInTime` vẫn `NULL` cho đến khi lưu chỉ số.
- Camera, tải ảnh và nhập tay 12 số đều dùng chung pipeline OCR; nếu ảnh mờ, nhân
  viên nhập tay số in trên thẻ.
- Thông báo thành công/CCCD hiển thị lấy từ đúng bản ghi vừa tra cứu.

## 3. Màn hình `/medical/health-check`

- Chọn chiến dịch `ACTIVE` (mặc định chiến dịch diễn ra hôm nay, nếu không có thì
  chiến dịch gần nhất). Lưu lựa chọn trên URL `?campaignId=`.
- Thẻ thống kê: Chờ khám (`APPROVED | CHECKED_IN`), Chờ chốt (`ELIGIBLE`),
  Hoàn thành (`COMPLETED`), Không đạt (`HEALTH_CHECK_FAILED`).
- Hàng chờ bên trái:
  - Sắp xếp ưu tiên: đã check-in → đã duyệt → chờ chốt → đã kết thúc.
  - Tìm kiếm theo tên/email/CCCD (bỏ dấu tiếng Việt) và lọc tab
    Tất cả / Chờ khám / Chờ chốt / Đã xong.
  - Chọn hồ sơ qua `?registrationId=`.
- Panel bên phải:
  - Hiển thị thông tin sinh viên, CCCD đã che, chiến dịch, giờ check-in.
  - Nếu đã có `HealthCheck`, hiển thị lại 5 chỉ số.
  - `APPROVED` / `CHECKED_IN`: form nhập chỉ số.
  - `ELIGIBLE`: hiển thị 2 nút lớn **Thành công** (xanh) và
    **Thất bại do sự cố** (đỏ).
  - `COMPLETED` / `HEALTH_CHECK_FAILED`: thông báo kết quả cuối.

## 4. Nhập chỉ số — `evaluateHealth` (XOR 3)

Form dùng `healthCheckSchema` + React Hook Form để validate realtime, sau đó gọi
`evaluateHealth` hiện có:

1. Kiểm tra phiên `MEDICAL`.
2. Validate huyết áp `xxx/yyy`, nhịp tim, cân nặng, nhóm máu A/B/AB/O, lượng máu
   250/350ml.
3. Transaction Serializable: `upsert` `HealthCheck`, đổi trạng thái:
   - Đạt ngưỡng huyết áp 90/60–140/90 mmHg **và** nhịp tim 60–100 → `ELIGIBLE`.
   - Không đạt → `HEALTH_CHECK_FAILED`.
4. Ghi audit `HEALTH_CHECK_PASSED` / `HEALTH_CHECK_FAILED`.

Sau khi lưu thành công, client gọi `router.refresh()` để panel chuyển ngay sang
bước chốt kết quả.

## 5. Chốt kết quả — `finalizeDonation` (mới)

```ts
finalizeDonation({ registrationId, outcome: "SUCCESS" | "INCIDENT" })
```

| Lựa chọn trên UI | `outcome` | Trạng thái DB | Audit action |
| --- | --- | --- | --- |
| Thành công (xanh) | `SUCCESS` | `COMPLETED` | `DONATION_COMPLETED` |
| Thất bại do sự cố (đỏ) | `INCIDENT` | `HEALTH_CHECK_FAILED` | `DONATION_FAILED` |

Quy tắc:

- Chỉ role `MEDICAL` được gọi action.
- Chỉ chốt hồ sơ đang `ELIGIBLE` (đã qua khám sức khỏe).
- Transaction Serializable + kiểm tra lại trạng thái trước khi update, tránh 2
  người cùng chốt một hồ sơ.
- `HealthCheck.isPassed` **không đổi** khi gặp sự cố: chỉ số khám vẫn hợp lệ,
  sự cố xảy ra ở bước lấy máu. Chỉ trạng thái `Registration` thay đổi.
- `HEALTH_CHECK_FAILED` không nằm trong `CAPACITY_CONSUMING_STATUSES`, nên ca
  thất bại do sự cố được giải phóng chỉ tiêu.
- Ghi `AuditLog` với `registrationId`, `previousStatus = ELIGIBLE`, `status`,
  `outcome` và `userId` là nhân viên y tế thao tác.

Kết quả trả về:

```json
{
  "success": true,
  "code": "DONATION_COMPLETED",
  "message": "Đã chốt ca hiến máu thành công.",
  "data": {
    "registrationId": "...",
    "status": "COMPLETED",
    "outcome": "SUCCESS"
  }
}
```

Mã lỗi chính: `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_INPUT`,
`REGISTRATION_NOT_FOUND`, `INVALID_STATUS`, `CONFLICT`, `INTERNAL_ERROR`.

## 6. Kiểm thử thủ công

Điều kiện: `docker compose up -d`, `npm run db:deploy`, `npm run db:seed`.

1. Đăng nhập `medical@due.edu.vn / DUE@12345`.
2. Vào `/medical/scan-id`; chọn chiến dịch mẫu nếu cần.
3. Quét CCCD bằng camera, tải ảnh hoặc nhập tay 12 số → hệ thống chuyển sang
   `/medical/health-check?campaignId=...&registrationId=...` với đúng hồ sơ.
   Kiểm tra hồ sơ vẫn `APPROVED` và `checkInTime = NULL` (không bị check-in).
4. Chọn một hồ sơ đã `APPROVED` hoặc `CHECKED_IN` trong hàng chờ (hoặc dùng kết quả
   quét ở bước 3).
5. Nhập chỉ số hợp lệ (ví dụ `120/80`, nhịp tim `80`, cân nặng `55`, nhóm `O`,
   `350ml`) → hồ sơ chuyển `ELIGIBLE`, panel hiện 2 nút chốt.
6. Bấm **Thành công** → hồ sơ `COMPLETED`, kiểm tra `AuditLog.action =
   DONATION_COMPLETED`.
7. Lặp lại với hồ sơ khác và bấm **Thất bại do sự cố** → hồ sơ
   `HEALTH_CHECK_FAILED`, audit `DONATION_FAILED`, `HealthCheck.isPassed` vẫn
   `true`.
8. Nhập chỉ số không đạt (ví dụ `150/95` hoặc nhịp tim `120`) → hồ sơ
   `HEALTH_CHECK_FAILED`, audit `HEALTH_CHECK_FAILED`, không hiện nút chốt.
9. Quét một CCCD của hồ sơ `PENDING` hoặc `REJECTED` → nhận thông báo không thể
   khám, không mở form chỉ số.
10. Kiểm tra `AuditLog` có action `MEDICAL_CCCD_LOOKUP` sau mỗi lần quét thành công.

## 7. Lưu ý bảo mật

- Kiểm tra role ở server trong cả `evaluateHealth` và `finalizeDonation`.
- Không tin trạng thái client gửi lên; action đọc lại trạng thái trong transaction.
- CCCD chỉ hiển thị bản che (`maskCccd`), không ghi plaintext vào audit.
- Nút chốt kết quả yêu cầu xác nhận trước khi gửi để tránh bấm nhầm.
