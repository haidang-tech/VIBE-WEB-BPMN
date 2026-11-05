"use client";

import { useRouter } from "next/navigation";
import { Filter } from "lucide-react";
import { Select } from "@/components/ui/select";

export type ReportCampaignOption = {
  id: string;
  name: string;
  dateLabel: string;
};

type Props = {
  campaigns: ReportCampaignOption[];
  selectedId: string;
};

export default function ReportsFilter({ campaigns, selectedId }: Props) {
  const router = useRouter();

  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <Filter className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <Select
        value={selectedId}
        onChange={(event) => {
          const value = event.target.value;
          router.push(
            value
              ? `/admin/reports?campaignId=${encodeURIComponent(value)}`
              : "/admin/reports",
          );
        }}
        aria-label="Lọc báo cáo theo chiến dịch"
        className="w-full sm:w-[300px]"
      >
        <option value="">Tất cả chiến dịch</option>
        {campaigns.map((campaign) => (
          <option key={campaign.id} value={campaign.id}>
            {campaign.name} · {campaign.dateLabel}
          </option>
        ))}
      </Select>
    </div>
  );
}
