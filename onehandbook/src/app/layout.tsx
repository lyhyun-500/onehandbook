import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME } from "@/config/site";
import { FloatingInquiryButton } from "@/components/FloatingInquiryButton";
import { SiteFooter } from "@/components/SiteFooter";
import { AnalysisJobsProvider } from "@/contexts/AnalysisJobsContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} m-0 flex min-h-screen flex-col p-0 antialiased`}
      >
        <AnalysisJobsProvider>
          <div className="flex-1">{children}</div>
          <SiteFooter />
          <FloatingInquiryButton />
        </AnalysisJobsProvider>
      </body>
    </html>
  );
}
