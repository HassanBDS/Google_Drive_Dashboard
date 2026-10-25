import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans, Fira_Code } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

/* Heading font — Outfit: geometric, modern, bold numbers */
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

/* Body font — Plus Jakarta Sans: highly legible, balanced */
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

/* Mono font — Fira Code: byte values, scan timers, folder IDs */
const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Google Drive Dashboard",
  description: "Visual disk usage analyzer and file explorer for Google Drive.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
};

import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/Tooltip";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fontClasses = [outfit.variable, plusJakartaSans.variable, firaCode.variable].join(" ");

  return (
    <html lang="en" className={fontClasses} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedTheme = localStorage.getItem('theme');
                  var theme = savedTheme || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
                  document.documentElement.setAttribute('data-theme', theme);
                  if (localStorage.getItem('sidebar_collapsed') === 'true') {
                    document.documentElement.classList.add('sidebar-collapsed');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <TooltipProvider>
          <div className="app-layout">
            <Sidebar />
            <div className="main-area">
              {children}
            </div>
          </div>
          <Toaster richColors closeButton position="bottom-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}

