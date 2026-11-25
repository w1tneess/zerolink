import type { Metadata } from "next";
import { switzer, azeretMono } from "./fonts";
import { Motion } from "@/components/Motion";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_BASE_URL || "http://localhost:3000"),
  title: {
    default: "ZeroLink — Simple, Private Link Shortener",
    template: "%s | ZeroLink",
  },
  description:
    "Create clean short links with no tracking cookies, no ads, and an instant preview before anyone clicks.",
  referrer: "no-referrer",
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    siteName: "ZeroLink",
    title: "ZeroLink — Simple, Private Link Shortener",
    description:
      "Make long links short and preview where any link leads before you click. Simple, private, and free of trackers.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZeroLink — Simple, Private Link Shortener",
    description:
      "Make long links short and preview where any link leads before you click. Simple, private, and free of trackers.",
  },
};

const BOOT_FLAGS_SCRIPT = `
(function() {
  try {
    var root = document.documentElement;
    root.classList.add('js');
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('motion');
    }
    var stored = localStorage.getItem('zerolink_theme');
    if (stored === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  } catch (e) {
    document.documentElement.classList.add('js', 'dark');
  }
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
      className={`${switzer.variable} ${azeretMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="color-scheme" content="dark light" />
        <script dangerouslySetInnerHTML={{ __html: BOOT_FLAGS_SCRIPT }} />
      </head>
      <body className="min-h-[100dvh] flex flex-col bg-[var(--bg)] text-[var(--text)]">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div id="curtain" aria-hidden="true">
          <div className="curtain__panel" />
        </div>
        {children}
        <Motion />
      </body>
    </html>
  );
}
