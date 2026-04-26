import "./globals.css";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import AppHeader from "../components/AppHeader";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-ui"
});

export const metadata = {
  title: "МяуГав",
  description: "Create pet memorials and place them on a map."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className={inter.variable}>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
