import type { RegStatus } from "@prisma/client";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MapPin,
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
  checkInTime: Date | null;
  completedAt: Date | null;
};

export default function DonationTimeNotice({
  status,
  campaignName,
  campaignDate,
  location,
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

  return (
    <Card
      className={cn(
        "overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card",
        isCompleted && "border-success/40 from-success/10",
      )}
    >
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-full",
              isCompleted && "bg-success/15 text-success",
            )}
          >
            {isCompleted ? (
              <CheckCircle2 className="size-5" aria-hidden />
            ) : (
              <BellRing className="size-5" aria-hidden />
            )}
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {isCompleted
                ? "Bạn đã hoàn thành hiến máu"
                : "Thông báo thời gian hiến máu"}
            </p>
            <p className="mt-1 text-base font-semibold tracking-tight sm:text-lg">
              {dateFormatter.format(campaignDate)}
            </p>
            <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1">
                <Clock3 className="size-3.5" aria-hidden />
                {timeFormatter.format(campaignDate)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {location}
              </span>
            </p>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <Badge variant={countdownVariant}>{countdownLabel}</Badge>

          {hasCheckedIn && checkInTime ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <CalendarClock className="size-3.5" aria-hidden />
              Check-in: {dateTimeFormatter.format(checkInTime)}
            </span>
          ) : null}

          {isCompleted && completedTime ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <CheckCircle2 className="size-3.5" aria-hidden />
              Hoàn thành: {dateTimeFormatter.format(completedTime)}
            </span>
          ) : null}

          <span className="text-muted-foreground max-w-48 truncate text-xs">
            {campaignName}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
