import localFont from "next/font/local";

export const switzer = localFont({
  src: [
    { path: "../fonts/switzer-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/switzer-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/switzer-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-switzer",
  display: "swap",
});

export const azeretMono = localFont({
  src: [
    { path: "../fonts/azeret-mono-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/azeret-mono-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-azeret-mono",
  display: "swap",
});
