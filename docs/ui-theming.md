# UI/UX & Theming — Prompt 12 & 14

Giao diện được làm mới theo phong cách trẻ trung, sạch sẽ: nền sáng, thẻ bo góc lớn,
shadow mềm và điểm nhấn Rose/Crimson. Toàn bộ hệ thống hỗ trợ **Light/Dark mode**,
micro-interactions, glassmorphism, toast, confetti, skeleton và tooltip.

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

- Thẻ: `rounded-2xl` + `shadow-soft`; hover nhấc nhẹ (`-translate-y-1`) và đổ bóng.
- Nút, input, select, textarea, alert: `rounded-xl`.
- Nút có ripple CSS (`.ripple`) và scale nhẹ khi nhấn (`active:scale-[0.97]`).
- Nền trang dùng `.app-surface`: mesh gradient nhiều lớp, drift chậm; tự tắt khi
  `prefers-reduced-motion`.
- Header/Navbar dùng `.glass` (backdrop blur + nền trong mờ theo token).
- Tiêu đề/ nút có icon Lucide đi kèm.
- Microcopy tiếng Việt ngắn, thân thiện, hướng hành động; bỏ placeholder/giải thích thừa.
- Chú thích dài chuyển thành `InfoTooltip` (icon ⓘ, hiện khi hover/focus).

## 4. Motion & feedback

| Thành phần | File | Cách dùng |
| --- | --- | --- |
| Toast toàn cục | `components/ui/toast.tsx` | `useToast().toast({ tone, title, description })`; trượt từ phải, tự đóng sau 5s |
| Hộp thoại xác nhận | `components/ui/confirm-dialog.tsx` | `ConfirmDialog` thay cho `window.confirm` (xóa chiến dịch, chốt ca hiến máu); nền kính mờ, đóng bằng Esc |
| Confetti | `components/ui/confetti.tsx` | `<Confetti show={celebrate} />` khi đăng ký thành công |
| Skeleton | `components/ui/skeleton.tsx` | primitive `animate-pulse` |
| Page skeleton | `components/PageSkeleton.tsx` | dùng trong `loading.tsx` của các route |
| Tooltip | `components/ui/tooltip.tsx` | `InfoTooltip` / `Tooltip`, thuần CSS, dùng được ở Server Component |

`ToastProvider` được mount trong `src/app/layout.tsx` nên mọi Client Component đều
gọi được. Không còn spinner `animate-spin`; trạng thái chờ dùng icon `animate-pulse`
hoặc skeleton đồng bộ hình dáng nội dung.

## 5. Kiểm tra

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run build
```

Smoke test thủ công: bật/tắt theme ở trang đăng nhập, sinh viên, admin, ban tổ chức và
y tế; kiểm tra độ tương phản, không tràn layout.
