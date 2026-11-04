# Database — Hệ thống hiến máu DUE

Kết quả **Prompt 1**: schema Prisma, migration khởi tạo, mã hóa CCCD và Prisma Client.

## 1. Cấu trúc file

```
prisma/
  schema.prisma                        # Nguồn sự thật của CSDL
  migrations/
    migration_lock.toml
    20261102000000_init/migration.sql  # Migration khởi tạo (có CHECK + partial index)
src/lib/
  prisma.ts                            # Prisma Client singleton cho Next.js
  crypto.ts                            # AES-256-GCM + blind index cho CCCD
.env.example                           # Mẫu biến môi trường (không chứa khóa thật)
docker-compose.yml                     # PostgreSQL 16 cho môi trường dev
```

## 2. ENUM

| ENUM | Giá trị |
| --- | --- |
| `Role` | `STUDENT`, `ORGANIZER`, `MEDICAL`, `ADMIN` |
| `RegStatus` | `PENDING`, `APPROVED`, `REJECTED`, `CHECKED_IN`, `ELIGIBLE`, `HEALTH_CHECK_FAILED`, `COMPLETED` |
| `CampaignStatus` | `DRAFT`, `ACTIVE`, `COMPLETED`, `CANCELLED` |
| `BloodType` | `A`, `B`, `AB`, `O` |

`RegStatus` bám đúng vòng đời 3 cổng XOR:

```
PENDING ──XOR2 đạt──> APPROVED ──OCR check-in──> CHECKED_IN ──XOR3 đạt──> ELIGIBLE ──> COMPLETED
   │                     │                          │
   └──XOR2 không đạt──> REJECTED                   └──XOR3 không đạt──> HEALTH_CHECK_FAILED
```

## 3. Bảng & ràng buộc chính

### `User`
- `email` unique, `password` **luôn là bcrypt hash**.
- CCCD không lưu plaintext. Ba cột `cccdCiphertext`, `cccdIv`, `cccdAuthTag` chứa
  kết quả AES-256-GCM; `cccdHash` là blind index HMAC-SHA256 (unique) để matching
  khi OCR mà không cần giải mã.
- `role` mặc định `STUDENT`.

### `Campaign`
- `capacity` (chỉ tiêu) + `overbookRate` (hệ số overbook, mặc định `1.0`).
- Sức chứa thực tế = `capacity * overbookRate` (dùng ở `checkCanRegister` — Prompt 3).

### `Registration`
- `status` kiểu `RegStatus`, `checkInTime` nullable.
- `preferredSlots` (`TEXT[]`) lưu các khung sinh viên chọn; `slotTime` lưu khung hệ
  thống phân sau khi cân bằng tải (Prompt 13).
- **Partial unique index** `Registration_active_per_campaign_key` trên
  `(userId, campaignId)` chỉ áp dụng cho `PENDING | APPROVED | COMPLETED` — chính là
  XOR 1 ở tầng DB: chặn hồ sơ trùng nhưng vẫn cho phép đăng ký lại sau khi `REJECTED`.
- `HealthCheck` quan hệ 1-1 (`registrationId` unique).

### `HealthCheck`
- `bloodPressure` dạng chuỗi `"120/80"`, `heartRate` (lần/phút), `weight` (kg).
- `bloodVolume` chỉ nhận **250** hoặc **350** (CHECK constraint).
- `isPassed` là kết quả XOR 3; `medicalStaffId` trỏ tới `User` role `MEDICAL`.

### `AuditLog`
- `action`, `userId` (nullable, `ON DELETE SET NULL`), `details` JSONB, `timestamp`.
- Index theo `userId` và `timestamp` để tra cứu nhanh.

### Ràng buộc bổ sung trong migration
| Ràng buộc | Ý nghĩa |
| --- | --- |
| `Registration_active_per_campaign_key` | Chống đăng ký trùng (XOR 1) |
| `HealthCheck_bloodVolume_check` | `bloodVolume IN (250, 350)` |
| `HealthCheck_heartRate_check` | `20 <= heartRate <= 250` |
| `HealthCheck_weight_check` | `weight > 0` |
| `Campaign_capacity_check` | `capacity > 0` |
| `Campaign_overbookRate_check` | `overbookRate >= 1.0` |

> Prisma Schema Language (v6) chưa biểu diễn được `CHECK` và partial index, nên các
> ràng buộc này được thêm thủ công vào cuối file migration.

## 4. Mã hóa CCCD (`src/lib/crypto.ts`)

```ts
import { encryptCccd, decryptCccd, maskCccd } from "@/lib/crypto";

const enc = encryptCccd("001203004567");
// => { ciphertext, iv, authTag, hash }

await prisma.user.create({
  data: {
    name: "Nguyễn Văn A",
    email: "a@due.edu.vn",
    password: passwordHash,
    cccdCiphertext: enc.ciphertext,
    cccdIv: enc.iv,
    cccdAuthTag: enc.authTag,
    cccdHash: enc.hash,
  },
});

const cccd = decryptCccd(user);     // chuỗi 12 số
maskCccd(cccd!);                    // "001203******67"
```

- AES-256-GCM: IV ngẫu nhiên 12 byte cho mỗi bản ghi, có auth tag chống sửa dữ liệu.
- Blind index: `HMAC-SHA256(PII_BLIND_INDEX_KEY, cccd)` → tra cứu `where: { cccdHash }`.
- Khóa đọc từ `PII_ENCRYPTION_KEY` và `PII_BLIND_INDEX_KEY` (32 byte base64).
  **Không commit `.env`; không đổi khóa sau khi đã có dữ liệu.**

Sinh khóa mới:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 5. Chạy migration

```bash
# 1. Khởi động PostgreSQL (nếu dùng Docker) — map ra cổng 5433 để tránh
#    đụng PostgreSQL local thường chạy ở 5432
docker compose up -d

# 2. Cài dependency
npm install

# 3. Áp dụng migration + generate client (môi trường dev)
npm run db:migrate

# Hoặc chỉ áp dụng migration đã có (CI/production)
npm run db:deploy

# Generate lại client sau khi đổi schema
npm run db:generate

# Xem dữ liệu
npm run db:studio
```

Nếu dùng PostgreSQL có sẵn, chỉ cần sửa `DATABASE_URL` trong `.env` rồi chạy
`npm run db:migrate`.

## 6. Ghi chú triển khai

- `DATABASE_URL` bắt buộc cho Prisma CLI và runtime.
- Prisma Client được generate vào `node_modules/@prisma/client`; import qua
  `src/lib/prisma.ts` để dùng singleton (tránh cạn connection khi hot-reload).
- Migration khởi tạo đã được tạo sẵn bằng `prisma migrate diff` và **chưa apply**
  (môi trường hiện tại không có PostgreSQL đang chạy). Chạy `npm run db:migrate`
  để áp dụng.
