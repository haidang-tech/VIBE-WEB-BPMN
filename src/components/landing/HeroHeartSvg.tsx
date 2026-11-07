/** Dạng sóng điện tâm đồ: P wave → QRS → T wave, trải đều trên viewBox 600×140. */
export const ECG_PATH =
  "M0 70H80l10-5 10 5H140l6 0 6 10 8-72 8 62 6 0H250q18-28 36 0H340l10-6 10 6H600";

/**
 * Bản vẽ SVG của trái tim + giọt máu + điện tâm đồ.
 * Dùng làm fallback khi trình duyệt không dựng được WebGL (hoặc trước khi
 * canvas 3D sẵn sàng) để phần hero không bao giờ bị trống.
 */
export default function HeroHeartSvg() {
  return (
    <>
      {/* Đường điện tâm đồ chạy phía sau trái tim, tạo cảm giác monitor y tế sống. */}
      <div
        aria-hidden
        className="hero-ecg-strip pointer-events-none absolute top-[64%] left-1/2 z-0 w-[26rem] -translate-x-1/2 -translate-y-1/2 sm:w-[34rem]"
      >
        <svg viewBox="0 0 600 140" fill="none" aria-hidden className="w-full overflow-visible">
          <defs>
            <linearGradient id="hero-ecg-fade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="12%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.8" />
              <stop offset="88%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <filter id="hero-ecg-glow" x="-10%" y="-200%" width="120%" height="500%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>

          <path
            className="hero-ecg-base"
            d={ECG_PATH}
            stroke="url(#hero-ecg-fade)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="hero-ecg-spark"
            d={ECG_PATH}
            pathLength={1}
            stroke="#ffffff"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.18"
            filter="url(#hero-ecg-glow)"
          />
          <path
            className="hero-ecg-spark"
            d={ECG_PATH}
            pathLength={1}
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <svg
        viewBox="0 0 240 240"
        className="hero-heart-beat relative z-10 size-48 sm:size-56"
        role="img"
        aria-label="Trái tim 3D màu trắng với giọt máu đỏ bên trong đập theo nhịp tim"
      >
        <defs>
          <radialGradient id="hero-heart-body" cx="36%" cy="26%" r="78%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="38%" stopColor="#fff7f8" />
            <stop offset="72%" stopColor="#ffe4e6" />
            <stop offset="100%" stopColor="#fda4af" />
          </radialGradient>
          <radialGradient id="hero-heart-shade" cx="68%" cy="72%" r="62%">
            <stop offset="42%" stopColor="#9f1239" stopOpacity="0" />
            <stop offset="82%" stopColor="#9f1239" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#881337" stopOpacity="0.34" />
          </radialGradient>
          <linearGradient id="hero-heart-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#fb7185" stopOpacity="0.55" />
          </linearGradient>
          <radialGradient id="hero-heart-gloss" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hero-drop-outer" cx="34%" cy="26%" r="78%">
            <stop offset="0%" stopColor="#fecdd3" />
            <stop offset="18%" stopColor="#fb7185" />
            <stop offset="52%" stopColor="#e11d48" />
            <stop offset="82%" stopColor="#9f1239" />
            <stop offset="100%" stopColor="#4c0519" />
          </radialGradient>
          <radialGradient id="hero-liquid-light" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#ffe4e6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <path
            id="hero-drop-shape"
            d="M120 104C120 104 90 142 90 162C90 179 103 192 120 192C137 192 150 179 150 162C150 142 120 104 120 104Z"
          />
          <clipPath id="hero-drop-clip">
            <use href="#hero-drop-shape" />
          </clipPath>
          <filter id="hero-liquid-blur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id="hero-heart-soft-shadow" x="-40%" y="-30%" width="180%" height="190%">
            <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#4c0519" floodOpacity="0.42" />
          </filter>
        </defs>

        {/* Thân tim: gradient khối cầu + bóng đổ + viền sáng. */}
        <g filter="url(#hero-heart-soft-shadow)">
          <path
            d="M120 208C62 164 24 126 24 86C24 54 48 32 78 32C98 32 113 43 120 57C127 43 142 32 162 32C192 32 216 54 216 86C216 126 178 164 120 208Z"
            fill="url(#hero-heart-body)"
          />
          <path
            d="M120 208C62 164 24 126 24 86C24 54 48 32 78 32C98 32 113 43 120 57C127 43 142 32 162 32C192 32 216 54 216 86C216 126 178 164 120 208Z"
            fill="url(#hero-heart-shade)"
          />
          <path
            d="M120 208C62 164 24 126 24 86C24 54 48 32 78 32C98 32 113 43 120 57C127 43 142 32 162 32C192 32 216 54 216 86C216 126 178 164 120 208Z"
            fill="none"
            stroke="url(#hero-heart-rim)"
            strokeWidth="1.6"
          />
        </g>

        {/* Giọt máu 3D: nền đỏ bóng, highlight lỏng chuyển động bên trong. */}
        <use
          href="#hero-drop-shape"
          fill="url(#hero-drop-outer)"
          stroke="#881337"
          strokeOpacity="0.28"
          strokeWidth="2"
        />
        <g clipPath="url(#hero-drop-clip)">
          <ellipse
            className="hero-liquid-glint"
            cx="126"
            cy="146"
            rx="14"
            ry="20"
            fill="url(#hero-liquid-light)"
            filter="url(#hero-liquid-blur)"
          />
          <ellipse
            className="hero-liquid-glint-slow"
            cx="106"
            cy="171"
            rx="10"
            ry="14"
            fill="#fecdd3"
            opacity="0.55"
            filter="url(#hero-liquid-blur)"
          />
          <path
            className="hero-liquid-glint"
            d="M98 168c9 6 18 8 28 6"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.38"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#hero-liquid-blur)"
          />
        </g>
        <use
          href="#hero-drop-shape"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.32"
          strokeWidth="1.4"
        />
        <path
          d="M108 148c-4 10-1 22 8 28"
          fill="none"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.55"
          filter="url(#hero-liquid-blur)"
        />
        <ellipse
          cx="106"
          cy="151"
          rx="4"
          ry="6"
          fill="#ffffff"
          opacity="0.75"
          transform="rotate(-24 106 151)"
        />
        <circle cx="136" cy="170" r="2" fill="#ffffff" opacity="0.45" />
        <circle cx="128" cy="182" r="1.5" fill="#ffffff" opacity="0.35" />

        {/* Highlight lớn và viền sáng giúp khối tim trông như sứ bóng. */}
        <ellipse
          cx="79"
          cy="70"
          rx="30"
          ry="18"
          fill="url(#hero-heart-gloss)"
          opacity="0.8"
          transform="rotate(-28 79 70)"
          filter="url(#hero-liquid-blur)"
        />
        <ellipse
          cx="70"
          cy="63"
          rx="12"
          ry="5"
          fill="#ffffff"
          opacity="0.65"
          transform="rotate(-30 70 63)"
        />
        <path
          d="M48 88c3 18 14 34 31 47"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.38"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#hero-liquid-blur)"
        />
        <path
          d="M168 56c14 9 25 22 29 38"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.28"
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="url(#hero-liquid-blur)"
        />
        <circle cx="164" cy="82" r="5" fill="#fecdd3" opacity="0.85" />
        <circle cx="76" cy="110" r="3.5" fill="#fecdd3" opacity="0.7" />
        <circle cx="178" cy="138" r="3" fill="#fecdd3" opacity="0.6" />
      </svg>
    </>
  );
}
