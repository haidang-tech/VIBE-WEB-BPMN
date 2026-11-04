"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, CalendarClock, MapPin } from "lucide-react";
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
};

export default function StudentDonationBanner({
  data,
}: {
  data: StudentDonationBannerData | null;
}) {
  const pathname = usePathname();

  // Trang theo dõi đã có thẻ thông báo chi tiết.
  if (!data || pathname.startsWith("/student/tracking")) {
    return null;
  }

  const meta = REGISTRATION_STATUS_META[data.status];

  return (
    <div className="border-primary/20 bg-primary/5 border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-sm">
        <BellRing className="text-primary size-4 shrink-0" aria-hidden />
        <span className="font-medium">Thông báo lịch hiến máu:</span>

        <span className="inline-flex items-center gap-1">
          <CalendarClock className="text-muted-foreground size-3.5" aria-hidden />
          {dateTimeFormatter.format(new Date(data.campaignDate))}
        </span>

        <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="max-w-64 truncate">{data.location}</span>
        </span>

        <Badge variant={TONE_TO_BADGE[meta.tone]}>{meta.label}</Badge>

        <Link
          href={`/student/tracking?registrationId=${encodeURIComponent(
            data.registrationId,
          )}`}
          className={cn(
            "text-primary ml-auto text-xs font-semibold underline-offset-4 hover:underline",
          )}
        >
          Xem chi tiết →
        </Link>
      </div>
    </div>
  );
}
