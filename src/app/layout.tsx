import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "labnote — 実験ノート",
  description: "実験ノート・論文管理アプリ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
