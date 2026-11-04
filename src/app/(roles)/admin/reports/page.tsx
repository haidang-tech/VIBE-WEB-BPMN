import type { Metadata } from "next";
import {
  Activity,
  BadgeCheck,
  CalendarDays,
  Droplets,
  Info,
} from "lucide-react";
import ReportCharts, {
  type BloodTypeDatum,
  type CampaignVolumeDatum,
} from "@/components/ReportsCharts";
import RefreshButton from "@/components/RefreshButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
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
import { prisma } from "@/lib/prisma";
import type { StatusTone } from "@/lib/registration-status";
import { cn } from "@/lib/utils";

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

const BLOOD_TYPE_META: Record<
  "A" | "B" | "AB" | "O",
  { color: string }
> = {
  A: { color: "#e11d48" },
  B: { color: "#0ea5e9" },
  AB: { color: "#8b5cf6" },
  O: { color: "#16a34a" },
};

function shortCampaignName(name: string): string {
  return name.length > 18 ? `${name.slice(0, 17)}…` : name;
}

export default async function AdminReportsPage() {
  await requireRole("ADMIN");

  const [campaigns, completedRegistrations] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: { date: "asc" },
      select: {
        id: true,
        name: true,
        date: true,
        status: true,
      },
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
  ]);

  const bloodTypeCounts: Record<"A" | "B" | "AB" | "O", number> = {
    A: 0,
    B: 0,
    AB: 0,
    O: 0,
  };

  const volumeByCampaign = new Map<
    string,
    { volume: number; donations: number }
  >();

  let totalVolume = 0;

  for (const registration of completedRegistrations) {
    const current = volumeByCampaign.get(registration.campaignId) ?? {
      volume: 0,
      donations: 0,
    };

    current.donations += 1;

    const healthCheck = registration.healthCheck;

    if (healthCheck?.bloodType) {
      bloodTypeCounts[healthCheck.bloodType] += 1;
    }

    if (healthCheck?.bloodVolume) {
      current.volume += healthCheck.bloodVolume;
      totalVolume += healthCheck.bloodVolume;
    }

    volumeByCampaign.set(registration.campaignId, current);
  }

  const bloodTypeData: BloodTypeDatum[] = (
    ["A", "B", "AB", "O"] as const
  ).map((type) => ({
    type,
    value: bloodTypeCounts[type],
    color: BLOOD_TYPE_META[type].color,
  }));

  const campaignVolumeData: CampaignVolumeDatum[] = campaigns.map(
    (campaign) => {
      const stats = volumeByCampaign.get(campaign.id) ?? {
        volume: 0,
        donations: 0,
      };

      return {
        id: campaign.id,
        name: campaign.name,
        shortName: shortCampaignName(campaign.name),
        dateLabel: dateFormatter.format(campaign.date),
        status: campaign.status,
        volume: stats.volume,
        donations: stats.donations,
      };
    },
  );

  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.status === "ACTIVE",
  ).length;

  const totalLiters = totalVolume / 1000;

  const stats = [
    {
      label: "Tổng chiến dịch",
      value: campaigns.length.toLocaleString("vi-VN"),
      hint: `${activeCampaigns} đang hoạt động`,
      icon: CalendarDays,
      tone: "text-primary",
    },
    {
      label: "Ca hiến thành công",
      value: completedRegistrations.length.toLocaleString("vi-VN"),
      hint: "Hồ sơ ở trạng thái Hoàn thành",
      icon: BadgeCheck,
      tone: "text-success",
    },
    {
      label: "Tổng máu thu được",
      value: `${totalLiters.toLocaleString("vi-VN", {
        maximumFractionDigits: 2,
      })} L`,
      hint: `${totalVolume.toLocaleString("vi-VN")} ml`,
      icon: Droplets,
      tone: "text-destructive",
    },
    {
      label: "Nhóm máu đã ghi nhận",
      value: bloodTypeData
        .reduce((sum, item) => sum + item.value, 0)
        .toLocaleString("vi-VN"),
      hint: "Từ các ca hiến thành công",
      icon: Activity,
      tone: "text-sky-500",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-primary text-sm font-medium">Khu vực quản trị</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Báo cáo & thống kê
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Nhóm máu và lượng máu thu được từ các ca hiến thành công.
          </p>
        </div>
        <RefreshButton />
      </header>

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
              <p className="text-muted-foreground mt-0.5 text-xs">
                {stat.hint}
              </p>
            </div>
          );
        })}
      </div>

      {completedRegistrations.length === 0 ? (
        <Alert variant="info">
          <Info />
          <AlertTitle>Chưa có dữ liệu hiến máu thành công</AlertTitle>
          <AlertDescription>
            Biểu đồ sẽ có dữ liệu sau khi nhân viên y tế chốt các ca hiến máu
            thành công ở màn hình Khám sức khỏe.
          </AlertDescription>
        </Alert>
      ) : null}

      <ReportCharts
        bloodTypeData={bloodTypeData}
        campaignVolumeData={campaignVolumeData}
      />

      <Card className="overflow-hidden py-0">
        <CardHeader className="border-border/70 bg-muted/20 border-b py-5">
          <CardTitle className="text-base">Chi tiết theo chiến dịch</CardTitle>
          <CardDescription>
            Số ca hoàn thành và lượng máu ghi nhận từ HealthCheck.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Chiến dịch</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Ca hoàn thành</TableHead>
                <TableHead className="pr-4 text-right">Lượng máu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground h-24 text-center"
                  >
                    Chưa có chiến dịch nào.
                  </TableCell>
                </TableRow>
              ) : (
                campaignVolumeData.map((campaign) => {
                  const meta = CAMPAIGN_STATUS_META[campaign.status];

                  return (
                    <TableRow key={campaign.id}>
                      <TableCell className="pl-4 whitespace-normal">
                        <p className="max-w-72 truncate text-sm font-medium">
                          {campaign.name}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {campaign.dateLabel}
                      </TableCell>
                      <TableCell>
                        <Badge variant={TONE_TO_BADGE[meta.tone]}>
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {campaign.donations}
                      </TableCell>
                      <TableCell className="pr-4 text-right font-medium tabular-nums">
                        {campaign.volume.toLocaleString("vi-VN")} ml
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
