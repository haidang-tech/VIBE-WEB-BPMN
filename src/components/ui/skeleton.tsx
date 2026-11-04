import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "skeleton-shimmer animate-pulse rounded-xl motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
