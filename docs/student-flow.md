# Flow Sinh viên — Đăng ký & Tracking (Prompt 4 + Prompt 11)

Kết quả **Prompt 4**: form đăng ký hiến máu có kiểm tra realtime, trang theo dõi tiến độ
dùng Framer Motion và Stepper bám sát vòng đời `RegStatus`.

Kết quả **Prompt 11**: form đăng ký được nâng cấp thành hồ sơ y tế chuẩn 3 bước, bổ sung
thông tin sinh viên, chỉ số thể trạng, khảo sát tiền sử sức khỏe, chọn khung giờ và cam
kết khai báo trung thực.

## 1. Cấu trúc file

```
src/
  app/(roles)/student/
    layout.tsx                 # Khung trang sinh viên + header/footer
    student-nav.tsx            # Điều hướng Đăng ký / Theo dõi
    page.tsx                   # Redirect /student -> /student/register
    register/page.tsx          # Server Component: nạp campaign + hồ sơ + defaults
    tracking/page.tsx          # Server Component: danh sách hồ sơ + chi tiết
  components/
    RegistrationForm.tsx       # Client Component: wizard 3 bước + validateProfile
    TrackingStepper.tsx        # Client Component: Stepper Framer Motion
    RefreshButton.tsx          # Làm mới dữ liệu tracking
    LogoutButton.tsx           # Đăng xuất
    ui/                        # Primitives kiểu Shadcn UI
  lib/
    validations.ts             # Zod schemas + DONATION_SLOTS dùng chung
    registration-status.ts     # Map RegStatus -> nhãn, màu, bước trên Stepper
prisma/
  schema.prisma                # Enum Gender + cột mới trên User/Registration
  migrations/20261104000000_student_registration_form/
```

## 2. Form đăng ký 3 bước (`RegistrationForm.tsx`)

Form dùng `react-hook-form` + `zodResolver(donationRegistrationSchema)` với
`mode: "onChange"`, chia thành 3 bước:

| Bước | Nội dung | Trường |
| --- | --- | --- |
| 1 | Thông tin cá nhân | Họ tên, MSSV, lớp, khoa, ngày sinh, giới tính, SĐT, email sinh viên, CCCD/CMND |
| 2 | Tiền sử sức khỏe | Cân nặng, chiều cao, nhóm máu (tùy chọn), ngày hiến gần nhất (tùy chọn), 3 câu hỏi Yes/No |
| 3 | Lịch trình & xác nhận | Chiến dịch, nhiều khung giờ mong muốn, ghi chú, checkbox cam kết |

### Điều hướng & validate

- Nút **Tiếp tục** chỉ chuyển bước khi các trường của bước hiện tại hợp lệ
  (`trigger(STEP_FIELDS[step])`). Nếu sai, hiển thị toast và giữ nguyên bước.
- Nếu submit thất bại, `onInvalid` tìm trường lỗi đầu tiên và nhảy về đúng bước chứa nó.
- Lỗi từ server được map vào đúng field qua `setError`, có `aria-invalid` và
  `aria-describedby` cho trình đọc màn hình.
- Email gắn với tài khoản nên chỉ đọc; CCCD đã lưu được giải mã ở server và cũng chỉ đọc.
- MSSV lưu ở `User.studentCode` (unique); email bắt buộc đuôi `@due.edu.vn`.

### Quy tắc validate chính (`lib/validations.ts`)

- `studentCodeSchema`: 6–12 chữ cái/số, tự bỏ khoảng trắng và chuyển hoa.
- `phoneSchema`: `0xxxxxxxxx` hoặc `+84xxxxxxxxx` (10–11 số sau khi chuẩn hóa).
- `cccdSchema`: đúng 12 chữ số, tự bỏ khoảng trắng/gạch/dấu chấm.
- `studentEmailSchema`: email hợp lệ + bắt buộc đuôi `@due.edu.vn`.
- `dateOfBirthSchema`: ngày trong quá khứ, tuổi 0–120.
- `optionalPastDateSchema`: ngày hiến gần nhất có thể bỏ trống, không được ở tương lai.
- `donationSlotSchema`: một trong 7 khung giờ cố định trong `DONATION_SLOTS`.
- `donationSlotListSchema`: mảng 1–7 khung giờ, chuẩn hóa theo thứ tự thời gian và
  loại trùng; dùng cho `preferredSlots`.
- `genderSchema`: `MALE | FEMALE | OTHER`.
- `yesNoSchema`: `YES | NO` (lưu DB dưới dạng boolean).
- `commitment`: bắt buộc `true` (cam kết khai báo trung thực).

### Cảnh báo & preview

- Cân nặng < 45kg hiển thị Alert cảnh báo nhưng vẫn cho gửi hồ sơ.
- Khối "Kiểm tra điều kiện sơ bộ" cập nhật realtime theo `evaluateProfileRules`
  (tuổi ≥ 18 và cân nặng ≥ 45kg). Server là nơi quyết định cuối cùng.
- Nếu có câu trả lời sức khỏe là `YES`, bước 3 hiển thị cảnh báo để nhân viên y tế lưu ý.

### Submit & phản hồi

- Nút gửi có trạng thái loading (`Loader2` + "Đang gửi hồ sơ...").
- Thành công: toast "Đăng ký thành công" kèm khung giờ được phân, sau ~1.4s chuyển tới
  `/student/tracking?registrationId=...`.

### Cân bằng khung giờ

- Sinh viên chọn một hoặc nhiều khung giờ (`preferredSlots`).
- Trong transaction, server đếm số hồ sơ đang chiếm chỗ theo từng khung của chiến dịch
  rồi phân vào khung ít đông nhất; nếu bằng nhau thì ưu tiên khung sớm hơn.
- Hàm thuần: `pickLeastCrowdedSlot` trong `lib/donation-rules.ts`.
- `PROFILE_REJECTED` → Alert cảnh báo kèm lý do, vẫn có nút xem tiến độ.
- `ALREADY_REGISTERED` / `CAMPAIGN_FULL` / `STUDENT_CODE_IN_USE` / lỗi validate →
  Alert + toast tương ứng.
- Trang `register/page.tsx` chặn trước ở tầng UI (XOR 1): campaign đã có hồ sơ đang hoạt
  động hoặc hết suất bị disable; nếu không còn campaign hợp lệ thì nút gửi bị vô hiệu hóa.

## 3. Lưu trữ dữ liệu (Prompt 11)

Dữ liệu được lưu ở hai nơi:

- **`User`** — hồ sơ sinh viên dùng lại cho các lần đăng ký sau:
  `studentCode` (unique), `className`, `faculty`, `dateOfBirth`, `gender`,
  `phone`, `bloodType`, `lastDonationDate`.
- **`Registration`** — snapshot tại thời điểm đăng ký:
  `weightKg`, `heightCm`, `preferredSlots` (các khung sinh viên chọn), `slotTime`
  (khung hệ thống phân), `usedAntibiotics`, `recentTattooOrSurgery`,
  `infectiousDiseaseHistory`, `healthDeclarationConfirmed`, `note`.

Migration `20261104000000_student_registration_form` thêm enum `Gender`, các cột trên và
ràng buộc `CHECK` cho `weightKg` (30–250) và `heightCm` (100–250).

CCCD vẫn được mã hóa AES-256-GCM (`cccdCiphertext` / `cccdIv` / `cccdAuthTag`) kèm blind
index `cccdHash`; không lưu plaintext.

## 4. `tracking/page.tsx` + `TrackingStepper.tsx`

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

## 5. Kiểm thử thủ công

1. Đăng nhập bằng tài khoản `STUDENT`.
2. Vào `/student/register`, hoàn thành bước 1 với MSSV/SĐT/CCCD sai định dạng → lỗi hiện ngay.
3. Bước 2:
   - Cân nặng 40kg → Alert cảnh báo dưới 45kg, preview "Chưa đủ điều kiện".
   - 20 tuổi, 50kg → preview "Đủ điều kiện".
   - Trả lời `Có` ở câu hỏi sức khỏe → bước 3 hiện cảnh báo.
4. Bước 3: chọn khung giờ, tick cam kết → gửi.
5. Gửi hồ sơ đủ điều kiện → toast "Đăng ký thành công", chuyển tới trang tracking.
6. Gửi hồ sơ không đủ điều kiện → hồ sơ `REJECTED`, Stepper đánh dấu bước Duyệt thất bại.
7. Đăng ký lại cùng campaign khi hồ sơ đang hoạt động → campaign bị khóa, server trả
   `ALREADY_REGISTERED` nếu cố tình gửi.
8. Dùng MSSV của tài khoản khác → server trả `STUDENT_CODE_IN_USE`.
9. Mở `/student/tracking` khi chưa có hồ sơ → màn hình trống có nút đăng ký.

## 6. Thư viện UI đã bổ sung

`tailwindcss`, `@tailwindcss/postcss`, `postcss`, `class-variance-authority`, `clsx`,
`tailwind-merge`, `lucide-react`, `framer-motion`, `react-hook-form`, `@hookform/resolvers`,
`@radix-ui/react-slot`, `@radix-ui/react-label`.

Tailwind được nạp qua `src/app/globals.css`; `src/app/layout.tsx` dùng theme tối mặc định.
