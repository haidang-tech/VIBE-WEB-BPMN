import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  HeartPulse,
  MapPin,
  Stethoscope,
  Ticket,
} from "lucide-react";
import RefreshButton from "@/components/RefreshButton";
import TrackingStepper from "@/components/TrackingStepper";
import DonationTimeNotice from "@/components/DonationTimeNotice";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  REGISTRATION_STATUS_META,
  type StatusTone,
} from "@/lib/registration-status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Theo dõi hồ sơ",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
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

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0 text-sm">{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  );
}

export default async function StudentTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ registrationId?: string | string[] }>;
}) {
  const session = await requireRole("STUDENT");
  const params = await searchParams;

  const registrations = await prisma.registration.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      checkInTime: true,
      slotTime: true,
      preferredSlots: true,
      campaign: {
        select: {
          name: true,
          date: true,
          location: true,
        },
      },
      healthCheck: {
        select: {
          bloodPressure: true,
          heartRate: true,
          weight: true,
          bloodType: true,
          bloodVolume: true,
          isPassed: true,
          updatedAt: true,
        },
      },
    },
  });

  const requestedId =
    typeof params.registrationId === "string"
      ? params.registrationId
      : undefined;

  const selected =
    registrations.find((registration) => registration.id === requestedId) ??
    registrations[0] ??
    null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-primary text-sm font-medium">Khu vực sinh viên</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Theo dõi tiến độ hiến máu
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Theo dõi từng bước: Đăng ký → Duyệt → Check-in → Khám → Hoàn thành.
          </p>
        </div>

        {selected ? (
          <div className="flex gap-2">
            <RefreshButton />
            <Button asChild>
              <Link href="/student/register">
                <Ticket aria-hidden />
                Đăng ký mới
              </Link>
            </Button>
          </div>
        ) : null}
      </header>

      {selected ? (
        <DonationTimeNotice
          status={selected.status}
          campaignName={selected.campaign.name}
          campaignDate={selected.campaign.date}
          location={selected.campaign.location}
          checkInTime={selected.checkInTime}
          completedAt={selected.healthCheck?.updatedAt ?? null}
        />
      ) : null}

      {registrations.length === 0 || !selected ? (
        <Card className="mx-auto max-w-xl text-center">
          <CardHeader>
            <div className="bg-muted mx-auto mb-2 grid size-12 place-items-center rounded-full">
              <ClipboardList className="text-muted-foreground size-6" />
            </div>
            <CardTitle>Chưa có hồ sơ hiến máu</CardTitle>
            <CardDescription>
              Đăng ký một chiến dịch để bắt đầu theo dõi tiến độ.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/student/register">Đăng ký hiến máu ngay</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* --- Danh sách hồ sơ ------------------------------------------ */}
          <aside className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Hồ sơ của bạn ({registrations.length})
              </h2>
            </div>

            <div className="space-y-2 lg:max-h-[560px] lg:overflow-y-auto lg:pr-1">
              {registrations.map((registration) => {
                const meta = REGISTRATION_STATUS_META[registration.status];
                const isSelected = registration.id === selected.id;

                return (
                  <Link
                    key={registration.id}
                    href={`/student/tracking?registrationId=${encodeURIComponent(
                      registration.id,
                    )}`}
                    aria-current={isSelected ? "page" : undefined}
                    className={cn(
                      "block rounded-lg border p-3 transition-colors",
                      isSelected
                        ? "border-primary/60 bg-primary/5"
                        : "border-border hover:bg-muted/40",
                    )}
                  >
                    <p className="line-clamp-2 text-sm font-medium">
                      {registration.campaign.name}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {dateFormatter.format(registration.campaign.date)}
                    </p>
                    <Badge
                      variant={TONE_TO_BADGE[meta.tone]}
                      className="mt-2"
                    >
                      {meta.label}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          </aside>

          {/* --- Chi tiết hồ sơ đang chọn --------------------------------- */}
          <div className="min-w-0 space-y-4">
            <Card className="overflow-hidden py-0">
              <CardHeader className="border-border/70 bg-muted/20 border-b py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">
                      {selected.campaign.name}
                    </CardTitle>
                    <CardDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3.5" aria-hidden />
                        {dateFormatter.format(selected.campaign.date)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" aria-hidden />
                        {selected.campaign.location}
                      </span>
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      TONE_TO_BADGE[
                        REGISTRATION_STATUS_META[selected.status].tone
                      ]
                    }
                  >
                    {REGISTRATION_STATUS_META[selected.status].label}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="py-7">
                <TrackingStepper status={selected.status} />
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardList
                      className="text-primary size-4"
                      aria-hidden
                    />
                    Thông tin hồ sơ
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <DetailRow label="Mã hồ sơ">
                    <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                      {selected.id}
                    </code>
                  </DetailRow>
                  <DetailRow label="Ngày đăng ký">
                    {dateTimeFormatter.format(selected.createdAt)}
                  </DetailRow>
                  <DetailRow label="Thời gian hiến máu">
                    {dateTimeFormatter.format(selected.campaign.date)}
                  </DetailRow>
                  <DetailRow label="Khung giờ được phân">
                    {selected.slotTime ?? "Chưa xếp"}
                  </DetailRow>
                  {selected.preferredSlots.length > 0 ? (
                    <DetailRow label="Khung giờ mong muốn">
                      {selected.preferredSlots.join(", ")}
                    </DetailRow>
                  ) : null}
                  <DetailRow label="Cập nhật gần nhất">
                    {dateTimeFormatter.format(selected.updatedAt)}
                  </DetailRow>
                  <DetailRow label="Check-in">
                    {selected.checkInTime
                      ? dateTimeFormatter.format(selected.checkInTime)
                      : "Chưa check-in"}
                  </DetailRow>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Stethoscope
                      className="text-primary size-4"
                      aria-hidden
                    />
                    Kết quả khám sức khỏe
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selected.healthCheck ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground text-sm">
                          Kết luận
                        </span>
                        <Badge
                          variant={
                            selected.healthCheck.isPassed
                              ? "success"
                              : "destructive"
                          }
                        >
                          {selected.healthCheck.isPassed
                            ? "Đạt yêu cầu"
                            : "Không đạt"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/40 rounded-lg p-2.5">
                          <p className="text-muted-foreground flex items-center gap-1 text-xs">
                            <HeartPulse className="size-3" aria-hidden />
                            Huyết áp
                          </p>
                          <p className="mt-0.5 text-sm font-semibold">
                            {selected.healthCheck.bloodPressure} mmHg
                          </p>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-2.5">
                          <p className="text-muted-foreground flex items-center gap-1 text-xs">
                            <Activity className="size-3" aria-hidden />
                            Nhịp tim
                          </p>
                          <p className="mt-0.5 text-sm font-semibold">
                            {selected.healthCheck.heartRate} lần/phút
                          </p>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-2.5">
                          <p className="text-muted-foreground text-xs">
                            Cân nặng
                          </p>
                          <p className="mt-0.5 text-sm font-semibold">
                            {selected.healthCheck.weight.toString()} kg
                          </p>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-2.5">
                          <p className="text-muted-foreground text-xs">
                            Nhóm máu
                          </p>
                          <p className="mt-0.5 text-sm font-semibold">
                            {selected.healthCheck.bloodType ?? "Chưa xác định"}
                          </p>
                        </div>
                      </div>

                      <p className="text-muted-foreground text-xs">
                        Lượng máu dự kiến:{" "}
                        <span className="text-foreground font-medium">
                          {selected.healthCheck.bloodVolume} ml
                        </span>
                      </p>
                    </div>
                  ) : (
                    <div className="text-muted-foreground flex items-start gap-2 text-sm">
                      <Stethoscope className="mt-0.5 size-4 shrink-0" />
                      <p>
                        Kết quả sẽ hiện sau khi bạn check-in và được nhập chỉ số.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {REGISTRATION_STATUS_META[selected.status].isFailure ? (
              <Alert variant="warning">
                <Ticket />
                <AlertTitle>
                  Hồ sơ chưa thể tiếp tục ở trạng thái hiện tại
                </AlertTitle>
                <AlertDescription>
                  <p>
                    Liên hệ ban tổ chức nếu cần hỗ trợ. Bạn có thể đăng ký lại
                    khi hồ sơ cũ đã kết thúc.
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    <Link href="/student/register">Đăng ký lại</Link>
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
