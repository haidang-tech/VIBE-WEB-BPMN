"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";

type LoginResult = {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
  redirectTo?: string;
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #334155",
  backgroundColor: "#0b1220",
  color: "#e2e8f0",
  fontSize: 15,
  outline: "none",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 13,
  fontWeight: 600,
  color: "#cbd5e1",
};

export default function LoginForm({ nextPath }: { nextPath?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json().catch(() => ({
        success: false,
      }))) as LoginResult;

      if (!response.ok || !data.success) {
        setError(data.message ?? "Đăng nhập thất bại");
        setFieldErrors(data.errors ?? {});
        return;
      }

      window.location.assign(nextPath ?? data.redirectTo ?? "/");
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error ? (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #7f1d1d",
            backgroundColor: "#450a0a",
            color: "#fecaca",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      ) : null}

      <label htmlFor="email" style={labelStyle}>
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="ten.sv@due.edu.vn"
        style={inputStyle}
        aria-invalid={Boolean(fieldErrors.email)}
      />
      {fieldErrors.email ? (
        <p style={{ margin: "6px 0 0", color: "#fca5a5", fontSize: 13 }}>
          {fieldErrors.email}
        </p>
      ) : null}

      <div style={{ height: 16 }} />

      <label htmlFor="password" style={labelStyle}>
        Mật khẩu
      </label>
      <div style={{ position: "relative" }}>
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          style={{ ...inputStyle, paddingRight: 84 }}
          aria-invalid={Boolean(fieldErrors.password)}
        />
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          style={{
            position: "absolute",
            top: "50%",
            right: 8,
            transform: "translateY(-50%)",
            border: "none",
            background: "transparent",
            color: "#94a3b8",
            fontSize: 13,
            cursor: "pointer",
            padding: "6px 8px",
          }}
        >
          {showPassword ? "Ẩn" : "Hiện"}
        </button>
      </div>
      {fieldErrors.password ? (
        <p style={{ margin: "6px 0 0", color: "#fca5a5", fontSize: 13 }}>
          {fieldErrors.password}
        </p>
      ) : null}

      <div style={{ height: 22 }} />

      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: 10,
          border: "none",
          background: loading
            ? "#7f1d1d"
            : "linear-gradient(135deg, #dc2626, #b91c1c)",
          color: "#fff",
          fontSize: 15,
          fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer",
          boxShadow: "0 10px 25px rgba(220, 38, 38, 0.25)",
        }}
      >
        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>

      <p style={{ margin: "14px 0 0", color: "#64748b", fontSize: 12, textAlign: "center" }}>
        Tài khoản demo được tạo bởi <code>prisma/seed.ts</code>.
      </p>

      <p style={{ margin: "10px 0 0", color: "#94a3b8", fontSize: 14, textAlign: "center" }}>
        Chưa có tài khoản?{" "}
        <Link
          href="/register"
          style={{ color: "#f87171", fontWeight: 600, textDecoration: "none" }}
        >
          Đăng ký ngay
        </Link>
      </p>
    </form>
  );
}
