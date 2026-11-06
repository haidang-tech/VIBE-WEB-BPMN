# 🩸 Hệ thống hiến máu cho sinh viên DUE

Hệ thống quản lý quy trình hiến máu dành cho sinh viên Trường Đại học Kinh tế (DUE),
xây dựng theo blueprint bảo mật: mã hóa PII (CCCD), kiểm soát trạng thái bằng ENUM,
và **3 cổng lọc (XOR 1 → 2 → 3)** từ đăng ký đến lấy máu.

## 📖 Mục lục

- [Stack công nghệ](#-stack-công-nghệ)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [Cài đặt & chạy dự án](#-cài-đặt--chạy-dự-án)
- [Kiểm thử](#-kiểm-thử)
- [Vai trò & luồng nghiệp vụ (3 cổng XOR)](#-vai-trò--luồng-nghiệp-vụ-3-cổng-xor)
- [Scripts toàn tập](#-scripts-toàn-tập)

## 🛠 Stack công nghệ

| Thành phần | Công nghệ |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 |
| Backend | Next.js Server Actions + Route Handlers (không cần Express) |
| Database | PostgreSQL 16 + Prisma ORM 6 |
| UI | Tailwind CSS 4 + shadcn/ui + Framer Motion |
| Validation | Zod 4 (đồng bộ client/server) |
| Xác thực | JWT (`jose`) + `bcryptjs`, cookie HttpOnly/Secure, RBAC theo vai trò |
| OCR | Tesseract.js (quét CCCD chạy local, dữ liệu WASM trong `public/tesseract/`) |
| AI (tuỳ chọn) | API tương thích OpenAI: OpenAI, Gemini, Ollama... |
| Test | Jest + ts-jest |
| Báo cáo | Recharts |

## 📂 Cấu trúc thư mục

```text
Project/
├── src/                          # Toàn bộ mã nguồn ứng dụng
│   ├── app/                      # Next.js App Router (routes, layout, API)
│   │   ├── page.tsx              # Trang landing page (trang chủ công khai)
│   │   ├── layout.tsx            # Root layout toàn app
│   │   ├── globals.css           # Style toàn cục (Tailwind + theme)
│   │   ├── login/                # Trang đăng nhập + login form
│   │   ├── (auth)/register/      # Nhóm route đăng ký (form + loading)
│   │   ├── (roles)/              # Nhóm route phân theo vai trò (3 cổng XOR)
│   │   │   ├── student/          # Cổng sinh viên: /register, /tracking
│   │   │   ├── organizer/        # Ban tổ chức: /dashboard, /check-in
│   │   │   ├── medical/          # Y tế: /scan-id, /health-check, /blood-status
│   │   │   └── admin/            # Quản trị: /dashboard, /campaigns, /reports
│   │   └── api/                  # Route handlers (backend REST)
│   │       ├── auth/login|logout|register/   # API xác thực (JWT + bcrypt)
│   │       └── internal/audit/   # Endpoint nội bộ ghi audit log
│   ├── actions/                  # Server Actions (logic nghiệp vụ phía server)
│   │   ├── blood-donation.ts     # ⭐ Nghiệp vụ chính: đăng ký, duyệt, check-in, khám sức khỏe
│   │   ├── admin.ts              # Action quản trị (chiến dịch, báo cáo)
│   │   ├── ai.ts                 # Action gọi AI rà soát "ghi chú thêm" của sinh viên
│   │   └── ocr.ts                # Action OCR quét CCCD
│   ├── lib/                      # ⭐ Thư viện dùng chung (business logic thuần)
│   │   ├── donation-rules.ts     # ⭐ Quy tắc 3 cổng XOR (tuổi, cân nặng, lâm sàng) — pure, dễ test
│   │   ├── slot-optimizer.ts     # Thuật toán phân bổ khung giờ hiến máu (cân bằng tải)
│   │   ├── ai-screening.ts       # Sàng lọc ghi chú y tế bằng rule nội bộ + LLM
│   │   ├── cccd-ocr.ts / -parse.ts   # OCR CCCD (Tesseract.js) + parse dữ liệu
│   │   ├── auth.ts / jwt.ts / rbac.ts / crypto.ts  # Phiên, JWT, phân quyền, mã hóa PII
│   │   ├── prisma.ts             # Prisma Client dùng chung (singleton)
│   │   ├── validations.ts        # Schema Zod đồng bộ client/server
│   │   ├── rate-limit.ts         # Chống spam request
│   │   ├── audit.ts              # Ghi audit log
│   │   ├── registration-status.ts / campaign-status.ts  # Trạng thái hồ sơ & chiến dịch
│   │   └── utils.ts              # Tiện ích chung (cn() của shadcn...)
│   ├── components/               # React components dùng chung
│   │   ├── landing/              # Sections landing page (Hero, Navbar, Footer...)
│   │   ├── ui/                   # UI kit shadcn (button, card, table, toast, dialog...)
│   │   ├── CampaignManager.tsx   # Quản lý chiến dịch (admin)
│   │   ├── RegistrationForm.tsx  # Form đăng ký hiến máu (XOR 2)
│   │   ├── MedicalCheckPanel.tsx # Panel khám sức khỏe (XOR 3)
│   │   ├── TrackingStepper.tsx   # Stepper theo dõi tiến trình hồ sơ (sinh viên)
│   │   ├── ReportsCharts.tsx     # Biểu đồ báo cáo (Recharts)
│   │   └── ...                   # CccdUploader, CheckInToolbar, ThemeToggle...
│   ├── middleware.ts             # ⭐ Middleware chặn route theo vai trò (route guard)
│   └── __tests__/                # Unit test (Jest): donation-rules, slot-optimizer, OCR, AI
├── prisma/                       # Database layer
│   ├── schema.prisma             # ⭐ Định nghĩa schema DB (ENUM trạng thái, mã hóa PII)
│   ├── seed.ts                   # Dữ liệu mẫu (db seed)
│   └── migrations/               # 3 migration: init, form đăng ký, khung giờ ưu tiên
├── docs/                         # Tài liệu dự án (auth, database, luồng từng role, testing)
├── public/
│   └── tesseract/                # ⭐ WASM + traineddata cho OCR CCCD chạy local
├── .env.example                  # Mẫu biến môi trường (copy thành .env rồi điền)
├── docker-compose.yml            # Chạy PostgreSQL 16 bằng Docker (cổng 5433)
├── jest.config.js                # Cấu hình Jest + ts-jest (environment Node)
├── next.config.ts                # Cấu hình Next.js (security headers, body size OCR)
├── components.json               # Cấu hình shadcn/ui
├── tsconfig.json                 # Cấu hình TypeScript (alias `@/*` → `src/`)
└── package.json                  # Scripts: dev, build, db:*, test:*
```

## 🚀 Cài đặt & chạy dự án

### Yêu cầu

- **Node.js ≥ 20**
- **Docker** (hoặc PostgreSQL sẵn có)
- npm

### 1. Cài dependencies

```bash
npm install
```

### 2. Khởi động PostgreSQL

```bash
docker compose up -d
```

Container chạy PostgreSQL 16 ở **cổng host 5433** (tránh đụng PostgreSQL local trên 5432),
tên database `due_blood`, dữ liệu lưu trong volume `due_blood_pgdata`.

### 3. Tạo file môi trường

```bash
cp .env.example .env
```

Điền các biến chính:

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL (mặc định trỏ tới `localhost:5433`) |
| `PII_ENCRYPTION_KEY` | 32 byte base64 — mã hóa CCCD |
| `PII_BLIND_INDEX_KEY` | 32 byte base64 — blind index tra cứu CCCD mã hóa |
| `JWT_SECRET` | ≥ 32 ký tự (nên 48 byte base64) — ký JWT phiên đăng nhập |
| `AUDIT_INTERNAL_SECRET` | Secret cho endpoint audit nội bộ |
| `SESSION_TTL_SECONDS` | Thời hạn phiên (mặc định 28800s = 8 giờ) |
| `COOKIE_SECURE` | Đặt `false` chỉ khi test HTTP trên host không phải localhost |
| `AI_API_KEY` (tuỳ chọn) | Bỏ trống thì sàng lọc AI chạy offline bằng bộ quy tắc nội bộ |
| `AI_BASE_URL` / `AI_MODEL` | API tương thích OpenAI (OpenAI, Gemini, Ollama...) |

Lệnh sinh key ngẫu nhiên:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 4. Khởi tạo database

```bash
npm run db:generate   # sinh Prisma Client
npm run db:migrate    # chạy migration (3 migration hiện có)
npm run db:seed       # tạo dữ liệu mẫu (tuỳ chọn)
```

### 5. Chạy

```bash
npm run dev     # phát triển → http://localhost:3000
npm run build   # build production
npm run start   # chạy production
```

## 🧪 Kiểm thử

Jest cấu hình với môi trường Node, biên dịch qua `ts-jest`, không cần DB thật
(Prisma/session/audit được mock trong từng test):

```bash
npm run test            # chạy unit test
npm run test:watch      # chế độ watch
npm run test:coverage   # coverage → thư mục coverage/
```

Các bộ test hiện có trong `src/__tests__/`:

| File test | Nội dung |
|---|---|
| `xorLogic.test.ts` | 3 cổng lọc nghiệp vụ (chặn đăng ký trùng, tuổi/cân nặng, lâm sàng) |
| `slotOptimizer.test.ts` | Thuật toán phân bổ khung giờ |
| `cccdOcr.test.ts` | Parse kết quả OCR CCCD |
| `aiScreening.test.ts` | Sàng lọc ghi chú sức khỏe bằng AI |

Coverage đo trên: `src/actions/blood-donation.ts`, `src/lib/donation-rules.ts`, `src/lib/validations.ts`.

## 👥 Vai trò & luồng nghiệp vụ (3 cổng XOR)

Mỗi sinh viên đi qua đúng 1 trong 2 nhánh tại mỗi cổng:

1. **XOR 1 — Trước form:** đã có hồ sơ `PENDING`/`APPROVED`/`COMPLETED` ở chiến dịch này?
   → CÓ: chặn và chuyển tới `/student/tracking`; KHÔNG: cho đăng ký mới.
2. **XOR 2 — Xử lý form:** hồ sơ cơ bản đạt? (tuổi 18–60, cân nặng ≥ 45kg)
   → Đạt: `APPROVED`; không đạt: `REJECTED`.
3. **XOR 3 — Quầy y tế:** chỉ số lâm sàng đạt? (huyết áp ổn định, nhịp tim bình thường)
   → Đạt: `ELIGIBLE`, chuyển vào bàn lấy máu; không đạt: `HEALTH_CHECK_FAILED`.

Vai trò truy cập (do `src/middleware.ts` kiểm soát):

| Vai trò | Trang |
|---|---|
| Student | `/register`, `/tracking` |
| Organizer | `/dashboard`, `/check-in` |
| Medical | `/scan-id`, `/health-check`, `/blood-status` |
| Admin | `/dashboard`, `/campaigns`, `/reports` |

Chi tiết luồng từng vai trò xem trong thư mục [`docs/`](./docs):

`admin-flow.md` · `auth.md` · `blood-donation.md` · `database.md` · `medical-flow.md` · `organizer-checkin.md` · `student-flow.md` · `testing-jest.md` · `ui-theming.md`

## 📜 Scripts toàn tập

| Lệnh | Chức năng |
|---|---|
| `npm run dev` | Chạy Next.js dev server |
| `npm run build` / `npm run start` | Build / chạy production |
| `npm run db:generate` | Sinh Prisma Client |
| `npm run db:migrate` | Chạy migration (dev) |
| `npm run db:deploy` | Áp migration (staging/production) |
| `npm run db:seed` | Nạp dữ liệu mẫu (`prisma/seed.ts`) |
| `npm run db:studio` | Mở Prisma Studio quản lý dữ liệu |
| `npm run test` / `test:watch` / `test:coverage` | Jest |
