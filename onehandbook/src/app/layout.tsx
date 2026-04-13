import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  CONTACT_EMAIL,
  SITE_DESCRIPTION,
  SITE_NAME,
} from "@/config/site";
import { FloatingInquiryButton } from "@/components/FloatingInquiryButton";
import { SiteFooter } from "@/components/SiteFooter";
import { AnalysisJobsProvider } from "@/contexts/AnalysisJobsContext";
import { getInternalSiteBaseUrl } from "@/lib/siteBaseUrl";
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

function softwareApplicationJsonLd(): string {
  const url = getInternalSiteBaseUrl();
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    alternateName: "노벨 에이전트",
    applicationCategory: ["WebApplication", "BusinessApplication"],
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript. Modern web browser.",
    url,
    description: SITE_DESCRIPTION,
    inLanguage: "ko",
    audience: {
      "@type": "PeopleAudience",
      name: "웹소설·웹툰 등 텍스트 연재 창작자",
    },
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      url,
      email: CONTACT_EMAIL,
    },
  });
}

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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: softwareApplicationJsonLd(),
          }}
        />
        <AnalysisJobsProvider>
          <div className="flex-1">{children}</div>
          <SiteFooter />
          <FloatingInquiryButton />
        </AnalysisJobsProvider>
      </body>
    </html>
  );
}
