import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Resume-Tailor",
  description: "Tailor your resume for any job in seconds with AI",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Resume-Tailor",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#090a10",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased overflow-x-hidden max-w-full`}
      suppressHydrationWarning
    >
      <head>
        <style dangerouslySetInnerHTML={{
          __html: `
            :root {
              --safe-area-inset-top: env(safe-area-inset-top);
              --safe-area-inset-right: env(safe-area-inset-right);
              --safe-area-inset-bottom: env(safe-area-inset-bottom);
              --safe-area-inset-left: env(safe-area-inset-left);
            }
            * {
              -webkit-tap-highlight-color: transparent;
            }
            input, textarea, select {
              font-size: 16px !important; /* Prevents zoom on iOS */
            }
          `
        }} />
      </head>
      <body 
        className="min-h-full w-full max-w-full overflow-x-hidden flex flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}