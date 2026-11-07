import type { Metadata } from "next";
import BloodCardList from "@/components/landing/BloodCardList";
import DonationScheduleSection from "@/components/landing/DonationScheduleSection";
import HeroSection from "@/components/landing/HeroSection";
import LandingFooter from "@/components/landing/LandingFooter";
import Navbar from "@/components/landing/Navbar";
import { getSession } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Hiến máu DUE – Chung tay vì sự sống",
  description:
    "Đăng ký hiến máu cùng sinh viên Trường Đại học Kinh tế – ĐHĐN. Quy trình an toàn, miễn phí và minh bạch.",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  const portalHref = session ? ROLE_HOME[session.role] : null;
  const portalLabel =
    session?.role === "STUDENT" ? "Trang sinh viên" : "Bảng điều khiển";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar
        portalHref={portalHref}
        portalLabel={portalLabel}
        signedIn={Boolean(session)}
      />
      <main className="flex-1">
        <HeroSection />
        <DonationScheduleSection />
        <BloodCardList />
      </main>
      <LandingFooter />
    </div>
  );
}
