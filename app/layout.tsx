import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAXWEB | Websites & Branding",
  description: "Fast, private and thoughtfully designed websites for businesses."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="/css/style.css" />
      </head>
      <body>
        {children}
        <Script src="/js/script.js" strategy="afterInteractive" />
        <Script src="/js/auth.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
