import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Droplet,
  HeartHandshake,
  Mail,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BOOKING_HREF } from "./constants";

const EXPLORE_LINKS = [
  { href: "/", label: "Trang chủ" },
  { href: "#lich-hien-mau", label: "Lịch hiến máu" },
  { href: "#quy-trinh", label: "Quy trình hiến máu" },
  { href: "#dieu-kien", label: "Điều kiện tham gia" },
  { href: "#ve-chung-toi", label: "Về chúng tôi" },
] as const;

const STUDENT_LINKS = [
  { href: "/login", label: "Đăng nhập" },
  { href: "/register", label: "Tạo tài khoản" },
  { href: BOOKING_HREF, label: "Đặt lịch hiến máu" },
] as const;

export default function LandingFooter() {
  return (
    <>
      <section
        id="ve-chung-toi"
        className="relative scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-red-600 via-red-600 to-rose-700 px-6 py-12 shadow-2xl shadow-red-600/25 sm:px-10 sm:py-14 lg:px-14 dark:shadow-black/40">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.18)_1px,transparent_0)] bg-[length:22px_22px] opacity-50"
          />
          <div
            aria-hidden
            className="absolute -top-24 -right-16 size-72 rounded-full border border-white/15"
          />
          <div
            aria-hidden
            className="absolute -bottom-28 -left-16 size-80 rounded-full border border-white/15"
          />

          <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto] lg:gap-12">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[11px] font-bold tracking-[0.16em] text-white uppercase backdrop-blur-sm">
                <HeartHandshake className="size-3.5" aria-hidden />
                Về chúng tôi
              </span>

              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-balance text-white sm:text-4xl">
                Mỗi người một giọt máu, cộng đồng thêm một nhịp đập.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
                Hiến máu DUE kết nối sinh viên với các chiến dịch hiến máu an
                toàn, minh bạch và nhân văn. Chúng tôi tin rằng một hành động nhỏ
                hôm nay có thể mở ra ngày mai tươi sáng hơn cho ai đó.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl bg-white px-6 text-base font-bold text-red-700 shadow-lg shadow-red-950/20 hover:bg-red-50 hover:text-red-800"
              >
                <Link href={BOOKING_HREF}>
                  Đặt lịch ngay
                  <ArrowRight aria-hidden />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-xl border-white/40 bg-white/10 px-6 text-base font-semibold text-white backdrop-blur-sm hover:border-white/60 hover:bg-white/20 hover:text-white dark:border-white/40 dark:bg-white/10 dark:hover:bg-white/20"
              >
                <a href="#dieu-kien">Tìm hiểu thêm</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative overflow-hidden bg-slate-950 text-slate-300">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_320px_at_12%_0%,rgba(220,38,38,0.16),transparent_70%)]"
        />

        <div className="relative mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-3"
                aria-label="Hiến máu DUE – Trang chủ"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-red-500 to-red-700 text-white shadow-lg shadow-red-600/20">
                  <Droplet className="size-6 fill-current" aria-hidden />
                </span>
                <span className="leading-tight">
                  <span className="block text-[15px] font-bold tracking-tight text-white">
                    Hiến máu DUE
                  </span>
                  <span className="block text-[10px] font-semibold tracking-[0.18em] text-red-400 uppercase">
                    Chung tay vì sự sống
                  </span>
                </span>
              </Link>

              <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
                Kết nối sinh viên với các chiến dịch hiến máu an toàn, minh bạch
                và nhân văn.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  { icon: ShieldCheck, label: "An toàn" },
                  { icon: HeartHandshake, label: "Miễn phí" },
                  { icon: Droplet, label: "Bảo mật" },
                ].map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-300"
                  >
                    <Icon className="size-3 text-red-400" aria-hidden />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold tracking-wide text-white uppercase">
                Khám phá
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {EXPLORE_LINKS.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-bold tracking-wide text-white uppercase">
                Dành cho sinh viên
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {STUDENT_LINKS.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-bold tracking-wide text-white uppercase">
                Liên hệ
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-400">
                <li className="flex items-start gap-2.5">
                  <MapPin
                    className="mt-0.5 size-4 shrink-0 text-red-400"
                    aria-hidden
                  />
                  <span>
                    Trường Đại học Kinh tế – ĐHĐN
                    <br />
                    71 Ngũ Hành Sơn, Đà Nẵng
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Clock3
                    className="size-4 shrink-0 text-red-400"
                    aria-hidden
                  />
                  <span>Thứ 2 – Thứ 6, 8:00 – 17:00</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail className="size-4 shrink-0 text-red-400" aria-hidden />
                  <span>Văn phòng Đoàn – Hội sinh viên</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Hiến máu DUE. Kết nối cộng đồng – Sẻ chia sự sống.</p>
            <p className="inline-flex items-center gap-1.5">
              <HeartHandshake className="size-3.5 text-red-400" aria-hidden />
              Được xây dựng cho cộng đồng sinh viên DUE.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
