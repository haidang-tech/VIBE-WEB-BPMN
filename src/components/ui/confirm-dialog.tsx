"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldQuestion,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DialogTone = "default" | "destructive" | "success" | "warning" | "info";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  loading?: boolean;
  icon?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
};

const TONE_ICON_CLASS: Record<DialogTone, string> = {
  default: "bg-primary/10 text-primary",
  destructive: "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-sky-500/10 text-sky-500",
};

const TONE_BUTTON: Record<
  DialogTone,
  "default" | "destructive" | "success" | "secondary"
> = {
  default: "default",
  destructive: "destructive",
  success: "success",
  warning: "default",
  info: "default",
};

function ToneIcon({ tone }: { tone: DialogTone }) {
  if (tone === "success") return <CheckCircle2 className="size-5" aria-hidden />;
  if (tone === "warning" || tone === "destructive") {
    return <AlertTriangle className="size-5" aria-hidden />;
  }
  if (tone === "info") return <Info className="size-5" aria-hidden />;
  return <ShieldQuestion className="size-5" aria-hidden />;
}

/**
 * Dialog xác nhận dùng chung: nền kính mờ, animation mượt, đóng bằng Esc.
 * Thay cho window.confirm để đồng bộ trải nghiệm toàn hệ thống.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  tone = "default",
  loading = false,
  icon,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => confirmRef.current?.focus(), 80);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [loading, onClose, open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.button
            type="button"
            aria-label="Đóng hộp thoại"
            className="absolute inset-0 cursor-default bg-slate-950/45 backdrop-blur-sm"
            onClick={() => {
              if (!loading) onClose();
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={
              description ? "confirm-dialog-description" : undefined
            }
            initial={
              shouldReduceMotion
                ? false
                : { opacity: 0, y: 24, scale: 0.96 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 16, scale: 0.97 }
            }
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="glass-strong relative w-full max-w-md overflow-hidden rounded-2xl border p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              aria-label="Đóng"
              className="text-muted-foreground hover:text-foreground hover:bg-accent/70 absolute top-3 right-3 rounded-full p-2 transition-colors disabled:opacity-40"
            >
              <X className="size-4" aria-hidden />
            </button>

            <div className="flex items-start gap-3.5">
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-full",
                  TONE_ICON_CLASS[tone],
                )}
              >
                {icon ?? <ToneIcon tone={tone} />}
              </span>

              <div className="min-w-0 flex-1 pt-0.5">
                <h2
                  id="confirm-dialog-title"
                  className="pr-8 text-base font-semibold tracking-tight"
                >
                  {title}
                </h2>
                {description ? (
                  <div
                    id="confirm-dialog-description"
                    className="text-muted-foreground mt-1.5 text-sm leading-relaxed text-pretty"
                  >
                    {description}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                {cancelLabel}
              </Button>
              <Button
                ref={confirmRef}
                type="button"
                variant={TONE_BUTTON[tone]}
                onClick={onConfirm}
                disabled={loading}
              >
                {loading ? "Đang xử lý..." : confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
