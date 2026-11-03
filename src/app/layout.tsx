import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Hiến máu DUE",
    template: "%s | Hiến máu DUE",
  },
  description:
    "Hệ thống đăng ký và quản lý hiến máu cho sinh viên Trường Đại học Kinh tế - ĐHĐN",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className="dark">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
