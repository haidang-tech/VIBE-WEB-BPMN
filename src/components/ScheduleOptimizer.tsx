"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Scale,
  Sparkles,
} from "lucide-react";
import {
  rebalanceSchedule,
  type RebalanceScheduleData,
} from "@/actions/schedule";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import type { SlotLoad } from "@/lib/slot-optimizer";
import { cn } from "@/lib/utils";

type Props = {
  campaignId: string;
  campaignName: string;
};

const LOAD_BAR_TONE: Record<SlotLoad["status"], string> = {
  under: "bg-primary",
  balanced: "bg-success",
  over: "bg-destructive",
};

const LOAD_BADGE: Record<
  SlotLoad["status"],
  { label: string; variant: "neutral" | "success" | "destructive" }
> = {
  under: { label: "Còn tải", variant: "neutral" },
  balanced: { label: "Vừa chỉ tiêu", variant: "success" },
  over: { label: "Quá tải", variant: "destructive" },
};

function LoadRow({ load }: { load: SlotLoad }) {
  const percent =
    load.target > 0
      ? Math.min(100, Math.round((load.count / load.target) * 100))
      : 0;
  const meta = LOAD_BADGE[load.status];

  return (
    <li className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium">{load.slot}</span>
        <span className="text-muted-foreground tabular-nums">
          {load.count}/{load.target} suất
        </span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-all", LOAD_BAR_TONE[load.status])}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px]">
          {load.free > 0 ? `Còn ${load.free} suất` : "Đã đầy chỉ tiêu"}
        </span>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </div>
    </li>
  );
}

export default function ScheduleOptimizer({
  campaignId,
  campaignName,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RebalanceScheduleData | null>(null);

  async function run() {
    setLoading(true);
    setError(null);

    try {
      const result = await rebalanceSchedule({ campaignId });

      if (!result.success || !result.data) {
        setError(result.message);
        toast({
          tone: "destructive",
          title: "Không thể điều phối lịch",
          description: result.message,
        });
        return;
      }

      setData(result.data);
      setOpen(false);
      toast({
        tone: result.data.moved > 0 ? "success" : "info",
        title:
          result.data.moved > 0
            ? "Đã cân bằng lại lịch"
            : "Lịch đang cân bằng",
        description: result.message,
      });
      router.refresh();
    } catch {
      const message =
        "Mất kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.";
      setError(message);
      toast({
        tone: "destructive",
        title: "Mất kết nối máy chủ",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card className="border-primary/20 from-primary/10 to-card overflow-hidden bg-gradient-to-br">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="bg-primary/10 text-primary grid size-8 place-items-center rounded-lg">
              <Sparkles className="size-4" aria-hidden />
            </span>
            AI điều phối lịch
          </CardTitle>
          <CardDescription className="leading-relaxed">
            Cân bằng hồ sơ đã duyệt giữa các khung giờ để tránh tắc nghẽn tại
            quầy tiếp nhận. Hệ thống chỉ chuyển trong đúng các khung sinh viên
            đã chọn.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-muted/30 flex items-start gap-2 rounded-lg border p-3 text-xs leading-relaxed">
            <Scale className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Ưu tiên người có ít khung giờ lựa chọn hơn, sau đó chia đều theo
              chỉ tiêu trung bình mỗi khung. Không đổi sang khung ngoài nguyện
              vọng của sinh viên.
            </p>
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={() => setOpen(true)}
            disabled={loading}
          >
            {loading ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : (
              <Sparkles aria-hidden />
            )}
            {loading ? "Đang điều phối..." : "Cân bằng lịch bằng AI"}
          </Button>

          {error ? (
            <p role="alert" className="text-destructive text-xs">
              {error}
            </p>
          ) : null}

          {data ? (
            <Alert variant={data.balanced ? "success" : "warning"}>
              {data.balanced ? <CheckCircle2 /> : <AlertTriangle />}
              <AlertTitle>
                {data.balanced
                  ? "Lịch đã được cân bằng"
                  : "Vẫn còn khung quá tải"}
              </AlertTitle>
              <AlertDescription>
                <p>
                  Đã chuyển{" "}
                  <span className="font-semibold">{data.moved}</span>/
                  {data.totalMovable} hồ sơ. Chỉ tiêu trung bình{" "}
                  {data.capacityPerSlot} suất/khung.
                </p>
                {data.bottleneckSlots.length > 0 ? (
                  <p className="mt-1 text-xs">
                    Khung còn quá tải: {data.bottleneckSlots.join(", ")}.
                  </p>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          {data ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium">
                <ArrowRight className="text-muted-foreground size-3.5" aria-hidden />
                Tải sau khi điều phối
              </div>
              <ul className="space-y-3">
                {data.after.map((load) => (
                  <LoadRow key={load.slot} load={load} />
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={open}
        title="Cân bằng lịch hiến máu bằng AI?"
        description={
          <span>
            Hệ thống sẽ phân lại các hồ sơ <strong>đã duyệt</strong> của chiến
            dịch <strong>{campaignName}</strong> trong đúng các khung giờ sinh
            viên đã chọn. Hồ sơ đã check-in hoặc đã hiến không bị thay đổi.
          </span>
        }
        confirmLabel="Điều phối ngay"
        cancelLabel="Để sau"
        tone="info"
        icon={<Sparkles className="size-5" aria-hidden />}
        loading={loading}
        onConfirm={run}
        onClose={() => {
          if (!loading) setOpen(false);
        }}
      />
    </>
  );
}
