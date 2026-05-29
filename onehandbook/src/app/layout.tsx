import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { AnalysisJobsProvider } from "@/contexts/AnalysisJobsContext";
import { GoogleTagManager } from "@next/third-parties/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://novelagent.kr";
const SITE_NAME = "노벨에이전트";
const SITE_NAME_EN = "Novel Agent";
const DEFAULT_TITLE = "노벨에이전트 - 웹소설 작가를 위한 AI 분석 스튜디오";
const DEFAULT_DESCRIPTION =
  "웹소설 원고를 업로드하면 6개 축(첫 훅·인물 매력·세계관·긴장감·로맨스·독창성)으로 AI가 분석해드립니다. 카카오페이지·문피아·네이버 플랫폼 최적화 리포트까지 한 번에.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: DEFAULT_TITLE,
    template: "%s | 노벨에이전트",
  },
  description: DEFAULT_DESCRIPTION,

  applicationName: SITE_NAME,
  referrer: "origin-when-cross-origin",
  keywords: [
    "웹소설",
    "웹소설 분석",
    "AI 웹소설",
    "작가 도구",
    "카카오페이지",
    "문피아",
    "네이버시리즈",
    "노벨에이전트",
    "novelagent",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  alternates: {
    canonical: SITE_URL,
    languages: {
      "ko-KR": SITE_URL,
    },
  },

  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "노벨에이전트 - 웹소설 작가를 위한 AI 분석 스튜디오",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/og-image.png"],
  },

  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },

  manifest: "/site.webmanifest",

  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: {
      "naver-site-verification": process.env.NAVER_SITE_VERIFICATION ?? "",
    },
  },

  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },

  category: "technology",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        alternateName: SITE_NAME_EN,
        url: SITE_URL,
        logo: `${SITE_URL}/logo.svg`,
        description:
          "AI 기반 웹소설 성과 분석 SaaS. 웹소설 작가를 위한 데이터 스튜디오.",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: SITE_NAME_EN,
        description: "웹소설 작가를 위한 AI 분석 스튜디오",
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "ko-KR",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#software`,
        name: SITE_NAME,
        alternateName: SITE_NAME_EN,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: {
          "@type": "Offer",
          priceCurrency: "KRW",
        },
      },
    ],
  };

  // NEXT_PUBLIC_GTM_ID 미설정 시(로컬/E2E) GTM 미로드 — 추적 격리. literal access (DefinePlugin inline).
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <html lang="ko">
      {gtmId ? <GoogleTagManager gtmId={gtmId} /> : null}
      <body
        className={`${geistSans.variable} ${geistMono.variable} m-0 flex min-h-screen flex-col p-0 antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <AnalysisJobsProvider>
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </AnalysisJobsProvider>
      </body>
    </html>
  );
}
