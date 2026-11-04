"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RegStatus } from "@prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Droplets,
  HeartPulse,
  Info,
  Scale,
  Stethoscope,
  Syringe,
} from "lucide-react";
import {
  evaluateHealth,
  finalizeDonation,
} from "@/actions/blood-donation";
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
import { useToast } from "@/components/ui/toast";
import { InfoTooltip } from "@/components/ui/tooltip";
import {
  evaluateHealthRules,
  parseBloodPressure,
} from "@/lib/donation-rules";
import {
  REGISTRATION_STATUS_META,
  type StatusTone,
} from "@/lib/registration-status";
import { healthCheckSchema } from "@/lib/validations";
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

type HealthCheckFormValues = {
  registrationId: string;
  bloodPressure: string;
  heartRate: number | string;
  weight: number | string;
  bloodType: "A" | "B" | "AB" | "O";
  bloodVolume: number | string;
};

export type MedicalHealthCheck = {
  bloodPressure: string;
  heartRate: number;
  weight: number;
  bloodType: "A" | "B" | "AB" | "O" | null;
  bloodVolume: number;
  isPassed: boolean;
  updatedAt: string;
};

export type MedicalPanelRegistration = {
  id: string;
  status: RegStatus;
  studentName: string;
  studentEmail: string;
  cccdMasked: string;
  campaignName: string;
  checkInTime: string | null;
  healthCheck: MedicalHealthCheck | null;
};

type Props = {
  registration: MedicalPanelRegistration;
};

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p role="alert" className="text-destructive mt-1.5 text-xs leading-relaxed">
      {message}
    </p>
  );
}

export default function MedicalCheckPanel({ registration }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState<"SUCCESS" | "INCIDENT" | null>(
    null,
  );

  const existing = registration.healthCheck;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<HealthCheckFormValues>({
    resolver: zodResolver(
      healthCheckSchema,
    ) as unknown as Resolver<HealthCheckFormValues>,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      registrationId: registration.id,
      bloodPressure: existing?.bloodPressure ?? "120/80",
      heartRate: existing?.heartRate ?? 80,
      weight: existing?.weight ?? 50,
      bloodType: existing?.bloodType ?? "O",
      bloodVolume: existing?.bloodVolume ?? 350,
    },
  });

  const bloodVolume = watch("bloodVolume");

  const meta = REGISTRATION_STATUS_META[registration.status];
  const canEnterMetrics =
    registration.status === "APPROVED" ||
    registration.status === "CHECKED_IN";
  const canFinalize = registration.status === "ELIGIBLE";

  const parsedPressure = existing
    ? parseBloodPressure(existing.bloodPressure)
    : null;

  const healthEvaluation =
    existing && parsedPressure
      ? evaluateHealthRules({
          bloodPressure: parsedPressure,
          heartRate: existing.heartRate,
        })
      : null;

  const onSubmit = handleSubmit(async (values) => {
    if (submitting) return;

    setSubmitting(true);

    try {
      const result = await evaluateHealth(values);

      if (result.errors) {
        for (const [field, message] of Object.entries(result.errors)) {
          if (field === "_form") continue;
          setError(field as keyof HealthCheckFormValues, {
            type: "server",
            message,
          });
        }
      }

      if (result.success) {
        toast({
          tone: "success",
          title: "Sức khỏe đạt yêu cầu",
          description:
            "Hồ sơ đã chuyển sang trạng thái đủ điều kiện. Hãy chốt kết quả sau khi lấy máu.",
        });
        router.refresh();
        return;
      }

      if (result.code === "HEALTH_CHECK_FAILED") {
        toast({
          tone: "destructive",
          title: "Sức khỏe chưa đạt",
          description: result.message,
        });
        router.refresh();
        return;
      }

      toast({
        tone: "destructive",
        title: "Không thể lưu chỉ số",
        description: result.message,
      });
    } catch {
      toast({
        tone: "destructive",
        title: "Mất kết nối máy chủ",
        description:
          "Không thể gửi chỉ số khám. Vui lòng kiểm tra mạng và thử lại.",
      });
    } finally {
      setSubmitting(false);
    }
  });

  async function handleFinalize(outcome: "SUCCESS" | "INCIDENT") {
    if (finalizing) return;

    const confirmed = window.confirm(
      outcome === "SUCCESS"
        ? "Xác nhận ca hiến máu THÀNH CÔNG? Hồ sơ sẽ được đóng ở trạng thái Hoàn thành."
        : "Xác nhận ca hiến máu THẤT BẠI do sự cố? Hồ sơ sẽ được đóng và không tính chỉ tiêu.",
    );

    if (!confirmed) return;

    setFinalizing(outcome);

    try {
      const result = await finalizeDonation({
        registrationId: registration.id,
        outcome,
      });

      toast({
        tone: result.success
          ? outcome === "INCIDENT"
            ? "warning"
            : "success"
          : "destructive",
        title: result.success
          ? outcome === "INCIDENT"
            ? "Đã ghi nhận ca thất bại"
            : "Đã chốt kết quả"
          : "Không thể chốt kết quả",
        description: result.message,
      });

      if (result.success) {
        router.refresh();
      }
    } catch {
      toast({
        tone: "destructive",
        title: "Mất kết nối máy chủ",
        description:
          "Không thể chốt kết quả. Vui lòng kiểm tra mạng và thử lại.",
      });
    } finally {
      setFinalizing(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-border/70 bg-muted/20 border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-lg">
                {registration.studentName}
              </CardTitle>
              <CardDescription className="mt-1 space-y-0.5">
                <p>{registration.studentEmail}</p>
                <p className="font-mono text-xs">{registration.cccdMasked}</p>
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge variant={TONE_TO_BADGE[meta.tone]}>{meta.label}</Badge>
              <p className="text-muted-foreground text-xs">
                {registration.campaignName}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <span>
              Check-in:{" "}
              <span className="text-foreground">
                {registration.checkInTime
                  ? dateTimeFormatter.format(
                      new Date(registration.checkInTime),
                    )
                  : "Chưa check-in"}
              </span>
            </span>
            <span>
              Mã hồ sơ:{" "}
              <span className="text-foreground font-mono">
                {registration.id}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      {existing ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Stethoscope className="text-primary size-4" aria-hidden />
              Chỉ số đã ghi nhận
            </CardTitle>
            <CardDescription>
              Cập nhật lúc {dateTimeFormatter.format(new Date(existing.updatedAt))}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Metric
                icon={HeartPulse}
                label="Huyết áp"
                value={`${existing.bloodPressure} mmHg`}
              />
              <Metric
                icon={HeartPulse}
                label="Nhịp tim"
                value={`${existing.heartRate} lần/phút`}
              />
              <Metric
                icon={Scale}
                label="Cân nặng"
                value={`${existing.weight} kg`}
              />
              <Metric
                icon={Droplets}
                label="Nhóm máu"
                value={existing.bloodType ?? "—"}
              />
              <Metric
                icon={Syringe}
                label="Lượng máu"
                value={`${existing.bloodVolume} ml`}
              />
            </dl>
          </CardContent>
        </Card>
      ) : null}

      {canEnterMetrics ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="text-primary size-4" aria-hidden />
              Nhập chỉ số khám sức khỏe
              <InfoTooltip
                label="Ngưỡng đạt: huyết áp 90/60–140/90 mmHg và nhịp tim 60–100 lần/phút. Không đạt sẽ đóng hồ sơ ở trạng thái không đủ điều kiện."
                side="top"
              />
            </CardTitle>
            <CardDescription>
              Nhập nhanh các chỉ số lâm sàng. Hệ thống tự đánh giá cổng XOR 3
              (huyết áp và nhịp tim).
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-6" noValidate>
              <input type="hidden" {...register("registrationId")} />
              <input type="hidden" {...register("bloodVolume")} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="bloodPressure">Huyết áp (mmHg)</Label>
                  <Input
                    id="bloodPressure"
                    inputMode="numeric"
                    placeholder="120/80"
                    autoComplete="off"
                    className="mt-1.5"
                    aria-invalid={Boolean(errors.bloodPressure)}
                    {...register("bloodPressure")}
                  />
                  <FieldError message={errors.bloodPressure?.message} />
                </div>

                <div>
                  <Label htmlFor="heartRate">Nhịp tim (lần/phút)</Label>
                  <Input
                    id="heartRate"
                    type="number"
                    inputMode="numeric"
                    min={30}
                    max={220}
                    step={1}
                    className="mt-1.5"
                    aria-invalid={Boolean(errors.heartRate)}
                    {...register("heartRate")}
                  />
                  <FieldError message={errors.heartRate?.message} />
                </div>

                <div>
                  <Label htmlFor="weight">Cân nặng (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    inputMode="decimal"
                    min={30}
                    max={250}
                    step={0.1}
                    className="mt-1.5"
                    aria-invalid={Boolean(errors.weight)}
                    {...register("weight")}
                  />
                  <FieldError message={errors.weight?.message} />
                </div>

                <div>
                  <Label htmlFor="bloodType">Nhóm máu</Label>
                  <Select
                    id="bloodType"
                    className="mt-1.5"
                    aria-invalid={Boolean(errors.bloodType)}
                    {...register("bloodType")}
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="O">O</option>
                  </Select>
                  <FieldError message={errors.bloodType?.message} />
                </div>
              </div>

              <div>
                <Label>Lượng máu hiến</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {[250, 350].map((volume) => {
                    const active = Number(bloodVolume) === volume;

                    return (
                      <button
                        key={volume}
                        type="button"
                        onClick={() =>
                          setValue("bloodVolume", volume, {
                            shouldValidate: true,
                          })
                        }
                        aria-pressed={active}
                        className={cn(
                          "flex h-14 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <Syringe className="size-4" aria-hidden />
                        {volume} ml
                      </button>
                    );
                  })}
                </div>
                <FieldError message={errors.bloodVolume?.message} />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Stethoscope className="animate-pulse" aria-hidden />
                    Đang lưu chỉ số...
                  </>
                ) : (
                  <>
                    <Stethoscope aria-hidden />
                    Lưu kết quả khám (XOR 3)
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {canFinalize ? (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgeCheck className="text-success size-4" aria-hidden />
              Chốt kết quả hiến máu
            </CardTitle>
            <CardDescription>
              Sức khỏe đã đạt. Chọn kết quả sau khi lấy máu — thao tác này sẽ
              đóng hồ sơ và ghi AuditLog.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="success"
                size="lg"
                disabled={finalizing !== null}
                onClick={() => handleFinalize("SUCCESS")}
                className="h-24 flex-col gap-1 text-base font-semibold"
              >
                {finalizing === "SUCCESS" ? (
                  <CheckCircle2
                    className="size-6 animate-pulse"
                    aria-hidden
                  />
                ) : (
                  <CheckCircle2 className="size-6" aria-hidden />
                )}
                Thành công
                <span className="text-xs font-normal opacity-90">
                  Hiến máu hoàn tất
                </span>
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="lg"
                disabled={finalizing !== null}
                onClick={() => handleFinalize("INCIDENT")}
                className="h-24 flex-col gap-1 text-base font-semibold"
              >
                {finalizing === "INCIDENT" ? (
                  <AlertTriangle
                    className="size-6 animate-pulse"
                    aria-hidden
                  />
                ) : (
                  <AlertTriangle className="size-6" aria-hidden />
                )}
                Thất bại do sự cố
                <span className="text-xs font-normal opacity-90">
                  Không tính chỉ tiêu
                </span>
              </Button>
            </div>

            <p className="text-muted-foreground text-center text-xs">
              Kiểm tra kỹ trước khi chốt — hồ sơ không thể mở lại từ màn hình
              này.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {registration.status === "COMPLETED" ? (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertTitle>Ca hiến máu đã hoàn thành</AlertTitle>
          <AlertDescription>
            Hồ sơ đã được đóng ở trạng thái Hoàn thành và được ghi vào AuditLog.
          </AlertDescription>
        </Alert>
      ) : null}

      {registration.status === "HEALTH_CHECK_FAILED" ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>
            {existing?.isPassed
              ? "Ca hiến máu thất bại do sự cố"
              : "Hồ sơ không đạt khám sức khỏe"}
          </AlertTitle>
          <AlertDescription>
            {existing?.isPassed ? (
              <p>
                Chỉ số khám vẫn hợp lệ nhưng ca lấy máu không thành công. Hồ sơ
                đã được đóng để giải phóng chỉ tiêu.
              </p>
            ) : (
              <>
                <p>
                  Huyết áp hoặc nhịp tim chưa đạt ngưỡng an toàn. Hồ sơ đã được
                  đóng.
                </p>
                {healthEvaluation && healthEvaluation.reasons.length > 0 ? (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {healthEvaluation.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {!canEnterMetrics &&
      !canFinalize &&
      registration.status !== "COMPLETED" &&
      registration.status !== "HEALTH_CHECK_FAILED" ? (
        <Alert variant="info">
          <Info />
          <AlertTitle>Hồ sơ chưa sẵn sàng để khám</AlertTitle>
          <AlertDescription>
            Hồ sơ đang ở trạng thái {meta.label}. Chỉ hồ sơ đã duyệt hoặc đã
            check-in mới được nhập chỉ số.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HeartPulse;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-muted/30 border-border/70 rounded-lg border p-3">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}
