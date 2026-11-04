import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { getSession } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/rbac";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import RegisterForm from "./register-form";

export const metadata: Metadata = {
  title: "Đăng ký tài khoản",
  description: "Tạo tài khoản sinh viên để đăng ký hiến máu tại DUE.",
};

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const session = await getSession();

  // Đã đăng nhập thì không cần đăng ký nữa.
  if (session) {
    redirect(ROLE_HOME[session.role]);
  }

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
          <h1 className="text-2xl font-semibold tracking-tight">
            Tạo tài khoản sinh viên
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Tham gia các chiến dịch hiến máu của DUE
          </p>
        </div>

        <Card className="shadow-soft backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base">Thông tin đăng ký</CardTitle>
            <CardDescription>
              Chưa đến 1 phút. Email dùng để đăng nhập.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
