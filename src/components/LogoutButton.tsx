"use client";

import { useState, type ComponentProps } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type LogoutButtonProps = {
  /** Trang quay lại sau khi đăng xuất. Mặc định là trang đăng nhập. */
  redirectTo?: string;
  className?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
};

export default function LogoutButton({
  redirectTo = "/login",
  className,
  variant = "outline",
  size = "sm",
}: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      window.location.assign(redirectTo);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? (
        <LogOut className="animate-pulse" aria-hidden />
      ) : (
        <LogOut aria-hidden />
      )}
      <span className="hidden sm:inline">Đăng xuất</span>
    </Button>
  );
}
