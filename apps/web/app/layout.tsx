import "./globals.css";
import type { ReactNode } from "react";
import {
  Commissioner,
  Inter,
  Manrope,
  Noto_Sans,
  Nunito_Sans,
  Onest,
  PT_Sans_Narrow,
  Roboto,
  Roboto_Condensed,
  Rubik,
  Source_Sans_3
} from "next/font/google";
import AppHeader from "../components/AppHeader";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-inter"
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

const robotoCondensed = Roboto_Condensed({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-roboto-condensed"
});

const notoSans = Noto_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "block",
  variable: "--font-ui"
});

const ptSansNarrow = PT_Sans_Narrow({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-pt-sans-narrow"
});

const sourceSans = Source_Sans_3({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-source-sans"
});

const onest = Onest({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-onest"
});

const commissioner = Commissioner({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-commissioner"
});

export const metadata = {
  title: "МяуГав",
  description: "Create pet memorials and place them on a map."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body
        className={`${notoSans.className} ${notoSans.variable} ${inter.variable} ${manrope.variable} ${roboto.variable} ${nunitoSans.variable} ${rubik.variable} ${robotoCondensed.variable} ${ptSansNarrow.variable} ${sourceSans.variable} ${onest.variable} ${commissioner.variable}`}
      >
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
