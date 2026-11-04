import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/rbac";
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
    redirect(ROLE_HOME[session.role]);
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
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(1200px 600px at 20% -10%, #3f1d1d 0%, transparent 60%), radial-gradient(900px 500px at 110% 110%, #1e1b4b 0%, transparent 55%), #0f172a",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 32,
          borderRadius: 20,
          border: "1px solid #1e293b",
          backgroundColor: "rgba(15, 23, 42, 0.86)",
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.45)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            aria-hidden
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 12px",
              borderRadius: 16,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, #ef4444, #991b1b)",
              fontSize: 26,
            }}
          >
            🩸
          </div>
          <h1 style={{ margin: 0, fontSize: 24, letterSpacing: -0.3 }}>
            Hiến máu DUE
          </h1>
          <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 14 }}>
            Đăng nhập để tiếp tục
          </p>
        </div>

        {registered ? (
          <div
            role="status"
            style={{
              marginBottom: 16,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #166534",
              backgroundColor: "#052e16",
              color: "#bbf7d0",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            Đăng ký thành công. Vui lòng đăng nhập bằng tài khoản vừa tạo.
          </div>
        ) : null}

        <LoginForm nextPath={nextPath} />
      </div>
    </main>
  );
}
