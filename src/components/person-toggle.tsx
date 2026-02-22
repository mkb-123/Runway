"use client";

// ============================================================
// Person Toggle - Segmented control for person/household views
// ============================================================
// [Person1] [Person2] [Household] — appears on every page.
// Compact on mobile, full names on desktop.

import { usePersonView } from "@/context/person-view-context";
import { useData } from "@/context/data-context";
import { cn } from "@/lib/utils";

export function PersonToggle() {
  const { household } = useData();
  const { selectedView, setSelectedView } = usePersonView();
  const persons = household.persons;

  if (persons.length < 2) return null;

  const options = [
    { id: "household" as const, label: "Household", short: "All" },
    ...persons.map((p) => ({ id: p.id, label: p.name, short: p.name.split(" ")[0] })),
  ];

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-lg border border-border/50 bg-muted/50 p-0.5 text-xs"
      role="tablist"
      aria-label="View filter"
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          role="tab"
          aria-selected={selectedView === opt.id}
          onClick={() => setSelectedView(opt.id)}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
            "min-h-[32px] min-w-[32px]",
            selectedView === opt.id
              ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          <span className="hidden sm:inline">{opt.label}</span>
          <span className="sm:hidden">{opt.short}</span>
        </button>
      ))}
    </div>
  );
}
