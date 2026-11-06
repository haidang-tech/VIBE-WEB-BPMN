import Link from "next/link";
import type { ReactNode } from "react";
import LogoutButton from "@/components/LogoutButton";
import StudentDonationBanner from "@/components/StudentDonationBanner";
import ThemeToggle from "@/components/ThemeToggle";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import StudentNav from "./student-nav";

export const dynamic = "force-dynamic";

export default async function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireRole("STUDENT");

  const [user, nextRegistration] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true },
    }),
    prisma.registration.findFirst({
      where: {
        userId: session.userId,
        status: { in: ["PENDING", "APPROVED", "CHECKED_IN", "ELIGIBLE"] },
        // Chỉ thông báo cho chiến dịch hôm nay hoặc sắp tới.
        campaign: { date: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      },
      orderBy: { campaign: { date: "asc" } },
      select: {
        id: true,
        status: true,
        slotTime: true,
        campaign: {
          select: { name: true, date: true, location: true },
        },
      },
    }),
  ]);

  const bannerData = nextRegistration
    ? {
        registrationId: nextRegistration.id,
        status: nextRegistration.status,
        campaignDate: nextRegistration.campaign.date.toISOString(),
        campaignName: nextRegistration.campaign.name,
        location: nextRegistration.campaign.location,
        slotTime: nextRegistration.slotTime,
      }
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:gap-6">
          <Link
            href="/student/register"
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

          <StudentNav />

          <div className="ml-auto flex items-center gap-3">
            <p className="hidden max-w-48 truncate text-sm font-medium md:block">
              {user?.name ?? "Sinh viên"}
            </p>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      <StudentDonationBanner data={bannerData} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
