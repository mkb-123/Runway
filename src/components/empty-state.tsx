"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

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
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
      <Settings className="size-10 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{message}</p>
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Go to Settings
        </Link>
      </div>
    </div>
  );
}
