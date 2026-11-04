"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function RefreshButton() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleRefresh() {
    setSpinning(true);

    startTransition(() => {
      router.refresh();
    });

    window.setTimeout(() => setSpinning(false), 700);
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleRefresh}
      disabled={pending}
    >
      <RefreshCw
        className={cn(spinning && "animate-pulse")}
        aria-hidden
      />
      Làm mới
    </Button>
  );
}
