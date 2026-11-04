"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { RegStatus } from "@prisma/client";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { InfoTooltip } from "@/components/ui/tooltip";
import { REGISTRATION_STATUS_META } from "@/lib/registration-status";

const STATUS_ORDER: RegStatus[] = [
  "PENDING",
  "APPROVED",
  "CHECKED_IN",
  "ELIGIBLE",
  "COMPLETED",
  "REJECTED",
  "HEALTH_CHECK_FAILED",
];

export type CampaignFilterOption = {
  id: string;
  name: string;
  dateLabel: string;
  isToday: boolean;
};

type Props = {
  q: string;
  status: string;
  campaignId: string;
  campaigns: CampaignFilterOption[];
  total: number;
};

export default function CheckInToolbar({
  q,
  status,
  campaignId,
  campaigns,
  total,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(q);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setSearch(q);
  }, [q]);

  function buildUrl(next: {
    q: string;
    status: string;
    campaignId: string;
  }): string {
    const params = new URLSearchParams();

    if (next.campaignId) params.set("campaignId", next.campaignId);
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.status && next.status !== "ALL") {
      params.set("status", next.status);
    }

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function apply(next: {
    q?: string;
    status?: string;
    campaignId?: string;
  }) {
    startTransition(() => {
      router.replace(
        buildUrl({
          q: next.q ?? search,
          status: next.status ?? status,
          campaignId: next.campaignId ?? campaignId,
        }),
        { scroll: false },
      );
    });
  }

  // Debounce ô tìm kiếm để không bắn request mỗi lần gõ phím.
  useEffect(() => {
    if (search === q) return;

    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(
          buildUrl({ q: search, status, campaignId }),
          { scroll: false },
        );
      });
    }, 350);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, q, status, campaignId]);

  const hasFilter = q.trim() !== "" || (status !== "" && status !== "ALL");

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <form
          className="relative min-w-0 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            apply({ q: search });
          }}
        >
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên, email hoặc 12 số CCCD..."
            aria-label="Tìm kiếm hồ sơ"
            className="pl-9"
          />
        </form>

        <Select
          value={status || "ALL"}
          onChange={(event) => apply({ status: event.target.value })}
          aria-label="Lọc theo trạng thái"
          className="lg:w-52"
        >
          <option value="ALL">Tất cả trạng thái</option>
          {STATUS_ORDER.map((item) => (
            <option key={item} value={item}>
              {REGISTRATION_STATUS_META[item].label}
            </option>
          ))}
        </Select>

        <Select
          value={campaignId}
          onChange={(event) => apply({ campaignId: event.target.value })}
          aria-label="Lọc theo chiến dịch"
          className="lg:w-64"
        >
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name} ({campaign.dateLabel}
              {campaign.isToday ? " · hôm nay" : ""})
            </option>
          ))}
        </Select>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSearch("");
            apply({ q: "", status: "ALL" });
          }}
          disabled={!hasFilter}
        >
          <RotateCcw aria-hidden />
          Xóa lọc
        </Button>
      </div>

      <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          Tìm theo tên, email hoặc CCCD
          <InfoTooltip
            label="Nhập đúng 12 số CCCD để tra cứu chính xác. Kết quả tự cập nhật sau khi ngừng gõ."
            side="top"
          />
        </span>
        <p className="flex shrink-0 items-center gap-1.5">
          {pending ? (
            <>
              <Search className="size-3.5 animate-pulse" aria-hidden />
              Đang lọc...
            </>
          ) : (
            `${total} hồ sơ`
          )}
        </p>
      </div>
    </div>
  );
}
