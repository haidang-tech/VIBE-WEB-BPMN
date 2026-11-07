# 🩸 Hệ thống hiến máu cho sinh viên DUE

Nền tảng quản lý quy trình hiến máu dành cho sinh viên **Trường Đại học Kinh tế – ĐHĐN (DUE)**.
Dự án số hoá toàn bộ hành trình từ đăng ký, duyệt hồ sơ, check-in, khám sàng lọc đến chốt ca hiến máu,
với 4 vai trò riêng biệt và cơ chế bảo vệ dữ liệu cá nhân (PII) ngay từ tầng ứng dụng trước khi ghi xuống cơ sở dữ liệu.

<p>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" />
  <img alt="Jest" src="https://img.shields.io/badge/Jest-tested-C21325?logo=jest&logoColor=white" />
</p>

> **Điểm nhấn:** Next.js App Router + Server Actions, Prisma/PostgreSQL, OCR CCCD chạy local,
> JWT HttpOnly + RBAC, mã hoá CCCD bằng AES-256-GCM và blind index HMAC-SHA256.

---

## 📖 Mục lục

- [Giới thiệu](#-giới-thiệu)
- [Tính năng chính](#-tính-năng-chính)
- [Stack công nghệ](#-stack-công-nghệ)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [Cài đặt & chạy dự án](#-cài-đặt--chạy-dự-án)
- [Tài khoản demo](#-tài-khoản-demo)
- [Biến môi trường](#️-biến-môi-trường)
- [Luồng nghiệp vụ 3 cổng XOR](#-luồng-nghiệp-vụ-3-cổng-xor)
- [Phân quyền & routes](#-phân-quyền--routes)
- [Luồng chi tiết theo vai trò](#-luồng-chi-tiết-theo-vai-trò)
- [API & Server Actions](#-api--server-actions)
- [Mô hình dữ liệu](#️-mô-hình-dữ-liệu)
- [Bảo mật & quyền riêng tư](#-bảo-mật--quyền-riêng-tư)
- [Kiểm thử](#-kiểm-thử)
- [Triển khai](#️-triển-khai)
- [Xử lý sự cố thường gặp](#-xử-lý-sự-cố-thường-gặp)
- [Scripts](#-scripts)
- [Tài liệu](#-tài-liệu)
- [Đóng góp](#-đóng-góp)
- [Roadmap & giới hạn hiện tại](#-roadmap--giới-hạn-hiện-tại)

---

## 🌟 Giới thiệu

Mỗi chiến dịch hiến máu tại trường cần xử lý một lượng lớn sinh viên trong thời gian ngắn.
Nếu làm thủ công, các vấn đề thường gặp là:

- Đăng ký trùng, vượt chỉ tiêu, khung giờ quá tải.
- Hồ sơ giấy khó đối chiếu, dễ nhầm người khi check-in.
- Dữ liệu CCCD, thông tin sức khoẻ nhạy cảm bị lưu dạng văn bản thường.
- Khó theo dõi trạng thái và thống kê kết quả sau chiến dịch.

Hệ thống này giải quyết các vấn đề trên bằng một luồng duy nhất:

```text
Đăng ký → Duyệt hồ sơ → Check-in → Khám sàng lọc → Hiến máu → Báo cáo
```

Mỗi bước đều có kiểm tra trạng thái, người thao tác đúng vai trò và ghi nhật ký kiểm toán.

## ✨ Tính năng chính

### Theo vai trò

| Vai trò | Chức năng chính |
|---|---|
| **Sinh viên** | Đăng ký/đăng nhập, khai báo hồ sơ y tế, chọn khung giờ, theo dõi tiến trình hồ sơ |
| **Ban tổ chức** | Xem danh sách hồ sơ theo chiến dịch, tìm kiếm/lọc, check-in thủ công hoặc quét CCCD |
| **Nhân viên y tế** | Quét CCCD để tra hồ sơ, nhập chỉ số lâm sàng, chốt đạt/không đạt, xác nhận hiến máu |
| **Quản trị viên** | CRUD chiến dịch, theo dõi dashboard, xem báo cáo & biểu đồ thống kê |

### Điểm nổi bật

- **3 cổng kiểm soát (XOR)** chặn sai trạng thái và đăng ký trùng.
- **Phân bổ khung giờ** theo nguyện vọng và cân bằng tải giữa các slot.
- **OCR CCCD** ngay trên trình duyệt bằng Tesseract.js, server chỉ nhận các ứng viên số CCCD.
- **AI hỗ trợ sàng lọc** ghi chú sức khoẻ (tuỳ chọn), luôn có bộ quy tắc nội bộ làm fallback offline.
- **Mã hoá PII**: CCCD không bao giờ lưu plaintext; tìm kiếm qua blind index.
- **Audit log** cho đăng nhập, đăng xuất, đăng ký, check-in, khám, chốt ca và truy cập bị từ chối.
- **Giao diện** responsive, Light/Dark mode, toast, skeleton, confetti, tooltip.

## 🛠 Stack công nghệ

| Thành phần | Công nghệ / thư viện |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Ngôn ngữ | TypeScript 5 |
| Backend | Server Actions + Route Handlers |
| Database | PostgreSQL 16 + Prisma ORM 6 |
| UI | Tailwind CSS 4, shadcn/ui, Radix UI, Framer Motion, Lucide |
| Validation | Zod 4 (dùng chung client/server) |
| Xác thực | JWT HS256 (`jose`), `bcryptjs`, cookie HttpOnly |
| OCR | Tesseract.js (WASM + traineddata trong `public/tesseract/`) |
| AI (tuỳ chọn) | API tương thích OpenAI: OpenAI, Gemini, Ollama, Azure OpenAI... |
| Biểu đồ | Recharts |
| Test | Jest 29 + ts-jest |
| Deploy | Vercel + PostgreSQL managed (Neon, Supabase, Vercel Postgres...) |

## 🏗 Kiến trúc hệ thống

```mermaid
flowchart LR
    U[Trình duyệt] --> M[Next.js Middleware]
    M -->|JWT + RBAC| A[App Router / RSC]
    A --> SA[Server Actions]
    A --> RH[Route Handlers]
    SA --> L[Business Logic / lib]
    RH --> L
    L --> P[Prisma Client]
    P --> DB[(PostgreSQL)]
    SA --> OCR[Tesseract.js / OCR parser]
    L --> AI[AI API tùy chọn]
```

- **Middleware (Edge)** xác thực JWT, chặn route theo vai trò, chống header spoofing và ghi audit khi bị từ chối.
- **Server Components** truy vấn dữ liệu trực tiếp qua Prisma cho các trang danh sách/dashboard.
- **Server Actions** xử lý thao tác ghi: đăng ký, duyệt, check-in, khám, chốt ca, CRUD chiến dịch.
- **Route Handlers** phục vụ đăng nhập/đăng xuất/đăng ký và endpoint audit nội bộ.
- **`src/lib/`** chứa logic thuần, dễ test: quy tắc hiến máu, slot optimizer, OCR parser, AI screening, crypto...

## 📂 Cấu trúc thư mục

```text
Project/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Landing page công khai
│   │   ├── layout.tsx                  # Root layout
│   │   ├── globals.css                 # Tailwind + design tokens
│   │   ├── login/                      # Trang đăng nhập
│   │   ├── (auth)/register/            # Đăng ký tài khoản sinh viên
│   │   ├── (roles)/
│   │   │   ├── student/                # /student/register, /student/tracking
│   │   │   ├── organizer/              # /organizer/dashboard, /organizer/check-in
│   │   │   ├── medical/                # /medical/scan-id, /health-check, /blood-status
│   │   │   └── admin/                  # /admin/reports, /admin/campaigns
│   │   └── api/
│   │       ├── auth/login|logout|register/
│   │       └── internal/audit/
│   ├── actions/
│   │   ├── blood-donation.ts           # ⭐ 3 cổng XOR: đăng ký, duyệt, khám, chốt ca
│   │   ├── admin.ts                    # CRUD chiến dịch
│   │   ├── ocr.ts                      # OCR CCCD & check-in/tra cứu
│   │   └── ai.ts                       # Sàng lọc ghi chú bằng AI
│   ├── components/
│   │   ├── landing/                    # Hero, Navbar, Footer, BloodCardList...
│   │   ├── ui/                         # UI kit shadcn/ui
│   │   ├── RegistrationForm.tsx        # Form đăng ký hiến máu
│   │   ├── MedicalCheckPanel.tsx       # Panel khám & chốt kết quả
│   │   ├── CampaignManager.tsx         # Quản lý chiến dịch
│   │   ├── ReportsCharts.tsx           # Biểu đồ báo cáo
│   │   └── ...
│   ├── lib/
│   │   ├── donation-rules.ts           # ⭐ Quy tắc 3 cổng XOR (pure)
│   │   ├── slot-optimizer.ts           # Phân bổ khung giờ
│   │   ├── ai-screening.ts             # Rule nội bộ + LLM
│   │   ├── cccd-ocr.ts / cccd-ocr-parse.ts
│   │   ├── auth.ts / jwt.ts / rbac.ts / crypto.ts
│   │   ├── validations.ts              # Zod schemas dùng chung
│   │   ├── rate-limit.ts / audit.ts
│   │   ├── registration-status.ts / campaign-status.ts
│   │   └── prisma.ts
│   ├── middleware.ts                   # JWT + RBAC + audit truy cập
│   └── __tests__/                      # Unit tests (Jest)
├── prisma/
│   ├── schema.prisma                   # Nguồn sự thật của CSDL
│   ├── seed.ts                         # Dữ liệu demo
│   └── migrations/
├── docs/                               # Tài liệu chi tiết từng phần
├── public/tesseract/                   # WASM + traineddata cho OCR
├── .env.example
├── docker-compose.yml                  # PostgreSQL 16 local (cổng 5433)
├── jest.config.js
├── next.config.ts                      # Security headers, body size OCR
├── vercel.json                         # Build command có Prisma migrate
└── package.json
```

## 🚀 Cài đặt & chạy dự án

### Yêu cầu

- **Node.js ≥ 20**
- **npm** (repo dùng `package-lock.json`)
- **Docker** hoặc một PostgreSQL 16 sẵn có

### 1. Cài dependencies

```bash
npm install
```

### 2. Khởi động PostgreSQL

```bash
docker compose up -d
```

Container chạy PostgreSQL 16 ở **cổng host 5433** (tránh đụng PostgreSQL local ở 5432),
database mặc định `due_blood`, dữ liệu lưu trong volume `due_blood_pgdata`.

Kiểm tra container:

```bash
docker compose ps
```

### 3. Tạo file môi trường

```bash
cp .env.example .env
```

Điền tối thiểu các biến bắt buộc:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/due_blood?schema=public"
PII_ENCRYPTION_KEY="<32 byte base64>"
PII_BLIND_INDEX_KEY="<32 byte base64>"
JWT_SECRET="<tối thiểu 32 ký tự>"
AUDIT_INTERNAL_SECRET="<32 byte base64>"
```

Sinh key ngẫu nhiên:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### 4. Khởi tạo database

```bash
npm run db:generate   # sinh Prisma Client
npm run db:migrate    # chạy migration ở môi trường dev
npm run db:seed       # dữ liệu mẫu (tuỳ chọn nhưng nên chạy)
```

Nếu chỉ muốn áp migration có sẵn (CI/production):

```bash
npm run db:deploy
```

### 5. Chạy ứng dụng

```bash
npm run dev     # http://localhost:3000
```

Build và chạy production:

```bash
npm run build
npm run start
```

## 🔑 Tài khoản demo

Sau khi chạy `npm run db:seed`, có thể đăng nhập bằng các tài khoản sau.
**Mật khẩu chung: `DUE@12345`**

| Email | Vai trò | Trang mặc định |
|---|---|---|
| `student@due.edu.vn` | Sinh viên | `/student/register` |
| `organizer@due.edu.vn` | Ban tổ chức | `/organizer/dashboard` |
| `medical@due.edu.vn` | Nhân viên y tế | `/medical/scan-id` |
| `admin@due.edu.vn` | Quản trị viên | `/admin/reports` |
| `student01@due.edu.vn` … `student12@due.edu.vn` | Sinh viên | Dữ liệu minh hoạ |

> ⚠️ Tài khoản trên chỉ dùng cho môi trường dev/demo. Không dùng mật khẩu này khi triển khai thật.

Seed tạo sẵn 3 chiến dịch (hôm nay, sắp tới, đã kết thúc), 22 hồ sơ demo ở nhiều trạng thái,
health check và audit log mẫu để dashboard/báo cáo có dữ liệu ngay.

## ⚙️ Biến môi trường

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | ✅ | Chuỗi kết nối PostgreSQL |
| `PII_ENCRYPTION_KEY` | ✅ | 32 byte base64 — khoá AES-256-GCM mã hoá CCCD |
| `PII_BLIND_INDEX_KEY` | ✅ | 32 byte base64 — khoá HMAC-SHA256 tạo blind index |
| `JWT_SECRET` | ✅ | Tối thiểu 32 ký tự — ký JWT phiên đăng nhập |
| `SESSION_TTL_SECONDS` | ❌ | Thời hạn phiên, mặc định `28800` (8 giờ) |
| `COOKIE_SECURE` | ❌ | `true` mặc định; chỉ đặt `false` khi test HTTP trên host không phải localhost |
| `AUDIT_INTERNAL_SECRET` | ✅ | Secret cho endpoint audit nội bộ do middleware gọi |
| `AI_API_KEY` | ❌ | Bỏ trống để chỉ dùng bộ quy tắc nội bộ (offline) |
| `AI_BASE_URL` | ❌ | Base URL tương thích OpenAI, mặc định `https://api.openai.com/v1` |
| `AI_MODEL` | ❌ | Model dùng cho sàng lọc, mặc định `gpt-4o-mini` |
| `AI_TIMEOUT_MS` | ❌ | Thời gian chờ tối đa, mặc định `4000`; hết hạn sẽ fallback rule nội bộ |

Lưu ý:

- `PII_ENCRYPTION_KEY` và `PII_BLIND_INDEX_KEY` **phải giữ nguyên** sau khi đã có dữ liệu,
  nếu đổi sẽ không giải mã/tra cứu được CCCD cũ.
- Khi deploy lên Vercel/serverless, `COOKIE_SECURE` phải là `true` (HTTPS).
- Rate limit đăng nhập hiện là in-memory, phù hợp demo/1 instance; production nhiều instance nên dùng Redis/WAF.

## 🔄 Luồng nghiệp vụ 3 cổng XOR

> Trong tài liệu gốc, "XOR" được hiểu là **cổng đạt/không đạt** tại từng bước.
> Hồ sơ chỉ đi tiếp khi thoả **tất cả** điều kiện của cổng đó (logic AND), không phải boolean XOR.

```mermaid
stateDiagram-v2
    [*] --> PENDING: Sinh viên gửi form
    PENDING --> APPROVED: XOR 2 đạt (tuổi 18–60, cân nặng ≥ 45kg)
    PENDING --> REJECTED: XOR 2 không đạt
    APPROVED --> CHECKED_IN: Check-in tại chiến dịch
    CHECKED_IN --> ELIGIBLE: XOR 3 đạt
    CHECKED_IN --> HEALTH_CHECK_FAILED: XOR 3 không đạt
    ELIGIBLE --> COMPLETED: Xác nhận hiến máu xong
    REJECTED --> [*]
    HEALTH_CHECK_FAILED --> [*]
    COMPLETED --> [*]
```

| Cổng | Thời điểm | Điều kiện | Kết quả |
|---|---|---|---|
| **XOR 1** | Trước khi mở form | Chưa có hồ sơ `PENDING`/`APPROVED`/`COMPLETED` ở chiến dịch này; chiến dịch còn chỉ tiêu | Có hồ sơ → chuyển `/student/tracking`; hợp lệ → cho đăng ký |
| **XOR 2** | Server Action đăng ký | Tuổi 18–60, cân nặng ≥ 45kg, khai báo y tế hợp lệ | Đạt → `APPROVED`; không đạt → `REJECTED` |
| **XOR 3** | Quầy y tế | Huyết áp 90–140/60–90 mmHg, nhịp tim 60–100 lần/phút | Đạt → `ELIGIBLE`; không đạt → `HEALTH_CHECK_FAILED` |

Trạng thái được định nghĩa tập trung trong `prisma/schema.prisma` (enum `RegStatus`) và
quy tắc thuần trong `src/lib/donation-rules.ts`, nhờ đó có thể unit-test mà không cần DB.

## 👥 Phân quyền & routes

### Route theo vai trò

| Vai trò | Route | Chức năng |
|---|---|---|
| Công khai | `/` | Landing page, xem lịch hiến máu |
| Công khai | `/login`, `/register` | Đăng nhập / đăng ký tài khoản |
| Sinh viên | `/student/register` | Form đăng ký hiến máu |
| Sinh viên | `/student/tracking` | Theo dõi tiến trình hồ sơ |
| Ban tổ chức | `/organizer/dashboard` | Tổng quan chiến dịch |
| Ban tổ chức | `/organizer/check-in` | Danh sách & check-in |
| Y tế | `/medical/scan-id` | Quét CCCD tra hồ sơ |
| Y tế | `/medical/health-check` | Nhập chỉ số, chốt kết quả |
| Y tế | `/medical/blood-status` | Chuyển hướng về `/medical/health-check` |
| Quản trị | `/admin/reports` | Dashboard & báo cáo |
| Quản trị | `/admin/campaigns` | Quản lý chiến dịch |
| Quản trị | `/admin/dashboard` | Chuyển hướng về `/admin/reports` |

### Cơ chế bảo vệ

- `src/lib/rbac.ts` định nghĩa `ROLE_HOME`, `ROLE_PREFIX`, `PUBLIC_PATHS`.
- `src/middleware.ts`:
  - Chưa đăng nhập → redirect `/login?next=...` (chỉ nhận đường dẫn nội bộ, chống open redirect).
  - Sai vai trò → trả trang **403** hoặc JSON 403 với API.
  - Xoá header `x-user-*` do client gửi lên rồi gắn lại từ JWT đã xác thực.
- `requireRole()` trong Server Components là lớp bảo vệ thứ hai.
- Đăng nhập thành công:
  - Sinh viên quay về trang chủ `/` (hoặc `next` hợp lệ).
  - Các vai trò khác về trang mặc định của mình.
- Khi đã đăng nhập, trang chủ hiển thị liên kết cổng thông tin **và nút Đăng xuất**.

## 🧭 Luồng chi tiết theo vai trò

### Sinh viên

1. Đăng ký tài khoản tại `/register` hoặc dùng tài khoản demo.
2. Vào `/student/register`, khai báo thông tin cá nhân, thể trạng, tiền sử sức khoẻ,
   chọn khung giờ mong muốn và tick cam kết.
3. Hệ thống kiểm tra XOR 1 + XOR 2, phân bổ `slotTime` và chuyển trạng thái `APPROVED`/`REJECTED`.
4. Theo dõi tại `/student/tracking` qua stepper tương ứng `RegStatus`.
5. Khi đến chiến dịch, mang CCCD để Ban tổ chức check-in.

### Ban tổ chức

1. Chọn chiến dịch tại `/organizer/check-in`.
2. Tìm kiếm/lọc hồ sơ theo trạng thái, tên, email hoặc mã sinh viên.
3. Check-in thủ công hoặc quét CCCD bằng camera/ảnh tải lên.
4. OCR chạy phía client để lấy ứng viên số CCCD; server đối chiếu blind index.
5. Chỉ check-in khi ứng viên khớp **duy nhất một** hồ sơ trong chiến dịch.

### Nhân viên y tế

1. Quét CCCD tại `/medical/scan-id` để tra hồ sơ đã check-in.
2. Chuyển sang `/medical/health-check`, nhập huyết áp, nhịp tim, cân nặng, nhóm máu, thể tích.
3. Hệ thống đánh giá XOR 3 và chuyển `ELIGIBLE` hoặc `HEALTH_CHECK_FAILED`.
4. Với hồ sơ đủ điều kiện, xác nhận hiến máu để chuyển `COMPLETED`.
5. Mọi thao tác đều ghi audit log kèm nhân viên thực hiện.

### Quản trị viên

1. `/admin/campaigns`: tạo/sửa/xoá chiến dịch, cấu hình `capacity` và `overbookRate`.
2. `/admin/reports`: xem KPI, biểu đồ theo trạng thái, nhóm máu, thể tích máu thu được.
3. Lọc báo cáo theo chiến dịch/thời gian.

## 🔌 API & Server Actions

### Route Handlers

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/auth/login` | Đăng nhập, rate limit theo IP + tài khoản, set cookie JWT |
| `POST` | `/api/auth/logout` | Đăng xuất, ghi audit, xoá cookie |
| `POST` | `/api/auth/register` | Đăng ký tài khoản sinh viên |
| `POST` | `/api/internal/audit` | Endpoint nội bộ cho middleware ghi `ACCESS_DENIED` |

### Server Actions chính

| File | Action | Mô tả |
|---|---|---|
| `blood-donation.ts` | `checkCanRegister` | XOR 1: kiểm tra hồ sơ trùng, chỉ tiêu, chiến dịch |
| | `validateProfile` | XOR 2: xác thực hồ sơ và tạo đăng ký |
| | `evaluateHealth` | XOR 3: đánh giá chỉ số lâm sàng |
| | `finalizeDonation` | Chốt ca hiến máu, chuyển `COMPLETED` |
| `admin.ts` | `createCampaign` / `updateCampaign` / `deleteCampaign` | CRUD chiến dịch |
| `ocr.ts` | `processCccdOcr` | OCR + check-in bằng CCCD |
| | `manualCheckIn` | Check-in thủ công |
| | `lookupCccdForMedical` / `lookupCccdForMedicalManual` | Tra hồ sơ cho y tế |
| `ai.ts` | `screenNoteForStudent` | Sàng lọc ghi chú sức khoẻ |
| | `previewAiScheduling` | Gợi ý phân bổ khung giờ |

## 🗄 Mô hình dữ liệu

### Models

| Model | Vai trò | Ghi chú |
|---|---|---|
| `User` | Tài khoản + hồ sơ sinh viên | CCCD mã hoá; `cccdHash` unique để matching |
| `Campaign` | Chiến dịch hiến máu | `capacity`, `overbookRate`, trạng thái |
| `Registration` | Hồ sơ đăng ký của sinh viên | Trạng thái `RegStatus`, slot, khai báo y tế |
| `HealthCheck` | Kết quả khám sàng lọc | 1–1 với `Registration` |
| `AuditLog` | Nhật ký thao tác | `action`, `userId`, `details` JSON |

### Enums

- `Role`: `STUDENT`, `ORGANIZER`, `MEDICAL`, `ADMIN`
- `RegStatus`: `PENDING`, `APPROVED`, `REJECTED`, `CHECKED_IN`, `ELIGIBLE`, `HEALTH_CHECK_FAILED`, `COMPLETED`
- `CampaignStatus`: `DRAFT`, `ACTIVE`, `COMPLETED`, `CANCELLED`
- `BloodType`: `A`, `B`, `AB`, `O`
- `Gender`: `MALE`, `FEMALE`, `OTHER`

### Ràng buộc & index đáng chú ý

- Unique `(userId, campaignId)` có điều kiện cho hồ sơ đang hoạt động — chống đăng ký trùng.
- Index `(campaignId, status)` và `status` phục vụ dashboard/check-in.
- `HealthCheck.bloodVolume` chỉ nhận `250` hoặc `350` (CHECK ở tầng DB).
- Xoá `Campaign`/`Registration` theo cascade; `AuditLog` giữ lại với `userId = null` khi xoá user.

## 🔐 Bảo mật & quyền riêng tư

| Lớp bảo vệ | Cách triển khai |
|---|---|
| Mã hoá CCCD | AES-256-GCM, IV ngẫu nhiên 12 byte cho mỗi bản ghi |
| Tra cứu không giải mã | Blind index HMAC-SHA256 (`cccdHash`), so sánh constant-time |
| Mật khẩu | bcrypt (12 rounds), không lưu plaintext |
| Phiên đăng nhập | JWT HS256, cookie HttpOnly + Secure + SameSite |
| Phân quyền | RBAC theo tiền tố route + kiểm tra lại ở server |
| Chống enumeration | Hash giả bcrypt khi email không tồn tại |
| Chống spam login | Fixed-window rate limit theo IP và tài khoản |
| Chống spoofing | Middleware xoá header `x-user-*` từ client |
| Audit | Ghi log đăng nhập, đăng xuất, nghiệp vụ và `ACCESS_DENIED` |
| HTTP headers | `nosniff`, `DENY` frame, referrer policy, HSTS ở production |
| Giới hạn upload | Ảnh CCCD tối đa 5MB; Server Action body limit 6MB |
| AI an toàn | Ẩn thông tin nhận dạng trước khi gửi; rule nội bộ luôn chạy trước |

> Ứng dụng không lưu ảnh CCCD. Ảnh chỉ dùng để OCR, server nhận danh sách ứng viên số CCCD.

## 🧪 Kiểm thử

Jest chạy môi trường Node, biên dịch TypeScript bằng `ts-jest`, mock Prisma/session/audit
nên **không cần database thật**.

```bash
npm run test            # chạy toàn bộ unit test
npm run test:watch      # watch mode
npm run test:coverage   # coverage → coverage/
```

| File test | Nội dung |
|---|---|
| `src/__tests__/xorLogic.test.ts` | 3 cổng XOR: đăng ký, duyệt hồ sơ, khám, chốt ca và các nhánh lỗi |
| `src/__tests__/validations.test.ts` | Zod schemas, ngày tháng, khung giờ, chiến dịch, audit, helper |
| `src/__tests__/slotOptimizer.test.ts` | Thuật toán phân bổ khung giờ, cân bằng tải |
| `src/__tests__/cccdOcr.test.ts` | Parse kết quả OCR CCCD và chuẩn hoá ứng viên |
| `src/__tests__/aiScreening.test.ts` | Sàng lọc ghi chú sức khoẻ bằng rule + AI |

Coverage được đo trên:

- `src/actions/blood-donation.ts`
- `src/lib/donation-rules.ts`
- `src/lib/validations.ts`

Chi tiết chiến lược test xem [`docs/testing-jest.md`](./docs/testing-jest.md).

## ☁️ Triển khai

### Vercel (khuyến nghị)

1. Import repository vào Vercel.
2. Tạo PostgreSQL managed (Neon, Supabase, Vercel Postgres...) và lấy `DATABASE_URL`
   có SSL nếu nhà cung cấp yêu cầu.
3. Thêm toàn bộ biến môi trường ở **Production** và **Preview**.
4. `vercel.json` đã cấu hình build command:

   ```json
   {
     "buildCommand": "npm run db:generate && npm run db:deploy && npm run build"
   }
   ```

5. Deploy. Mỗi lần deploy production, Prisma sẽ tự áp migration rồi mới build Next.js.

Lưu ý production:

- `COOKIE_SECURE=true`.
- `JWT_SECRET`, `PII_*`, `AUDIT_INTERNAL_SECRET` phải là giá trị ngẫu nhiên mạnh, không commit.
- Nếu dùng nhiều instance/serverless, thay rate limiter in-memory bằng Redis.
- Chạy `npm run db:seed` **không** tự động trên production; chỉ seed DB demo riêng nếu cần.

### Docker PostgreSQL local

```bash
docker compose up -d       # khởi động
docker compose logs -f     # xem log
docker compose down        # dừng (giữ dữ liệu)
docker compose down -v     # dừng và xoá volume dữ liệu
```

## 🩺 Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `PrismaClientInitializationError` | Sai `DATABASE_URL` hoặc DB chưa chạy | Kiểm tra Docker/DB, chạy `npm run db:generate` |
| `Thiếu biến môi trường PII_ENCRYPTION_KEY` | Chưa tạo `.env` hoặc thiếu key | Copy `.env.example`, sinh key base64 32 byte |
| `JWT_SECRET phải có tối thiểu 32 ký tự` | Secret quá ngắn | Dùng chuỗi ≥ 32 ký tự hoặc 48 byte base64 |
| Đăng nhập xong bị đăng xuất ngay | `COOKIE_SECURE=true` khi chạy HTTP không phải localhost | Đặt `COOKIE_SECURE=false` ở môi trường test tương ứng |
| OCR không nhận ảnh | Thiếu file trong `public/tesseract/` hoặc ảnh mờ | Kiểm tra WASM/traineddata, chụp rõ mặt trước CCCD |
| `Migration failed` khi deploy | DB production lệch schema | Chạy `prisma migrate status`, backup rồi xử lý migration |
| Bị chặn 403 dù đúng tài khoản | Vào route của vai trò khác | Dùng đúng trang của vai trò hoặc xem `ROLE_HOME` |
| Dashboard không có dữ liệu | Chưa chạy seed | `npm run db:seed` ở môi trường dev |

## 📜 Scripts

| Lệnh | Chức năng |
|---|---|
| `npm run dev` | Chạy Next.js dev server |
| `npm run build` | Build production |
| `npm run start` | Chạy bản build production |
| `npm run db:generate` | Sinh Prisma Client |
| `npm run db:migrate` | Tạo/chạy migration ở môi trường dev |
| `npm run db:deploy` | Áp migration có sẵn (CI/staging/production) |
| `npm run db:seed` | Nạp dữ liệu mẫu từ `prisma/seed.ts` |
| `npm run db:studio` | Mở Prisma Studio |
| `npm run test` | Chạy Jest |
| `npm run test:watch` | Jest watch mode |
| `npm run test:coverage` | Jest + coverage |

## 📚 Tài liệu

Tài liệu chi tiết nằm trong thư mục [`docs/`](./docs):

| File | Nội dung |
|---|---|
| [`auth.md`](./docs/auth.md) | Xác thực, RBAC, validation, audit |
| [`database.md`](./docs/database.md) | Schema, migration, mã hoá CCCD |
| [`blood-donation.md`](./docs/blood-donation.md) | 3 cổng XOR và Server Actions |
| [`student-flow.md`](./docs/student-flow.md) | Luồng sinh viên: đăng ký & tracking |
| [`organizer-checkin.md`](./docs/organizer-checkin.md) | Check-in & OCR CCCD |
| [`medical-flow.md`](./docs/medical-flow.md) | Khám sức khoẻ & chốt kết quả |
| [`admin-flow.md`](./docs/admin-flow.md) | Quản lý chiến dịch & báo cáo |
| [`testing-jest.md`](./docs/testing-jest.md) | Chiến lược test và checklist bảo mật |
| [`ui-theming.md`](./docs/ui-theming.md) | Design tokens, theming, UI/UX |

## 🤝 Đóng góp

1. Tạo nhánh: `git checkout -b feat/ten-tinh-nang`.
2. Chạy `npm run test` và `npx tsc --noEmit` trước khi commit.
3. Nếu thay đổi schema:
   - Sửa `prisma/schema.prisma`.
   - Tạo migration bằng `npm run db:migrate`.
   - Cập nhật seed/test liên quan.
4. Commit theo Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`...
5. Mở Pull Request kèm mô tả thay đổi và cách kiểm tra.

## 🗺 Roadmap & giới hạn hiện tại

**Đã có**

- Đầy đủ luồng 4 vai trò và 3 cổng XOR.
- OCR CCCD local, check-in, khám, chốt ca.
- CRUD chiến dịch, dashboard, báo cáo.
- Unit test cho logic nghiệp vụ quan trọng.
- Deploy Vercel với migration tự động.

**Có thể mở rộng**

- Rate limit phân tán bằng Redis.
- Gửi email/SMS nhắc lịch hiến máu.
- Xuất báo cáo Excel/PDF.
- Quản lý kho máu và lịch sử hiến máu dài hạn.
- Đa ngôn ngữ (Việt/Anh).
- E2E test với Playwright.

---

<p align="center">
  <strong>Hiến máu DUE — Chung tay vì sự sống 🩸</strong><br />
  Trường Đại học Kinh tế – Đại học Đà Nẵng
</p>
