"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RegStatus } from "@prisma/client";
import {
  Clock3,
  Search,
  SearchX,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  REGISTRATION_STATUS_META,
  type StatusTone,
} from "@/lib/registration-status";
import { cn } from "@/lib/utils";

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

const TABS = [
  { key: "ALL", label: "Tất cả" },
  { key: "WAITING", label: "Chờ khám" },
  { key: "FINALIZE", label: "Chờ chốt" },
  { key: "DONE", label: "Đã xong" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export type MedicalCampaignOption = {
  id: string;
  name: string;
  dateLabel: string;
  isToday: boolean;
};

export type MedicalQueueItem = {
  id: string;
  studentName: string;
  studentEmail: string;
  cccdMasked: string;
  status: RegStatus;
  checkInTime: string | null;
};

type Props = {
  campaigns: MedicalCampaignOption[];
  campaignId: string;
  items: MedicalQueueItem[];
  selectedId: string | null;
};

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

/** Bỏ dấu tiếng Việt để tìm kiếm dễ hơn (Nguyễn -> nguyen). */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function matchesTab(status: RegStatus, tab: TabKey): boolean {
  switch (tab) {
    case "WAITING":
      return status === "APPROVED" || status === "CHECKED_IN";
    case "FINALIZE":
      return status === "ELIGIBLE";
    case "DONE":
      return status === "COMPLETED" || status === "HEALTH_CHECK_FAILED";
    default:
      return true;
  }
}

export default function MedicalQueue({
  campaigns,
  campaignId,
  items,
  selectedId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("ALL");

  const counts = useMemo(() => {
    const base: Record<TabKey, number> = {
      ALL: items.length,
      WAITING: 0,
      FINALIZE: 0,
      DONE: 0,
    };

    for (const item of items) {
      for (const key of ["WAITING", "FINALIZE", "DONE"] as const) {
        if (matchesTab(item.status, key)) base[key] += 1;
      }
    }

    return base;
  }, [items]);

  const filtered = useMemo(() => {
    const needle = normalize(search.trim());

    return items.filter((item) => {
      if (!matchesTab(item.status, tab)) return false;
      if (!needle) return true;

      return (
        normalize(item.studentName).includes(needle) ||
        normalize(item.studentEmail).includes(needle) ||
        item.cccdMasked.replace(/\*/g, "").includes(needle)
      );
    });
  }, [items, search, tab]);

  function changeCampaign(nextCampaignId: string) {
    startTransition(() => {
      router.push(
        `/medical/health-check?campaignId=${encodeURIComponent(nextCampaignId)}`,
      );
    });
  }

  return (
    <aside className="bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-sm xl:sticky xl:top-20 xl:max-h-[calc(100vh-7rem)]">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Users className="text-primary size-4" aria-hidden />
              Hàng chờ khám
            </h2>
          </div>
          <Badge variant="neutral" className="tabular-nums">
            {items.length} hồ sơ
          </Badge>
        </div>

        <Select
          value={campaignId}
          onChange={(event) => changeCampaign(event.target.value)}
          aria-label="Chọn chiến dịch"
          disabled={pending}
        >
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name} ({campaign.dateLabel}
              {campaign.isToday ? " · hôm nay" : ""})
            </option>
          ))}
        </Select>

        <div className="relative">
          {pending ? (
            <Search
              className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-pulse"
              aria-hidden
            />
          ) : (
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
          )}
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm tên, email hoặc CCCD..."
            aria-label="Tìm hồ sơ trong hàng chờ"
            className="pl-9"
          />
        </div>

        <div className="bg-muted/50 grid grid-cols-4 gap-1 rounded-lg p-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              aria-pressed={tab === item.key}
              className={cn(
                "rounded-md px-1 py-1.5 text-center text-xs font-medium transition-colors",
                tab === item.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
              <span className="ml-1 tabular-nums opacity-70">
                {counts[item.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center">
            <SearchX className="size-6" aria-hidden />
            <p className="text-foreground text-sm font-medium">
              Không có hồ sơ phù hợp
            </p>
            <p className="text-xs">Thử đổi từ khóa hoặc chọn nhóm khác.</p>
          </div>
        ) : (
          filtered.map((item) => {
            const meta = REGISTRATION_STATUS_META[item.status];
            const active = item.id === selectedId;

            return (
              <Link
                key={item.id}
                href={`/medical/health-check?campaignId=${encodeURIComponent(
                  campaignId,
                )}&registrationId=${encodeURIComponent(item.id)}`}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "block rounded-lg border p-3 transition-colors",
                  active
                    ? "border-primary/60 bg-primary/5 ring-primary/20 ring-2"
                    : "border-border/70 hover:bg-accent/60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.studentName}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {item.studentEmail}
                    </p>
                  </div>
                  <Badge variant={TONE_TO_BADGE[meta.tone]}>
                    {meta.label}
                  </Badge>
                </div>

                <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="font-mono">{item.cccdMasked}</span>
                  {item.checkInTime ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3" aria-hidden />
                      {timeFormatter.format(new Date(item.checkInTime))}
                    </span>
                  ) : (
                    <span>Chưa check-in</span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </aside>
  );
}
