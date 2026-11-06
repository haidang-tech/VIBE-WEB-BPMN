import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarHeart,
  Clock3,
  Droplet,
  Info,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BOOKING_HREF } from "./constants";

type ScheduleStatus = "open" | "upcoming";

type DonationSchedule = {
  id: string;
  campaign: string;
  /** ISO date, luôn hiểu theo múi giờ Việt Nam. */
  date: string;
  time: string;
  location: string;
  bloodTypes: string[];
  totalSlots: number;
  remainingSlots: number;
  status: ScheduleStatus;
};

const SCHEDULES: DonationSchedule[] = [
  {
    id: "due-dot-1-2026",
    campaign: "Hiến máu nhân đạo đợt 1 – 2026",
    date: "2026-11-12",
    time: "07:30 – 11:30",
    location: "Hội trường A – Trường Đại học Kinh tế Đà Nẵng",
    bloodTypes: ["O−", "A+"],
    totalSlots: 150,
    remainingSlots: 28,
    status: "open",
  },
  {
    id: "gioi-mau-nghia-tinh-2026",
    campaign: "Giọt máu nghĩa tình – Ngày hội sinh viên DUE",
    date: "2026-11-26",
    time: "08:00 – 16:30",
    location: "Hội trường B – Trường Đại học Kinh tế Đà Nẵng",
    bloodTypes: ["B+", "AB+"],
    totalSlots: 120,
    remainingSlots: 42,
    status: "open",
  },
  {
    id: "ngay-hoi-hien-mau-2026",
    campaign: "Ngày hội hiến máu sinh viên DUE 2026",
    date: "2026-12-10",
    time: "07:00 – 17:00",
    location: "Nhà văn hóa Trường Đại học Kinh tế – ĐHĐN",
    bloodTypes: [],
    totalSlots: 250,
    remainingSlots: 250,
    status: "upcoming",
  },
];

const STATUS_META: Record<
  ScheduleStatus,
  { label: string; badge: string; dot: string; ping: boolean }
> = {
  open: {
    label: "Đang mở",
    badge:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
    dot: "bg-emerald-500",
    ping: true,
  },
  upcoming: {
    label: "Sắp diễn ra",
    badge:
      "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
    dot: "bg-amber-500",
    ping: false,
  },
};

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

function formatScheduleDate(value: string) {
  const date = new Date(`${value}T12:00:00+07:00`);
  const parts = dateFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: get("weekday"),
    day: get("day"),
    month: get("month"),
  };
}

export default function DonationScheduleSection() {
  const openCount = SCHEDULES.filter(
    (schedule) => schedule.status === "open",
  ).length;

  return (
    <section
      id="lich-hien-mau"
      aria-labelledby="lich-hien-mau-title"
      className="relative scroll-mt-24 overflow-hidden pt-4 pb-16 sm:pt-6 sm:pb-20 lg:pt-8 lg:pb-24"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 h-72 w-[52rem] -translate-x-1/2 rounded-full bg-red-100/40 blur-3xl dark:bg-red-900/10" />
        <div className="absolute -right-24 bottom-0 size-72 rounded-full bg-rose-100/50 blur-3xl dark:bg-rose-900/10" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-red-200/80 bg-red-50/80 px-4 py-1.5 text-[11px] font-bold tracking-[0.16em] text-red-700 uppercase dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              <CalendarHeart className="size-3.5" aria-hidden />
              Đừng bỏ lỡ
            </span>

            <h2
              id="lich-hien-mau-title"
              className="mt-4 text-3xl font-extrabold tracking-tight text-balance text-slate-950 sm:text-4xl lg:text-[2.75rem] dark:text-white"
            >
              Lịch hiến máu{" "}
              <span className="text-red-600 dark:text-red-400">đang mở</span>
            </h2>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
              Chọn địa điểm và khung giờ thuận tiện nhất để tham gia hiến máu
              cứu người. Mỗi suất đăng ký là một cơ hội sẻ chia sự sống.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              {openCount} đợt đang mở
            </span>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-10 rounded-xl border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-red-500/20 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Link href={BOOKING_HREF}>
                Xem tất cả lịch
                <ArrowUpRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:mt-12 lg:grid-cols-3">
          {SCHEDULES.map((schedule) => {
            const { weekday, day, month } = formatScheduleDate(schedule.date);
            const status = STATUS_META[schedule.status];
            const isOpen = schedule.status === "open";
            const usedSlots = Math.max(
              0,
              schedule.totalSlots - schedule.remainingSlots,
            );
            const usedPercent =
              schedule.totalSlots > 0
                ? Math.min(100, Math.round((usedSlots / schedule.totalSlots) * 100))
                : 0;

            return (
              <article
                key={schedule.id}
                aria-labelledby={`${schedule.id}-title`}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-card p-6 shadow-md shadow-slate-900/5 transition-all duration-300 will-change-transform hover:-translate-y-2 hover:border-red-200 hover:shadow-2xl hover:shadow-red-950/10 motion-reduce:transform-none motion-reduce:transition-none dark:border-white/10 dark:hover:border-red-500/20 dark:hover:shadow-black/40"
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-500 to-rose-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-600/20">
                      <span className="text-xl leading-none font-extrabold">
                        {day}
                      </span>
                      <span className="mt-0.5 text-[9px] leading-none font-bold tracking-wide uppercase opacity-90">
                        Thg {month}
                      </span>
                    </span>

                    <div>
                      <p className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase dark:text-slate-500">
                        {weekday}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <Clock3
                          className="size-3.5 text-red-500 dark:text-red-400"
                          aria-hidden
                        />
                        {schedule.time}
                      </p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset sm:text-[11px]",
                      status.badge,
                    )}
                  >
                    <span className="relative flex size-1.5">
                      {status.ping ? (
                        <span
                          className={cn(
                            "absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:animate-none",
                            status.dot,
                          )}
                        />
                      ) : null}
                      <span
                        className={cn(
                          "relative inline-flex size-1.5 rounded-full",
                          status.dot,
                        )}
                      />
                    </span>
                    {status.label}
                  </span>
                </div>

                <h3
                  id={`${schedule.id}-title`}
                  className="mt-5 line-clamp-2 min-h-[3.25rem] text-lg leading-snug font-bold tracking-tight text-slate-950 sm:text-xl dark:text-white"
                >
                  {schedule.campaign}
                </h3>

                <p className="mt-1 flex min-h-[2.5rem] items-start gap-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  <MapPin
                    className="mt-0.5 size-4 shrink-0 text-red-500 dark:text-red-400"
                    aria-hidden
                  />
                  <span>{schedule.location}</span>
                </p>

                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <Droplet
                        className="size-3.5 fill-red-500 text-red-500 dark:fill-red-400 dark:text-red-400"
                        aria-hidden
                      />
                      Nhóm máu ưu tiên
                    </span>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {schedule.bloodTypes.length > 0 ? (
                        schedule.bloodTypes.map((bloodType) => (
                          <span
                            key={bloodType}
                            className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 ring-1 ring-red-100 ring-inset dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20"
                          >
                            {bloodType}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Tất cả nhóm máu
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-end justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {isOpen ? "Suất còn nhận" : "Tổng số suất"}
                    </span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      <span className="text-base font-extrabold text-red-600 dark:text-red-400">
                        {schedule.remainingSlots}
                      </span>
                      <span className="mx-0.5">/</span>
                      {schedule.totalSlots} suất
                    </span>
                  </div>

                  <div
                    role="progressbar"
                    aria-label={`Đã nhận ${usedSlots} trên ${schedule.totalSlots} suất`}
                    aria-valuemin={0}
                    aria-valuemax={schedule.totalSlots}
                    aria-valuenow={usedSlots}
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-500 transition-[width] duration-500"
                      style={{ width: `${usedPercent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  <Button
                    asChild
                    size="lg"
                    className={cn(
                      "h-11 w-full rounded-xl text-sm font-semibold",
                      isOpen
                        ? "bg-red-600 text-white shadow-lg shadow-red-600/20 hover:bg-red-700 hover:shadow-red-600/30"
                        : "border border-red-200 bg-red-50/70 text-red-700 shadow-none hover:border-red-300 hover:bg-red-100 hover:text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20 dark:hover:text-red-200",
                    )}
                  >
                    <Link href={BOOKING_HREF}>
                      {isOpen ? "Đăng ký ngay" : "Xem chi tiết"}
                      <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-8 flex items-start justify-center gap-2 text-center text-xs leading-relaxed text-slate-500 sm:items-center dark:text-slate-400">
          <Info className="mt-0.5 size-3.5 shrink-0 sm:mt-0" aria-hidden />
          Lịch có thể thay đổi tùy theo tình hình tiếp nhận máu. Vui lòng kiểm
          tra lại trước khi đến hiến.
        </p>
      </div>
    </section>
  );
}
