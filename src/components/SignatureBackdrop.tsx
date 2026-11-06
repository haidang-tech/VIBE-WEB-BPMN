/**
 * Hoa văn nền đặc trưng của web hiến máu DUE: mèo + giọt máu.
 *
 * Được vẽ bằng SVG pattern rất nhạt, cố định phía sau nội dung nên không ảnh
 * hưởng tới khả năng đọc, responsive hay thao tác của người dùng. Không dùng
 * ảnh bitmap để giữ nhẹ trang và tự đổi màu theo light/dark.
 */

export default function SignatureBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="bg-primary/[0.05] absolute -left-32 top-24 size-[30rem] rounded-full blur-3xl" />
      <div className="bg-primary/[0.04] absolute -right-28 bottom-0 size-[26rem] rounded-full blur-3xl" />

      <svg
        className="text-primary/[0.07] dark:text-primary/[0.1] absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="due-cat-blood-signature"
            width="176"
            height="176"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-6)"
          >
            <g
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Mèo — biểu tượng may mắn, gần gũi sinh viên */}
              <path d="M30 62 28 36l18 10c4-1.5 8-2.2 12-2.2s8 .7 12 2.2l18-10-2 24c2.5 4 4 8.5 4 13 0 14-13 23-32 23S26 87 26 73c0-4.5 1.5-9 4-13Z" />
              <circle cx="46" cy="64" r="2.4" fill="currentColor" stroke="none" />
              <circle cx="70" cy="64" r="2.4" fill="currentColor" stroke="none" />
              <path d="M56 71h4l-2 3Z" fill="currentColor" stroke="none" />
              <path d="M58 74v4M58 78c-2 2-5 2-7 0M58 78c2 2 5 2 7 0" />
              <path d="M30 68l-11-2M30 72l-11 2M76 68l11-2M76 72l11 2" />

              {/* Giọt máu lớn */}
              <path d="M126 26c0 0-13 15-13 24a13 13 0 0 0 26 0c0-9-13-24-13-24Z" />
              <path d="M119 50a7 7 0 0 0 7 7" opacity="0.7" />

              {/* Giọt máu nhỏ + dấu chân mèo */}
              <path d="M143 108c0 0-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11Z" />
              <circle cx="72" cy="134" r="3" />
              <circle cx="84" cy="129" r="2.4" />
              <circle cx="95" cy="133" r="2.4" />
              <path d="M83 143c-4 0-7-3-7-7 0-3 3-5 6-4l3 1 3-1c3-1 6 1 6 4 0 4-3 7-7 7Z" />
            </g>
          </pattern>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill="url(#due-cat-blood-signature)"
        />
      </svg>
    </div>
  );
}
