import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  ClipboardCheck,
  Info,
  MapPin,
  ScanLine,
  Stethoscope,
} from "lucide-react";
import CccdUploader from "@/components/CccdUploader";
import RefreshButton from "@/components/RefreshButton";
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

export const metadata: Metadata = {
  title: "Quét CCCD khám sức khỏe",
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

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

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

export default async function MedicalScanIdPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("MEDICAL");

  const params = await searchParams;
  const requestedCampaignId = firstParam(params.campaignId);
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
          Quét CCCD khám sức khỏe
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Quét CCCD để mở đúng hồ sơ sinh viên và nhập chỉ số khám. Thao tác
          này không check-in — trạng thái hồ sơ chỉ thay đổi sau khi lưu kết quả
          khám.
        </p>
      </div>
      <div className="flex gap-2">
        <RefreshButton />
        <Button asChild variant="outline">
          <Link href="/medical/health-check">
            <Stethoscope aria-hidden />
            Khám sức khỏe
          </Link>
        </Button>
      </div>
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
              Cần kích hoạt chiến dịch trước khi quét CCCD khám sức khỏe.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isToday =
    selectedCampaign.date >= todayStart && selectedCampaign.date < todayEnd;

  const [waitingCount, recentHealthChecks] = await Promise.all([
    prisma.registration.count({
      where: {
        campaignId: selectedCampaign.id,
        status: { in: ["APPROVED", "CHECKED_IN"] },
      },
    }),
    prisma.healthCheck.findMany({
      where: { registration: { campaignId: selectedCampaign.id } },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        isPassed: true,
        updatedAt: true,
        registration: {
          select: {
            user: { select: { name: true, email: true } },
          },
        },
      },
    }),
  ]);

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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <CccdUploader
          key={selectedCampaign.id}
          campaignId={selectedCampaign.id}
          campaignName={selectedCampaign.name}
          intent="medical"
        />

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ScanLine className="text-primary size-4" aria-hidden />
                Chiến dịch đang chọn
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="font-medium">{selectedCampaign.name}</p>
              <p className="text-muted-foreground flex items-start gap-2">
                <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {dateFormatter.format(selectedCampaign.date)} ·{" "}
                  {timeFormatter.format(selectedCampaign.date)}
                </span>
              </p>
              <p className="text-muted-foreground flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{selectedCampaign.location}</span>
              </p>
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <span className="text-muted-foreground text-xs">Chờ khám</span>
                <span className="text-lg font-semibold tabular-nums">
                  {waitingCount}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="text-success size-4" aria-hidden />
                Khám gần đây
              </CardTitle>
              <CardDescription>
                Cập nhật sau mỗi lần lưu chỉ số khám.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentHealthChecks.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Chưa có sinh viên nào được nhập chỉ số trong chiến dịch này.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {recentHealthChecks.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {item.registration.user.name}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {item.registration.user.email}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <Badge
                          variant={item.isPassed ? "success" : "destructive"}
                        >
                          {item.isPassed ? "Đạt" : "Chưa đạt"}
                        </Badge>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {timeFormatter.format(item.updatedAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
