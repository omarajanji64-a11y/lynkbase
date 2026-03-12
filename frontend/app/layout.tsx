import type { Metadata } from "next";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Lynkbase",
  description: "Instagram account manager"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="min-h-screen bg-background">
            <Sidebar />
            <main className="ml-[240px] min-h-screen p-8">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
