"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanLine, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  {
    href: "/medical/scan-id",
    label: "Quét CCCD",
    icon: ScanLine,
  },
  {
    href: "/medical/health-check",
    label: "Khám & chốt kết quả",
    icon: Stethoscope,
  },
] as const;

export default function MedicalNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Điều hướng khu vực y tế" className="flex items-center gap-1">
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
