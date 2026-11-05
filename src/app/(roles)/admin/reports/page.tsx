import type { Metadata } from "next";
import type { RegStatus } from "@prisma/client";
import {
  BadgeCheck,
  CalendarDays,
  Droplets,
  Percent,
} from "lucide-react";
import ReportsCharts, {
  type BloodTypeDatum,
  type CampaignVolumeDatum,
  type SlotDatum,
  type StatusDatum,
} from "@/components/ReportsCharts";
import ReportsFilter from "@/components/ReportsFilter";
import RefreshButton from "@/components/RefreshButton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { CAMPAIGN_STATUS_META } from "@/lib/campaign-status";
import { computeMaxSlots } from "@/lib/donation-rules";
import { prisma } from "@/lib/prisma";
import {
  REGISTRATION_STATUS_META,
  type StatusTone,
} from "@/lib/registration-status";
import { cn } from "@/lib/utils";
import { DONATION_SLOTS } from "@/lib/validations";

export const metadata: Metadata = {
  title: "Báo cáo & thống kê",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

const percentFormatter = new Intl.NumberFormat("vi-VN", {
  style: "percent",
  maximumFractionDigits: 0,
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

const TONE_COLORS: Record<StatusTone, string> = {
  neutral: "#94a3b8",
  info: "#0ea5e9",
  success: "#16a34a",
  warning: "#f59e0b",
  danger: "#e11d48",
};

const BLOOD_TYPE_META: Record<"A" | "B" | "AB" | "O", { color: string }> = {
  A: { color: "#e11d48" },
  B: { color: "#0ea5e9" },
  AB: { color: "#8b5cf6" },
  O: { color: "#16a34a" },
};

const STATUS_ORDER: RegStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CHECKED_IN",
  "ELIGIBLE",
  "HEALTH_CHECK_FAILED",
  "COMPLETED",
];

function shortCampaignName(name: string): string {
  return name.length > 18 ? `${name.slice(0, 17)}…` : name;
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ campaignId?: string | string[] }>;
}) {
  await requireRole("ADMIN");

  const params = await searchParams;
  const rawCampaignId = Array.isArray(params.campaignId)
    ? params.campaignId[0]
    : params.campaignId;

  const campaigns = await prisma.campaign.findMany({
    orderBy: { date: "asc" },
    select: {
      id: true,
      name: true,
      date: true,
      capacity: true,
      overbookRate: true,
      status: true,
      _count: { select: { registrations: true } },
    },
  });

  const selectedId =
    rawCampaignId && campaigns.some((campaign) => campaign.id === rawCampaignId)
      ? rawCampaignId
      : "";
  const campaignFilter = selectedId ? { campaignId: selectedId } : {};

  const [statusGroups, slotGroups, completedRegistrations, campaignGroups] =
    await Promise.all([
      prisma.registration.groupBy({
        by: ["status"],
        where: campaignFilter,
        _count: { _all: true },
      }),
      prisma.registration.groupBy({
        by: ["slotTime"],
        where: { ...campaignFilter, slotTime: { not: null } },
        _count: { _all: true },
      }),
      prisma.registration.findMany({
        where: { status: "COMPLETED" },
        select: {
          campaignId: true,
          healthCheck: {
            select: { bloodType: true, bloodVolume: true },
          },
        },
      }),
      prisma.registration.groupBy({
        by: ["campaignId", "status"],
        _count: { _all: true },
      }),
    ]);

  const statusCounts = new Map<RegStatus, number>();
  for (const group of statusGroups) {
    statusCounts.set(group.status, group._count._all);
  }

  const slotCounts = new Map<string, number>();
  for (const group of slotGroups) {
    if (group.slotTime) {
      slotCounts.set(group.slotTime, group._count._all);
    }
  }

  const completedPerCampaign = new Map<string, number>();
  for (const group of campaignGroups) {
    if (group.status === "COMPLETED") {
      completedPerCampaign.set(group.campaignId, group._count._all);
    }
  }

  const completedStatusFilter = (campaignId: string) =>
    !selectedId || campaignId === selectedId;

  const bloodTypeCounts: Record<"A" | "B" | "AB" | "O", number> = {
    A: 0,
    B: 0,
    AB: 0,
    O: 0,
  };
  const bloodTypeVolumes: Record<"A" | "B" | "AB" | "O", number> = {
    A: 0,
    B: 0,
    AB: 0,
    O: 0,
  };
  const volumeByCampaign = new Map<string, number>();

  let totalVolume = 0;
  let totalCompleted = 0;

  for (const registration of completedRegistrations) {
    const healthCheck = registration.healthCheck;
    const volume = healthCheck?.bloodVolume ?? 0;

    volumeByCampaign.set(
      registration.campaignId,
      (volumeByCampaign.get(registration.campaignId) ?? 0) + volume,
    );

    if (!completedStatusFilter(registration.campaignId)) continue;

    totalCompleted += 1;
    totalVolume += volume;

    if (healthCheck?.bloodType) {
      bloodTypeCounts[healthCheck.bloodType] += 1;
      bloodTypeVolumes[healthCheck.bloodType] += volume;
    }
  }

  const totalRegistrations = statusGroups.reduce(
    (sum, group) => sum + group._count._all,
    0,
  );

  const statusData: StatusDatum[] = STATUS_ORDER.filter((status) =>
    statusCounts.has(status),
  ).map((status) => {
    const meta = REGISTRATION_STATUS_META[status];

    return {
      status,
      label: meta.label,
      value: statusCounts.get(status) ?? 0,
      color: TONE_COLORS[meta.tone],
    };
  });

  const bloodTypeData: BloodTypeDatum[] = (
    ["A", "B", "AB", "O"] as const
  ).map((type) => ({
    type,
    count: bloodTypeCounts[type],
    volume: bloodTypeVolumes[type],
    color: BLOOD_TYPE_META[type].color,
  }));

  const slotData: SlotDatum[] = DONATION_SLOTS.map((slot) => ({
    slot,
    value: slotCounts.get(slot) ?? 0,
  }));

  const campaignVolumeData: CampaignVolumeDatum[] = campaigns.map(
    (campaign) => ({
      id: campaign.id,
      name: campaign.name,
      shortName: shortCampaignName(campaign.name),
      dateLabel: dateFormatter.format(campaign.date),
      status: campaign.status,
      volume: volumeByCampaign.get(campaign.id) ?? 0,
      donations: completedPerCampaign.get(campaign.id) ?? 0,
      selected: selectedId === campaign.id,
    }),
  );

  const visibleCampaigns = selectedId
    ? campaigns.filter((campaign) => campaign.id === selectedId)
    : campaigns;

  const completionRate =
    totalRegistrations > 0 ? totalCompleted / totalRegistrations : 0;

  const kpis = [
    {
      label: "Tổng hồ sơ",
      value: totalRegistrations.toLocaleString("vi-VN"),
      icon: CalendarDays,
      tone: "text-primary",
      background: "bg-primary/10",
    },
    {
      label: "Ca hoàn thành",
      value: totalCompleted.toLocaleString("vi-VN"),
      icon: BadgeCheck,
      tone: "text-success",
      background: "bg-success/10",
    },
    {
      label: "Lượng máu thu được",
      value: `${totalVolume.toLocaleString("vi-VN")} ml`,
      icon: Droplets,
      tone: "text-destructive",
      background: "bg-destructive/10",
    },
    {
      label: "Tỷ lệ hoàn thành",
      value: percentFormatter.format(completionRate),
      icon: Percent,
      tone: "text-sky-500",
      background: "bg-sky-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Báo cáo & thống kê
        </h1>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <ReportsFilter
            campaigns={campaigns.map((campaign) => ({
              id: campaign.id,
              name: campaign.name,
              dateLabel: dateFormatter.format(campaign.date),
            }))}
            selectedId={selectedId}
          />
          <RefreshButton />
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;

          return (
            <div
              key={kpi.label}
              className="bg-card flex items-center gap-3 rounded-xl border p-4 shadow-sm"
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  kpi.background,
                )}
              >
                <Icon className={cn("size-5", kpi.tone)} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-muted-foreground truncate text-xs">
                  {kpi.label}
                </p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums">
                  {kpi.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <ReportsCharts
        statusData={statusData}
        bloodTypeData={bloodTypeData}
        slotData={slotData}
        campaignVolumeData={campaignVolumeData}
        totalRegistrations={totalRegistrations}
      />

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-border/70 bg-muted/20 border-b py-5">
          <CardTitle className="text-base">Hiệu quả theo chiến dịch</CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Chiến dịch</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Chỉ tiêu</TableHead>
                <TableHead className="text-right">Hồ sơ</TableHead>
                <TableHead className="text-right">Hoàn thành</TableHead>
                <TableHead className="text-right">Lượng máu</TableHead>
                <TableHead className="pr-4 text-right">Lấp đầy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleCampaigns.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-muted-foreground h-24 text-center"
                  >
                    Chưa có chiến dịch nào.
                  </TableCell>
                </TableRow>
              ) : (
                visibleCampaigns.map((campaign) => {
                  const meta = CAMPAIGN_STATUS_META[campaign.status];
                  const maxSlots = computeMaxSlots(
                    campaign.capacity,
                    Number(campaign.overbookRate),
                  );
                  const completed = completedPerCampaign.get(campaign.id) ?? 0;
                  const registrations = campaign._count.registrations;
                  const fillRate =
                    maxSlots > 0 ? registrations / maxSlots : 0;

                  return (
                    <TableRow key={campaign.id}>
                      <TableCell className="pl-4 whitespace-normal">
                        <p className="max-w-64 truncate text-sm font-medium">
                          {campaign.name}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                        {dateFormatter.format(campaign.date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={TONE_TO_BADGE[meta.tone]}>
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        <span className="font-medium">
                          {campaign.capacity.toLocaleString("vi-VN")}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          / {maxSlots.toLocaleString("vi-VN")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {registrations.toLocaleString("vi-VN")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {completed.toLocaleString("vi-VN")}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium tabular-nums">
                        {(volumeByCampaign.get(campaign.id) ?? 0).toLocaleString(
                          "vi-VN",
                        )}{" "}
                        ml
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="bg-muted hidden h-1.5 w-16 overflow-hidden rounded-full sm:block">
                            <span
                              className="bg-primary block h-full rounded-full"
                              style={{
                                width: `${Math.min(fillRate * 100, 100)}%`,
                              }}
                            />
                          </span>
                          <span className="w-10 text-xs tabular-nums">
                            {percentFormatter.format(fillRate)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
