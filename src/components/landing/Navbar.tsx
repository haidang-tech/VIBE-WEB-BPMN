"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Droplet, Menu, X } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BOOKING_HREF } from "./constants";

type NavbarProps = {
  /** Đích quay lại bảng điều khiển khi người dùng đã đăng nhập. */
  portalHref?: string | null;
  portalLabel?: string;
};

const NAV_LINKS = [
  { href: "/", label: "Trang chủ" },
  { href: "#lich-hien-mau", label: "Lịch hiến máu" },
  { href: "#dieu-kien", label: "Điều kiện tham gia" },
  { href: "#ve-chung-toi", label: "Về chúng tôi" },
] as const;

export default function Navbar({
  portalHref = null,
  portalLabel = "Vào trang của tôi",
}: NavbarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300",
        scrolled
          ? "border-slate-200/80 bg-white/90 shadow-sm dark:border-white/10 dark:bg-slate-950/85"
          : "border-transparent bg-white/70 dark:bg-slate-950/55",
      )}
    >
      <div className="relative mx-auto flex h-20 w-full max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5 sm:gap-3"
          aria-label="Hiến máu DUE – Trang chủ"
          onClick={() => setOpen(false)}
        >
          <span className="relative grid size-10 place-items-center rounded-xl bg-gradient-to-br from-red-500 to-red-700 text-white shadow-lg shadow-red-600/25 transition-transform duration-300 group-hover:-rotate-6 sm:size-11 sm:rounded-2xl">
            <Droplet className="size-5 fill-current sm:size-6" aria-hidden />
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-950"
            />
          </span>

          <span className="leading-tight">
            <span className="block text-[13px] font-bold tracking-tight text-slate-900 sm:text-[15px] dark:text-white">
              Hiến máu DUE
            </span>
            <span className="hidden text-[10px] font-semibold tracking-[0.18em] text-red-600 uppercase sm:block dark:text-red-400">
              Chung tay vì sự sống
            </span>
          </span>
        </Link>

        <nav
          aria-label="Điều hướng chính"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex"
        >
          {NAV_LINKS.map((link) => {
            const active = link.href === "/" && pathname === "/";

            return (
              <Link
                key={link.label}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200",
                  active
                    ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {portalHref ? (
            <Link
              href={portalHref}
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 hover:text-red-800 lg:inline-flex dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
            >
              {portalLabel}
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 lg:inline-flex dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
            >
              Đăng nhập
            </Link>
          )}

          <ThemeToggle className="hidden sm:inline-flex" />

          <Button
            asChild
            size="lg"
            className="h-9 rounded-xl bg-red-600 px-3 text-xs font-semibold text-white shadow-md shadow-red-600/25 hover:bg-red-700 hover:shadow-red-600/30 sm:h-10 sm:px-5 sm:text-sm"
          >
            <Link href={BOOKING_HREF}>
              <span className="hidden sm:inline">Đặt lịch ngay</span>
              <span className="sm:hidden">Đặt lịch</span>
              <ArrowRight aria-hidden />
            </Link>
          </Button>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? "Đóng menu" : "Mở menu"}
            className="grid size-9 place-items-center rounded-xl text-slate-700 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:outline-none sm:size-10 lg:hidden dark:text-slate-200 dark:hover:bg-white/10"
          >
            {open ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="mobile-navigation"
          className="absolute inset-x-0 top-full border-b border-slate-200/80 bg-white shadow-xl lg:hidden dark:border-white/10 dark:bg-slate-950"
        >
          <nav
            aria-label="Điều hướng di động"
            className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6"
          >
            {NAV_LINKS.map((link) => {
              const active = link.href === "/" && pathname === "/";

              return (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-xl px-4 py-3 text-sm font-semibold transition-colors",
                    active
                      ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}

            <div className="mt-3 flex items-center justify-between border-t border-slate-200/80 pt-3 dark:border-white/10">
              {portalHref ? (
                <Link
                  href={portalHref}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                >
                  {portalLabel}
                </Link>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  Đăng nhập
                </Link>
              )}
              <ThemeToggle />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
