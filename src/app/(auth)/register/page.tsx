import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      {/* Hiệu ứng nền */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 size-[520px] rounded-full bg-red-900/25 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -bottom-40 size-[480px] rounded-full bg-indigo-900/25 blur-[120px]"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <div
            aria-hidden
            className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-red-500 to-red-900 text-2xl shadow-lg shadow-red-900/30"
          >
            🩸
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            Tạo tài khoản sinh viên
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Đăng ký để tham gia các chiến dịch hiến máu của DUE
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base text-slate-100">
              Thông tin đăng ký
            </CardTitle>
            <CardDescription>
              Chỉ mất chưa đến 1 phút. Email sẽ dùng để đăng nhập.
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
