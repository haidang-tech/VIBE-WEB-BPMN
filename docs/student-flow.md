# Flow Sinh viên — Đăng ký & Tracking (Prompt 4)

Kết quả **Prompt 4**: form đăng ký hiến máu có kiểm tra realtime, trang theo dõi tiến độ
dùng Framer Motion và Stepper bám sát vòng đời `RegStatus`.

## 1. Cấu trúc file

```
src/
  app/(roles)/student/
    layout.tsx                 # Khung trang sinh viên + header/footer
    student-nav.tsx            # Điều hướng Đăng ký / Theo dõi
    page.tsx                   # Redirect /student -> /student/register
    register/page.tsx          # Server Component: nạp campaign + hồ sơ đang hoạt động
    tracking/page.tsx          # Server Component: danh sách hồ sơ + chi tiết
  components/
    RegistrationForm.tsx       # Client Component: form + validateProfile
    TrackingStepper.tsx        # Client Component: Stepper Framer Motion
    RefreshButton.tsx          # Làm mới dữ liệu tracking
    LogoutButton.tsx           # Đăng xuất
    ui/                        # Primitives kiểu Shadcn UI
  lib/
    registration-status.ts     # Map RegStatus -> nhãn, màu, bước trên Stepper
```

## 2. `RegistrationForm.tsx`

- Dùng `react-hook-form` + `zodResolver(donationRegistrationSchema)` với `mode: "onChange"`
  để lỗi hiển thị ngay khi người dùng nhập.
- Trường bắt buộc: chiến dịch, họ tên, email, CCCD, ngày sinh, cân nặng.
  Chiều cao, số điện thoại và ghi chú là tùy chọn.
- Email gắn với tài khoản nên chỉ đọc. CCCD đã lưu được giải mã ở server và cũng chỉ đọc.
- Khối "Kiểm tra điều kiện sơ bộ" cập nhật realtime theo `evaluateProfileRules`
  (tuổi ≥ 18 và cân nặng ≥ 45kg). Đây chỉ là preview; server là nơi quyết định.
- Khi submit, form gọi Server Action `validateProfile` (XOR 2):
  - `PROFILE_APPROVED` → chuyển tới `/student/tracking?registrationId=...`.
  - `PROFILE_REJECTED` → hiển thị cảnh báo kèm lý do, vẫn có nút xem tiến độ.
  - `ALREADY_REGISTERED` / `CAMPAIGN_FULL` / lỗi validate → hiển thị Alert tương ứng.
- Lỗi trả về từ server được map vào đúng field qua `setError`, có `aria-invalid` và
  `aria-describedby` cho trình đọc màn hình.
- Trang `register/page.tsx` chặn trước ở tầng UI (XOR 1): campaign đã có hồ sơ đang hoạt
  động hoặc hết suất sẽ bị disable trong select; nếu không còn campaign hợp lệ thì nút
  gửi bị vô hiệu hóa.

## 3. `tracking/page.tsx` + `TrackingStepper.tsx`

Trang tracking lấy toàn bộ hồ sơ của sinh viên đang đăng nhập, sắp xếp mới nhất trước.
Người dùng chọn hồ sơ ở cột trái (query `?registrationId=`), chi tiết hiển thị ở cột phải.

Stepper gồm 5 bước cố định:

```
Đăng ký → Duyệt → Check-in → Khám → Hoàn thành
```

Mỗi `RegStatus` được map trong `lib/registration-status.ts`:

| RegStatus | Bước hiển thị | Ý nghĩa |
| --- | --- | --- |
| `PENDING` | Đang ở bước Duyệt | Chờ ban tổ chức duyệt |
| `APPROVED` | Đang ở bước Check-in | Đã duyệt điều kiện sơ bộ |
| `REJECTED` | Bước Duyệt bị đánh dấu thất bại | Không đạt tuổi/cân nặng |
| `CHECKED_IN` | Đang ở bước Khám | Đã xác nhận danh tính |
| `ELIGIBLE` | Đang ở bước Hoàn thành | Sức khỏe đạt, chờ lấy máu |
| `HEALTH_CHECK_FAILED` | Bước Khám bị đánh dấu thất bại | Chỉ số lâm sàng không đạt |
| `COMPLETED` | Hoàn tất cả 5 bước | Đã hiến máu xong |

Hiệu ứng Framer Motion:

- Đường tiến độ chạy dần (`width` animation) tới bước hiện tại.
- Từng vòng tròn bước xuất hiện lần lượt bằng spring.
- Bước hiện tại có vòng `animate-ping`.
- Khối mô tả trạng thái chuyển màu theo tone: thành công, đang chờ hoặc thất bại.
- Tôn trọng `prefers-reduced-motion` qua `useReducedMotion()`.

Ngoài Stepper, trang còn hiển thị thông tin hồ sơ (mã, ngày đăng ký, check-in) và kết quả
khám sức khỏe (huyết áp, nhịp tim, cân nặng, nhóm máu, lượng máu) khi đã có dữ liệu.

## 4. Kiểm thử thủ công

1. Đăng nhập bằng tài khoản `STUDENT`.
2. Vào `/student/register`, chọn campaign và nhập ngày sinh/cân nặng:
   - 17 tuổi hoặc 40kg → preview báo "Chưa đủ điều kiện".
   - 20 tuổi, 50kg → preview báo "Đủ điều kiện".
3. Gửi hồ sơ đủ điều kiện → được chuyển tới trang tracking, Stepper ở bước Duyệt/Check-in.
4. Gửi hồ sơ không đủ điều kiện → hồ sơ `REJECTED`, Stepper đánh dấu bước Duyệt thất bại.
5. Đăng ký lại cùng campaign khi hồ sơ đang `PENDING/APPROVED/COMPLETED` → campaign bị khóa,
   server trả `ALREADY_REGISTERED` nếu cố tình gửi.
6. Mở `/student/tracking` khi chưa có hồ sơ → màn hình trống có nút đăng ký.

## 5. Thư viện UI đã bổ sung

`tailwindcss`, `@tailwindcss/postcss`, `postcss`, `class-variance-authority`, `clsx`,
`tailwind-merge`, `lucide-react`, `framer-motion`, `react-hook-form`, `@hookform/resolvers`,
`@radix-ui/react-slot`, `@radix-ui/react-label`.

Tailwind được nạp qua `src/app/globals.css`; `src/app/layout.tsx` dùng theme tối mặc định.
