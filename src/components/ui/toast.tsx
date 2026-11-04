"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "destructive" | "warning" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** 0 = không tự đóng */
  duration?: number;
};

type ToastItem = ToastInput & { id: string; tone: ToastTone };

type ToastContextValue = {
  toast: (input: ToastInput) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CLASS: Record<ToastTone, string> = {
  success: "border-success/40",
  destructive: "border-destructive/40",
  warning: "border-warning/40",
  info: "border-sky-500/40",
};

const TONE_ICON_CLASS: Record<ToastTone, string> = {
  success: "text-success",
  destructive: "text-destructive",
  warning: "text-warning",
  info: "text-sky-500",
};

function ToneIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") return <CheckCircle2 className="size-5" aria-hidden />;
  if (tone === "warning") return <AlertTriangle className="size-5" aria-hidden />;
  if (tone === "info") return <Info className="size-5" aria-hidden />;
  return <AlertCircle className="size-5" aria-hidden />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));

    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const item: ToastItem = { ...input, id, tone: input.tone ?? "info" };

      // Giữ tối đa 4 toast để không che nội dung.
      setItems((current) => [...current.slice(-3), item]);

      const duration = input.duration ?? 5000;
      if (duration > 0) {
        const timer = window.setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;

    return () => {
      for (const timer of map.values()) window.clearTimeout(timer);
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        aria-label="Thông báo"
        role="region"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, x: 72, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 96, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              className={cn(
                "glass-strong shadow-soft pointer-events-auto flex w-full items-start gap-3 rounded-2xl border p-4 sm:w-[min(92vw,380px)]",
                TONE_CLASS[item.tone],
              )}
            >
              <span className={cn("mt-0.5 shrink-0", TONE_ICON_CLASS[item.tone])}>
                <ToneIcon tone={item.tone} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                {item.description ? (
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    {item.description}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Đóng thông báo"
                className="text-muted-foreground hover:text-foreground hover:bg-accent -mr-1 -mt-1 rounded-full p-1.5 transition-colors"
              >
                <X className="size-4" aria-hidden />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast phải được dùng bên trong <ToastProvider>.");
  }

  return context;
}
