import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anala — PreStocks AI Research",
  description: "AI-native trading intelligence for PreStocks tokenized pre-IPO stocks on Solana",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
