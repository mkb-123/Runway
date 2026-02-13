"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Landmark,
  Briefcase,
  TrendingUp,
  Sunset,
  Wallet,
  Calculator,
  PieChart,
  Shield,
  Download,
  Settings,
  Menu,
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

const navLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/holdings", label: "Holdings", icon: Briefcase },
  { href: "/projections", label: "Projections", icon: TrendingUp },
  { href: "/retirement", label: "Retirement", icon: Sunset },
  { href: "/income", label: "Income", icon: Wallet },
  { href: "/tax-planning", label: "Tax Planning", icon: Calculator },
  { href: "/allocation", label: "Allocation", icon: PieChart },
  { href: "/iht", label: "IHT", icon: Shield },
  { href: "/export", label: "Export", icon: Download },
];

export function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center px-4 sm:px-6 lg:px-8">
        {/* Logo / App Title */}
        <Link href="/" className="mr-6 flex items-center gap-2 font-semibold">
          <Landmark className="size-5 text-primary" />
          <span className="hidden sm:inline-block">Net Worth Tracker</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden flex-1 items-center gap-0.5 overflow-x-auto lg:flex">
          {navLinks.map((link) => {
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

        {/* Mobile Navigation */}
        <div className="flex flex-1 items-center justify-end lg:hidden">
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
                  Net Worth Tracker
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-4">
                {navLinks.map((link) => {
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
