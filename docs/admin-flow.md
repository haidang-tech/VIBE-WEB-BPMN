# Flow Admin — Quản lý chiến dịch & Báo cáo (Prompt 7)

Kết quả **Prompt 7**: phân hệ quản trị gồm CRUD Campaign (capacity, overbookRate) và
dashboard thống kê bằng Recharts.

## 1. Cấu trúc file

```
src/
  app/(roles)/admin/
    layout.tsx                 # Khung trang quản trị
    admin-nav.tsx              # Điều hướng Chiến dịch / Báo cáo
    page.tsx                   # /admin -> /admin/reports
    dashboard/page.tsx         # /admin/dashboard -> /admin/reports
    campaigns/page.tsx         # Server Component: danh sách + thống kê hồ sơ
    reports/page.tsx           # Thống kê nhóm máu & lượng máu
  actions/
    admin.ts                   # createCampaign / updateCampaign / deleteCampaign
  components/
    CampaignManager.tsx        # Bảng CRUD + form tạo/sửa
    ReportsCharts.tsx          # Biểu đồ tròn & cột (Recharts)
  lib/
    campaign-status.ts         # Nhãn/trạng thái CampaignStatus
    validations.ts             # campaignFormSchema dùng chung client/server
```

Thư viện biểu đồ: `recharts` (đã thêm vào `package.json`).

## 2. CRUD Campaign — `/admin/campaigns`

Bảng hiển thị:

- Tên, ngày, địa điểm.
- `capacity` (chỉ tiêu chính thức).
- `overbookRate` (hệ số overbook).
- Sức chứa tối đa = `floor(capacity × overbookRate)`.
- Số hồ sơ và số ca hoàn thành.
- Trạng thái: Bản nháp / Đang hoạt động / Đã kết thúc / Đã hủy.
- Thao tác Sửa / Xóa.

Form bên phải dùng React Hook Form + `campaignFormSchema`:

| Trường | Ràng buộc |
| --- | --- |
| `name` | 3–150 ký tự |
| `date` | `YYYY-MM-DD`, lưu theo múi giờ Việt Nam (UTC+7) |
| `location` | 3–200 ký tự |
| `capacity` | Số nguyên 1–100.000 |
| `overbookRate` | Số thực 1.0–3.0 |
| `status` | `DRAFT / ACTIVE / COMPLETED / CANCELLED` |

Form hiển thị ngay **sức chứa tối đa dự kiến** khi thay đổi capacity/overbook.

### Server Actions — `src/actions/admin.ts`

- `createCampaign(data)`
- `updateCampaign({ id, ...data })`
- `deleteCampaign(campaignId)`

Quy tắc chung:

- Chỉ role `ADMIN` được gọi (kiểm tra ở server).
- Validate toàn bộ input bằng Zod, trả `errors` theo từng field.
- Ghi AuditLog: `CAMPAIGN_CREATED`, `CAMPAIGN_UPDATED`, `CAMPAIGN_DELETED`.
- Không xóa chiến dịch đã có hồ sơ đăng ký (`CAMPAIGN_HAS_REGISTRATIONS`) để bảo
  toàn dữ liệu; thay vào đó chuyển trạng thái sang `CANCELLED`.
- Xử lý `P2025` khi chiến dịch không còn tồn tại.

## 3. Báo cáo — `/admin/reports`

Nguồn dữ liệu: các `Registration` có trạng thái `COMPLETED` và `HealthCheck` tương ứng.

Thẻ thống kê:

- Tổng chiến dịch và số đang hoạt động.
- Tổng ca hiến thành công.
- Tổng lượng máu thu được (ml và L).
- Số ca đã ghi nhận nhóm máu.

Biểu đồ:

1. **Biểu đồ tròn** — phân bố nhóm máu A, B, AB, O; kèm số ca và tỷ lệ %.
2. **Biểu đồ cột** — tổng lượng máu (ml) thu được theo từng chiến dịch.

Bảng chi tiết theo chiến dịch: ngày, trạng thái, số ca hoàn thành, lượng máu.

Trường hợp chưa có ca hoàn thành, hai biểu đồ hiển thị trạng thái rỗng kèm gợi ý
chốt kết quả ở khu vực y tế.

## 4. Kiểm thử thủ công

Điều kiện: `docker compose up -d`, `npm run db:deploy`, `npm run db:seed`.

1. Đăng nhập `admin@due.edu.vn / DUE@12345`.
2. Vào `/admin/campaigns`:
   - Tạo chiến dịch mới với `capacity = 50`, `overbookRate = 1.5` → cột tối đa
     hiển thị `75`.
   - Sửa chiến dịch, đổi chỉ tiêu/trạng thái → bảng cập nhật.
   - Thử xóa chiến dịch chưa có hồ sơ → thành công.
   - Thử xóa chiến dịch đã có hồ sơ → bị chặn kèm thông báo.
3. Vào `/admin/reports`:
   - Xem thẻ thống kê và bảng chi tiết.
   - Sau khi khu vực y tế chốt ca **Thành công**, biểu đồ tròn/cột cập nhật.
4. Kiểm tra `AuditLog` có các action `CAMPAIGN_CREATED`, `CAMPAIGN_UPDATED`,
   `CAMPAIGN_DELETED`.

## 5. Lưu ý bảo mật & dữ liệu

- RBAC kiểm tra ở middleware và trong từng Server Action.
- Không dùng `capacity`/`overbookRate` từ client trực tiếp; luôn validate lại.
- Xóa chiến dịch có hồ sơ bị chặn ở server, không chỉ ẩn nút trên UI.
- Báo cáo chỉ đọc dữ liệu đã chốt `COMPLETED`, không tính hồ sơ bị hủy/không đạt.
- Biểu đồ dùng màu cố định cho 4 nhóm máu, dễ đọc trên cả nền sáng/tối.
