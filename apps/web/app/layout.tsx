import "./globals.css";
import type { ReactNode } from "react";
import AppHeader from "../components/AppHeader";

export const metadata = {
  title: "МяуГав",
  description: "Create pet memorials and place them on a map."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
