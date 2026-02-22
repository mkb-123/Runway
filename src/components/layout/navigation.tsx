"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Landmark,
  TrendingUp,
  Sunset,
  Wallet,
  Calculator,
  Shield,
  Download,
  Settings,
  Menu,
  Eye,
  Target,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScenarioPanel } from "@/components/scenario-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { PrivacyToggle } from "@/components/privacy-toggle";
import { useScenario } from "@/context/scenario-context";

// Navigation grouped into "Today" (current position) and "Plan" (future outlook)
const navGroups = [
  {
    label: "Today",
    icon: Eye,
    links: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/accounts", label: "Accounts", icon: Landmark },
      { href: "/income", label: "Income", icon: Wallet },
    ],
  },
  {
    label: "Plan",
    icon: Target,
    links: [
      { href: "/cashflow", label: "Cash Flow", icon: BarChart3 },
      { href: "/projections", label: "Projections", icon: TrendingUp },
      { href: "/retirement", label: "Retirement", icon: Sunset },
      { href: "/tax-planning", label: "Tax Planning", icon: Calculator },
      { href: "/iht", label: "Estate", icon: Shield },
    ],
  },
];

const utilityLinks = [
  { href: "/export", label: "Export", icon: Download },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { isScenarioMode } = useScenario();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-background/60 print:hidden",
        isScenarioMode
          ? "border-amber-300 bg-amber-50/95 dark:border-amber-800 dark:bg-amber-950/95"
          : "bg-background/95"
      )}
    >
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center px-4 sm:px-6 lg:px-8">
        {/* Logo / App Title */}
        <Link href="/" className="mr-8 flex items-center gap-2.5 text-lg font-bold tracking-tight">
          <Landmark className="size-5 text-primary" />
          <span>Runway</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden flex-1 items-center gap-0.5 overflow-x-auto lg:flex">
          {navGroups.map((group) => (
            <div key={group.label} className="flex items-center">
              <span className="mr-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">
                {group.label}
              </span>
              {group.links.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors xl:px-2.5 xl:text-sm",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
              <div className="mx-2 h-4 w-px bg-border" />
            </div>
          ))}
          {utilityLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors xl:px-2.5 xl:text-sm",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="size-3.5" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* What-If Scenario Button + Theme Toggle */}
        <div className="ml-auto mr-2 hidden items-center gap-1 lg:flex">
          <ScenarioPanel />
          <PrivacyToggle />
          <ThemeToggle />
        </div>

        {/* Mobile Navigation */}
        <div className="flex flex-1 items-center justify-end gap-1 lg:hidden">
          <ScenarioPanel />
          <PrivacyToggle />
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b px-4 py-4">
                <SheetTitle className="flex items-center gap-2">
                  <Landmark className="size-5 text-primary" />
                  Runway
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-4">
                {navGroups.map((group) => {
                  const GroupIcon = group.icon;
                  return (
                    <div key={group.label}>
                      <div className="mb-1 mt-3 flex items-center gap-2 px-3 first:mt-0">
                        <GroupIcon className="size-3.5 text-muted-foreground/60" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                          {group.label}
                        </span>
                      </div>
                      {group.links.map((link) => {
                        const Icon = link.icon;
                        const active = isActive(link.href);
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                              active
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            <Icon className="size-4" />
                            <span>{link.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
                <div className="my-2 border-t" />
                {utilityLinks.map((link) => {
                  const Icon = link.icon;
                  const active = isActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Icon className="size-4" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
