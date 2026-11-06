import type { Metadata } from "next";
import type { ReactNode } from "react";
import SignatureBackdrop from "@/components/SignatureBackdrop";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Hiến máu DUE",
    template: "%s | Hiến máu DUE",
  },
  description:
    "Hệ thống đăng ký và quản lý hiến máu cho sinh viên Trường Đại học Kinh tế - ĐHĐN",
};

/**
 * Áp theme trước khi paint để tránh nháy sáng/tối (FOUC).
 * Ưu tiên lựa chọn đã lưu, sau đó tới cài đặt hệ thống.
 */
const THEME_SCRIPT = `(function(){try{var stored=localStorage.getItem('due-theme');var dark=stored?stored==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',dark);}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="app-surface min-h-screen bg-background font-sans text-foreground antialiased">
        <SignatureBackdrop />
        <div className="relative z-10">
          <ToastProvider>{children}</ToastProvider>
        </div>
      </body>
    </html>
  );
}
