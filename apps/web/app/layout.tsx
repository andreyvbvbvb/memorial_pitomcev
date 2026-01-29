import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Memorial Pitomcev",
  description: "Create pet memorials and place them on a map."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
