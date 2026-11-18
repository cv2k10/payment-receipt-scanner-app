import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReceiptScan AI — Payment Receipt Scanner to Table",
  description: "Scan payment receipts with NVIDIA Mistral Large AI and turn them into a searchable, exportable table.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#F4F5F0] text-slate-900 antialiased">{children}</body>
    </html>
  );
}
