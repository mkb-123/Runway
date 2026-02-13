import type { Metadata } from "next";
import { Navigation } from "@/components/layout/navigation";
import { DataProvider } from "@/context/data-context";
import { ScenarioProvider } from "@/context/scenario-context";
import { ErrorBoundary } from "@/components/error-boundary";
import "./globals.css";

export const metadata: Metadata = {
  title: "Net Worth Tracker",
  description: "Personal household net worth tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <ErrorBoundary>
          <DataProvider>
            <ScenarioProvider>
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none"
              >
                Skip to main content
              </a>
              <Navigation />
              <main
                id="main-content"
                className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8"
              >
                {children}
              </main>
            </ScenarioProvider>
          </DataProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
