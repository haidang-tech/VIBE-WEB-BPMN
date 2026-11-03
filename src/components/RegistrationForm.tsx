"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  Lock,
  MapPin,
  ShieldCheck,
  Ticket,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { validateProfile } from "@/actions/blood-donation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  MIN_AGE,
  MIN_WEIGHT_KG,
  evaluateProfileRules,
} from "@/lib/donation-rules";
import { calculateAge, donationRegistrationSchema } from "@/lib/validations";
import { cn } from "@/lib/utils";

export type CampaignOption = {
  id: string;
  name: string;
  dateLabel: string;
  location: string;
  remainingSlots: number;
  maxSlots: number;
  /** Sinh viên đã có hồ sơ đang hoạt động ở chiến dịch này. */
  alreadyRegistered: boolean;
};

export type RegistrationFormDefaults = {
  fullName: string;
  email: string;
  /** CCCD đã giải mã của chính tài khoản đang đăng nhập (nếu có). */
  cccd: string | null;
};

type RegistrationFormValues = {
  fullName: string;
  email: string;
  phone?: string;
  cccd: string;
  dateOfBirth: string;
  weightKg?: number | string;
  heightCm?: number | string;
  campaignId: string;
  note?: string;
};

type ServerState = {
  tone: "destructive" | "success" | "warning" | "info";
  title: string;
  message: string;
  reasons?: string[];
  trackingId?: string;
};

type Props = {
  campaigns: CampaignOption[];
  defaults: RegistrationFormDefaults;
};

const FIELD_ERROR_ID = (field: string) => `${field}-error`;

function FieldError({ field, message }: { field: string; message?: string }) {
  if (!message) return null;

  return (
    <p
      id={FIELD_ERROR_ID(field)}
      role="alert"
      className="text-destructive mt-1.5 text-xs leading-relaxed"
    >
      {message}
    </p>
  );
}

function RequirementItem({
  ok,
  label,
}: {
  ok: boolean | null;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok === null ? (
        <span className="bg-muted-foreground/40 size-4 rounded-full" />
      ) : ok ? (
        <CheckCircle2 className="text-success size-4" aria-hidden />
      ) : (
        <XCircle className="text-destructive size-4" aria-hidden />
      )}
      <span
        className={cn(
          ok === false ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </li>
  );
}

export default function RegistrationForm({ campaigns, defaults }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverState, setServerState] = useState<ServerState | null>(null);

  const firstAvailableCampaign =
    campaigns.find(
      (campaign) => campaign.remainingSlots > 0 && !campaign.alreadyRegistered,
    )?.id ??
    campaigns[0]?.id ??
    "";

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<RegistrationFormValues>({
    resolver: zodResolver(
      donationRegistrationSchema,
    ) as unknown as Resolver<RegistrationFormValues>,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      fullName: defaults.fullName,
      email: defaults.email,
      phone: "",
      cccd: defaults.cccd ?? "",
      dateOfBirth: "",
      weightKg: "",
      heightCm: "",
      campaignId: firstAvailableCampaign,
      note: "",
    },
  });

  const dateOfBirth = watch("dateOfBirth");
  const weightRaw = watch("weightKg");
  const campaignId = watch("campaignId");
  const selectedCampaign = campaigns.find((item) => item.id === campaignId);

  const age = useMemo(() => {
    if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;

    try {
      const value = calculateAge(dateOfBirth);
      return Number.isFinite(value) && value >= 0 && value <= 120 ? value : null;
    } catch {
      return null;
    }
  }, [dateOfBirth]);

  const weightValue =
    typeof weightRaw === "number" ? weightRaw : Number(weightRaw);
  const hasWeight =
    weightRaw !== undefined &&
    weightRaw !== "" &&
    Number.isFinite(weightValue) &&
    weightValue > 0;

  const preview =
    age !== null && hasWeight ? evaluateProfileRules(age, weightValue) : null;

  const usedSlots = selectedCampaign
    ? Math.max(0, selectedCampaign.maxSlots - selectedCampaign.remainingSlots)
    : 0;
  const usedPercent = selectedCampaign
    ? Math.min(
        100,
        selectedCampaign.maxSlots > 0
          ? Math.round((usedSlots / selectedCampaign.maxSlots) * 100)
          : 0,
      )
    : 0;

  const hasAvailableCampaign = campaigns.some(
    (campaign) => campaign.remainingSlots > 0 && !campaign.alreadyRegistered,
  );

  const onSubmit = handleSubmit(async (values) => {
    if (submitting) return;

    setSubmitting(true);
    setServerState(null);

    try {
      const result = await validateProfile(values);

      if (result.success && result.data) {
        router.push(
          `/student/tracking?registrationId=${encodeURIComponent(
            result.data.registrationId,
          )}`,
        );
        return;
      }

      if (result.errors) {
        for (const [field, message] of Object.entries(result.errors)) {
          if (field === "_form") continue;
          setError(field as keyof RegistrationFormValues, {
            type: "server",
            message,
          });
        }
      }

      if (result.code === "PROFILE_REJECTED") {
        setServerState({
          tone: "warning",
          title: "Hồ sơ đã được ghi nhận nhưng chưa đủ điều kiện",
          message:
            "Hồ sơ của bạn đã được lưu ở trạng thái bị từ chối. Bạn có thể xem lại tại trang Theo dõi.",
          reasons: result.data?.reasons,
          trackingId: result.data?.registrationId,
        });
      } else if (result.code === "ALREADY_REGISTERED") {
        setServerState({
          tone: "info",
          title: "Bạn đã có hồ sơ cho chiến dịch này",
          message: result.message,
          trackingId: result.data?.registrationId,
        });
      } else {
        setServerState({
          tone: "destructive",
          title:
            result.code === "CAMPAIGN_FULL"
              ? "Chiến dịch đã đủ chỉ tiêu"
              : "Không thể gửi hồ sơ",
          message: result.message,
        });
      }
    } catch {
      setServerState({
        tone: "destructive",
        title: "Mất kết nối máy chủ",
        message:
          "Không thể gửi hồ sơ lúc này. Vui lòng kiểm tra kết nối mạng và thử lại.",
      });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="overflow-hidden py-0">
        <CardHeader className="border-border/70 bg-muted/20 border-b py-5">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserRound className="text-primary size-5" aria-hidden />
            Thông tin đăng ký hiến máu
          </CardTitle>
          <CardDescription>
            Điền đầy đủ thông tin bên dưới. Hệ thống kiểm tra điều kiện ngay khi
            bạn nhập liệu và xác nhận lại ở máy chủ.
          </CardDescription>
        </CardHeader>

        <CardContent className="py-6">
          {serverState ? (
            <Alert variant={serverState.tone} className="mb-6">
              {serverState.tone === "destructive" ? (
                <AlertCircle />
              ) : serverState.tone === "info" ? (
                <Info />
              ) : (
                <AlertCircle />
              )}
              <AlertTitle>{serverState.title}</AlertTitle>
              <AlertDescription>
                <p>{serverState.message}</p>
                {serverState.reasons && serverState.reasons.length > 0 ? (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {serverState.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
                {serverState.trackingId ? (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    <Link
                      href={`/student/tracking?registrationId=${encodeURIComponent(
                        serverState.trackingId,
                      )}`}
                    >
                      Xem tiến độ hồ sơ
                    </Link>
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={onSubmit} noValidate className="space-y-6">
            {/* --- Chiến dịch ------------------------------------------------ */}
            <div className="space-y-2">
              <Label htmlFor="campaignId">
                Chiến dịch hiến máu <span className="text-destructive">*</span>
              </Label>
              <Select
                id="campaignId"
                aria-invalid={Boolean(errors.campaignId)}
                aria-describedby={
                  errors.campaignId ? FIELD_ERROR_ID("campaignId") : undefined
                }
                disabled={campaigns.length === 0}
                {...register("campaignId")}
              >
                {campaigns.length === 0 ? (
                  <option value="">Chưa có chiến dịch đang mở</option>
                ) : null}
                {campaigns.map((campaign) => {
                  const unavailable =
                    campaign.remainingSlots <= 0 || campaign.alreadyRegistered;

                  const suffix = campaign.alreadyRegistered
                    ? " — đã có hồ sơ"
                    : campaign.remainingSlots <= 0
                      ? " — hết suất"
                      : ` — còn ${campaign.remainingSlots} suất`;

                  return (
                    <option
                      key={campaign.id}
                      value={campaign.id}
                      disabled={unavailable}
                    >
                      {campaign.name} ({campaign.dateLabel}){suffix}
                    </option>
                  );
                })}
              </Select>
              <FieldError
                field="campaignId"
                message={errors.campaignId?.message}
              />
            </div>

            <div className="border-border/70 border-t" />

            {/* --- Thông tin cá nhân ---------------------------------------- */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="fullName">
                  Họ và tên <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fullName"
                  autoComplete="name"
                  placeholder="Nguyễn Văn A"
                  aria-invalid={Boolean(errors.fullName)}
                  aria-describedby={
                    errors.fullName ? FIELD_ERROR_ID("fullName") : undefined
                  }
                  {...register("fullName")}
                />
                <FieldError
                  field="fullName"
                  message={errors.fullName?.message}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  readOnly
                  className="opacity-80"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={
                    errors.email ? FIELD_ERROR_ID("email") : undefined
                  }
                  {...register("email")}
                />
                <p className="text-muted-foreground text-xs">
                  Email gắn với tài khoản sinh viên, không thể thay đổi.
                </p>
                <FieldError field="email" message={errors.email?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="0912345678"
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={
                    errors.phone ? FIELD_ERROR_ID("phone") : undefined
                  }
                  {...register("phone", {
                    setValueAs: (value: string) =>
                      value.trim() === "" ? undefined : value,
                  })}
                />
                <FieldError field="phone" message={errors.phone?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cccd">
                  Số CCCD <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="cccd"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={20}
                    placeholder="001203004567"
                    readOnly={Boolean(defaults.cccd)}
                    className={cn(
                      "pr-9",
                      defaults.cccd && "opacity-80",
                    )}
                    aria-invalid={Boolean(errors.cccd)}
                    aria-describedby={
                      errors.cccd ? FIELD_ERROR_ID("cccd") : undefined
                    }
                    {...register("cccd")}
                  />
                  {defaults.cccd ? (
                    <Lock
                      className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2"
                      aria-hidden
                    />
                  ) : null}
                </div>
                <p className="text-muted-foreground text-xs">
                  {defaults.cccd
                    ? "CCCD đã gắn với tài khoản. Liên hệ ban tổ chức nếu cần thay đổi."
                    : "Nhập đúng 12 chữ số. CCCD được mã hóa trước khi lưu."}
                </p>
                <FieldError field="cccd" message={errors.cccd?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">
                  Ngày sinh <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  autoComplete="bday"
                  max={new Date().toISOString().slice(0, 10)}
                  aria-invalid={Boolean(errors.dateOfBirth)}
                  aria-describedby={
                    errors.dateOfBirth
                      ? FIELD_ERROR_ID("dateOfBirth")
                      : undefined
                  }
                  {...register("dateOfBirth")}
                />
                <FieldError
                  field="dateOfBirth"
                  message={errors.dateOfBirth?.message}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weightKg">
                  Cân nặng (kg) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="weightKg"
                  type="number"
                  inputMode="decimal"
                  min={30}
                  max={250}
                  step="0.1"
                  placeholder="50"
                  aria-invalid={Boolean(errors.weightKg)}
                  aria-describedby={
                    errors.weightKg ? FIELD_ERROR_ID("weightKg") : undefined
                  }
                  {...register("weightKg", {
                    setValueAs: (value: string) =>
                      value.trim() === "" ? undefined : Number(value),
                  })}
                />
                <FieldError
                  field="weightKg"
                  message={errors.weightKg?.message}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="heightCm">Chiều cao (cm)</Label>
                <Input
                  id="heightCm"
                  type="number"
                  inputMode="numeric"
                  min={100}
                  max={250}
                  step="1"
                  placeholder="170"
                  aria-invalid={Boolean(errors.heightCm)}
                  aria-describedby={
                    errors.heightCm ? FIELD_ERROR_ID("heightCm") : undefined
                  }
                  {...register("heightCm", {
                    setValueAs: (value: string) =>
                      value.trim() === "" ? undefined : Number(value),
                  })}
                />
                <FieldError
                  field="heightCm"
                  message={errors.heightCm?.message}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="note">Ghi chú</Label>
                <Textarea
                  id="note"
                  rows={3}
                  placeholder="Ví dụ: mong muốn hiến vào buổi sáng, có tiền sử bệnh lý..."
                  aria-invalid={Boolean(errors.note)}
                  aria-describedby={
                    errors.note ? FIELD_ERROR_ID("note") : undefined
                  }
                  {...register("note")}
                />
                <FieldError field="note" message={errors.note?.message} />
              </div>
            </div>

            {/* --- Kiểm tra sơ bộ realtime ---------------------------------- */}
            <div className="bg-muted/30 border-border/70 rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="text-primary size-4" aria-hidden />
                  Kiểm tra điều kiện sơ bộ
                </p>
                {preview ? (
                  <Badge variant={preview.eligible ? "success" : "warning"}>
                    {preview.eligible ? "Đủ điều kiện" : "Chưa đủ điều kiện"}
                  </Badge>
                ) : (
                  <Badge variant="neutral">Chờ nhập liệu</Badge>
                )}
              </div>

              <ul className="grid gap-2 sm:grid-cols-2">
                <RequirementItem
                  ok={age === null ? null : age >= MIN_AGE}
                  label={
                    age === null
                      ? `Tuổi từ ${MIN_AGE} trở lên`
                      : `Tuổi ${age} (yêu cầu ≥ ${MIN_AGE})`
                  }
                />
                <RequirementItem
                  ok={hasWeight ? weightValue >= MIN_WEIGHT_KG : null}
                  label={
                    hasWeight
                      ? `Cân nặng ${weightValue}kg (yêu cầu ≥ ${MIN_WEIGHT_KG}kg)`
                      : `Cân nặng từ ${MIN_WEIGHT_KG}kg`
                  }
                />
              </ul>

              <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                {preview && !preview.eligible
                  ? `Lưu ý: ${preview.reasons.join("; ")}. Hồ sơ vẫn có thể gửi nhưng sẽ được ghi nhận là bị từ chối.`
                  : "Kết quả sơ bộ chỉ mang tính tham khảo; máy chủ là nơi quyết định cuối cùng."}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Lock className="size-3.5" aria-hidden />
                Dữ liệu cá nhân được mã hóa AES-256-GCM.
              </p>
              <Button
                type="submit"
                size="lg"
                disabled={submitting || !hasAvailableCampaign}
                className="sm:min-w-44"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Đang gửi hồ sơ...
                  </>
                ) : (
                  "Gửi hồ sơ đăng ký"
                )}
              </Button>
            </div>

            {!hasAvailableCampaign ? (
              <p className="text-warning text-sm">
                Hiện không còn chiến dịch nào nhận đăng ký mới. Vui lòng quay lại
                sau.
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {/* --- Cột thông tin chiến dịch -------------------------------------- */}
      <aside className="space-y-4">
        <Card className="bg-gradient-to-b from-primary/10 to-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Ticket className="text-primary size-4" aria-hidden />
              {selectedCampaign ? selectedCampaign.name : "Chiến dịch"}
            </CardTitle>
            <CardDescription>
              {selectedCampaign
                ? "Thông tin chiến dịch bạn đang chọn"
                : "Chọn một chiến dịch để xem chi tiết"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 text-sm">
              <CalendarDays
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              <span>
                {selectedCampaign?.dateLabel ?? "Chưa có ngày diễn ra"}
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <MapPin
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              <span>{selectedCampaign?.location ?? "Chưa có địa điểm"}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Users
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              <span>
                {selectedCampaign
                  ? `Còn ${selectedCampaign.remainingSlots}/${selectedCampaign.maxSlots} suất (đã gồm overbook)`
                  : "Chưa có dữ liệu chỉ tiêu"}
              </span>
            </div>

            {selectedCampaign ? (
              <div className="space-y-1.5">
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${usedPercent}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  Đã nhận {usedSlots}/{selectedCampaign.maxSlots} hồ sơ
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="text-primary size-4" aria-hidden />
              Lưu ý trước khi hiến máu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground space-y-2.5 text-sm">
              <li className="flex gap-2">
                <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
                Ăn nhẹ, không để bụng quá đói trước khi hiến máu.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
                Mang theo CCCD bản gốc để check-in.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
                Ngủ đủ giấc, tránh rượu bia trong 24 giờ trước.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
                Thông báo cho nhân viên y tế nếu đang dùng thuốc.
              </li>
            </ul>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
