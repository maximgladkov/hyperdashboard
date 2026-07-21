import { Providers } from "@/components/Providers";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hyperliquid · Profit ledger",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Hyperdash",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="dark" data-theme="mouve-dark" lang="en">
      <body className="bg-background text-foreground pt-4 pb-7 px-3 sm:pt-7 sm:pb-10 sm:px-[clamp(14px,4vw,44px)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
