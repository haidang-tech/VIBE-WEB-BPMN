# Auth, RBAC & Validation — Prompt 2

## 1. File đã tạo

```
src/lib/validations.ts                  # Zod schemas dùng chung client/server
src/lib/jwt.ts                          # Ký & xác thực JWT (Edge-safe, jose)
src/lib/auth.ts                         # getSession / requireSession / requireRole
src/lib/rbac.ts                         # Role, route prefix, public paths
src/lib/audit.ts                        # AuditLog helper (Prisma)
src/lib/rate-limit.ts                   # Rate limit login (in-memory)
src/middleware.ts                       # Xác thực JWT + RBAC + audit truy cập
src/app/api/auth/login/route.ts         # POST đăng nhập
src/app/api/auth/logout/route.ts        # POST đăng xuất
src/app/api/internal/audit/route.ts     # Endpoint nội bộ cho middleware ghi audit
src/app/login/page.tsx                  # Trang đăng nhập
src/app/login/login-form.tsx            # Form client
src/app/page.tsx                        # Redirect theo role
prisma/seed.ts                          # Tài khoản demo 4 role
```

## 2. Luồng đăng nhập

```
POST /api/auth/login { email, password }
  → Zod validate (loginSchema)
  → Rate limit theo IP + theo (IP, email)
  → Prisma tìm user theo email
  → bcrypt.compare (luôn chạy, kể cả email không tồn tại → chống timing attack)
  → Ký JWT HS256 { sub: userId, role } (TTL 8 giờ)
  → Set-Cookie: due_session (HTTPOnly, Secure, SameSite=Lax, Path=/)
  → Ghi AuditLog AUTH_LOGIN_SUCCESS
  → Trả { success, user, redirectTo }
```

- Thông báo lỗi luôn là **"Email hoặc mật khẩu không đúng"** cho cả hai trường hợp
  sai email / sai mật khẩu (không lộ email đã tồn tại).
- JWT **không chứa email, họ tên hay CCCD**; chỉ có `sub` và `role` để giảm rò rỉ PII.
- Token hết hạn sau `SESSION_TTL_SECONDS` (mặc định 28.800 giây = 8 giờ), được kiểm
  tra tự động bởi `jwtVerify` (issuer + audience + algorithm).

### Thuộc tính cookie

| Thuộc tính | Giá trị |
| --- | --- |
| Name | `due_session` |
| HttpOnly | `true` — JavaScript không đọc được |
| Secure | `true` mặc định (đặt `COOKIE_SECURE=false` chỉ khi test HTTP không phải localhost) |
| SameSite | `Lax` — giảm CSRF |
| Path | `/` |
| Max-Age | `SESSION_TTL_SECONDS` |

## 3. RBAC trong middleware

| Role | Được phép |
| --- | --- |
| `STUDENT` | `/student/**` |
| `ORGANIZER` | `/organizer/**` |
| `MEDICAL` | `/medical/**` |
| `ADMIN` | `/admin/**` |

Quy tắc:

- Chưa đăng nhập + route bảo vệ → `307` về `/login?next=<path>` (open redirect đã bị chặn).
- Chưa đăng nhập + `/api/**` → `401` JSON.
- Sai role + page → **`403`** kèm trang HTML.
- Sai role + API → **`403`** JSON.
- Đã đăng nhập mà vào `/login` → redirect về trang chủ của role.
- Mọi API khác (trừ public) chỉ cần đăng nhập, role cụ thể do handler kiểm tra.

Middleware xóa header `x-user-id` / `x-user-role` do client gửi rồi mới gắn giá trị từ JWT,
tránh giả mạo danh tính xuống server components.

### Route công khai

`/login`, `/403`, `/api/auth/login`, `/api/internal/audit`.

## 4. Audit Log

Các action đang dùng:

| Action | Khi nào |
| --- | --- |
| `AUTH_LOGIN_SUCCESS` | Đăng nhập thành công |
| `AUTH_LOGIN_FAILED` | Sai email / mật khẩu |
| `AUTH_LOGIN_RATE_LIMITED` | Vượt rate limit |
| `AUTH_LOGOUT` | Đăng xuất |
| `ACCESS_DENIED` | Truy cập sai role (ghi từ middleware) |

Middleware chạy Edge runtime nên không dùng Prisma trực tiếp. Khi chặn truy cập, nó gọi
`POST /api/internal/audit` kèm header `x-audit-secret` (so sánh constant-time với
`AUDIT_INTERNAL_SECRET`).

`writeAuditLog()` không bao giờ throw — lỗi ghi log chỉ in ra console, không làm hỏng
luồng nghiệp vụ.

## 5. Validation (Zod)

| Schema | Dùng cho |
| --- | --- |
| `loginSchema` | Đăng nhập |
| `donationRegistrationSchema` | Form đăng ký hiến máu (Prompt 4) |
| `healthCheckSchema` | Form khám sức khỏe (Prompt 6) |
| `auditLogInputSchema` | Endpoint audit nội bộ |

Các primitive tái sử dụng: `emailSchema`, `cccdSchema` (chuẩn hóa 12 số), `phoneSchema`,
`dateOfBirthSchema`, `bloodPressureSchema`, `passwordPolicySchema`.

Helper: `zodFieldErrors()` trả `{ field: message }`, `calculateAge()` tính tuổi theo UTC.

## 6. Rate limit

- 5 lần / 15 phút cho mỗi cặp `(IP, email)`.
- 20 lần / 15 phút cho mỗi IP.
- Vượt → `429` + header `Retry-After`, đồng thời ghi audit.
- Đăng nhập thành công reset bộ đếm của cặp `(IP, email)`.

> Đây là bộ đếm in-memory, chỉ đúng khi chạy 1 instance. Production cần Redis/WAF.

## 7. Tài khoản demo

`prisma/seed.ts` tạo 4 tài khoản, mật khẩu chung `DUE@12345`:

| Email | Role |
| --- | --- |
| `admin@due.edu.vn` | ADMIN |
| `organizer@due.edu.vn` | ORGANIZER |
| `medical@due.edu.vn` | MEDICAL |
| `student@due.edu.vn` | STUDENT |

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

## 8. Kiểm thử nhanh bằng curl

```bash
# Đăng nhập, lưu cookie
curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@due.edu.vn","password":"DUE@12345"}'

# Vào đúng role (page chưa xây ở Prompt 2 nên trả 404 = đã qua middleware)
curl -b cookies.txt http://localhost:3000/student/register

# Sai role => 403
curl -b cookies.txt http://localhost:3000/admin/dashboard
```

## 9. Ghi chú bảo mật

- Mật khẩu chỉ lưu dạng bcrypt (cost 12 trong seed), không bao giờ trả về client.
- So sánh bcrypt luôn chạy kể cả khi email không tồn tại.
- Generic error message, không lộ tài khoản có tồn tại hay không.
- JWT tối giản, cookie HttpOnly + Secure + SameSite=Lax.
- Header danh tính do middleware gắn, client gửi header giả sẽ bị xóa.
- Security headers toàn cục: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS (production).
- `.env` (chứa `JWT_SECRET`, khóa PII) đã nằm trong `.gitignore`.
