import type { Metadata, Viewport } from "next";
import { Navigation } from "@/components/layout/navigation";
import { ScenarioBanner } from "@/components/scenario-banner";
import { SaveErrorBanner } from "@/components/save-error-banner";
import { TaxYearBanner } from "@/components/tax-year-banner";
import { DataProvider } from "@/context/data-context";
import { ScenarioProvider } from "@/context/scenario-context";
import { PersonViewProvider } from "@/context/person-view-context";
import { PrivacyProvider } from "@/context/privacy-context";
import { ErrorBoundary } from "@/components/error-boundary";
import "./globals.css";

export const metadata: Metadata = {
  title: "Runway",
  description: "UK household net worth tracker and financial planner",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
              <PersonViewProvider>
                <PrivacyProvider>
                  <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none"
                  >
                    Skip to main content
                  </a>
                  <Navigation />
                  <SaveErrorBanner />
                  <TaxYearBanner />
                  <ScenarioBanner />
                  <main
                    id="main-content"
                    className="mx-auto max-w-screen-2xl pb-20 lg:pb-16"
                  >
                    {children}
                  </main>
                </PrivacyProvider>
              </PersonViewProvider>
            </ScenarioProvider>
          </DataProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
