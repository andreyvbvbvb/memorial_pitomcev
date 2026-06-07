import "./globals.css";
import type { ReactNode } from "react";
import { Inter, Manrope, Nunito_Sans, Roboto, Rubik } from "next/font/google";
import AppHeader from "../components/AppHeader";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-ui"
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-manrope"
});

const roboto = Roboto({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  variable: "--font-roboto"
});

const nunitoSans = Nunito_Sans({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-nunito"
});

const rubik = Rubik({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-rubik"
});

export const metadata = {
  title: "МяуГав",
  description: "Create pet memorials and place them on a map."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} ${manrope.variable} ${roboto.variable} ${nunitoSans.variable} ${rubik.variable}`}>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
