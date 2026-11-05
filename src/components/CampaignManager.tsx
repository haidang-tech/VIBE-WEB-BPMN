"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import type { CampaignStatus } from "@prisma/client";
import {
  CalendarDays,
  MapPin,
  Pencil,
  Plus,
  Save,
  Ticket,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  createCampaign,
  deleteCampaign,
  updateCampaign,
} from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { InfoTooltip } from "@/components/ui/tooltip";
import {
  CAMPAIGN_STATUS_META,
  CAMPAIGN_STATUS_OPTIONS,
} from "@/lib/campaign-status";
import { campaignFormSchema } from "@/lib/validations";

const TONE_TO_BADGE: Record<
  "neutral" | "info" | "success" | "warning" | "danger",
  "neutral" | "info" | "success" | "warning" | "destructive"
> = {
  neutral: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "destructive",
};

export type CampaignRow = {
  id: string;
  name: string;
  dateLabel: string;
  dateInput: string;
  location: string;
  capacity: number;
  overbookRate: number;
  maxSlots: number;
  status: CampaignStatus;
  registrationCount: number;
  completedCount: number;
};

type CampaignFormValues = {
  name: string;
  date: string;
  location: string;
  capacity: number | string;
  overbookRate: number | string;
  status: CampaignStatus;
};

type Props = {
  campaigns: CampaignRow[];
  defaultDate: string;
};

export default function CampaignManager({ campaigns, defaultDate }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CampaignRow | null>(null);

  const createDefaults: CampaignFormValues = {
    name: "",
    date: defaultDate,
    location: "Trường Đại học Kinh tế - ĐHĐN",
    capacity: 200,
    overbookRate: 1.2,
    status: "DRAFT",
  };

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(
      campaignFormSchema,
    ) as unknown as Resolver<CampaignFormValues>,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: createDefaults,
  });

  const editingCampaign = editingId
    ? (campaigns.find((campaign) => campaign.id === editingId) ?? null)
    : null;

  const capacityValue = Number(watch("capacity"));
  const overbookValue = Number(watch("overbookRate"));
  const previewSlots =
    Number.isFinite(capacityValue) &&
    Number.isFinite(overbookValue) &&
    capacityValue > 0 &&
    overbookValue > 0
      ? Math.floor(capacityValue * overbookValue)
      : 0;

  function startCreate() {
    setEditingId(null);
    reset(createDefaults);
  }

  function startEdit(campaign: CampaignRow) {
    setEditingId(campaign.id);
    reset({
      name: campaign.name,
      date: campaign.dateInput,
      location: campaign.location,
      capacity: campaign.capacity,
      overbookRate: campaign.overbookRate,
      status: campaign.status,
    });
  }

  const onSubmit = handleSubmit(async (values) => {
    if (saving) return;

    setSaving(true);

    try {
      const result = editingId
        ? await updateCampaign({ id: editingId, ...values })
        : await createCampaign(values);

      if (result.errors) {
        for (const [field, message] of Object.entries(result.errors)) {
          if (field === "_form") continue;
          setError(field as keyof CampaignFormValues, {
            type: "server",
            message,
          });
        }
      }

      if (result.success) {
        toast({
          tone: "success",
          title: editingId ? "Đã cập nhật chiến dịch" : "Đã tạo chiến dịch",
          description: result.message,
        });

        if (!editingId) {
          reset(createDefaults);
        }

        router.refresh();
        return;
      }

      toast({
        tone: "destructive",
        title: "Không thể lưu chiến dịch",
        description: result.message,
      });
    } catch {
      toast({
        tone: "destructive",
        title: "Mất kết nối máy chủ",
        description: "Không thể gửi dữ liệu. Vui lòng kiểm tra mạng và thử lại.",
      });
    } finally {
      setSaving(false);
    }
  });

  function requestDelete(campaign: CampaignRow) {
    if (deletingId) return;
    setPendingDelete(campaign);
  }

  async function handleDelete(campaign: CampaignRow) {
    if (deletingId) return;

    setDeletingId(campaign.id);

    try {
      const result = await deleteCampaign(campaign.id);

      toast({
        tone: result.success ? "success" : "destructive",
        title: result.success ? "Đã xóa chiến dịch" : "Không thể xóa",
        description: result.message,
      });

      if (result.success) {
        if (editingId === campaign.id) {
          startCreate();
        }
        router.refresh();
      }
    } catch {
      toast({
        tone: "destructive",
        title: "Mất kết nối máy chủ",
        description:
          "Không thể xóa chiến dịch. Vui lòng kiểm tra mạng và thử lại.",
      });
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-lg font-semibold">
              Danh sách chiến dịch
              <InfoTooltip
                label="Sức chứa tối đa = chỉ tiêu × tỷ lệ overbook (làm tròn xuống). Chỉ xóa được chiến dịch chưa có hồ sơ đăng ký."
                side="top"
              />
            </h2>
            <p className="text-muted-foreground text-sm">
              {campaigns.length} chiến dịch · quản lý chỉ tiêu và tỷ lệ
              overbook.
            </p>
          </div>
          <Button type="button" onClick={startCreate} disabled={saving}>
            <Plus aria-hidden />
            Thêm chiến dịch
          </Button>
        </div>

        <Card className="overflow-hidden py-0">
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Chiến dịch</TableHead>
                  <TableHead>Chỉ tiêu</TableHead>
                  <TableHead>Overbook</TableHead>
                  <TableHead>Tối đa</TableHead>
                  <TableHead>Hồ sơ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="pr-4 text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center">
                      <div className="text-muted-foreground flex flex-col items-center gap-2">
                        <Ticket className="size-6" aria-hidden />
                        <p className="text-foreground font-medium">
                          Chưa có chiến dịch nào
                        </p>
                        <p className="text-xs">
                          Bấm “Thêm chiến dịch” để tạo chiến dịch đầu tiên.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  campaigns.map((campaign) => {
                    const meta = CAMPAIGN_STATUS_META[campaign.status];
                    const isEditing = campaign.id === editingId;
                    const deleting = campaign.id === deletingId;

                    return (
                      <TableRow
                        key={campaign.id}
                        data-state={isEditing ? "selected" : undefined}
                      >
                        <TableCell className="pl-4 whitespace-normal">
                          <p className="max-w-64 truncate text-sm font-medium">
                            {campaign.name}
                          </p>
                          <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="size-3" aria-hidden />
                              {campaign.dateLabel}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" aria-hidden />
                              {campaign.location}
                            </span>
                          </p>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {campaign.capacity}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          ×{campaign.overbookRate.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">
                          {campaign.maxSlots}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-sm tabular-nums">
                            <Users
                              className="text-muted-foreground size-3.5"
                              aria-hidden
                            />
                            {campaign.registrationCount}
                          </span>
                          <p className="text-muted-foreground text-xs">
                            {campaign.completedCount} hoàn thành
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={TONE_TO_BADGE[meta.tone]}>
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              type="button"
                              variant={isEditing ? "secondary" : "ghost"}
                              size="sm"
                              onClick={() => startEdit(campaign)}
                              disabled={saving || deleting}
                            >
                              <Pencil aria-hidden />
                              Sửa
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => requestDelete(campaign)}
                              disabled={
                                saving ||
                                deleting ||
                                campaign.registrationCount > 0
                              }
                              title={
                                campaign.registrationCount > 0
                                  ? "Không thể xóa chiến dịch đã có hồ sơ"
                                  : "Xóa chiến dịch"
                              }
                            >
                              {deleting ? (
                                <Trash2
                                  className="animate-pulse"
                                  aria-hidden
                                />
                              ) : (
                                <Trash2 aria-hidden />
                              )}
                              Xóa
                            </Button>
                          </div>
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

      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  {editingCampaign ? "Sửa chiến dịch" : "Tạo chiến dịch mới"}
                </CardTitle>
              </div>
              {editingCampaign ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={startCreate}
                  aria-label="Hủy chỉnh sửa"
                  disabled={saving}
                >
                  <X aria-hidden />
                </Button>
              ) : null}
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div>
                <Label htmlFor="campaign-name">Tên chiến dịch</Label>
                <Input
                  id="campaign-name"
                  className="mt-1.5"
                  placeholder="Hiến máu nhân đạo đợt 2 - 2026"
                  aria-invalid={Boolean(errors.name)}
                  {...register("name")}
                />
                <FieldError message={errors.name?.message} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="campaign-date">Ngày tổ chức</Label>
                  <Input
                    id="campaign-date"
                    type="date"
                    className="mt-1.5"
                    aria-invalid={Boolean(errors.date)}
                    {...register("date")}
                  />
                  <FieldError message={errors.date?.message} />
                </div>

                <div>
                  <Label htmlFor="campaign-status">Trạng thái</Label>
                  <Select
                    id="campaign-status"
                    className="mt-1.5"
                    aria-invalid={Boolean(errors.status)}
                    {...register("status")}
                  >
                    {CAMPAIGN_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <FieldError message={errors.status?.message} />
                </div>
              </div>

              <div>
                <Label htmlFor="campaign-location">Địa điểm</Label>
                <Input
                  id="campaign-location"
                  className="mt-1.5"
                  placeholder="Trường Đại học Kinh tế - ĐHĐN"
                  aria-invalid={Boolean(errors.location)}
                  {...register("location")}
                />
                <FieldError message={errors.location?.message} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="campaign-capacity">Chỉ tiêu</Label>
                  <Input
                    id="campaign-capacity"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100000}
                    step={1}
                    className="mt-1.5"
                    aria-invalid={Boolean(errors.capacity)}
                    {...register("capacity")}
                  />
                  <FieldError message={errors.capacity?.message} />
                </div>

                <div>
                  <Label htmlFor="campaign-overbook">Overbook</Label>
                  <Input
                    id="campaign-overbook"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={3}
                    step={0.05}
                    className="mt-1.5"
                    aria-invalid={Boolean(errors.overbookRate)}
                    {...register("overbookRate")}
                  />
                  <FieldError message={errors.overbookRate?.message} />
                </div>
              </div>

              <div className="bg-muted/40 border-border/70 rounded-lg border p-3">
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Users className="size-3.5" aria-hidden />
                  Sức chứa tối đa dự kiến
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {previewSlots.toLocaleString("vi-VN")} suất
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Save className="animate-pulse" aria-hidden />
                    Đang lưu...
                  </>
                ) : editingCampaign ? (
                  <>
                    <Save aria-hidden />
                    Lưu thay đổi
                  </>
                ) : (
                  <>
                    <Plus aria-hidden />
                    Tạo chiến dịch
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </aside>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Xóa chiến dịch?"
        description={
          pendingDelete ? (
            <>
              Chiến dịch{" "}
              <span className="text-foreground font-medium">
                “{pendingDelete.name}”
              </span>{" "}
              sẽ bị xóa vĩnh viễn. Thao tác này không thể hoàn tác.
            </>
          ) : null
        }
        tone="destructive"
        confirmLabel="Xóa chiến dịch"
        loading={Boolean(deletingId)}
        onConfirm={() => {
          if (pendingDelete) void handleDelete(pendingDelete);
        }}
        onClose={() => {
          if (!deletingId) setPendingDelete(null);
        }}
      />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p role="alert" className="text-destructive mt-1.5 text-xs leading-relaxed">
      {message}
    </p>
  );
}
