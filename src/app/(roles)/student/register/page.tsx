import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Info } from "lucide-react";
import RegistrationForm, {
  type CampaignOption,
} from "@/components/RegistrationForm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { decryptCccd } from "@/lib/crypto";
import {
  BLOCKING_REGISTRATION_STATUSES,
  CAPACITY_CONSUMING_STATUSES,
  computeMaxSlots,
} from "@/lib/donation-rules";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Đăng ký hiến máu",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

export default async function StudentRegisterPage() {
  const session = await requireRole("STUDENT");

  const [user, campaignRecords, activeRegistrations] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        name: true,
        email: true,
        cccdCiphertext: true,
        cccdIv: true,
        cccdAuthTag: true,
      },
    }),
    prisma.campaign.findMany({
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
    }),
    prisma.registration.findMany({
      where: {
        userId: session.userId,
        status: { in: [...BLOCKING_REGISTRATION_STATUSES] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        campaignId: true,
        status: true,
        campaign: { select: { name: true } },
      },
    }),
  ]);

  if (!user) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Không tìm thấy tài khoản</CardTitle>
          <CardDescription>
            Tài khoản trong phiên đăng nhập không còn tồn tại. Vui lòng đăng xuất
            và đăng nhập lại.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const campaignIds = campaignRecords.map((campaign) => campaign.id);

  const counts =
    campaignIds.length > 0
      ? await prisma.registration.groupBy({
          by: ["campaignId"],
          where: {
            campaignId: { in: campaignIds },
            status: { in: [...CAPACITY_CONSUMING_STATUSES] },
          },
          _count: { _all: true },
        })
      : [];

  const countByCampaign = new Map(
    counts.map((item) => [item.campaignId, item._count._all]),
  );

  const blockedCampaignIds = new Set(
    activeRegistrations.map((registration) => registration.campaignId),
  );

  const campaigns: CampaignOption[] = campaignRecords.map((campaign) => {
    const maxSlots = computeMaxSlots(
      campaign.capacity,
      Number(campaign.overbookRate),
    );
    const activeCount = countByCampaign.get(campaign.id) ?? 0;

    return {
      id: campaign.id,
      name: campaign.name,
      dateLabel: dateFormatter.format(campaign.date),
      location: campaign.location,
      maxSlots,
      remainingSlots: Math.max(0, maxSlots - activeCount),
      alreadyRegistered: blockedCampaignIds.has(campaign.id),
    };
  });

  let ownCccd: string | null = null;

  try {
    ownCccd = decryptCccd(user);
  } catch (error) {
    // Không chặn trang nếu khóa mã hóa thay đổi; sinh viên có thể nhập lại CCCD.
    console.error("[student/register] Không giải mã được CCCD:", error);
  }

  const activeRegistration = activeRegistrations[0];

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="text-primary text-sm font-medium">Khu vực sinh viên</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Đăng ký hiến máu
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Hoàn thành hồ sơ để tham gia chiến dịch hiến máu nhân đạo. Hệ thống sẽ
          kiểm tra điều kiện tuổi, cân nặng và ghi nhận trạng thái hồ sơ của bạn.
        </p>
      </header>

      {activeRegistration ? (
        <Alert variant="info">
          <Info />
          <AlertTitle>Bạn đang có hồ sơ đang hoạt động</AlertTitle>
          <AlertDescription>
            <p>
              Hồ sơ tại chiến dịch “{activeRegistration.campaign.name}” vẫn đang
              được xử lý. Bạn có thể theo dõi tiến độ hoặc đăng ký thêm chiến
              dịch khác nếu còn suất.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link
                href={`/student/tracking?registrationId=${encodeURIComponent(
                  activeRegistration.id,
                )}`}
              >
                Xem tiến độ hồ sơ
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {campaigns.length === 0 ? (
        <Card className="mx-auto max-w-xl text-center">
          <CardHeader>
            <div className="bg-muted mx-auto mb-2 grid size-12 place-items-center rounded-full">
              <CalendarDays className="text-muted-foreground size-6" />
            </div>
            <CardTitle>Chưa có chiến dịch nào đang mở</CardTitle>
            <CardDescription>
              Ban tổ chức chưa công bố chiến dịch hiến máu mới. Vui lòng quay lại
              sau.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <RegistrationForm
          campaigns={campaigns}
          defaults={{
            fullName: user.name,
            email: user.email,
            cccd: ownCccd,
          }}
        />
      )}
    </div>
  );
}
