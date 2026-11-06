import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { defaultAfterLogin } from "@/lib/rbac";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Đăng nhập",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; registered?: string | string[] }>;
}) {
  const session = await getSession();

  if (session) {
    redirect(defaultAfterLogin(session.role));
  }

  const params = await searchParams;
  const registered = params.registered === "1";
  const rawNext = params.next;
  const nextPath =
    typeof rawNext === "string" &&
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//")
      ? rawNext
      : undefined;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="bg-primary/15 pointer-events-none absolute -top-40 -left-32 size-[520px] rounded-full blur-[120px]"
      />
      <div
        aria-hidden
        className="bg-primary/10 pointer-events-none absolute -right-32 -bottom-40 size-[480px] rounded-full blur-[120px]"
      />

      <ThemeToggle className="absolute top-4 right-4 z-10" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <div
            aria-hidden
            className="from-primary to-primary/70 mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-gradient-to-br text-2xl shadow-lg shadow-primary/25"
          >
            🩸
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Hiến máu DUE</h1>
        </div>

        {registered ? (
          <div
            role="status"
            className="border-success/40 bg-success/10 text-success mb-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>Đăng ký thành công. Đăng nhập bằng tài khoản vừa tạo nhé!</span>
          </div>
        ) : null}

        <Card className="shadow-soft backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">Chào mừng trở lại</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginForm nextPath={nextPath} />
          </CardContent>
        </Card>

        <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
