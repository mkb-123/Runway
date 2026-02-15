"use client";

import { useState, useCallback } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Collapsible section header — reusable across all pages.
 * Persists open/closed state in localStorage via storageKey.
 * When collapsed, shows a summary string on the right.
 */
export function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  storageKey,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  storageKey: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return defaultOpen;
    try {
      const stored = localStorage.getItem(`nw-section-${storageKey}`);
      return stored !== null ? stored === "true" : defaultOpen;
    } catch {
      return defaultOpen;
    }
  });

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`nw-section-${storageKey}`, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [storageKey]);

  return (
    <div>
      <button
        onClick={toggle}
        className="group flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left transition-all duration-200 hover:bg-accent/50 hover:shadow-sm"
      >
        <div className="flex items-center gap-2.5">
          <ChevronRight
            className={`size-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
          />
          <span className="font-semibold text-sm">{title}</span>
        </div>
        {!isOpen && summary && (
          <span className="text-xs text-muted-foreground truncate ml-4 max-w-[60%] text-right tabular-nums" data-sensitive>
            {summary}
          </span>
        )}
      </button>
      <div
        className={`grid transition-all duration-250 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
