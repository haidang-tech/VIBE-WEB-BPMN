import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CirclePlay,
  Clock3,
  Droplet,
  HeartPulse,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import HeroHeart3D from "./HeroHeart3D";
import { BOOKING_HREF } from "./constants";

const STATS = [
  { value: "2.500+", label: "Sinh viên tham gia" },
  { value: "12", label: "Chiến dịch mỗi năm" },
  { value: "100%", label: "Miễn phí & bảo mật" },
] as const;

export default function HeroSection() {
  return (
    <section id="top" className="relative isolate overflow-hidden">
      {/* Nền mềm, giữ tinh thần y tế sạch sẽ nhưng vẫn có điểm nhấn đỏ. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-32 size-[28rem] rounded-full bg-red-200/50 blur-3xl dark:bg-red-900/20" />
        <div className="absolute top-24 -right-24 size-80 rounded-full bg-rose-100/70 blur-3xl dark:bg-rose-900/10" />
        <div className="absolute bottom-0 left-1/3 h-64 w-[44rem] -translate-x-1/2 rounded-full bg-orange-100/50 blur-3xl dark:bg-orange-900/10" />
      </div>

      <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:pt-20 lg:pb-24">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-red-200/80 bg-white/80 px-4 py-1.5 text-[11px] font-bold tracking-[0.16em] text-red-700 uppercase shadow-sm backdrop-blur dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-red-600" />
            </span>
            Hiến máu cứu người
          </span>

          <h1 className="mt-6 text-[2rem] leading-[1.08] font-extrabold tracking-tight text-balance text-slate-950 min-[380px]:text-4xl sm:text-5xl lg:text-[3.5rem] dark:text-white">
            Một giọt máu của bạn,{" "}
            <span className="relative whitespace-nowrap text-red-600 dark:text-red-400">
              một cuộc đời
              <svg
                aria-hidden
                viewBox="0 0 220 12"
                className="absolute -bottom-1 left-0 h-2.5 w-full text-red-300/80 dark:text-red-500/40"
                preserveAspectRatio="none"
              >
                <path
                  d="M3 8.5C58 3 145 2.5 217 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            được ở lại.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
            Hiến máu là nghĩa cử nhỏ nhưng có thể mang lại cơ hội sống cho người
            bệnh. Hãy cùng sinh viên DUE lan tỏa sự sẻ chia, bắt đầu từ một lần
            đăng ký hôm nay.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-xl bg-red-600 px-6 text-base font-semibold text-white shadow-lg shadow-red-600/25 hover:bg-red-700 hover:shadow-red-600/30"
            >
              <Link href={BOOKING_HREF}>
                Đặt lịch hiến máu
                <ArrowRight aria-hidden />
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-xl border-slate-200 bg-white/80 px-6 text-base font-semibold text-slate-700 shadow-sm backdrop-blur hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-red-500/20 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <a href="#quy-trinh">
                <CirclePlay aria-hidden />
                Tìm hiểu quy trình
              </a>
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck
                className="size-4 text-emerald-600 dark:text-emerald-400"
                aria-hidden
              />
              Quy trình chuẩn y tế
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock3 className="size-4 text-red-600 dark:text-red-400" aria-hidden />
              Chỉ mất 30–45 phút
            </span>
            <span className="inline-flex items-center gap-2">
              <HeartPulse
                className="size-4 text-rose-600 dark:text-rose-400"
                aria-hidden
              />
              Hoàn toàn miễn phí
            </span>
          </div>

          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-slate-200/80 pt-6 sm:gap-6 dark:border-white/10">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="block text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
                    {stat.value}
                  </span>
                  <span className="mt-1 block text-xs leading-snug font-medium text-slate-500 sm:text-sm dark:text-slate-400">
                    {stat.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            aria-hidden
            className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-red-200/80 via-rose-100/50 to-transparent blur-2xl dark:from-red-900/30 dark:via-rose-900/10"
          />

          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-red-500 via-red-600 to-rose-700 p-6 shadow-2xl shadow-red-600/25 ring-1 ring-white/20 sm:p-8">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.2)_1px,transparent_0)] bg-[length:18px_18px] opacity-60"
            />
            <div
              aria-hidden
              className="absolute -top-24 -right-20 size-64 rounded-full border border-white/15"
            />
            <div
              aria-hidden
              className="absolute -bottom-28 -left-20 size-72 rounded-full border border-white/15"
            />
            <div
              aria-hidden
              className="absolute top-1/3 left-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-2xl"
            />

            <div className="relative flex min-h-[26rem] flex-col justify-between sm:min-h-[31rem]">
              <div className="flex items-start justify-between gap-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-white uppercase backdrop-blur-sm">
                  <span className="size-1.5 rounded-full bg-emerald-300" />
                  Cộng đồng hiến máu DUE
                </span>

                <div className="hidden size-20 rotate-6 place-items-center rounded-full border border-white/25 bg-white/10 text-center text-[10px] leading-tight font-bold tracking-wide text-white uppercase backdrop-blur-sm sm:grid">
                  1 giọt máu
                  <br />
                  <span className="text-base">3 cuộc đời</span>
                </div>
              </div>

              <HeroHeart3D />

              <div className="relative">
                <svg
                  aria-hidden
                  viewBox="0 0 400 32"
                  className="mb-4 h-6 w-full text-white/25"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0 18H112l10-9 9 18 10-13 8 4H400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                <p className="max-w-xs text-xl font-bold tracking-tight text-white sm:text-2xl">
                  Mỗi giọt máu, một hy vọng mới.
                </p>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/80">
                  Hiến máu an toàn, miễn phí và thông tin của bạn được bảo mật
                  tuyệt đối.
                </p>
              </div>
            </div>
          </div>

          {/* Thẻ nổi minh họa — chỉ hiện từ màn hình sm để không che nội dung chính. */}
          <div className="absolute top-24 -left-4 hidden items-center gap-3 rounded-2xl border border-white/70 bg-white/95 p-3.5 shadow-xl shadow-red-950/10 backdrop-blur sm:flex lg:-left-8 dark:border-white/10 dark:bg-slate-900/95">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
              <Droplet className="size-5 fill-current" aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">
                Đang cần
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Nhóm máu O−, A+
              </p>
            </div>
          </div>

          <div className="absolute -right-3 -bottom-5 hidden w-52 rounded-2xl border border-white/70 bg-white/95 p-4 shadow-xl shadow-red-950/10 backdrop-blur sm:block lg:-right-8 dark:border-white/10 dark:bg-slate-900/95">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.12em] text-emerald-600 uppercase dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" aria-hidden />
              Sẵn sàng đồng hành
            </p>
            <p className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">
              Đăng ký trong 2 phút
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Kiểm tra sức khỏe miễn phí trước khi hiến.
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-red-500 to-rose-500" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
