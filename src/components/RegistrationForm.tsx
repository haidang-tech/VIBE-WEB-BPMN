"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForm,
  type FieldErrors,
  type Resolver,
  type UseFormRegisterReturn,
} from "react-hook-form";
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  HeartPulse,
  Info,
  LoaderCircle,
  Lock,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { screenNoteForStudent } from "@/actions/ai";
import { validateProfile } from "@/actions/blood-donation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Confetti from "@/components/ui/confetti";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { InfoTooltip } from "@/components/ui/tooltip";
import {
  MIN_AGE,
  MIN_WEIGHT_KG,
  evaluateProfileRules,
} from "@/lib/donation-rules";
import type { NoteRiskLevel, NoteScreening } from "@/lib/ai-screening";
import {
  DONATION_SLOTS,
  calculateAge,
  donationRegistrationSchema,
} from "@/lib/validations";
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
  studentCode: string;
  className: string;
  faculty: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  bloodType: string;
  lastDonationDate: string;
};

type GenderValue = "MALE" | "FEMALE" | "OTHER" | "";
type BloodTypeValue = "A" | "B" | "AB" | "O" | "";
type YesNoValue = "YES" | "NO" | "";

type RegistrationFormValues = {
  fullName: string;
  studentCode: string;
  className: string;
  faculty: string;
  email: string;
  phone: string;
  cccd: string;
  dateOfBirth: string;
  gender: GenderValue;
  weightKg: number | string;
  heightCm: number | string;
  bloodType: BloodTypeValue;
  lastDonationDate: string;
  usedAntibiotics: YesNoValue;
  recentTattooOrSurgery: YesNoValue;
  infectiousDiseaseHistory: YesNoValue;
  campaignId: string;
  preferredSlots: string[];
  commitment: boolean;
  note: string;
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

const STEPS = [
  {
    id: 1,
    label: "Thông tin cá nhân",
    shortLabel: "Cá nhân",
    description: "Thông tin định danh và liên hệ",
    icon: UserRound,
  },
  {
    id: 2,
    label: "Tiền sử sức khỏe",
    shortLabel: "Sức khỏe",
    description: "Chỉ số thể trạng và khảo sát y tế",
    icon: HeartPulse,
  },
  {
    id: 3,
    label: "Lịch trình & xác nhận",
    shortLabel: "Lịch trình",
    description: "Khung giờ hiến máu và cam kết",
    icon: CalendarDays,
  },
] as const;

const STEP_FIELDS: (keyof RegistrationFormValues)[][] = [
  [
    "fullName",
    "studentCode",
    "className",
    "faculty",
    "email",
    "phone",
    "cccd",
    "dateOfBirth",
    "gender",
  ],
  [
    "weightKg",
    "heightCm",
    "bloodType",
    "lastDonationDate",
    "usedAntibiotics",
    "recentTattooOrSurgery",
    "infectiousDiseaseHistory",
  ],
  ["campaignId", "preferredSlots", "commitment", "note"],
];

const GENDER_LABELS: Record<string, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
};

const BLOOD_TYPE_LABELS: Record<string, string> = {
  A: "A",
  B: "B",
  AB: "AB",
  O: "O",
};

const NOTE_SCREENING_TONE: Record<
  NoteRiskLevel,
  {
    badge: "success" | "warning" | "destructive";
    panel: string;
    icon: string;
  }
> = {
  clear: {
    badge: "success",
    panel: "border-success/30 bg-success/5",
    icon: "text-success",
  },
  caution: {
    badge: "warning",
    panel: "border-warning/40 bg-warning/10",
    icon: "text-warning",
  },
  blocked: {
    badge: "destructive",
    panel: "border-destructive/40 bg-destructive/5",
    icon: "text-destructive",
  },
};

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

function YesNoQuestion({
  name,
  label,
  hint,
  error,
  registration,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  registration: UseFormRegisterReturn;
}) {
  return (
    <fieldset className="border-border/70 bg-background/40 rounded-xl border p-4">
      <legend className="flex items-center gap-1 px-1 text-sm font-medium">
        {label}
        {hint ? <InfoTooltip label={hint} side="top" /> : null}
      </legend>
      <div className="mt-3 flex gap-2">
        {(["YES", "NO"] as const).map((value) => (
          <label
            key={value}
            className="border-input hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/10 flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <input
              type="radio"
              value={value}
              className="sr-only"
              {...registration}
            />
            {value === "YES" ? (
              <>
                <CheckCircle2 className="text-success size-4" aria-hidden />
                Có
              </>
            ) : (
              <>
                <XCircle className="text-muted-foreground size-4" aria-hidden />
                Không
              </>
            )}
          </label>
        ))}
      </div>
      <FieldError field={name} message={error} />
    </fieldset>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-right text-sm font-medium">{value || "—"}</span>
    </div>
  );
}

export default function RegistrationForm({ campaigns, defaults }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [serverState, setServerState] = useState<ServerState | null>(null);
  const [step, setStep] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [noteScreening, setNoteScreening] = useState<NoteScreening | null>(
    null,
  );
  const [noteScreeningLoading, setNoteScreeningLoading] = useState(false);
  const [noteScreeningError, setNoteScreeningError] = useState<string | null>(
    null,
  );
  const [screenedNote, setScreenedNote] = useState<string | null>(null);

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
    trigger,
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
      studentCode: defaults.studentCode,
      className: defaults.className,
      faculty: defaults.faculty,
      email: defaults.email,
      phone: defaults.phone,
      cccd: defaults.cccd ?? "",
      dateOfBirth: defaults.dateOfBirth,
      gender: (defaults.gender as GenderValue) || "",
      weightKg: "",
      heightCm: "",
      bloodType: (defaults.bloodType as BloodTypeValue) || "",
      lastDonationDate: defaults.lastDonationDate,
      usedAntibiotics: "",
      recentTattooOrSurgery: "",
      infectiousDiseaseHistory: "",
      campaignId: firstAvailableCampaign,
      preferredSlots: [],
      commitment: false,
      note: "",
    },
  });

  const values = watch();
  const dateOfBirth = values.dateOfBirth;
  const weightRaw = values.weightKg;
  const campaignId = values.campaignId;
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

  const noteValue = typeof values.note === "string" ? values.note : "";
  const noteScreeningStale =
    noteScreening !== null && screenedNote !== noteValue.trim();
  const noteBlocked =
    noteScreening?.level === "blocked" && !noteScreeningStale;
  const noteTone = noteScreening
    ? NOTE_SCREENING_TONE[noteScreening.level]
    : null;

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

  const hasHealthFlag =
    values.usedAntibiotics === "YES" ||
    values.recentTattooOrSurgery === "YES" ||
    values.infectiousDiseaseHistory === "YES";

  useEffect(() => {
    if (!redirectTo) return;

    const timer = window.setTimeout(() => {
      router.push(redirectTo);
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [redirectTo, router]);

  useEffect(() => {
    if (!celebrate) return;

    const timer = window.setTimeout(() => setCelebrate(false), 3200);
    return () => window.clearTimeout(timer);
  }, [celebrate]);

  async function reviewNote() {
    const trimmed = noteValue.trim();

    if (!trimmed) {
      toast({
        tone: "info",
        title: "Chưa có ghi chú",
        description:
          "Hãy nhập ghi chú sức khỏe trước khi nhờ AI rà soát.",
      });
      return;
    }

    setNoteScreeningLoading(true);
    setNoteScreeningError(null);

    try {
      const result = await screenNoteForStudent(trimmed);

      if (result.success && result.data) {
        setNoteScreening(result.data);
        setScreenedNote(trimmed);
      } else {
        setNoteScreeningError(result.message);
      }
    } catch {
      setNoteScreeningError(
        "Không thể kết nối dịch vụ rà soát. Vui lòng kiểm tra mạng và thử lại.",
      );
    } finally {
      setNoteScreeningLoading(false);
    }
  }

  async function goNext() {
    const valid = await trigger(STEP_FIELDS[step], { shouldFocus: true });

    if (!valid) {
      toast({
        tone: "destructive",
        title: "Thiếu hoặc sai thông tin",
        description: "Vui lòng kiểm tra các trường được đánh dấu đỏ.",
      });
      return;
    }

    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  }

  function goBack() {
    setStep((current) => Math.max(0, current - 1));
  }

  function onInvalid(formErrors: FieldErrors<RegistrationFormValues>) {
    const firstField = Object.keys(formErrors)[0] as
      | keyof RegistrationFormValues
      | undefined;

    if (firstField) {
      const targetStep = STEP_FIELDS.findIndex((fields) =>
        fields.includes(firstField),
      );

      if (targetStep >= 0) setStep(targetStep);
    }

    toast({
      tone: "destructive",
      title: "Thiếu hoặc sai thông tin",
      description: "Vui lòng kiểm tra các trường được đánh dấu đỏ.",
    });
  }

  const onSubmit = handleSubmit(async (formValues) => {
    if (submitting) return;

    setSubmitting(true);
    setServerState(null);

    try {
      const result = await validateProfile(formValues);

      if (result.success && result.data) {
        const trackingUrl = `/student/tracking?registrationId=${encodeURIComponent(
          result.data.registrationId,
        )}`;

        toast({
          tone: "success",
          title: "Đăng ký thành công",
          description: result.data.assignedSlot
            ? `Bạn được xếp vào khung ${result.data.assignedSlot}. Đang chuyển tới trang theo dõi...`
            : "Hồ sơ đã được ghi nhận. Đang chuyển tới trang theo dõi tiến độ...",
        });
        setCelebrate(true);
        setRedirectTo(trackingUrl);
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
        toast({
          tone: "warning",
          title: "Hồ sơ chưa đủ điều kiện",
          description: result.message,
        });
      } else if (result.code === "ALREADY_REGISTERED") {
        setServerState({
          tone: "info",
          title: "Bạn đã có hồ sơ cho chiến dịch này",
          message: result.message,
          trackingId: result.data?.registrationId,
        });
        toast({
          tone: "info",
          title: "Đã có hồ sơ cho chiến dịch này",
          description: result.message,
        });
      } else {
        const title =
          result.code === "CAMPAIGN_FULL"
            ? "Chiến dịch đã đủ chỉ tiêu"
            : result.code === "STUDENT_CODE_IN_USE"
              ? "MSSV đã được sử dụng"
              : "Không thể gửi hồ sơ";

        setServerState({
          tone: "destructive",
          title,
          message: result.message,
        });
        toast({
          tone: "destructive",
          title,
          description: result.message,
        });
      }
    } catch {
      setServerState({
        tone: "destructive",
        title: "Mất kết nối máy chủ",
        message:
          "Không thể gửi hồ sơ lúc này. Vui lòng kiểm tra kết nối mạng và thử lại.",
      });
      toast({
        tone: "destructive",
        title: "Mất kết nối máy chủ",
        description: "Vui lòng kiểm tra kết nối mạng và thử lại.",
      });
    } finally {
      setSubmitting(false);
    }
  }, onInvalid);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden py-0">
          <CardHeader className="border-border/70 bg-muted/20 border-b py-5">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserRound className="text-primary size-5" aria-hidden />
              Hồ sơ đăng ký hiến máu
            </CardTitle>
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

            {/* --- Step indicator --------------------------------------- */}
            <ol
              className="mb-7 flex items-start gap-2"
              aria-label="Các bước đăng ký"
            >
              {STEPS.map((item, index) => {
                const Icon = item.icon;
                const done = index < step;
                const current = index === step;

                return (
                  <li
                    key={item.id}
                    className="flex flex-1 items-start gap-2"
                    aria-current={current ? "step" : undefined}
                  >
                    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full border text-sm font-semibold transition-colors",
                          done &&
                            "border-primary bg-primary text-primary-foreground",
                          current &&
                            "border-primary bg-primary/10 text-primary",
                          !done &&
                            !current &&
                            "border-border text-muted-foreground",
                        )}
                      >
                        {done ? (
                          <CheckCircle2 className="size-4" aria-hidden />
                        ) : (
                          <Icon className="size-4" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block text-xs font-medium sm:text-sm",
                            current ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          <span className="sm:hidden">
                            {item.shortLabel}
                          </span>
                          <span className="hidden sm:inline">{item.label}</span>
                        </span>
                        <span className="text-muted-foreground hidden text-xs lg:block">
                          {item.description}
                        </span>
                      </span>
                    </div>
                    {index < STEPS.length - 1 ? (
                      <span
                        className={cn(
                          "mt-4 hidden h-px w-4 shrink-0 sm:block",
                          done ? "bg-primary" : "bg-border",
                        )}
                        aria-hidden
                      />
                    ) : null}
                  </li>
                );
              })}
            </ol>

            <form onSubmit={onSubmit} noValidate className="space-y-6">
              {/* --- Step 1: Thông tin cá nhân ------------------------- */}
              {step === 0 ? (
                <section className="space-y-5">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold">
                      <UserRound className="text-primary size-4" aria-hidden />
                      Thông tin sinh viên
                    </h2>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="fullName">
                        Họ và tên{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="fullName"
                        autoComplete="name"
                        placeholder="Nguyễn Văn A"
                        aria-invalid={Boolean(errors.fullName)}
                        aria-describedby={
                          errors.fullName
                            ? FIELD_ERROR_ID("fullName")
                            : undefined
                        }
                        {...register("fullName")}
                      />
                      <FieldError
                        field="fullName"
                        message={errors.fullName?.message}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="studentCode">
                        MSSV <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="studentCode"
                        autoComplete="off"
                        placeholder="2212345678"
                        aria-invalid={Boolean(errors.studentCode)}
                        aria-describedby={
                          errors.studentCode
                            ? FIELD_ERROR_ID("studentCode")
                            : undefined
                        }
                        {...register("studentCode")}
                      />
                      <FieldError
                        field="studentCode"
                        message={errors.studentCode?.message}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="className">
                        Lớp <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="className"
                        autoComplete="off"
                        placeholder="46K21.1"
                        aria-invalid={Boolean(errors.className)}
                        aria-describedby={
                          errors.className
                            ? FIELD_ERROR_ID("className")
                            : undefined
                        }
                        {...register("className")}
                      />
                      <FieldError
                        field="className"
                        message={errors.className?.message}
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="faculty">
                        Khoa <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="faculty"
                        autoComplete="organization"
                        placeholder="Khoa Kinh tế"
                        aria-invalid={Boolean(errors.faculty)}
                        aria-describedby={
                          errors.faculty
                            ? FIELD_ERROR_ID("faculty")
                            : undefined
                        }
                        {...register("faculty")}
                      />
                      <FieldError
                        field="faculty"
                        message={errors.faculty?.message}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth">
                        Ngày sinh{" "}
                        <span className="text-destructive">*</span>
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
                      <Label htmlFor="gender">
                        Giới tính{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        id="gender"
                        aria-invalid={Boolean(errors.gender)}
                        aria-describedby={
                          errors.gender
                            ? FIELD_ERROR_ID("gender")
                            : undefined
                        }
                        {...register("gender")}
                      >
                        <option value="">Chọn giới tính</option>
                        <option value="MALE">Nam</option>
                        <option value="FEMALE">Nữ</option>
                        <option value="OTHER">Khác</option>
                      </Select>
                      <FieldError
                        field="gender"
                        message={errors.gender?.message}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        Số điện thoại{" "}
                        <span className="text-destructive">*</span>
                      </Label>
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
                        {...register("phone")}
                      />
                      <FieldError
                        field="phone"
                        message={errors.phone?.message}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-1">
                        Email sinh viên{" "}
                        <span className="text-destructive">*</span>
                        <InfoTooltip
                          label="Email gắn với tài khoản và bắt buộc có đuôi @due.edu.vn."
                          side="top"
                        />
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
                      <FieldError
                        field="email"
                        message={errors.email?.message}
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="cccd" className="flex items-center gap-1">
                        Số CCCD/CMND{" "}
                        <span className="text-destructive">*</span>
                        <InfoTooltip
                          label={
                            defaults.cccd
                              ? "CCCD đã gắn với tài khoản. Liên hệ ban tổ chức nếu cần thay đổi."
                              : "Nhập đúng 12 chữ số. CCCD được mã hóa AES-256-GCM trước khi lưu."
                          }
                          side="top"
                        />
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
                      <FieldError
                        field="cccd"
                        message={errors.cccd?.message}
                      />
                    </div>
                  </div>
                </section>
              ) : null}

              {/* --- Step 2: Tiền sử sức khỏe ------------------------- */}
              {step === 1 ? (
                <section className="space-y-5">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold">
                      <HeartPulse
                        className="text-primary size-4"
                        aria-hidden
                      />
                      Chỉ số thể trạng & tiền sử sức khỏe
                    </h2>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="weightKg">
                        Cân nặng (kg){" "}
                        <span className="text-destructive">*</span>
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
                          errors.weightKg
                            ? FIELD_ERROR_ID("weightKg")
                            : undefined
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
                      <Label htmlFor="heightCm">
                        Chiều cao (cm){" "}
                        <span className="text-destructive">*</span>
                      </Label>
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
                          errors.heightCm
                            ? FIELD_ERROR_ID("heightCm")
                            : undefined
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

                    <div className="space-y-2">
                      <Label htmlFor="bloodType">Nhóm máu (nếu biết)</Label>
                      <Select
                        id="bloodType"
                        aria-invalid={Boolean(errors.bloodType)}
                        aria-describedby={
                          errors.bloodType
                            ? FIELD_ERROR_ID("bloodType")
                            : undefined
                        }
                        {...register("bloodType", {
                          setValueAs: (value: string) =>
                            value === "" ? undefined : value,
                        })}
                      >
                        <option value="">Chưa biết / không rõ</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="AB">AB</option>
                        <option value="O">O</option>
                      </Select>
                      <FieldError
                        field="bloodType"
                        message={errors.bloodType?.message}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lastDonationDate">
                        Ngày hiến máu gần nhất (nếu có)
                      </Label>
                      <Input
                        id="lastDonationDate"
                        type="date"
                        max={new Date().toISOString().slice(0, 10)}
                        aria-invalid={Boolean(errors.lastDonationDate)}
                        aria-describedby={
                          errors.lastDonationDate
                            ? FIELD_ERROR_ID("lastDonationDate")
                            : undefined
                        }
                        {...register("lastDonationDate", {
                          setValueAs: (value: string) =>
                            value.trim() === "" ? undefined : value,
                        })}
                      />
                      <FieldError
                        field="lastDonationDate"
                        message={errors.lastDonationDate?.message}
                      />
                    </div>
                  </div>

                  {hasWeight && weightValue < MIN_WEIGHT_KG ? (
                    <Alert variant="warning">
                      <AlertTriangle />
                      <AlertTitle>
                        Cân nặng dưới {MIN_WEIGHT_KG}kg
                      </AlertTitle>
                      <AlertDescription>
                        Theo quy định hiến máu, hồ sơ có thể bị từ chối nếu cân
                        nặng dưới {MIN_WEIGHT_KG}kg. Bạn vẫn có thể gửi hồ sơ để
                        ban tổ chức ghi nhận.
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ClipboardList
                        className="text-primary size-4"
                        aria-hidden
                      />
                      <h3 className="text-sm font-semibold">
                        Khảo sát tiền sử sức khỏe
                      </h3>
                    </div>

                    <YesNoQuestion
                      name="usedAntibiotics"
                      label="Trong 7 ngày qua, bạn có đang dùng thuốc kháng sinh hoặc điều trị bệnh không?"
                      hint="Bao gồm thuốc kháng sinh, thuốc điều trị bệnh hoặc tiêm phòng trong vòng 7 ngày."
                      error={errors.usedAntibiotics?.message}
                      registration={register("usedAntibiotics")}
                    />

                    <YesNoQuestion
                      name="recentTattooOrSurgery"
                      label="Trong 6 tháng gần đây, bạn có xăm hình, xỏ khuyên hoặc phẫu thuật không?"
                      hint="Các thủ thuật xâm lấn có thể ảnh hưởng đến thời gian chờ hiến máu."
                      error={errors.recentTattooOrSurgery?.message}
                      registration={register("recentTattooOrSurgery")}
                    />

                    <YesNoQuestion
                      name="infectiousDiseaseHistory"
                      label="Bạn có tiền sử mắc bệnh truyền nhiễm, dị ứng nặng hoặc ngất khi lấy máu không?"
                      hint="Ví dụ: viêm gan B/C, HIV, dị ứng phản vệ, từng ngất khi lấy máu."
                      error={errors.infectiousDiseaseHistory?.message}
                      registration={register("infectiousDiseaseHistory")}
                    />
                  </div>

                  {/* --- Kiểm tra sơ bộ realtime ----------------------- */}
                  <div className="bg-muted/30 border-border/70 rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <ShieldCheck
                          className="text-primary size-4"
                          aria-hidden
                        />
                        Kiểm tra điều kiện sơ bộ
                      </p>
                      {preview ? (
                        <Badge
                          variant={preview.eligible ? "success" : "warning"}
                        >
                          {preview.eligible
                            ? "Đủ điều kiện"
                            : "Chưa đủ điều kiện"}
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
                        ok={
                          hasWeight ? weightValue >= MIN_WEIGHT_KG : null
                        }
                        label={
                          hasWeight
                            ? `Cân nặng ${weightValue}kg (yêu cầu ≥ ${MIN_WEIGHT_KG}kg)`
                            : `Cân nặng từ ${MIN_WEIGHT_KG}kg`
                        }
                      />
                    </ul>

                    {preview && !preview.eligible ? (
                      <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                        {`Lưu ý: ${preview.reasons.join("; ")}. Hồ sơ vẫn có thể gửi nhưng sẽ được ghi nhận là bị từ chối.`}
                      </p>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {/* --- Step 3: Lịch trình & xác nhận --------------------- */}
              {step === 2 ? (
                <section className="space-y-5">
                  <div>
                    <h2 className="flex items-center gap-2 text-base font-semibold">
                      <CalendarDays
                        className="text-primary size-4"
                        aria-hidden
                      />
                      Lịch trình hiến máu
                    </h2>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="campaignId">
                      Chiến dịch hiến máu{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      id="campaignId"
                      aria-invalid={Boolean(errors.campaignId)}
                      aria-describedby={
                        errors.campaignId
                          ? FIELD_ERROR_ID("campaignId")
                          : undefined
                      }
                      disabled={campaigns.length === 0}
                      {...register("campaignId")}
                    >
                      {campaigns.length === 0 ? (
                        <option value="">Chưa có chiến dịch đang mở</option>
                      ) : null}
                      {campaigns.map((campaign) => {
                        const unavailable =
                          campaign.remainingSlots <= 0 ||
                          campaign.alreadyRegistered;

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

                  <fieldset className="space-y-3">
                    <legend className="text-sm font-medium">
                      Khung giờ có thể tham gia{" "}
                      <span className="text-destructive">*</span>
                    </legend>
                    <p
                      id="preferredSlots-help"
                      className="text-muted-foreground text-xs"
                    >
                      Chọn một hoặc nhiều khung giờ.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {DONATION_SLOTS.map((slot) => (
                        <label
                          key={slot}
                          className="border-input hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/10 flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors"
                        >
                          <input
                            type="checkbox"
                            value={slot}
                            className="accent-primary size-4"
                            aria-describedby="preferredSlots-help"
                            {...register("preferredSlots")}
                          />
                          <Clock3
                            className="text-muted-foreground size-4"
                            aria-hidden
                          />
                          <span className="font-medium">{slot}</span>
                        </label>
                      ))}
                    </div>
                    <FieldError
                      field="preferredSlots"
                      message={errors.preferredSlots?.message}
                    />
                  </fieldset>

                  <div className="space-y-2">
                    <Label htmlFor="note">Ghi chú thêm</Label>
                    <Textarea
                      id="note"
                      rows={3}
                      placeholder="Ví dụ: mong muốn hiến vào buổi sáng, có tiền sử bệnh lý cần lưu ý..."
                      aria-invalid={Boolean(errors.note)}
                      aria-describedby={
                        errors.note ? FIELD_ERROR_ID("note") : undefined
                      }
                      {...register("note")}
                    />
                    <FieldError field="note" message={errors.note?.message} />
                  </div>

                  {/* --- AI rà soát ghi chú sức khỏe ----------------- */}
                  <div
                    className={cn(
                      "rounded-xl border p-4 transition-colors",
                      noteTone
                        ? noteTone.panel
                        : "border-primary/25 bg-primary/5",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-full",
                            noteTone
                              ? "bg-background/70 " + noteTone.icon
                              : "bg-primary/10 text-primary",
                          )}
                        >
                          {noteScreening?.level === "blocked" ? (
                            <ShieldAlert className="size-4" aria-hidden />
                          ) : (
                            <Sparkles className="size-4" aria-hidden />
                          )}
                        </span>
                        <div>
                          <p className="text-sm font-semibold">
                            AI rà soát ghi chú sức khỏe
                          </p>
                          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                            Kiểm tra tiền sử bệnh lý, thuốc đang dùng hoặc sự
                            cố sức khỏe có thể khiến bạn chưa nên hiến máu hôm
                            nay.
                          </p>
                        </div>
                      </div>

                      {noteScreening ? (
                        <Badge variant={noteTone?.badge ?? "neutral"}>
                          {noteScreening.label}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={reviewNote}
                        disabled={noteScreeningLoading || submitting}
                      >
                        {noteScreeningLoading ? (
                          <LoaderCircle className="animate-spin" aria-hidden />
                        ) : (
                          <Sparkles aria-hidden />
                        )}
                        {noteScreeningLoading
                          ? "Đang rà soát..."
                          : "Nhờ AI rà soát"}
                      </Button>
                      <span className="text-muted-foreground text-xs">
                        Không thay thế kết luận của nhân viên y tế.
                      </span>
                    </div>

                    {noteScreeningError ? (
                      <p role="alert" className="text-destructive mt-3 text-xs">
                        {noteScreeningError}
                      </p>
                    ) : null}

                    {noteScreening ? (
                      <div className="mt-3 space-y-2">
                        {noteScreeningStale ? (
                          <p className="text-warning text-xs font-medium">
                            Ghi chú đã thay đổi sau lần rà soát trước. Hãy nhờ
                            AI rà soát lại.
                          </p>
                        ) : null}

                        <p className="text-sm">{noteScreening.summary}</p>

                        {noteScreening.reasons.length > 0 ? (
                          <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed">
                            {noteScreening.reasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        ) : null}

                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {noteScreening.advice}
                        </p>

                        <p className="text-muted-foreground text-[11px]">
                          Nguồn:{" "}
                          {noteScreening.provider === "hybrid"
                            ? "AI + quy tắc y tế nội bộ"
                            : "Quy tắc y tế nội bộ"}{" "}
                          · Độ tin cậy{" "}
                          {Math.round(noteScreening.confidence * 100)}%
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {noteBlocked ? (
                    <Alert variant="destructive">
                      <ShieldAlert />
                      <AlertTitle>Ghi chú cần được tư vấn y tế</AlertTitle>
                      <AlertDescription>
                        AI phát hiện thông tin có thể khiến bạn chưa đủ điều
                        kiện hiến máu. Hãy chỉnh sửa ghi chú nếu thông tin chưa
                        chính xác, hoặc liên hệ ban tổ chức / nhân viên y tế để
                        được tư vấn trước khi gửi hồ sơ.
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {/* --- Tóm tắt hồ sơ ------------------------------- */}
                  <div className="bg-muted/30 border-border/70 rounded-xl border p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <ClipboardList
                        className="text-primary size-4"
                        aria-hidden
                      />
                      Tóm tắt hồ sơ
                    </p>
                    <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                      <SummaryRow label="Họ tên" value={values.fullName} />
                      <SummaryRow label="MSSV" value={values.studentCode} />
                      <SummaryRow label="Lớp" value={values.className} />
                      <SummaryRow label="Khoa" value={values.faculty} />
                      <SummaryRow
                        label="Ngày sinh"
                        value={values.dateOfBirth}
                      />
                      <SummaryRow
                        label="Giới tính"
                        value={GENDER_LABELS[values.gender] ?? ""}
                      />
                      <SummaryRow label="Điện thoại" value={values.phone} />
                      <SummaryRow
                        label="Cân nặng"
                        value={
                          values.weightKg ? `${values.weightKg} kg` : ""
                        }
                      />
                      <SummaryRow
                        label="Chiều cao"
                        value={
                          values.heightCm ? `${values.heightCm} cm` : ""
                        }
                      />
                      <SummaryRow
                        label="Nhóm máu"
                        value={BLOOD_TYPE_LABELS[values.bloodType] ?? ""}
                      />
                      <SummaryRow
                        label="Khung giờ mong muốn"
                        value={values.preferredSlots.join(", ")}
                      />
                      <SummaryRow
                        label="Chiến dịch"
                        value={selectedCampaign?.name ?? ""}
                      />
                    </div>

                    {hasHealthFlag ? (
                      <Alert variant="warning" className="mt-4">
                        <AlertTriangle />
                        <AlertTitle>
                          Có thông tin sức khỏe cần lưu ý
                        </AlertTitle>
                        <AlertDescription>
                          Bạn đã khai báo có tiền sử cần theo dõi. Nhân viên y
                          tế sẽ kiểm tra thêm trước khi hiến máu.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </div>

                  <div className="border-border/70 bg-background/40 rounded-xl border p-4">
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="accent-primary mt-0.5 size-4 shrink-0"
                        aria-invalid={Boolean(errors.commitment)}
                        aria-describedby={
                          errors.commitment
                            ? FIELD_ERROR_ID("commitment")
                            : undefined
                        }
                        {...register("commitment")}
                      />
                      <span className="leading-relaxed">
                        Tôi cam kết khai báo thông tin cá nhân và tiền sử sức
                        khỏe trung thực, chịu trách nhiệm về tính chính xác của
                        thông tin đã cung cấp.
                      </span>
                    </label>
                    <FieldError
                      field="commitment"
                      message={errors.commitment?.message}
                    />
                  </div>
                </section>
              ) : null}

              {/* --- Navigation --------------------------------------- */}
              <div className="border-border/70 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-end">
                <div className="flex items-center gap-2">
                  {step > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={goBack}
                      disabled={submitting}
                    >
                      <ChevronLeft aria-hidden />
                      Quay lại
                    </Button>
                  ) : null}

                  {step < STEPS.length - 1 ? (
                    <Button
                      type="button"
                      size="lg"
                      onClick={goNext}
                      className="sm:min-w-36"
                    >
                      Tiếp tục
                      <ChevronRight aria-hidden />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="lg"
                      disabled={
                        submitting || !hasAvailableCampaign || noteBlocked
                      }
                      className="sm:min-w-44"
                    >
                      {submitting ? (
                        <>
                          <HeartPulse className="animate-pulse" aria-hidden />
                          Đang gửi hồ sơ...
                        </>
                      ) : (
                        "Gửi hồ sơ đăng ký"
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {!hasAvailableCampaign ? (
                <p className="text-warning text-sm">
                  Hiện không còn chiến dịch nào nhận đăng ký mới. Vui lòng quay
                  lại sau.
                </p>
              ) : null}

              {noteBlocked ? (
                <p className="text-destructive text-sm">
                  Hồ sơ chưa thể gửi vì ghi chú sức khỏe có dấu hiệu chưa đủ
                  điều kiện hiến máu. Hãy chỉnh sửa ghi chú hoặc liên hệ ban tổ
                  chức để được tư vấn.
                </p>
              ) : null}
            </form>
          </CardContent>
        </Card>

        {/* --- Cột thông tin chiến dịch ------------------------------ */}
        <aside className="space-y-4">
          <Card className="from-primary/10 to-card bg-gradient-to-b">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Ticket className="text-primary size-4" aria-hidden />
                {selectedCampaign ? selectedCampaign.name : "Chiến dịch"}
              </CardTitle>
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
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${usedPercent}%` }}
                  />
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

      <Confetti show={celebrate} />
    </>
  );
}
