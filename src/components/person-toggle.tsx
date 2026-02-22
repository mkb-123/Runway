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
    ...persons.map((p) => ({ id: p.id, label: p.name, short: p.name.split(" ")[0] })),
    { id: "household" as const, label: "Household", short: "All" },
  ];

  return (
    <div
      className="inline-flex items-center rounded-lg bg-muted p-1 text-sm"
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
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            "min-h-[44px] min-w-[44px]",
            selectedView === opt.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="hidden sm:inline">{opt.label}</span>
          <span className="sm:hidden">{opt.short}</span>
        </button>
      ))}
    </div>
  );
}
