import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hyperliquid · Profit ledger",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="dark" data-theme="mouve-dark" lang="en">
      <body className="bg-background text-foreground pt-4 pb-7 px-3 sm:pt-7 sm:pb-10 sm:px-[clamp(14px,4vw,44px)]">
        {children}
      </body>
    </html>
  );
}
