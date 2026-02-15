/**
 * SettingsBar — a visually distinct bar that surfaces settings-level
 * assumptions on consuming pages.
 *
 * Consistent visual language across all pages:
 * - Settings (cog) icon on the left
 * - A short label like "Planning assumptions" or "Allowance usage"
 * - Slotted content (badges, progress bars, etc.)
 * - "Edit in Settings" link on the right that deep-links to the correct tab
 */
import { Settings } from "lucide-react";
import Link from "next/link";

interface SettingsBarProps {
  /** Short label displayed after the cog icon (e.g. "Planning assumptions") */
  label: string;
  /** Settings tab to deep-link to (e.g. "planning", "household") */
  settingsTab: string;
  /** Link text for the edit link */
  editLabel?: string;
  /** The inline content — badges, mini progress bars, etc. */
  children: React.ReactNode;
}

export function SettingsBar({
  label,
  settingsTab,
  editLabel = "Edit in Settings",
  children,
}: SettingsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
      <div className="flex items-center gap-1.5 text-primary">
        <Settings className="size-3.5" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {children}
      </div>
      <Link
        href={`/settings?tab=${settingsTab}`}
        className="ml-auto text-xs text-primary hover:underline"
      >
        {editLabel}
      </Link>
    </div>
  );
}
