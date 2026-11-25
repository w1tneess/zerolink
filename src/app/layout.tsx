import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ZeroLink — Auditable, Zero-Telemetry URL Shortener",
  description:
    "Self-hostable public and personal URL shortener with zero tracking cookies, zero third-party requests, and full destination inspection.",
  referrer: "no-referrer",
};

const THEME_INIT_SCRIPT = `
(function() {
  try {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    function applyTheme() {
      var stored = localStorage.getItem('zerolink_theme');
      if (stored === 'dark' || (!stored && mq.matches)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    applyTheme();
    if (mq.addEventListener) {
      mq.addEventListener('change', function() {
        if (!localStorage.getItem('zerolink_theme')) applyTheme();
      });
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-[100dvh] flex flex-col bg-[var(--bg)] text-[var(--text)] selection:bg-[var(--accent)] selection:text-[var(--accent-fg)]">
        {children}
      </body>
    </html>
  );
}
