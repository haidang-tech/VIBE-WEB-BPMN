import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Info, Lock } from "lucide-react";
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
import { computeCapacityPerSlot } from "@/lib/slot-optimizer";
import { DONATION_SLOTS } from "@/lib/validations";

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
        studentCode: true,
        className: true,
        faculty: true,
        dateOfBirth: true,
        gender: true,
        phone: true,
        bloodType: true,
        lastDonationDate: true,
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

  // Đếm riêng từng khung giờ để làm mờ khung đã đủ tải.
  const slotCounts =
    campaignIds.length > 0
      ? await prisma.registration.groupBy({
          by: ["campaignId", "slotTime"],
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

  const slotCountByCampaign = new Map<string, Record<string, number>>();

  for (const group of slotCounts) {
    if (!group.slotTime) continue;

    const bucket = slotCountByCampaign.get(group.campaignId) ?? {};
    bucket[group.slotTime] = group._count._all;
    slotCountByCampaign.set(group.campaignId, bucket);
  }

  const blockedCampaignIds = new Set(
    activeRegistrations.map((registration) => registration.campaignId),
  );

  const campaigns: CampaignOption[] = campaignRecords.map((campaign) => {
    const maxSlots = computeMaxSlots(
      campaign.capacity,
      Number(campaign.overbookRate),
    );
    const activeCount = countByCampaign.get(campaign.id) ?? 0;
    const slotCapacity = computeCapacityPerSlot(
      maxSlots,
      DONATION_SLOTS.length,
    );
    const campaignSlotCounts = slotCountByCampaign.get(campaign.id) ?? {};

    return {
      id: campaign.id,
      name: campaign.name,
      dateLabel: dateFormatter.format(campaign.date),
      location: campaign.location,
      maxSlots,
      remainingSlots: Math.max(0, maxSlots - activeCount),
      alreadyRegistered: blockedCampaignIds.has(campaign.id),
      slotCapacity,
      slotCounts: Object.fromEntries(
        DONATION_SLOTS.map((slot) => [slot, campaignSlotCounts[slot] ?? 0]),
      ),
    };
  });

  const availableCampaigns = campaigns.filter(
    (campaign) => campaign.remainingSlots > 0 && !campaign.alreadyRegistered,
  );

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
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Đăng ký hiến máu
        </h1>
      </header>

      {activeRegistration ? (
        <Alert variant="info">
          <Info />
          <AlertTitle>Bạn đang có hồ sơ hoạt động</AlertTitle>
          <AlertDescription>
            <p>
              Hồ sơ “{activeRegistration.campaign.name}” vẫn đang được xử lý.
              Theo dõi tiến độ hoặc đăng ký chiến dịch khác nếu còn suất.
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
            <CardTitle>Chưa có chiến dịch đang mở</CardTitle>
          </CardHeader>
        </Card>
      ) : availableCampaigns.length === 0 ? (
        <Card className="border-warning/40 bg-warning/5 mx-auto max-w-xl text-center">
          <CardHeader>
            <div className="bg-warning/15 text-warning mx-auto mb-2 grid size-12 place-items-center rounded-full">
              <Lock className="size-6" aria-hidden />
            </div>
            <CardTitle>Đã đóng đăng ký</CardTitle>
            <CardDescription>
              Tất cả chiến dịch đang mở đã đủ chỉ tiêu tiếp nhận hoặc bạn đã có
              hồ sơ hoạt động. Vui lòng theo dõi hồ sơ hiện tại hoặc quay lại
              khi có chiến dịch mới.
            </CardDescription>
            <div className="mt-4">
              <Button asChild variant="outline">
                <Link href="/student/tracking">Xem hồ sơ của tôi</Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <RegistrationForm
          campaigns={campaigns}
          defaults={{
            fullName: user.name,
            email: user.email,
            cccd: ownCccd,
            studentCode: user.studentCode ?? "",
            className: user.className ?? "",
            faculty: user.faculty ?? "",
            dateOfBirth: user.dateOfBirth
              ? user.dateOfBirth.toISOString().slice(0, 10)
              : "",
            gender: user.gender ?? "",
            phone: user.phone ?? "",
            bloodType: user.bloodType ?? "",
            lastDonationDate: user.lastDonationDate
              ? user.lastDonationDate.toISOString().slice(0, 10)
              : "",
          }}
        />
      )}
    </div>
  );
}
