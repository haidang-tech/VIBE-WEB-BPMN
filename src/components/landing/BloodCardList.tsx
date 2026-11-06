import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BOOKING_HREF } from "./constants";

type Accent = "red" | "sky" | "emerald";

type InfoCard = {
  id?: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: Accent;
  badge: string;
  items: string[];
  cta: string;
  meta: string;
};

const ACCENTS: Record<
  Accent,
  { icon: string; badge: string; bar: string; check: string }
> = {
  red: {
    icon: "bg-red-50 text-red-600 ring-red-100 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20",
    badge: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
    bar: "from-red-500 to-rose-500",
    check: "text-red-500 dark:text-red-400",
  },
  sky: {
    icon: "bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20",
    badge: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
    bar: "from-sky-500 to-cyan-500",
    check: "text-sky-500 dark:text-sky-400",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
    badge:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    bar: "from-emerald-500 to-teal-500",
    check: "text-emerald-500 dark:text-emerald-400",
  },
};

const CARDS: InfoCard[] = [
  {
    id: "quy-trinh",
    title: "Quy trình hiến máu",
    description:
      "Chỉ với 4 bước đơn giản, bạn đã có thể trao đi một phần sự sống.",
    icon: ClipboardList,
    accent: "red",
    badge: "4 bước",
    items: [
      "Đăng ký trực tuyến trong 2 phút",
      "Khám sức khỏe nhanh tại chỗ",
      "Hiến máu an toàn cùng nhân viên y tế",
      "Nghỉ ngơi và nhận chứng nhận",
    ],
    cta: "Bắt đầu đăng ký",
    meta: "30–45 phút",
  },
  {
    title: "Địa điểm gần bạn",
    description:
      "Các chiến dịch được tổ chức ngay trong khuôn viên trường và tại trung tâm y tế.",
    icon: MapPin,
    accent: "sky",
    badge: "3 điểm hiến máu",
    items: [
      "Nhà văn hóa Trường ĐH Kinh tế – ĐHĐN",
      "Trung tâm Hiến máu nhân đạo Đà Nẵng",
      "Bệnh viện Đà Nẵng – Khoa Huyết học",
    ],
    cta: "Xem lịch & địa điểm",
    meta: "Trong khu vực Đà Nẵng",
  },
  {
    title: "Ai có thể hiến máu?",
    description:
      "Chỉ cần bạn khỏe mạnh và sẵn lòng chia sẻ, cơ hội đã ở rất gần.",
    icon: HeartPulse,
    accent: "emerald",
    badge: "Điều kiện cơ bản",
    items: [
      "Tuổi từ 18 đến 60",
      "Cân nặng từ 45 kg trở lên",
      "Không mắc bệnh lây nhiễm qua đường máu",
      "Sức khỏe ổn định trong ngày hiến",
    ],
    cta: "Kiểm tra điều kiện",
    meta: "Kiểm tra miễn phí",
  },
];

export default function BloodCardList() {
  return (
    <section
      id="dieu-kien"
      className="relative scroll-mt-24 border-y border-slate-200/70 bg-white/75 py-16 sm:py-20 lg:py-24 dark:border-white/10 dark:bg-slate-950/40"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute top-10 -left-24 size-72 rounded-full bg-red-100/50 blur-3xl dark:bg-red-900/10" />
        <div className="absolute -right-24 bottom-0 size-72 rounded-full bg-emerald-100/40 blur-3xl dark:bg-emerald-900/10" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full border border-red-200/80 bg-red-50/80 px-4 py-1.5 text-[11px] font-bold tracking-[0.16em] text-red-700 uppercase dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            Bạn cần biết
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-balance text-slate-950 sm:text-4xl dark:text-white">
            Hiến máu an toàn, bắt đầu từ{" "}
            <span className="text-red-600 dark:text-red-400">
              những điều đơn giản.
            </span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Mọi thông tin bạn cần trước khi tham gia hiến máu đều được tổng hợp
            rõ ràng, ngắn gọn và dễ tra cứu.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => {
            const Icon = card.icon;
            const accent = ACCENTS[card.accent];

            return (
              <article
                key={card.title}
                id={card.id}
                className="group relative flex h-full scroll-mt-28 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-card p-6 shadow-md shadow-slate-900/5 transition-all duration-300 will-change-transform hover:-translate-y-2 hover:border-red-200 hover:shadow-2xl hover:shadow-red-950/10 motion-reduce:transform-none motion-reduce:transition-none dark:border-white/10 dark:hover:border-red-500/20 dark:hover:shadow-black/40"
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                    accent.bar,
                  )}
                />

                <div className="flex items-start justify-between gap-4">
                  <span
                    className={cn(
                      "grid size-12 shrink-0 place-items-center rounded-2xl ring-1 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 motion-reduce:transform-none",
                      accent.icon,
                    )}
                  >
                    <Icon className="size-6" aria-hidden />
                  </span>

                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-[11px] font-bold",
                      accent.badge,
                    )}
                  >
                    {card.badge}
                  </span>
                </div>

                <h3 className="mt-5 text-xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {card.description}
                </p>

                <ul className="mt-5 space-y-3">
                  {card.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300"
                    >
                      <CheckCircle2
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          accent.check,
                        )}
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs font-medium text-slate-500 dark:border-white/10 dark:text-slate-400">
                    <span>{card.meta}</span>
                    <Link
                      href={BOOKING_HREF}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 transition-colors hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
                    >
                      {card.cta}
                      <ArrowUpRight
                        className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        aria-hidden
                      />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-6 py-4 text-sm font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2
              className="size-4 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
            Hướng dẫn bởi nhân viên y tế
          </span>
          <span className="inline-flex items-center gap-2">
            <CheckCircle2
              className="size-4 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
            Thiết bị hiến máu vô trùng
          </span>
          <span className="inline-flex items-center gap-2">
            <CheckCircle2
              className="size-4 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
            Bảo mật thông tin cá nhân
          </span>
        </div>
      </div>
    </section>
  );
}
