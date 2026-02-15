"use client";

import { useData } from "@/context/data-context";
import { AlertTriangle, X } from "lucide-react";

export function SaveErrorBanner() {
  const { saveError, dismissSaveError } = useData();

  if (!saveError) return null;

  return (
    <div
      role="alert"
      className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-sm text-destructive flex items-center gap-2"
    >
      <AlertTriangle className="size-4 shrink-0" />
      <span className="flex-1">{saveError}</span>
      <button
        onClick={dismissSaveError}
        className="shrink-0 rounded p-1 hover:bg-destructive/20"
        aria-label="Dismiss save error"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
