"use client";

import type { RegStatus } from "@prisma/client";
import { motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  TRACKING_STEPS,
  getStatusMeta,
  getStepState,
  type StatusTone,
  type StepState,
} from "@/lib/registration-status";
import { cn } from "@/lib/utils";

const TONE_TO_BADGE: Record<
  StatusTone,
  "neutral" | "info" | "success" | "warning" | "destructive"
> = {
  neutral: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "destructive",
};

function circleClass(state: StepState): string {
  switch (state) {
    case "done":
      return "border-success bg-success text-success-foreground";
    case "failed":
      return "border-destructive bg-destructive text-white";
    case "current":
      return "border-primary bg-primary text-primary-foreground";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function labelClass(state: StepState): string {
  switch (state) {
    case "done":
      return "text-foreground";
    case "failed":
      return "text-destructive";
    case "current":
      return "text-primary";
    default:
      return "text-muted-foreground";
  }
}

export default function TrackingStepper({ status }: { status: RegStatus }) {
  const meta = getStatusMeta(status);
  const shouldReduceMotion = useReducedMotion();

  const progress = Math.min(
    100,
    Math.max(0, (meta.completedSteps / (TRACKING_STEPS.length - 1)) * 100),
  );

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Trạng thái hiện tại
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant={TONE_TO_BADGE[meta.tone]}>{meta.label}</Badge>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          Bước {meta.completedSteps}/{TRACKING_STEPS.length}
        </p>
      </div>

      <div className="relative">
        <div
          aria-hidden
          className="bg-border absolute top-5 right-[10%] left-[10%] h-0.5"
        />
        <motion.div
          aria-hidden
          className={cn(
            "absolute top-5 left-[10%] h-0.5 origin-left",
            meta.isFailure ? "bg-destructive" : "bg-primary",
          )}
          initial={shouldReduceMotion ? false : { width: 0 }}
          animate={{ width: `${progress * 0.8}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
        />

        <ol className="relative z-10 flex">
          {TRACKING_STEPS.map((step, index) => {
            const state = getStepState(status, index);

            return (
              <li
                key={step.key}
                className="flex w-1/5 flex-col items-center text-center"
                aria-current={state === "current" ? "step" : undefined}
              >
                <motion.div
                  initial={
                    shouldReduceMotion ? false : { scale: 0.7, opacity: 0 }
                  }
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    duration: 0.35,
                    delay: 0.1 + index * 0.08,
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                  }}
                  className={cn(
                    "relative grid size-10 place-items-center rounded-full border-2 text-sm font-semibold shadow-sm",
                    circleClass(state),
                  )}
                >
                  {state === "current" ? (
                    <span
                      aria-hidden
                      className="bg-primary/25 absolute inset-0 animate-ping rounded-full"
                    />
                  ) : null}
                  <span className="relative">
                    {state === "done" ? (
                      <Check className="size-5" aria-hidden />
                    ) : state === "failed" ? (
                      <X className="size-5" aria-hidden />
                    ) : (
                      index + 1
                    )}
                  </span>
                </motion.div>

                <p
                  className={cn(
                    "mt-2.5 text-xs font-semibold sm:text-sm",
                    labelClass(state),
                  )}
                >
                  {step.label}
                </p>
                <p className="text-muted-foreground mt-0.5 hidden max-w-[120px] text-[11px] leading-tight sm:block">
                  {step.description}
                </p>
              </li>
            );
          })}
        </ol>
      </div>

      <motion.div
        key={status}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className={cn(
          "mt-8 rounded-lg border px-4 py-3 text-sm leading-relaxed",
          meta.isFailure
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : meta.isFinished
              ? "border-success/40 bg-success/10 text-success"
              : "border-border bg-muted/30 text-muted-foreground",
        )}
      >
        {meta.description}
      </motion.div>
    </div>
  );
}
