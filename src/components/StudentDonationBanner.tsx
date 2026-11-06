"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Clock3,
  MapPin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  REGISTRATION_STATUS_META,
  type StatusTone,
} from "@/lib/registration-status";
import { cn } from "@/lib/utils";

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function daysUntil(targetIso: string): number {
  const target = new Date(targetIso);
  const now = new Date();
  const vnNow = new Date(now.getTime() + VN_OFFSET_MS);
  const vnTarget = new Date(target.getTime() + VN_OFFSET_MS);

  const today = Date.UTC(
    vnNow.getUTCFullYear(),
    vnNow.getUTCMonth(),
    vnNow.getUTCDate(),
  );
  const day = Date.UTC(
    vnTarget.getUTCFullYear(),
    vnTarget.getUTCMonth(),
    vnTarget.getUTCDate(),
  );

  return Math.round((day - today) / (24 * 60 * 60 * 1000));
}

const TONE_TO_BADGE: Record<
  StatusTone,
  "neutral" | "info" | "success" | "warning" | "destructive"
> = {
  neutral: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "destructive",
};

export type StudentDonationBannerData = {
  registrationId: string;
  status: keyof typeof REGISTRATION_STATUS_META;
  campaignDate: string;
  campaignName: string;
  location: string;
  slotTime?: string | null;
};

export default function StudentDonationBanner({
  data,
}: {
  data: StudentDonationBannerData | null;
}) {
  const pathname = usePathname();
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    if (!data) return;

    setDays(daysUntil(data.campaignDate));
  }, [data]);

  // Trang theo dõi đã có tấm thiệp thông báo chi tiết.
  if (!data || pathname.startsWith("/student/tracking")) {
    return null;
  }

  const meta = REGISTRATION_STATUS_META[data.status];
  const isUrgent = days !== null && days <= 1 && days >= 0;

  const countdownLabel =
    days === null
      ? null
      : days < 0
        ? "Đã diễn ra"
        : days === 0
          ? "Hôm nay"
          : days === 1
            ? "Ngày mai"
            : `Còn ${days} ngày`;

  return (
    <section
      aria-label="Thông báo lịch hiến máu"
      className="border-primary/15 relative border-b bg-gradient-to-b from-primary/[0.06] to-transparent py-3 sm:py-4"
    >
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="border-primary/25 from-primary/[0.09] via-card to-card shadow-soft relative flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-r sm:flex-row sm:items-stretch">
          {/* --- Nội dung thiệp ------------------------------------ */}
          <div className="relative flex min-w-0 flex-1 items-start gap-3 px-4 py-3.5 sm:px-5">
            <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-xl">
              <BellRing className="size-5" aria-hidden />
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-primary text-[11px] font-semibold uppercase tracking-[0.14em]">
                  Thư mời hiến máu
                </p>
                <Badge variant={TONE_TO_BADGE[meta.tone]}>{meta.label}</Badge>
              </div>

              <p className="mt-0.5 truncate text-sm font-semibold">
                {data.campaignName}
              </p>

              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" aria-hidden />
                  {dateTimeFormatter.format(new Date(data.campaignDate))}
                </span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  <span className="max-w-64 truncate">{data.location}</span>
                </span>
                {data.slotTime ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-3.5" aria-hidden />
                    Khung giờ: {data.slotTime}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* --- Cuống thiệp: đếm ngược + mở chi tiết --------------- */}
          <div
            className={cn(
              "flex items-center justify-between gap-3 border-t border-dashed border-primary/25 px-4 py-2.5 sm:w-56 sm:flex-col sm:items-end sm:justify-center sm:border-l sm:border-t-0 sm:px-4",
              "bg-primary/[0.04]",
            )}
          >
            {countdownLabel ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                  isUrgent
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/10 text-primary",
                )}
              >
                <Clock3 className="size-3.5" aria-hidden />
                {countdownLabel}
              </span>
            ) : (
              <span className="h-6" aria-hidden />
            )}

            <Link
              href={`/student/tracking?registrationId=${encodeURIComponent(
                data.registrationId,
              )}`}
              className="text-primary-foreground bg-primary hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors"
            >
              Xem thiệp mời
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
