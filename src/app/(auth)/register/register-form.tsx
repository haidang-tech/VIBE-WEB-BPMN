"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Lock,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  registerSchema,
  type RegisterInput,
} from "@/lib/validations";

type RegisterResponse = {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
};

const FIELD_ERROR_ID = (field: string) => `${field}-error`;

const PASSWORD_RULES = [
  { key: "length", label: "Tối thiểu 8 ký tự" },
  { key: "upper", label: "Có chữ hoa" },
  { key: "lower", label: "Có chữ thường" },
  { key: "digit", label: "Có chữ số" },
  { key: "special", label: "Có ký tự đặc biệt" },
] as const;

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

function PasswordRule({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-1.5 text-xs transition-colors",
        ok ? "text-success" : "text-muted-foreground",
      )}
    >
      {ok ? (
        <CheckCircle2 className="size-3.5" aria-hidden />
      ) : (
        <XCircle className="size-3.5 opacity-60" aria-hidden />
      )}
      {label}
    </li>
  );
}

export default function RegisterForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [registered, setRegistered] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema) as unknown as Resolver<RegisterInput>,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const password = watch("password") ?? "";

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      digit: /\d/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    }),
    [password],
  );

  // Toast thành công hiển thị ~1.6s rồi tự chuyển về /login.
  useEffect(() => {
    if (!registered) return;

    const timer = window.setTimeout(() => {
      router.push("/login?registered=1");
    }, 1600);

    return () => window.clearTimeout(timer);
  }, [registered, router]);

  const onSubmit = handleSubmit(async (values) => {
    if (submitting || registered) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(values),
      });

      const data = (await response.json().catch(() => ({
        success: false,
        message: "Không đọc được phản hồi từ máy chủ.",
      }))) as RegisterResponse;

      if (!response.ok || !data.success) {
        if (data.errors) {
          for (const [field, message] of Object.entries(data.errors)) {
            if (field === "_form") continue;
            setError(field as keyof RegisterInput, {
              type: "server",
              message,
            });
          }
        }

        const message =
          data.message ??
          "Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.";

        setFormError(message);
        toast({
          tone: "destructive",
          title: "Không thể đăng ký",
          description: message,
        });
        return;
      }

      toast({
        tone: "success",
        title: "Đăng ký thành công",
        description:
          data.message ?? "Tài khoản của bạn đã được tạo. Vui lòng đăng nhập.",
      });
      setRegistered(true);
    } catch {
      const message =
        "Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.";

      setFormError(message);
      toast({
        tone: "destructive",
        title: "Mất kết nối máy chủ",
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {formError ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Không thể đăng ký</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="name">
            Họ và tên <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <UserRound
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="name"
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              className="pl-9"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? FIELD_ERROR_ID("name") : undefined}
              {...register("name")}
            />
          </div>
          <FieldError field="name" message={errors.name?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <span
              aria-hidden
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
            >
              @
            </span>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="ten.sv@due.edu.vn"
              className="pl-9"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={
                errors.email ? FIELD_ERROR_ID("email") : undefined
              }
              {...register("email")}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Chỉ chấp nhận email sinh viên có đuôi @due.edu.vn.
          </p>
          <FieldError field="email" message={errors.email?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            Mật khẩu <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Lock
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              className="pr-16 pl-9"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? FIELD_ERROR_ID("password") : undefined
              }
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-1 text-xs transition-colors"
            >
              {showPassword ? "Ẩn" : "Hiện"}
            </button>
          </div>
          <FieldError field="password" message={errors.password?.message} />

          <div className="bg-muted/30 border-border/60 rounded-lg border p-3">
            <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium">
              <ShieldCheck className="text-primary size-3.5" aria-hidden />
              Mật khẩu cần đáp ứng
            </p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {PASSWORD_RULES.map((rule) => (
                <PasswordRule
                  key={rule.key}
                  ok={passwordChecks[rule.key]}
                  label={rule.label}
                />
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">
            Xác nhận mật khẩu <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Lock
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
              className="pl-9"
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={
                errors.confirmPassword
                  ? FIELD_ERROR_ID("confirmPassword")
                  : undefined
              }
              {...register("confirmPassword")}
            />
          </div>
          <FieldError
            field="confirmPassword"
            message={errors.confirmPassword?.message}
          />
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={submitting || registered}
          className="w-full"
        >
          {registered ? (
            <>
              <CheckCircle2 aria-hidden />
              Đăng ký thành công
            </>
          ) : submitting ? (
            <>
              <ShieldCheck className="animate-pulse" aria-hidden />
              Đang tạo tài khoản...
            </>
          ) : (
            <>
              Tạo tài khoản
              <ArrowRight aria-hidden />
            </>
          )}
        </Button>

        <p className="text-muted-foreground text-center text-xs leading-relaxed">
          Dữ liệu cá nhân được mã hóa AES-256-GCM.
        </p>

        <p className="text-muted-foreground border-border/60 border-t pt-4 text-center text-sm">
          Đã có tài khoản?{" "}
          <Link
            href="/login"
            className="text-primary font-semibold underline-offset-4 hover:underline"
          >
            Đăng nhập ngay
          </Link>
        </p>
      </form>
    </>
  );
}
