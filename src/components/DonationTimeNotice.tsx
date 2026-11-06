import type { RegStatus } from "@prisma/client";
import {
  BellRing,
  CalendarClock,
  CalendarHeart,
  Cat,
  CheckCircle2,
  Clock3,
  Droplet,
  MapPin,
  Ticket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

const dayNumberFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

const weekdayFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  timeZone: "Asia/Ho_Chi_Minh",
});

const monthYearFormatter = new Intl.DateTimeFormat("vi-VN", {
  month: "long",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Số ngày lịch (theo múi giờ Việt Nam) từ hôm nay tới ngày chiến dịch. */
function daysUntil(target: Date): number {
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

type Props = {
  status: RegStatus;
  campaignName: string;
  campaignDate: Date;
  location: string;
  slotTime?: string | null;
  checkInTime: Date | null;
  completedAt: Date | null;
};

export default function DonationTimeNotice({
  status,
  campaignName,
  campaignDate,
  location,
  slotTime,
  checkInTime,
  completedAt,
}: Props) {
  // Hồ sơ bị từ chối / không đạt sức khỏe thì không thông báo thời gian hiến.
  if (status === "REJECTED" || status === "HEALTH_CHECK_FAILED") {
    return null;
  }

  const isCompleted = status === "COMPLETED";
  const hasCheckedIn =
    status === "CHECKED_IN" ||
    status === "ELIGIBLE" ||
    status === "COMPLETED";

  const days = daysUntil(campaignDate);

  let countdownLabel: string;
  let countdownVariant: "success" | "info" | "neutral" | "warning";

  if (isCompleted) {
    countdownLabel = "Đã hoàn thành";
    countdownVariant = "success";
  } else if (days < 0) {
    countdownLabel = "Đã diễn ra";
    countdownVariant = "neutral";
  } else if (days === 0) {
    countdownLabel = "Hôm nay";
    countdownVariant = "success";
  } else if (days === 1) {
    countdownLabel = "Ngày mai";
    countdownVariant = "warning";
  } else {
    countdownLabel = `Còn ${days} ngày`;
    countdownVariant = "info";
  }

  let message: string;
  switch (status) {
    case "PENDING":
      message =
        "Hồ sơ đang chờ duyệt. Thời gian trên là dự kiến, vui lòng theo dõi trạng thái hồ sơ.";
      break;
    case "APPROVED":
      message =
        "Hồ sơ đã được duyệt. Vui lòng có mặt trước 15 phút và mang theo CCCD bản gốc.";
      break;
    case "CHECKED_IN":
      message =
        "Bạn đã check-in. Vui lòng chờ đến lượt khám sức khỏe tại khu vực y tế.";
      break;
    case "ELIGIBLE":
      message =
        "Bạn đã đạt khám sức khỏe. Vui lòng chờ đến lượt lấy máu và làm theo hướng dẫn của nhân viên y tế.";
      break;
    case "COMPLETED":
      message =
        "Cảm ơn bạn đã tham gia hiến máu! Hãy nghỉ ngơi, uống đủ nước và tránh vận động mạnh trong ngày.";
      break;
    default:
      message = "";
  }

  const completedTime = completedAt ?? checkInTime;
  const accentColor = isCompleted ? "text-success" : "text-primary";
  const accentBg = isCompleted ? "bg-success/[0.04]" : "bg-primary/[0.04]";
  const accentBorder = isCompleted ? "border-success/40" : "border-primary/30";

  return (
    <Card
      role="region"
      aria-label="Thông báo thời gian hiến máu"
      className={cn(
        "relative gap-0 overflow-hidden rounded-2xl py-0 shadow-lg hover:translate-y-0",
        accentBorder,
      )}
    >
      {/* Dải màu trên cùng: điểm nhấn như thiệp mời */}
      <div
        aria-hidden
        className={cn(
          "h-1.5 w-full bg-gradient-to-r",
          isCompleted
            ? "from-success via-success/60 to-success/15"
            : "from-primary via-primary/60 to-primary/15",
        )}
      />

      <CardContent className="relative p-0">
        <div className="grid sm:grid-cols-[minmax(0,1fr)_13rem]">
          {/* --- Nội dung chính của thiệp ---------------------------- */}
          <div className="relative p-5 sm:p-6">
            <Cat
              aria-hidden
              className={cn(
                "pointer-events-none absolute -bottom-5 right-2 size-28 opacity-[0.06]",
                accentColor,
              )}
            />

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                  isCompleted
                    ? "bg-success/15 text-success"
                    : "bg-primary/10 text-primary",
                )}
              >
                <CalendarHeart className="size-3.5" aria-hidden />
                {isCompleted ? "Hoàn thành hiến máu" : "Thư mời hiến máu"}
              </span>
              <Badge variant={countdownVariant}>{countdownLabel}</Badge>
            </div>

            <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">
              {campaignName}
            </h2>

            <p className="mt-3 flex items-start gap-2 text-base font-semibold sm:text-lg">
              <CalendarHeart
                className={cn("mt-0.5 size-5 shrink-0", accentColor)}
                aria-hidden
              />
              <time dateTime={campaignDate.toISOString()}>
                {dateFormatter.format(campaignDate)}
              </time>
            </p>

            <p className="text-muted-foreground mt-2 flex items-start gap-1.5 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{location}</span>
            </p>

            {slotTime ? (
              <p className="border-primary/25 bg-primary/5 mt-3 inline-flex flex-wrap items-center gap-2 rounded-xl border px-3 py-1.5 text-sm">
                <Ticket className={cn("size-4", accentColor)} aria-hidden />
                <span className="text-muted-foreground">
                  Khung giờ của bạn:
                </span>
                <strong className="font-semibold">{slotTime}</strong>
              </p>
            ) : null}

            <p className="text-muted-foreground mt-4 max-w-prose text-sm leading-relaxed">
              {message}
            </p>
          </div>

          {/* --- Cuống thiệp: ngày và giờ nổi bật -------------------- */}
          <div
            className={cn(
              "relative flex items-center justify-between gap-4 border-t border-dashed p-5 sm:flex-col sm:items-start sm:justify-center sm:border-l sm:border-t-0",
              accentBg,
              isCompleted ? "border-success/30" : "border-primary/25",
            )}
          >
            {/* Hai khía tròn tạo cảm giác vé/thiệp xé được */}
            <span
              aria-hidden
              className="bg-background absolute -left-2.5 -top-2.5 hidden size-5 rounded-full sm:block"
            />
            <span
              aria-hidden
              className="bg-background absolute -bottom-2.5 -left-2.5 hidden size-5 rounded-full sm:block"
            />

            <div className="relative">
              <p
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.18em]",
                  isCompleted ? "text-success/80" : "text-primary/80",
                )}
              >
                Ngày hiến máu
              </p>
              <p
                className={cn(
                  "relative z-10 mt-1 text-5xl font-black leading-none tracking-tight tabular-nums",
                  accentColor,
                )}
              >
                {dayNumberFormatter.format(campaignDate)}
              </p>
              <p className="text-muted-foreground mt-1 text-xs font-medium">
                {weekdayFormatter.format(campaignDate)} ·{" "}
                {monthYearFormatter.format(campaignDate)}
              </p>
              <Droplet
                aria-hidden
                className={cn(
                  "absolute -right-3 -top-3 size-20 opacity-10",
                  accentColor,
                )}
              />
            </div>

            <div className="relative space-y-1.5 text-xs">
              <p className="inline-flex items-center gap-1.5 font-semibold">
                <Clock3
                  className={cn("size-3.5", accentColor)}
                  aria-hidden
                />
                {timeFormatter.format(campaignDate)}
              </p>

              {hasCheckedIn && checkInTime ? (
                <p className="text-muted-foreground inline-flex items-center gap-1.5">
                  <CalendarClock className="size-3.5" aria-hidden />
                  Check-in: {dateTimeFormatter.format(checkInTime)}
                </p>
              ) : null}

              {isCompleted && completedTime ? (
                <p className="text-muted-foreground inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  Hoàn thành: {dateTimeFormatter.format(completedTime)}
                </p>
              ) : null}

              {!hasCheckedIn ? (
                <p className="text-muted-foreground inline-flex items-center gap-1.5">
                  <BellRing className="size-3.5" aria-hidden />
                  Có mặt trước 15 phút
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
