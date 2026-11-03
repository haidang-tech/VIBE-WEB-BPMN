# Flow Ban tổ chức — Check-in & Mock OCR (Prompt 5)

Kết quả **Prompt 5**: màn hình check-in cho Ban tổ chức, bảng hồ sơ có tìm kiếm/lọc và
luồng quét ảnh CCCD giả lập để chuyển hồ sơ sang `CHECKED_IN`.

## 1. Cấu trúc file

```
src/
  app/(roles)/organizer/
    layout.tsx               # Khung trang Ban tổ chức
    organizer-nav.tsx        # Điều hướng Check-in
    page.tsx                 # /organizer -> /organizer/check-in
    dashboard/page.tsx       # /organizer/dashboard -> /organizer/check-in
    check-in/page.tsx        # Server Component: thống kê + bảng + bộ lọc
  actions/
    ocr.ts                   # Server Action OCR giả lập + check-in
  components/
    CccdUploader.tsx         # Upload/kéo thả ảnh, gọi processCccdOcr
    CheckInToolbar.tsx       # Tìm kiếm debounce + lọc trạng thái/chiến dịch
    ui/table.tsx             # Shadcn Table primitives
  lib/
    ocr-mock.ts              # Hằng số CCCD mẫu, thời gian delay, tên provider
```

`next.config.ts` đặt `experimental.serverActions.bodySizeLimit = "6mb"` để nhận ảnh tối đa
5MB (mặc định của Next.js là 1MB).

## 2. Màn hình `/organizer/check-in`

- Hiển thị chiến dịch đang chọn (mặc định: chiến dịch diễn ra hôm nay; nếu hôm nay không
  có thì chọn chiến dịch `ACTIVE` gần nhất và hiện thông báo).
- Thẻ thống kê: tổng hồ sơ, chờ check-in (`APPROVED`), đã check-in
  (`CHECKED_IN | ELIGIBLE | COMPLETED`), không đạt (`REJECTED | HEALTH_CHECK_FAILED`).
- Bảng Shadcn Table gồm: sinh viên, CCCD đã che, trạng thái, giờ check-in, giờ đăng ký.
- Tìm kiếm theo tên/email; nhập đúng **12 số CCCD** sẽ tra cứu bằng blind index
  (không giải mã toàn bộ bảng).
- Lọc theo trạng thái và chiến dịch; bộ lọc lưu trên URL nên có thể chia sẻ/refresh.
- Ô tìm kiếm debounce 350ms; tối đa 200 dòng mỗi lần tải.

## 3. `processCccdOcr(formData)` — `src/actions/ocr.ts`

Các bước:

1. Kiểm tra phiên đăng nhập và role `ORGANIZER`.
2. Validate file: bắt buộc, không rỗng, tối đa 5MB, MIME là ảnh.
3. Chờ 1 giây để giả lập gọi Google Cloud Vision API.
4. Trả về CCCD mẫu `001203004567` (trùng tài khoản student trong seed).
5. Tính blind index HMAC-SHA256 và tìm `User.cccdHash` — không lưu/không trả CCCD plaintext.
6. Chọn hồ sơ `APPROVED` của user trong chiến dịch đang chọn.
7. Trong transaction Serializable: đổi `status` sang `CHECKED_IN`, ghi `checkInTime`.
8. Ghi `AuditLog` action `OCR_CHECK_IN` (chỉ lưu 4 số cuối CCCD).

Kết quả trả về theo cấu trúc:

```json
{
  "success": true,
  "code": "CHECKED_IN",
  "message": "Đã check-in thành công cho Nguyễn Văn Sinh Viên.",
  "data": {
    "registrationId": "...",
    "studentName": "...",
    "studentEmail": "...",
    "cccdMasked": "001203******67",
    "campaignId": "...",
    "campaignName": "...",
    "status": "CHECKED_IN",
    "checkInTime": "..."
  }
}
```

Các mã lỗi chính: `UNAUTHENTICATED`, `FORBIDDEN`, `FILE_REQUIRED`, `FILE_TOO_LARGE`,
`INVALID_FILE_TYPE`, `CCCD_NOT_FOUND`, `REGISTRATION_NOT_FOUND`,
`REGISTRATION_NOT_APPROVED`, `ALREADY_CHECKED_IN`, `REGISTRATION_BLOCKED`, `CONFLICT`.

## 4. Kiểm thử thủ công

Điều kiện: đã chạy `docker compose up -d`, `npm run db:migrate`, `npm run db:seed`.

1. Đăng nhập `student@due.edu.vn / DUE@12345`, đăng ký chiến dịch mẫu để có hồ sơ
   `APPROVED`.
2. Đăng xuất, đăng nhập `organizer@due.edu.vn / DUE@12345`.
3. Vào `/organizer/check-in`:
   - Bảng hiển thị hồ sơ của chiến dịch gần nhất (do seed đặt ngày trong tương lai).
   - Thử tìm theo tên/email, nhập `001203004567`, lọc theo trạng thái.
4. Ở panel phải, chọn một ảnh bất kỳ (JPG/PNG), bấm **Check-in bằng CCCD**.
5. Sau 1 giây, hồ sơ chuyển sang `CHECKED_IN`; bảng tự làm mới; thông báo hiển thị tên,
   email, CCCD đã che và thời gian check-in.
6. Upload lại lần nữa → nhận thông báo "Hồ sơ này đã được check-in trước đó."
7. Kiểm tra `AuditLog` có action `OCR_CHECK_IN`.

## 5. Lưu ý bảo mật

- Chỉ role `ORGANIZER` được gọi action; kiểm tra ở server, không tin client.
- CCCD không bao giờ ghi log/audit dạng plaintext; UI chỉ hiển thị bản che.
- File được kiểm tra kích thước/MIME trước khi xử lý.
- Transaction Serializable + kiểm tra lại trạng thái trước khi update, tránh check-in trùng
  khi hai người thao tác đồng thời.
- OCR hiện là mock; khi tích hợp thật cần thay `processCccdOcr` bằng Google Vision/FPT.AI
  và giữ nguyên bước matching blind index + audit.
