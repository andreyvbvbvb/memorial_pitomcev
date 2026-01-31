import "./globals.css";
import type { ReactNode } from "react";
import { Commissioner, Playfair_Display } from "next/font/google";

const bodyFont = Commissioner({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700"]
});

const displayFont = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  weight: ["400", "600", "700"]
});

export const metadata = {
  title: "Memorial Pitomcev",
  description: "Create pet memorials and place them on a map."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>{children}</body>
    </html>
  );
}
