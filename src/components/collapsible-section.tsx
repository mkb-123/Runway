"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

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
        className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/50"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <span className="font-semibold text-sm">{title}</span>
        </div>
        {!isOpen && summary && (
          <span className="text-xs text-muted-foreground truncate ml-4 max-w-[60%] text-right">
            {summary}
          </span>
        )}
      </button>
      {isOpen && <div className="mt-3">{children}</div>}
    </div>
  );
}
