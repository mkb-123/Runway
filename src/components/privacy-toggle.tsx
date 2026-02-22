"use client";

import { EyeOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrivacy } from "@/context/privacy-context";

export function PrivacyToggle() {
  const { blurred, toggle } = usePrivacy();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={blurred ? "Show numbers" : "Hide numbers"}
      title={blurred ? "Show numbers (Ctrl+Shift+B)" : "Hide numbers (Ctrl+Shift+B)"}
      className="min-h-[44px] min-w-[44px]"
    >
      {blurred ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </Button>
  );
}
