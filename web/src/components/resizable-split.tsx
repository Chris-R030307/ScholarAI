"use client";

import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

function readStoredPercent(
  key: string,
  def: number,
  min: number,
  max: number,
): number {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw == null) return def;
    const n = Number(raw);
    if (!Number.isFinite(n)) return def;
    return Math.min(max, Math.max(min, n));
  } catch {
    return def;
  }
}

type Props = {
  storageKey: string;
  defaultLeftPercent: number;
  minLeftPercent: number;
  maxLeftPercent: number;
  left: ReactNode;
  right: ReactNode;
  className?: string;
};

export function ResizableSplit({
  storageKey,
  defaultLeftPercent,
  minLeftPercent,
  maxLeftPercent,
  left,
  right,
  className = "",
}: Props) {
  const [pct, setPct] = useState(() =>
    readStoredPercent(
      storageKey,
      defaultLeftPercent,
      minLeftPercent,
      maxLeftPercent,
    ),
  );
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const persist = useCallback(
    (n: number) => {
      try {
        sessionStorage.setItem(storageKey, String(Math.round(n * 10) / 10));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const el = containerRef.current;
      if (!el || !dragging.current) return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0) return;
      const x = e.clientX - r.left;
      const next = (x / r.width) * 100;
      const clamped = Math.min(
        maxLeftPercent,
        Math.max(minLeftPercent, next),
      );
      setPct(clamped);
    },
    [maxLeftPercent, minLeftPercent],
  );

  const stopDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setPct((p) => {
      persist(p);
      return p;
    });
  }, [persist]);

  useEffect(() => {
    const up = () => stopDrag();
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [stopDrag]);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [onPointerMove]);

  const onSeparatorKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 10 : 3;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPct((p) => {
          const n = Math.max(minLeftPercent, p - step);
          persist(n);
          return n;
        });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPct((p) => {
          const n = Math.min(maxLeftPercent, p + step);
          persist(n);
          return n;
        });
      }
    },
    [maxLeftPercent, minLeftPercent, persist],
  );

  return (
    <>
      <div
        ref={containerRef}
        className={`hidden min-h-[min(70vh,720px)] w-full gap-0 lg:flex ${className}`}
      >
        <div
          className="flex min-h-0 min-w-0 flex-col overflow-hidden pr-3"
          style={{ flex: `0 0 ${pct}%` }}
        >
          {left}
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={minLeftPercent}
          aria-valuemax={maxLeftPercent}
          tabIndex={0}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            dragging.current = true;
          }}
          onKeyDown={onSeparatorKeyDown}
          className="group relative w-3 shrink-0 cursor-col-resize touch-none outline-none"
        >
          <span className="absolute inset-y-8 left-1/2 block w-1 -translate-x-1/2 rounded-full bg-zinc-200 group-hover:bg-emerald-500/50 group-focus-visible:bg-emerald-600/60 dark:bg-zinc-700 dark:group-hover:bg-emerald-400/40" />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pl-3">
          {right}
        </div>
      </div>
      <div className={`flex w-full flex-col gap-10 lg:hidden ${className}`}>
        <div className="min-w-0">{left}</div>
        <div className="min-w-0">{right}</div>
      </div>
    </>
  );
}
