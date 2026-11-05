import Link from "next/link";
import type { ReactNode } from "react";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MedicalNav from "./medical-nav";

export const dynamic = "force-dynamic";

export default async function MedicalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireRole("MEDICAL");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:gap-6">
          <Link
            href="/medical/health-check"
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

          <MedicalNav />

          <div className="ml-auto flex items-center gap-3">
            <p className="hidden max-w-48 truncate text-sm font-medium md:block">
              {user?.name ?? "Nhân viên y tế"}
            </p>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
