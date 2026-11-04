# UI/UX & Theming — Prompt 12

Giao diện được làm mới theo phong cách trẻ trung, sạch sẽ: nền sáng, thẻ bo góc lớn,
shadow mềm và điểm nhấn Rose/Crimson. Toàn bộ hệ thống hỗ trợ **Light/Dark mode**.

## 1. Bảng màu & token

Token được khai báo trong `src/app/globals.css` dưới dạng CSS variables và map sang
Tailwind qua `@theme inline`.

| Token | Light | Dark |
| --- | --- | --- |
| `--background` | trắng hồng rất nhạt | slate đậm |
| `--foreground` | xám đậm | slate sáng |
| `--primary` | Rose/Crimson tươi | đỏ dịu hơn, đỡ chói |
| `--card` | trắng | slate nhạt hơn nền |
| `--muted-foreground` | xám trung tính | xám sáng |

Dùng class token (`bg-background`, `text-foreground`, `bg-primary`,
`text-muted-foreground`, `border-border`…) thay cho màu hardcode để giao diện tự đổi
theo theme.

## 2. Dark/Light mode

- `.dark` được gắn lên `<html>`.
- Lựa chọn lưu ở `localStorage` với key `due-theme`.
- Lần đầu truy cập sẽ theo `prefers-color-scheme` của hệ điều hành.
- Script inline trong `src/app/layout.tsx` chạy trước khi paint để tránh nháy màu (FOUC).
- `src/components/ThemeToggle.tsx` đặt ở header các khu vực và ở trang đăng nhập/đăng ký.
  Icon đổi bằng CSS (`dark:hidden` / `hidden dark:block`) nên không lệch hydration.

## 3. Quy ước giao diện

- Thẻ: `rounded-2xl` + `shadow-soft`.
- Nút, input, select, textarea, alert: `rounded-xl`.
- Nền trang dùng `.app-surface` để có vệt hồng phấn nhẹ.
- Tiêu đề/ nút có icon Lucide đi kèm.
- Microcopy tiếng Việt ngắn, thân thiện, hướng hành động; bỏ placeholder/giải thích thừa.

## 4. Kiểm tra

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run build
```

Smoke test thủ công: bật/tắt theme ở trang đăng nhập, sinh viên, admin, ban tổ chức và
y tế; kiểm tra độ tương phản, không tràn layout.
