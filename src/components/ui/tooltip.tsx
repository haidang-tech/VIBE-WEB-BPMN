import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Side = "top" | "bottom" | "left" | "right";

type TooltipProps = {
  label: ReactNode;
  children: ReactNode;
  side?: Side;
  className?: string;
};

const SIDE_CLASS: Record<Side, string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  left: "top-1/2 right-full mr-2 -translate-y-1/2",
  right: "top-1/2 left-full ml-2 -translate-y-1/2",
};

/**
 * Tooltip nhẹ, thuần CSS: hiện khi hover hoặc focus bên trong trigger.
 * Dùng được trong Server Component vì không có state.
 */
export function Tooltip({
  label,
  children,
  side = "top",
  className,
}: TooltipProps) {
  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "glass-strong text-popover-foreground pointer-events-none absolute z-[80] w-max max-w-72 rounded-xl border px-3 py-2 text-left text-xs leading-relaxed text-pretty opacity-0 shadow-xl transition-all duration-200",
          "translate-y-1 scale-95 group-hover/tooltip:translate-y-0 group-hover/tooltip:scale-100 group-hover/tooltip:opacity-100 group-focus-within/tooltip:translate-y-0 group-focus-within/tooltip:scale-100 group-focus-within/tooltip:opacity-100",
          SIDE_CLASS[side],
        )}
      >
        {label}
      </span>
    </span>
  );
}

type InfoTooltipProps = {
  label: string;
  side?: Side;
  className?: string;
};

/** Icon thông tin kèm tooltip — thay cho các dòng chú thích dài. */
export function InfoTooltip({ label, side = "top", className }: InfoTooltipProps) {
  return (
    <Tooltip label={label} side={side} className={className}>
      <button
        type="button"
        aria-label={label}
        className="text-muted-foreground hover:text-foreground hover:bg-accent/70 focus-visible:ring-ring/50 inline-flex size-6 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 focus-visible:ring-[3px] focus-visible:outline-none"
      >
        <Info className="size-4" aria-hidden />
      </button>
    </Tooltip>
  );
}
