import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// System font stack - avoids Google Fonts network dependency during build
// while maintaining consistent cross-platform typography.

export const metadata: Metadata = {
  title: "UGC Logistics Dashboard",
  description: "Integrated Dashboard for KPI, CRM, Ticketing, and DSO",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
