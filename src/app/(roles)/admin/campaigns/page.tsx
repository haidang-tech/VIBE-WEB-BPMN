import type { Metadata } from "next";
import CampaignManager, { type CampaignRow } from "@/components/CampaignManager";
import RefreshButton from "@/components/RefreshButton";
import { requireRole } from "@/lib/auth";
import { computeMaxSlots } from "@/lib/donation-rules";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Quản lý chiến dịch",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

const datePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

function toDateInput(date: Date): string {
  const parts = datePartsFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export default async function AdminCampaignsPage() {
  await requireRole("ADMIN");

  const [campaigns, completedGroups] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: { date: "asc" },
      select: {
        id: true,
        name: true,
        date: true,
        location: true,
        capacity: true,
        overbookRate: true,
        status: true,
        _count: { select: { registrations: true } },
      },
    }),
    prisma.registration.groupBy({
      by: ["campaignId"],
      where: { status: "COMPLETED" },
      _count: { _all: true },
    }),
  ]);

  const completedByCampaign = new Map(
    completedGroups.map((group) => [group.campaignId, group._count._all]),
  );

  const rows: CampaignRow[] = campaigns.map((campaign) => {
    const overbookRate = Number(campaign.overbookRate);

    return {
      id: campaign.id,
      name: campaign.name,
      dateLabel: dateFormatter.format(campaign.date),
      dateInput: toDateInput(campaign.date),
      location: campaign.location,
      capacity: campaign.capacity,
      overbookRate,
      maxSlots: computeMaxSlots(campaign.capacity, overbookRate),
      status: campaign.status,
      registrationCount: campaign._count.registrations,
      completedCount: completedByCampaign.get(campaign.id) ?? 0,
    };
  });

  const todayInput = toDateInput(new Date());

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Quản lý chiến dịch
        </h1>
        <RefreshButton />
      </header>

      <CampaignManager campaigns={rows} defaultDate={todayInput} />
    </div>
  );
}
