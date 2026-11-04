# Bản thiết kế & Kịch bản Vibe Code: Hệ thống hiến máu cho sinh viên DUE (Bản chuẩn bảo mật & nghiệp vụ)

Tài liệu này đóng vai trò là blueprint dành riêng cho Opencode CLI, giúp tự động hóa quá trình xây dựng dự án "Hệ thống hiến máu cho sinh viên DUE". Bản thiết kế đã khắc phục toàn bộ các lỗi nghiêm trọng về bảo mật dữ liệu PII, chuẩn hóa ENUM trạng thái, ràng buộc cổng XOR và thiết lập cấu trúc thư mục App Router tối ưu.

## 1. Tech Stack Đề Xuất

- **Framework:** Next.js 14+ (App Router, sử dụng cấu trúc thư mục `src/app`).
- **UI/UX (Vibe):** Tailwind CSS + Shadcn UI + Framer Motion.
- **Database & ORM:** PostgreSQL kết hợp Prisma ORM (sử dụng Prisma ENUM để kiểm soát toàn bộ vòng đời trạng thái).
- **Validation:** Zod (Validation đồng bộ ở cả Client Components và Server Actions).
- **External API:** Google Cloud Vision API / FPT.AI (Mock function để OCR quét CCCD) & Resend (Gửi Email thông báo).

## 2. Kiến trúc Hệ thống, Routing & 3 Cổng XOR

**Cấu trúc Routing (Next.js App Router đặt tại `src/app/`):**

- `(auth)/login`
- `(roles)/student`: `/register`, `/tracking`
- `(roles)/organizer`: `/dashboard`, `/check-in`
- `(roles)/medical`: `/scan-id`, `/health-check`, `/blood-status`
- `(roles)/admin`: `/users`, `/campaigns`, `/settings`, `/reports`, `/audit-logs`

**Vị trí 3 cổng XOR (Business Logic):**

1. **XOR 1 (Trước form): Đủ điều kiện tạo hồ sơ mới không?**
   - _Logic:_ Truy vấn DB kiểm tra xem sinh viên có đơn đăng ký nào ở chiến dịch này mang trạng thái `PENDING`, `APPROVED`, hoặc `COMPLETED` không. Nếu CÓ -> chặn và chuyển đến `/tracking`. Nếu KHÔNG (chưa đăng ký hoặc từng bị `REJECTED`) -> cho phép đăng ký mới.
2. **XOR 2 (Xử lý form): Hồ sơ cơ bản có đạt không?**
   - _Logic:_ Server Action kiểm tra điều kiện: Tuổi >= 18 XOR Cân nặng >= 45kg? Nếu Đạt -> Lưu trạng thái `APPROVED`. Nếu Không -> Lưu trạng thái `REJECTED`.
3. **XOR 3 (Tại quầy y tế): Sức khỏe lâm sàng có đạt không?**
   - _Logic:_ Kiểm tra chỉ số lâm sàng: Huyết áp ổn định XOR Nhịp tim bình thường? Đạt -> Cập nhật trạng thái `ELIGIBLE`, chuyển vào bàn lấy máu. Không đạt -> Cập nhật `HEALTH_CHECK_FAILED`.

---

## 3. Kịch bản "Vibe Code" bằng Opencode CLI (Trọng tâm)

Copy & Paste từng prompt dưới đây vào Opencode CLI theo đúng thứ tự.

### Prompt 1: Database Schema & Migration (Có ENUM & Mã hóa CCCD)

> "Tạo file `prisma/schema.prisma` cho CSDL PostgreSQL.
>
> 1. Định nghĩa ENUM `Role` (STUDENT, ORGANIZER, MEDICAL, ADMIN) và ENUM `RegStatus` (PENDING, APPROVED, REJECTED, CHECKED_IN, ELIGIBLE, HEALTH_CHECK_FAILED, COMPLETED).
> 2. Bảng `User`: id, name, email, password, role, cccd (lưu ý: cccd sẽ được mã hóa tại Server trước khi lưu để bảo mật PII).
> 3. Bảng `Campaign`: id, name, date, location, capacity (chỉ tiêu), overbookRate (tỷ lệ overbook), status.
> 4. Bảng `Registration`: id, userId, campaignId, status (kiểu RegStatus), checkInTime.
> 5. Bảng `HealthCheck`: id, registrationId, bloodPressure, heartRate, weight, bloodType, bloodVolume (250/350), isPassed, medicalStaffId.
> 6. Bảng `AuditLog`: id, action, userId, details, timestamp.
>    Viết script chạy migration và generate Prisma client."

### Prompt 2: Setup Backend Auth, RBAC & Validation Library

> "Thực hiện 3 việc:
>
> 1. Tạo file `src/lib/validations.ts` chứa các Zod schema chuẩn cho Login, Đăng ký hiến máu, và Khám sức khỏe.
> 2. Viết API Route `src/app/api/auth/login/route.ts`: nhận email/password, so sánh hash bcrypt, tạo JWT lưu trong `HTTPOnly`, `Secure` Cookie.
> 3. Viết Middleware `src/middleware.ts` kiểm tra JWT hợp lệ và thực hiện RBAC: Sinh viên chỉ vào `/student`, Admin vào `/admin`... Sai quyền trả 403. Gắn kèm Audit Log helper để ghi lịch sử truy cập."

### Prompt 3: Cổng XOR Validation Server Actions (Xử lý nghiệp vụ cốt lõi)

> "Tạo file `src/actions/blood-donation.ts` chứa 3 Server Actions xử lý cổng XOR:
>
> 1. `checkCanRegister(userId, campaignId)`: Đọc DB, chặn đăng ký nếu tồn tại record có status là PENDING/APPROVED/COMPLETED, đồng thời kiểm tra giới hạn `capacity` \* `overbookRate` của Campaign.
> 2. `validateProfile(data)`: Validate dữ liệu qua Zod, kiểm tra logic Tuổi >= 18 XOR Cân nặng >= 45kg.
> 3. `evaluateHealth(data)`: Nhận chỉ số y tế, thuật toán trả về kết quả hợp lệ XOR không hợp lệ.
>    Tất cả các hàm phải bọc trong try/catch và trả về chuẩn cấu trúc `{success: boolean, message: string}`."

### Prompt 4: Flow Sinh viên (Form Đăng ký & Tracking UI)

> "Sử dụng Tailwind CSS và Shadcn UI, sinh code cho:
>
> 1. `src/components/RegistrationForm.tsx`: UI form đẹp mắt kết nối với `validateProfile` (Prompt 3) và Zod. Bắt lỗi hiển thị realtime.
> 2. `src/app/(roles)/student/tracking/page.tsx`: Dùng Framer Motion tạo một Stepper component hiển thị tiến độ (Đăng ký -> Duyệt -> Check-in -> Khám -> Hoàn thành) bám sát theo ENUM `RegStatus` trong DB."

### Prompt 5: Flow Ban tổ chức (Dashboard Check-in & Mock OCR)

> "Triển khai màn hình Check-in:
>
> 1. `src/app/(roles)/organizer/check-in/page.tsx`: Layout chứa Shadcn Table hiển thị danh sách Registration hôm nay, có tìm kiếm và lọc.
> 2. Tạo UI upload ảnh CCCD. Viết Server Action `src/actions/ocr.ts` giả lập (mock) việc gọi Google Vision API: Nhận file, trả về chuỗi CCCD mẫu sau 1 giây, tự động matching với DB `User` và đổi status sang `CHECKED_IN`."

### Prompt 6: Flow Nhân viên Y tế (Nhập liệu Y tế & Trạng thái hiến máu)

> "Tạo màn hình thao tác nhanh cho Y tế:
>
> 1. `src/app/(roles)/medical/health-check/page.tsx`: UI điền chỉ số (Huyết áp, nhịp tim, cân nặng, nhóm máu, lượng máu hiến). Nút Submit gọi hàm `evaluateHealth` (XOR 3).
> 2. Giao diện chốt kết quả: Nếu sức khỏe Đạt, hiển thị 2 nút bấm lớn (Thành công - màu xanh / Thất bại do sự cố - màu đỏ). Update trạng thái tương ứng vào DB và ghi AuditLog."

### Prompt 7: Flow Admin (Quản lý Campaign, Overbook & Charts)

> "Xây dựng phân hệ quản trị Admin:
>
> 1. UI CRUD Campaign (`src/app/(roles)/admin/campaigns/page.tsx`): Có trường nhập liệu cho `capacity` và `overbookRate`.
> 2. Dashboard Thống kê (`src/app/(roles)/admin/reports/page.tsx`): Dùng `recharts` vẽ Biểu đồ tròn (Phân bố Nhóm máu A, B, O, AB) và Biểu đồ cột (Số lượng máu thu được từng chiến dịch). Lấy data từ Prisma."

### Prompt 8: Unit Test & Checklist Bảo mật (Báo cáo)

> "Cài đặt môi trường Jest. Viết 1 file test `src/__tests__/xorLogic.test.ts` để kiểm thử tự động 3 Server Actions ở Prompt 3 (Kiểm tra chặn đăng ký trùng, rẽ nhánh đúng tuổi/cân nặng). Output file hướng dẫn cài đặt Jest trong Next.js App Router để chạy minh chứng báo cáo."

### Prompt 9: Khởi tạo Dữ liệu Ảo (Database Seeding)

> "Triển khai tính năng Đăng ký tài khoản mới cho sinh viên:
>
> - Thêm `registerSchema` vào `src/lib/validations.ts` sử dụng Zod để validate: Tên, Email (bắt buộc đúng định dạng), Mật khẩu (tối thiểu 8 ký tự) và Xác nhận mật khẩu.
> - Xây dựng giao diện `src/app/(auth)/register/page.tsx` sử dụng Tailwind CSS và Shadcn UI. Form cần giữ thiết kế tối màu (dark theme), bắt lỗi realtime từ Zod và có nút chuyển hướng nhanh sang trang Login.
> - Viết Server Action hoặc API Route (`src/app/api/auth/register/route.ts`): Nhận dữ liệu từ form, kiểm tra xem Email đã tồn tại trong DB chưa. Nếu chưa, sử dụng `bcrypt` để hash mật khẩu và tạo bản ghi mới vào bảng `User` với trường `role` được gán mặc định là `STUDENT`.
> - Xử lý UI/UX: Hiển thị trạng thái loading khi đang submit, dùng Toast notification thông báo thành công và tự động redirect người dùng về trang `/login`."
