"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, HeartHandshake } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  {
    href: "/student/register",
    label: "Đăng ký",
    icon: HeartHandshake,
  },
  {
    href: "/student/tracking",
    label: "Theo dõi",
    icon: ClipboardList,
  },
] as const;

export default function StudentNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Điều hướng sinh viên" className="flex items-center gap-1">
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
              "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
