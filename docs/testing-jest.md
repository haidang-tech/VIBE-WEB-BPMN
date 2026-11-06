# Unit Test với Jest & Checklist bảo mật — Prompt 8

Tài liệu này mô tả bộ Jest cho Next.js App Router và cách chạy test để lấy
minh chứng cho báo cáo.

## 1. Kết quả đạt được

- Đã cài Jest + ts-jest cho dự án Next.js 15 (App Router).
- File nghiệp vụ: `src/__tests__/xorLogic.test.ts`.
- 64 test trong file nghiệp vụ, bao phủ:
  - `checkCanRegister` — chặn đăng ký trùng, kiểm tra sức chứa/overbook.
  - `validateProfile` — rẽ nhánh tuổi `>= 18` và cân nặng `>= 45kg`.
  - `evaluateHealth` — rẽ nhánh sức khỏe đạt/không đạt.
  - `finalizeDonation` — chốt ca hiến máu thành công hoặc ghi nhận sự cố.
  - Nhánh lỗi xác thực, dữ liệu, CCCD/MSSV/email trùng, khung giờ đầy,
    transaction conflict và lỗi DB.
- `src/__tests__/validations.test.ts` kiểm tra schema ngày tháng, khung giờ,
  tài khoản sinh viên, chiến dịch, audit và helper validation.
- Toàn bộ 5 suite hiện có tổng cộng 117 test.
- Test chạy độc lập, không cần PostgreSQL, không cần biến môi trường PII/JWT.

## 2. Cài đặt

### 2.1. Cài dependency

```bash
npm install --save-dev jest@^29.7.0 ts-jest@^29.2.5 @types/jest@^29.5.14
```

Phiên bản đang dùng:

| Gói | Phiên bản |
| --- | --- |
| `jest` | 29.7.0 |
| `ts-jest` | 29.4.15 |
| `@types/jest` | 29.5.14 |

### 2.2. Thêm script vào `package.json`

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### 2.3. Tạo `jest.config.js`

```js
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      { tsconfig: "<rootDir>/tsconfig.jest.json" },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  clearMocks: true,
  collectCoverageFrom: [
    "src/actions/blood-donation.ts",
    "src/lib/donation-rules.ts",
    "src/lib/validations.ts",
  ],
  coverageDirectory: "coverage",
};
```

Giải thích các điểm quan trọng với Next.js App Router:

- `testEnvironment: "node"`: Server Action chỉ chạy ở server, không cần DOM.
- `ts-jest` + `tsconfig.jest.json`: biên dịch TypeScript trực tiếp, không phải
  `next build` trước khi test.
- `moduleNameMapper`: tái hiện alias `@/*` trong `tsconfig.json`, nếu thiếu sẽ
  lỗi `Cannot find module '@/lib/...'`.
- `roots`/`testMatch`: chỉ quét test trong `src`, bỏ qua `.next` và
  `node_modules`.
- `clearMocks`: xóa lịch sử gọi mock giữa các test.

### 2.4. Tạo `tsconfig.jest.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "jsx": "react-jsx",
    "isolatedModules": true,
    "noEmit": true,
    "types": ["jest", "node"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

`tsconfig.json` gốc dùng `module: "esnext"` cho Next.js; Jest chạy trên Node
nên cần override sang `commonjs`.

## 3. Cấu trúc file test

```
src/__tests__/xorLogic.test.ts
src/__tests__/validations.test.ts
```

### 3.1. Mock các phụ thuộc server

Test không kết nối DB thật, thay vào đó mock:

| Module | Lý do |
| --- | --- |
| `@/lib/prisma` | Tránh kết nối PostgreSQL; `$transaction` được mock để gọi callback với chính mock Prisma. |
| `@/lib/auth` | Giả lập phiên đăng nhập và role. |
| `@/lib/audit` | Kiểm tra action audit mà không ghi DB. |
| `@/lib/crypto` | Tránh yêu cầu khóa `PII_ENCRYPTION_KEY` / `PII_BLIND_INDEX_KEY`. |

`$transaction` được mock như sau để các Server Action chạy đúng logic bên trong:

```ts
db.$transaction.mockImplementation(
  async (callback: (tx: typeof db) => unknown) => callback(db),
);
```

Ngoài ra test dùng `jest.useFakeTimers()` với mốc `2026-06-15` để tuổi được
tính ổn định, không phụ thuộc ngày chạy thực tế.

### 3.2. Danh sách test

**`checkCanRegister` (8 test)**

- Cho phép đăng ký khi còn suất.
- Chặn trùng khi đã có hồ sơ `PENDING/APPROVED/COMPLETED`.
- Chặn khi chiến dịch đủ chỉ tiêu (đã gồm overbook).
- Trả `CAMPAIGN_NOT_FOUND`.
- Chặn kiểm tra hồ sơ của người khác (`FORBIDDEN`).
- Từ chối ID rỗng, yêu cầu đăng nhập và xử lý lỗi DB (`INTERNAL_ERROR`).

**`validateProfile` (28 test)**

- Tuổi `>= 18` và cân nặng `>= 45kg` → `APPROVED`, audit
  `REGISTRATION_APPROVED`.
- Cân nặng `< 45kg` → `REJECTED`, audit `REGISTRATION_REJECTED`.
- Tuổi `< 18` → `REJECTED`.
- Thiếu cả tuổi và cân nặng → trả đủ 2 lý do.
- Chặn đăng ký trùng/hết suất/khung giờ đầy trong transaction.
- Chặn tài khoản không tồn tại, CCCD/MSSV/email đã được dùng và ghi chú bị
  đánh dấu cần hoãn; dùng summary nếu AI không trả reason.
- Lưu ngày hiến máu gần nhất; kiểm tra các nhánh dự phòng khi kết quả tính tải
  hoặc metadata lỗi unique không có giá trị.
- Kiểm tra đăng nhập, role `STUDENT`, dữ liệu sai định dạng.
- Xử lý unique constraint `P2002`, transaction conflict `P2034` và lỗi DB khác.

**`evaluateHealth` (12 test)**

- Sức khỏe đạt → `ELIGIBLE`, audit `HEALTH_CHECK_PASSED`.
- Huyết áp ngoài ngưỡng → `HEALTH_CHECK_FAILED`, vẫn lưu kết quả.
- Nhịp tim ngoài ngưỡng → `HEALTH_CHECK_FAILED`.
- Hồ sơ `PENDING` → `INVALID_STATUS`.
- Hồ sơ `CHECKED_IN` → được phép nhập kết quả.
- Hồ sơ không tồn tại → `REGISTRATION_NOT_FOUND`.
- Kiểm tra đăng nhập, role `MEDICAL`, chỉ số sai định dạng, transaction
  conflict và lỗi DB.

**`finalizeDonation` (8 test)**

- `SUCCESS` → `COMPLETED`; `INCIDENT` → `HEALTH_CHECK_FAILED`.
- Từ chối khi chưa đăng nhập, sai role, input sai, hồ sơ không tồn tại hoặc
  trạng thái chưa `ELIGIBLE`.
- Xử lý transaction conflict và lỗi DB.

**`validations.test.ts` (12 test)** bao phủ schema/helper cho ngày, khung giờ,
tài khoản đăng ký, chiến dịch, audit log và tính tuổi.

**Các suite còn lại:** `slotOptimizer.test.ts` (11 test), `cccdOcr.test.ts`
(21 test) và `aiScreening.test.ts` (9 test).

## 4. Cách chạy

```bash
# Chạy toàn bộ test một lần
npm test

# Chế độ theo dõi khi đang phát triển
npm run test:watch

# Chạy kèm báo cáo độ phủ (sinh thư mục coverage/)
npm run test:coverage
```

Kết quả mong đợi:

```
PASS src/__tests__/xorLogic.test.ts
PASS src/__tests__/validations.test.ts
PASS src/__tests__/aiScreening.test.ts
PASS src/__tests__/cccdOcr.test.ts
PASS src/__tests__/slotOptimizer.test.ts

Test Suites: 5 passed, 5 total
Tests:       117 passed, 117 total
```

Kết quả chạy gần nhất: 117/117 test pass; các file được cấu hình đo coverage
đạt 100% statements, branches, functions và lines. Phạm vi đo gồm
`blood-donation.ts`, `donation-rules.ts` và `validations.ts`. Báo cáo chi tiết nằm ở
`coverage/lcov-report/index.html` (thư mục này được ignore trong `.gitignore`).

## 5. Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách xử lý |
| --- | --- | --- |
| `Cannot find module '@/lib/prisma'` | Thiếu alias trong Jest | Kiểm tra `moduleNameMapper` trong `jest.config.js`. |
| `Cannot use import statement outside a module` | Chưa override module | Đảm bảo `tsconfig.jest.json` dùng `"module": "commonjs"`. |
| Lỗi thiếu `PII_ENCRYPTION_KEY` | Chưa mock `@/lib/crypto` | Giữ `jest.mock("@/lib/crypto", ...)` ở đầu file test. |
| Test chạy vào DB thật | Chưa mock `@/lib/prisma` | Kiểm tra mock được khai báo trước khi import action. |
| `@prisma/client did not initialize` | Chưa `prisma generate` | Chạy `npm run db:generate` (chỉ cần khi import Prisma thật). |

## 6. Checklist bảo mật (tóm tắt cho báo cáo)

### Xác thực & phân quyền

- [x] Mật khẩu hash bằng bcrypt, không lưu plaintext.
- [x] Phiên đăng nhập dùng JWT HS256, cookie `httpOnly`, `sameSite=lax`,
  `secure` bật mặc định.
- [x] Middleware chặn route theo role; mỗi Server Action kiểm tra lại role ở
  server (không tin UI).
- [x] `checkCanRegister` chỉ cho phép sinh viên kiểm tra hồ sơ của chính mình.
- [x] `validateProfile` chỉ role `STUDENT`; `evaluateHealth` chỉ role `MEDICAL`.
- [x] Admin CRUD campaign chỉ role `ADMIN`.

### Dữ liệu cá nhân (PII)

- [x] CCCD mã hóa AES-256-GCM trước khi lưu DB.
- [x] Mỗi bản ghi dùng IV ngẫu nhiên; có `authTag` chống sửa đổi dữ liệu.
- [x] Tra cứu CCCD bằng blind index HMAC-SHA256 (`cccdHash`), không giải mã
  toàn bảng.
- [x] Không ghi CCCD plaintext / mật khẩu / token vào `AuditLog`.
- [x] Khóa mã hóa đọc từ biến môi trường, không commit `.env`.

### Kiểm soát dữ liệu đầu vào

- [x] Mọi input đi qua Zod schema ở server trước khi chạm DB.
- [x] CCCD đúng 12 chữ số; ngày sinh không ở tương lai; cân nặng/nhịp tim/
  huyết áp trong ngưỡng.
- [x] Lượng máu chỉ nhận 250ml hoặc 350ml (validate + CHECK constraint).
- [x] Validate lại `capacity`/`overbookRate` ở Server Action Admin.

### Toàn vẹn nghiệp vụ

- [x] Partial unique index chặn hồ sơ trùng trong cùng chiến dịch.
- [x] Transaction `Serializable` cho các bước kiểm tra + ghi dữ liệu.
- [x] Xử lý `P2002` (trùng) và `P2034` (xung đột transaction) bằng thông báo
  thân thiện.
- [x] XOR 2 chỉ duyệt khi tuổi `>= 18` **và** cân nặng `>= 45kg`.
- [x] XOR 3 chỉ cho nhập kết quả khi hồ sơ `APPROVED` hoặc `CHECKED_IN`.
- [x] Không xóa chiến dịch đã có hồ sơ đăng ký.
- [x] Mọi thay đổi trạng thái quan trọng đều ghi `AuditLog`.

### Vận hành

- [x] Audit log không làm hỏng luồng nghiệp vụ (lỗi ghi log được nuốt và log
  ra console).
- [x] Rate limit đăng nhập ở tầng API.
- [x] Unit test chạy độc lập với DB, có thể chạy trong CI.
- [x] `npm test`, `npx tsc --noEmit`, `npm run build` đều phải pass trước khi
  merge.

## 7. Lệnh kiểm chứng trước khi nộp báo cáo

```bash
npm test
npx tsc --noEmit
npm run build
```
