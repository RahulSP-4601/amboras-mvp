import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Evolv — Storefront experimentation",
  description: "Generate, test, and improve a focused one-product storefront.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
