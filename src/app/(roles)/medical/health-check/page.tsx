import type { Metadata } from "next";
import { RegStatus } from "@prisma/client";
import {
  BadgeCheck,
  CalendarDays,
  ClipboardCheck,
  Info,
  MapPin,
  SearchX,
  Stethoscope,
  UserRoundCheck,
} from "lucide-react";
import MedicalCheckPanel from "@/components/MedicalCheckPanel";
import MedicalQueue from "@/components/MedicalQueue";
import RefreshButton from "@/components/RefreshButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { decryptCccd, maskCccd } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Khám sức khỏe & chốt kết quả",
};

export const dynamic = "force-dynamic";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

const shortDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

/** Thứ tự ưu tiên trong hàng chờ: ai cần thao tác trước đứng trước. */
const QUEUE_PRIORITY: Partial<Record<RegStatus, number>> = {
  CHECKED_IN: 0,
  APPROVED: 1,
  ELIGIBLE: 2,
  HEALTH_CHECK_FAILED: 3,
  COMPLETED: 4,
};

const QUEUE_STATUSES: RegStatus[] = [
  "APPROVED",
  "CHECKED_IN",
  "ELIGIBLE",
  "HEALTH_CHECK_FAILED",
  "COMPLETED",
];

type CccdRecord = {
  cccdCiphertext: string | null;
  cccdIv: string | null;
  cccdAuthTag: string | null;
};

function maskedCccd(record: CccdRecord): string {
  try {
    const value = decryptCccd(record);
    return value ? maskCccd(value) : "Chưa cập nhật";
  } catch {
    return "Không giải mã được";
  }
}

/** Khoảng [start, end) của ngày hôm nay theo múi giờ Việt Nam (UTC+7). */
function getTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const vnNow = new Date(now.getTime() + VN_OFFSET_MS);
  const startUtc =
    Date.UTC(
      vnNow.getUTCFullYear(),
      vnNow.getUTCMonth(),
      vnNow.getUTCDate(),
    ) - VN_OFFSET_MS;

  return {
    start: new Date(startUtc),
    end: new Date(startUtc + 24 * 60 * 60 * 1000),
  };
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function MedicalHealthCheckPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("MEDICAL");

  const params = await searchParams;
  const requestedCampaignId = firstParam(params.campaignId);
  const requestedRegistrationId = firstParam(params.registrationId);

  const { start: todayStart, end: todayEnd } = getTodayRange();

  const activeCampaigns = await prisma.campaign.findMany({
    where: { status: "ACTIVE" },
    orderBy: { date: "asc" },
    select: {
      id: true,
      name: true,
      date: true,
      location: true,
    },
  });

  const todayCampaign =
    activeCampaigns.find(
      (campaign) => campaign.date >= todayStart && campaign.date < todayEnd,
    ) ?? null;

  const selectedCampaign =
    activeCampaigns.find((campaign) => campaign.id === requestedCampaignId) ??
    todayCampaign ??
    activeCampaigns[0] ??
    null;

  const header = (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1.5">
        <p className="text-primary text-sm font-medium">Khu vực y tế</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Khám sức khỏe & chốt kết quả
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Nhập nhanh huyết áp, nhịp tim, cân nặng, nhóm máu và lượng máu. Hồ sơ
          đạt cổng XOR 3 sẽ chuyển sang bước chốt kết quả hiến máu.
        </p>
      </div>
      <RefreshButton />
    </header>
  );

  if (!selectedCampaign) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="mx-auto max-w-xl text-center">
          <CardHeader>
            <div className="bg-muted mx-auto mb-2 grid size-12 place-items-center rounded-full">
              <CalendarDays className="text-muted-foreground size-6" />
            </div>
            <CardTitle>Chưa có chiến dịch đang hoạt động</CardTitle>
            <CardDescription>
              Cần kích hoạt chiến dịch trước khi nhân viên y tế có thể khám và
              chốt kết quả hiến máu.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isToday =
    selectedCampaign.date >= todayStart && selectedCampaign.date < todayEnd;

  const campaignOptions = activeCampaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    dateLabel: shortDateFormatter.format(campaign.date),
    isToday: campaign.date >= todayStart && campaign.date < todayEnd,
  }));

  const statusCounts = await prisma.registration.groupBy({
    by: ["status"],
    where: { campaignId: selectedCampaign.id },
    _count: { _all: true },
  });

  const countByStatus = new Map(
    statusCounts.map((item) => [item.status, item._count._all]),
  );

  const countOf = (...statuses: RegStatus[]) =>
    statuses.reduce((sum, item) => sum + (countByStatus.get(item) ?? 0), 0);

  const stats = [
    {
      label: "Chờ khám",
      value: countOf("APPROVED", "CHECKED_IN"),
      icon: UserRoundCheck,
      tone: "text-warning",
    },
    {
      label: "Chờ chốt",
      value: countOf("ELIGIBLE"),
      icon: BadgeCheck,
      tone: "text-success",
    },
    {
      label: "Hoàn thành",
      value: countOf("COMPLETED"),
      icon: ClipboardCheck,
      tone: "text-success",
    },
    {
      label: "Không đạt",
      value: countOf("HEALTH_CHECK_FAILED"),
      icon: SearchX,
      tone: "text-destructive",
    },
  ];

  const registrations = await prisma.registration.findMany({
    where: {
      campaignId: selectedCampaign.id,
      status: { in: QUEUE_STATUSES },
    },
    take: 200,
    select: {
      id: true,
      status: true,
      checkInTime: true,
      createdAt: true,
      user: {
        select: {
          name: true,
          email: true,
          cccdCiphertext: true,
          cccdIv: true,
          cccdAuthTag: true,
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

  const sorted = [...registrations].sort((a, b) => {
    const priorityA = QUEUE_PRIORITY[a.status] ?? 99;
    const priorityB = QUEUE_PRIORITY[b.status] ?? 99;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const queueItems = sorted.map((registration) => ({
    id: registration.id,
    studentName: registration.user.name,
    studentEmail: registration.user.email,
    cccdMasked: maskedCccd(registration.user),
    status: registration.status,
    checkInTime: registration.checkInTime?.toISOString() ?? null,
  }));

  const requestedIsValid = queueItems.some(
    (item) => item.id === requestedRegistrationId,
  );

  const autoSelectedId =
    queueItems.find((item) => item.status === "CHECKED_IN")?.id ??
    queueItems.find((item) => item.status === "APPROVED")?.id ??
    queueItems.find((item) => item.status === "ELIGIBLE")?.id ??
    queueItems[0]?.id ??
    null;

  const selectedId = requestedIsValid
    ? requestedRegistrationId
    : autoSelectedId;

  const selected = selectedId
    ? (sorted.find((registration) => registration.id === selectedId) ?? null)
    : null;

  const panelRegistration = selected
    ? {
        id: selected.id,
        status: selected.status,
        studentName: selected.user.name,
        studentEmail: selected.user.email,
        cccdMasked: maskedCccd(selected.user),
        campaignName: selectedCampaign.name,
        checkInTime: selected.checkInTime?.toISOString() ?? null,
        healthCheck: selected.healthCheck
          ? {
              bloodPressure: selected.healthCheck.bloodPressure,
              heartRate: selected.healthCheck.heartRate,
              weight: Number(selected.healthCheck.weight),
              bloodType: selected.healthCheck.bloodType,
              bloodVolume: selected.healthCheck.bloodVolume,
              isPassed: selected.healthCheck.isPassed,
              updatedAt: selected.healthCheck.updatedAt.toISOString(),
            }
          : null,
      }
    : null;

  return (
    <div className="space-y-6">
      {header}

      {!isToday ? (
        <Alert variant="info">
          <Info />
          <AlertTitle>Hôm nay chưa có chiến dịch khám</AlertTitle>
          <AlertDescription>
            Đang hiển thị chiến dịch gần nhất:{" "}
            <span className="font-medium">{selectedCampaign.name}</span> —{" "}
            {dateFormatter.format(selectedCampaign.date)}.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="bg-card rounded-xl border p-4 shadow-sm"
            >
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Icon className={cn("size-3.5", stat.tone)} aria-hidden />
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="bg-muted/20 border-border/70 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {selectedCampaign.name}
          </p>
          <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              {dateFormatter.format(selectedCampaign.date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {selectedCampaign.location}
            </span>
          </p>
        </div>
        <Badge variant={isToday ? "success" : "info"}>
          {isToday ? "Đang diễn ra hôm nay" : "Chiến dịch sắp tới"}
        </Badge>
      </div>

      <div className="grid min-h-[560px] gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <MedicalQueue
          campaigns={campaignOptions}
          campaignId={selectedCampaign.id}
          items={queueItems}
          selectedId={selectedId}
        />

        <section className="min-w-0">
          {panelRegistration ? (
            <MedicalCheckPanel
              key={panelRegistration.id}
              registration={panelRegistration}
            />
          ) : (
            <Card className="flex min-h-[320px] items-center justify-center text-center">
              <CardHeader>
                <div className="bg-muted mx-auto mb-2 grid size-12 place-items-center rounded-full">
                  <Stethoscope className="text-muted-foreground size-6" />
                </div>
                <CardTitle>Chọn một hồ sơ để bắt đầu</CardTitle>
                <CardDescription>
                  Hàng chờ bên trái hiển thị các hồ sơ đã duyệt, đã check-in và
                  các ca đang chờ chốt kết quả.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
