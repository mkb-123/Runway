"use client";

import Link from "next/link";
import { Settings, ArrowRight } from "lucide-react";

/**
 * Empty state prompt directing users to the Settings page.
 * Used when a page has no data to display.
 */
export function EmptyState({
  message,
  settingsTab,
}: {
  message: string;
  settingsTab?: string;
}) {
  const href = settingsTab ? `/settings?tab=${settingsTab}` : "/settings";

  return (
    <div className="relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-lg border border-dashed bg-gradient-to-b from-muted/40 to-muted/10 px-6 py-14 text-center">
      <div className="pointer-events-none absolute -right-6 -top-6 size-32 rounded-full bg-primary/[0.04]" />
      <div className="pointer-events-none absolute -left-4 -bottom-4 size-24 rounded-full bg-primary/[0.03]" />
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
        <Settings className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <p className="max-w-sm text-sm font-medium text-muted-foreground">{message}</p>
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          Go to Settings <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
