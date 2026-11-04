"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Toggle Dark/Light mode.
 * - Trạng thái được lưu ở localStorage (`due-theme`) và áp class `dark` lên <html>.
 * - Icon đổi bằng CSS (dark:hidden / hidden dark:block) nên không lệch hydration.
 */
export default function ThemeToggle({ className }: { className?: string }) {
  function toggleTheme() {
    const root = document.documentElement;
    const nextDark = !root.classList.contains("dark");

    root.classList.toggle("dark", nextDark);

    try {
      localStorage.setItem("due-theme", nextDark ? "dark" : "light");
    } catch {
      // Trình duyệt chặn storage: vẫn đổi được trong phiên hiện tại.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={cn("rounded-full", className)}
      aria-label="Chuyển giao diện sáng/tối"
      title="Chuyển giao diện sáng/tối"
    >
      <Sun className="size-4 dark:hidden" aria-hidden />
      <Moon className="hidden size-4 dark:block" aria-hidden />
    </Button>
  );
}
