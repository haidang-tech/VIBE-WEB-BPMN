"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChartColumn } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  {
    href: "/admin/campaigns",
    label: "Chiến dịch",
    icon: CalendarDays,
  },
  {
    href: "/admin/reports",
    label: "Báo cáo",
    icon: ChartColumn,
  },
] as const;

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Điều hướng quản trị" className="flex items-center gap-1">
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
