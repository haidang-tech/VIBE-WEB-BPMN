"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

const COLORS = [
  "#e11d48",
  "#f43f5e",
  "#fb7185",
  "#f59e0b",
  "#22c55e",
  "#38bdf8",
  "#a855f7",
];

type ConfettiProps = {
  show: boolean;
  pieces?: number;
};

/** Hiệu ứng tung hoa thuần Framer Motion, không cần thư viện ngoài. */
export default function Confetti({ show, pieces = 70 }: ConfettiProps) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, index) => ({
        id: index,
        left: Math.random() * 100,
        delay: Math.random() * 0.45,
        duration: 1.7 + Math.random() * 1.3,
        rotate: Math.random() * 540 - 270,
        drift: (Math.random() - 0.5) * 220,
        color: COLORS[index % COLORS.length],
        width: 5 + Math.random() * 6,
        height: 8 + Math.random() * 8,
        round: Math.random() > 0.65,
      })),
    [pieces],
  );

  return (
    <AnimatePresence>
      {show ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[110] overflow-hidden"
        >
          {items.map((item) => (
            <motion.span
              key={item.id}
              className="absolute top-0 block"
              style={{
                left: `${item.left}%`,
                width: item.width,
                height: item.height,
                backgroundColor: item.color,
                borderRadius: item.round ? "9999px" : "2px",
              }}
              initial={{ y: -40, opacity: 1, rotate: 0 }}
              animate={{
                y: "105vh",
                x: item.drift,
                rotate: item.rotate,
                opacity: [1, 1, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: item.duration,
                delay: item.delay,
                ease: "easeOut",
              }}
            />
          ))}
        </div>
      ) : null}
    </AnimatePresence>
  );
}
