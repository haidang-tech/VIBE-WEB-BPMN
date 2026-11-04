# Flow Ban tổ chức — Check-in & OCR CCCD (Prompt 5)

Kết quả **Prompt 5**: màn hình check-in cho Ban tổ chức, bảng hồ sơ có tìm kiếm/lọc và
luồng quét ảnh CCCD bằng OCR để chuyển hồ sơ sang `CHECKED_IN`.

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
    ocr.ts                   # Server Action đối chiếu CCCD + check-in
  components/
    CccdUploader.tsx         # Camera/tải ảnh, OCR, gọi processCccdOcr
    CheckInToolbar.tsx       # Tìm kiếm debounce + lọc trạng thái/chiến dịch
    ui/table.tsx             # Shadcn Table primitives
  lib/
    cccd-ocr.ts              # Tesseract worker + tiền xử lý ảnh
    cccd-ocr-parse.ts        # Trích xuất/xếp hạng ứng viên 12 chữ số
public/
  tesseract/                 # worker.min.js, core WASM, eng.traineddata.gz
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

1. Kiểm tra phiên đăng nhập và role `ORGANIZER` hoặc `MEDICAL`.
2. Validate file: bắt buộc, không rỗng, tối đa 5MB, MIME là ảnh.
3. Đọc dữ liệu client gửi lên:
   - `cccd`: số nhập tay (ưu tiên tuyệt đối), hoặc
   - `cccdCandidates`: mảng JSON các số OCR nhận diện được, đã xếp hạng.
4. Validate từng số đúng 12 chữ số; nếu không có số nào trả `INVALID_CCCD`.
5. Tính blind index HMAC-SHA256 và tìm `User.cccdHash` — không lưu/không trả CCCD plaintext.
6. Với nhiều ứng viên OCR: chỉ chấp nhận khi tất cả ứng viên khớp **cùng một sinh viên**.
   Nếu khớp từ hai sinh viên khác nhau trả `AMBIGUOUS_CCCD` và không check-in ai.
7. Chọn hồ sơ `APPROVED` của user trong chiến dịch đang chọn.
8. Trong transaction Serializable: đổi `status` sang `CHECKED_IN`, ghi `checkInTime`.
9. Ghi `AuditLog` action `OCR_CHECK_IN` (`method: "OCR"`, `source`, 4 số cuối CCCD).

`source` nhận một trong các giá trị: `CAMERA_AUTO`, `CAMERA_MANUAL`, `UPLOAD`.

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

Các mã lỗi chính: `UNAUTHENTICATED`, `FORBIDDEN`, `FILE_REQUIRED`, `FILE_EMPTY`,
`FILE_TOO_LARGE`, `INVALID_FILE_TYPE`, `INVALID_CCCD`, `INVALID_CAMPAIGN`,
`CAMPAIGN_NOT_FOUND`, `CCCD_NOT_FOUND`, `REGISTRATION_NOT_FOUND`,
`REGISTRATION_NOT_APPROVED`, `ALREADY_CHECKED_IN`, `REGISTRATION_BLOCKED`,
`AMBIGUOUS_CCCD`, `CONFLICT`.

## 4. Nhận diện CCCD bằng OCR

- Client dùng `tesseract.js` (chạy trong Web Worker) để đọc vùng số CCCD in trên
  mặt trước thẻ. Camera được yêu cầu độ phân giải `1920×1080`; ảnh được phóng
  to/thu nhỏ và chuyển xám, kéo giãn tương phản trước khi OCR.
- Lượt quét toàn ảnh dùng PSM `SPARSE_TEXT`. Tesseract trả về từng dòng/từ;
  `cccd-ocr-parse.ts` gom các nhóm số liền kề (ví dụ `001 210 007 890`) thành
  ứng viên 12 chữ số, rồi xếp hạng theo độ tin cậy, nguồn (một từ / ghép từ),
  nhãn `Số / No.` và mã tỉnh hợp lệ.
- Nếu lượt quét toàn ảnh đọc được nhãn `Số / No.`, hệ thống xác định vị trí nhãn
  rồi crop vùng số ngay bên phải (mở rộng thêm để không cắt mất chữ số đầu/cuối),
  phóng to và OCR lại với `tessedit_char_whitelist = "0123456789"` ở PSM
  `SINGLE_LINE`, dự phòng `SINGLE_BLOCK`. Đây là bước quyết định khi ảnh camera
  nhỏ hoặc hơi mờ. Ứng viên từ vùng crop được xếp trước ứng viên toàn ảnh.
- Tham số Tesseract được giữ giữa các lần gọi, nên mỗi lượt luôn đặt lại
  `tessedit_char_whitelist` (kể cả về chuỗi rỗng) trước khi quét toàn ảnh.
- Client gửi tối đa 5 ứng viên lên server. Server chỉ check-in khi các ứng viên
  khớp duy nhất một sinh viên; nếu không chắc chắn, trả lỗi và không check-in.
- Bộ nhận diện nằm trong `public/tesseract/` nên không phụ thuộc CDN. Lần quét
  đầu tải worker + core WASM + `eng.traineddata.gz` (khoảng 7MB); các lần sau
  dùng lại worker/cache.
- Nếu OCR không đọc được (ảnh mờ, lóa, thẻ bị che, hoặc ảnh quá nhỏ), người dùng
  nhập tay 12 số in trên thẻ. Không có trường hợp hệ thống tự chọn một hồ sơ bất kỳ.
  Thực nghiệm với ảnh mô phỏng camera cho thấy pipeline đọc đúng khi thẻ rộng từ
  khoảng 480px trở lên; dưới ngưỡng đó (400px, 360px) chữ số mất quá nhiều chi
  tiết nên cần chụp gần hơn hoặc nhập tay.

## 5. Kiểm thử thủ công

Điều kiện: đã chạy `docker compose up -d`, `npm run db:migrate`, `npm run db:seed`.

1. Đăng nhập `student@due.edu.vn / DUE@12345`, đăng ký chiến dịch mẫu để có hồ sơ
   `APPROVED`.
2. Đăng xuất, đăng nhập `organizer@due.edu.vn / DUE@12345` (hoặc
   `medical@due.edu.vn / DUE@12345`).
3. Vào `/organizer/check-in` hoặc `/medical/scan-id`:
   - Bảng hiển thị hồ sơ của chiến dịch gần nhất (do seed đặt ngày trong tương lai).
   - Thử tìm theo tên/email, nhập `001203004567`, lọc theo trạng thái.
4. Ở panel quét:
   - Bật camera, đưa mặt trước CCCD vào khung hình sao cho phần số CCCD rõ nét;
     hệ thống tự nhận diện 12 số trên thẻ rồi check-in.
   - Hoặc tải ảnh CCCD rõ phần số.
   - Nếu ảnh mờ/không nhận diện được, nhập tay 12 số CCCD rồi bấm
     **Check-in bằng CCCD**.
5. Hồ sơ chuyển sang `CHECKED_IN`; bảng tự làm mới; thông báo hiển thị tên, email,
   CCCD đã che và thời gian check-in.
6. Quét lại cùng một thẻ → nhận thông báo "Hồ sơ này đã được check-in trước đó."
7. Quét một CCCD không có trong DB → nhận `CCCD_NOT_FOUND`, không ai bị check-in.
8. Kiểm tra `AuditLog` có action `OCR_CHECK_IN` kèm `method = "OCR"` và `source`.

## 6. Lưu ý bảo mật

- Chỉ role `ORGANIZER` và `MEDICAL` được gọi action; kiểm tra ở server, không tin client.
- Server không tự chọn hồ sơ để check-in; số CCCD phải do client gửi lên từ OCR/nhập tay.
- Với nhiều ứng viên OCR, server từ chối nếu chúng khớp nhiều sinh viên khác nhau.
- CCCD không bao giờ ghi log/audit dạng plaintext; UI chỉ hiển thị bản che.
- File được kiểm tra kích thước/MIME trước khi xử lý.
- Transaction Serializable + kiểm tra lại trạng thái trước khi update, tránh check-in trùng
  khi hai người thao tác đồng thời.
- OCR chạy hoàn toàn trên client; ảnh vẫn được gửi kèm Server Action để giữ validate
  file và có thể thay bằng OCR server (Google Vision/FPT.AI) sau này mà không đổi
  bước matching blind index + audit.
