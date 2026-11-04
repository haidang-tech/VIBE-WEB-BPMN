import type { Metadata } from "next";
import { RegStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import {
  CalendarDays,
  Info,
  MapPin,
  ScanLine,
  SearchX,
  Users,
} from "lucide-react";
import CccdUploader from "@/components/CccdUploader";
import CheckInToolbar from "@/components/CheckInToolbar";
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
import { blindIndex, decryptCccd, maskCccd } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import {
  REGISTRATION_STATUS_META,
  type StatusTone,
} from "@/lib/registration-status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Check-in chiến dịch",
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

export default async function OrganizerCheckInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ORGANIZER");

  const params = await searchParams;
  const rawQ = firstParam(params.q).trim().slice(0, 100);
  const rawStatus = firstParam(params.status);
  const requestedCampaignId = firstParam(params.campaignId);

  const status =
    rawStatus &&
    (Object.values(RegStatus) as string[]).includes(rawStatus)
      ? (rawStatus as RegStatus)
      : null;

  const { start: todayStart, end: todayEnd } = getTodayRange();

  const activeCampaigns = await prisma.campaign.findMany({
    where: { status: "ACTIVE" },
    orderBy: { date: "asc" },
    select: {
      id: true,
      name: true,
      date: true,
      location: true,
      capacity: true,
      overbookRate: true,
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
        <p className="text-primary text-sm font-medium">Khu vực Ban tổ chức</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Check-in chiến dịch
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Theo dõi hồ sơ, quét CCCD và check-in sinh viên khi đến chiến dịch.
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
              Chưa có chiến dịch đang mở. Hãy tạo hoặc kích hoạt chiến dịch
              trước.
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

  const totalRegistrations = statusCounts.reduce(
    (sum, item) => sum + item._count._all,
    0,
  );
  const waitingCount = countOf("APPROVED");
  const checkedInCount = countOf("CHECKED_IN", "ELIGIBLE", "COMPLETED");
  const failedCount = countOf("REJECTED", "HEALTH_CHECK_FAILED");

  const normalizedQuery = rawQ.replace(/[\s.-]/g, "");
  let cccdHash: string | null = null;

  if (/^\d{12}$/.test(normalizedQuery)) {
    try {
      cccdHash = blindIndex(normalizedQuery);
    } catch (error) {
      console.error("[organizer/check-in] Không tạo được blind index:", error);
    }
  }

  const searchFilters: Prisma.RegistrationWhereInput[] = [
    { user: { name: { contains: rawQ, mode: "insensitive" } } },
    { user: { email: { contains: rawQ, mode: "insensitive" } } },
  ];

  if (cccdHash) {
    searchFilters.push({ user: { cccdHash } });
  }

  const where: Prisma.RegistrationWhereInput = {
    campaignId: selectedCampaign.id,
    ...(status ? { status } : {}),
    ...(rawQ ? { OR: searchFilters } : {}),
  };

  const [registrations, filteredCount] = await Promise.all([
    prisma.registration.findMany({
      where,
      orderBy: [{ createdAt: "asc" }],
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
      },
    }),
    prisma.registration.count({ where }),
  ]);

  const stats = [
    {
      label: "Tổng hồ sơ",
      value: totalRegistrations,
      icon: Users,
      tone: "text-foreground",
    },
    {
      label: "Chờ check-in",
      value: waitingCount,
      icon: ScanLine,
      tone: "text-warning",
    },
    {
      label: "Đã check-in",
      value: checkedInCount,
      icon: CalendarDays,
      tone: "text-success",
    },
    {
      label: "Không đạt",
      value: failedCount,
      icon: SearchX,
      tone: "text-destructive",
    },
  ];

  return (
    <div className="space-y-6">
      {header}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          {!isToday ? (
            <Alert variant="info">
              <Info />
              <AlertTitle>Hôm nay chưa có chiến dịch check-in</AlertTitle>
              <AlertDescription>
                Đang hiển thị chiến dịch gần nhất:{" "}
                <span className="font-medium">{selectedCampaign.name}</span> —{" "}
                {dateFormatter.format(selectedCampaign.date)}. Bạn có thể chọn
                chiến dịch khác trong bộ lọc bên dưới.
              </AlertDescription>
            </Alert>
          ) : null}

          <Card className="overflow-hidden py-0">
            <CardHeader className="border-border/70 bg-muted/20 border-b py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">
                    {selectedCampaign.name}
                  </CardTitle>
                  <CardDescription className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" aria-hidden />
                      {dateFormatter.format(selectedCampaign.date)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden />
                      {selectedCampaign.location}
                    </span>
                  </CardDescription>
                </div>
                <Badge variant={isToday ? "success" : "info"}>
                  {isToday ? "Đang diễn ra hôm nay" : "Chiến dịch sắp tới"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="py-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stats.map((stat) => {
                  const Icon = stat.icon;

                  return (
                    <div
                      key={stat.label}
                      className="bg-muted/30 border-border/70 rounded-lg border p-3"
                    >
                      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <Icon
                          className={cn("size-3.5", stat.tone)}
                          aria-hidden
                        />
                        {stat.label}
                      </p>
                      <p className="mt-1 text-xl font-semibold tabular-nums">
                        {stat.value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Danh sách hồ sơ</CardTitle>
              <CardDescription>
                Hồ sơ của chiến dịch đang chọn, sắp xếp theo thời gian đăng ký.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <CheckInToolbar
                q={rawQ}
                status={status ?? "ALL"}
                campaignId={selectedCampaign.id}
                campaigns={campaignOptions}
                total={filteredCount}
              />

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sinh viên</TableHead>
                    <TableHead>CCCD</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Đăng ký lúc</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-36 text-center">
                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                          <SearchX className="size-6" aria-hidden />
                          <p className="text-foreground font-medium">
                            Không có hồ sơ phù hợp
                          </p>
                          <p className="text-xs">
                            Thử xóa bộ lọc hoặc chọn chiến dịch khác.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    registrations.map((registration) => {
                      const meta =
                        REGISTRATION_STATUS_META[registration.status];

                      return (
                        <TableRow key={registration.id}>
                          <TableCell>
                            <p className="text-sm font-medium">
                              {registration.user.name}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {registration.user.email}
                            </p>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">
                            {maskedCccd(registration.user)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={TONE_TO_BADGE[meta.tone]}>
                              {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {registration.checkInTime
                              ? dateTimeFormatter.format(
                                  registration.checkInTime,
                                )
                              : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {dateTimeFormatter.format(registration.createdAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {filteredCount > registrations.length ? (
                <p className="text-muted-foreground text-xs">
                  Đang hiển thị {registrations.length}/{filteredCount} hồ sơ.
                  Thu hẹp bộ lọc để xem chính xác hơn.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <CccdUploader
            key={selectedCampaign.id}
            campaignId={selectedCampaign.id}
            campaignName={selectedCampaign.name}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ScanLine className="text-primary size-4" aria-hidden />
                Quy trình check-in
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="text-muted-foreground space-y-3 text-sm">
                <li className="flex gap-2.5">
                  <span className="bg-primary/10 text-primary grid size-5 shrink-0 place-items-center rounded-full text-xs font-semibold">
                    1
                  </span>
                  Tải ảnh mặt trước CCCD của sinh viên.
                </li>
                <li className="flex gap-2.5">
                  <span className="bg-primary/10 text-primary grid size-5 shrink-0 place-items-center rounded-full text-xs font-semibold">
                    2
                  </span>
                  Hệ thống OCR giả lập trả về số CCCD sau 1 giây.
                </li>
                <li className="flex gap-2.5">
                  <span className="bg-primary/10 text-primary grid size-5 shrink-0 place-items-center rounded-full text-xs font-semibold">
                    3
                  </span>
                  Đối chiếu blind index với hồ sơ và chuyển trạng thái sang
                  CHECKED_IN.
                </li>
                <li className="flex gap-2.5">
                  <span className="bg-primary/10 text-primary grid size-5 shrink-0 place-items-center rounded-full text-xs font-semibold">
                    4
                  </span>
                  Mọi thao tác được ghi vào AuditLog.
                </li>
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
