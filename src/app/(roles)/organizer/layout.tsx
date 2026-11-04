import Link from "next/link";
import type { ReactNode } from "react";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OrganizerNav from "./organizer-nav";

export const dynamic = "force-dynamic";

export default async function OrganizerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireRole("ORGANIZER");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-border/70 bg-background/85 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:gap-6">
          <Link
            href="/organizer/check-in"
            className="flex shrink-0 items-center gap-2 font-semibold"
          >
            <span
              aria-hidden
              className="from-primary to-primary/70 grid size-9 place-items-center rounded-xl bg-gradient-to-br text-base shadow-sm"
            >
              🩸
            </span>
            <span className="hidden sm:inline">Hiến máu DUE</span>
          </Link>

          <OrganizerNav />

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="max-w-40 truncate text-sm leading-tight font-medium">
                {user?.name ?? "Ban tổ chức"}
              </p>
              <p className="text-muted-foreground max-w-48 truncate text-xs">
                {user?.email ?? ""}
              </p>
            </div>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {children}
      </main>

      <footer className="border-border/70 border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs">
          <p>Hệ thống hiến máu sinh viên DUE — Trường Đại học Kinh tế, ĐHĐN.</p>
          <p>Khu vực Ban tổ chức · Check-in bằng CCCD.</p>
        </div>
      </footer>
    </div>
  );
}
