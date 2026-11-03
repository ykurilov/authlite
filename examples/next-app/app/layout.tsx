import "@ykurilov/authlite/styles.css";
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "Заметки — пример AuthLite для Next.js" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
