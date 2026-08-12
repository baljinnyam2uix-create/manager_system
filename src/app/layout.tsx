import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Сургалтын менежерийн систем",
  description:
    "Ерөнхий боловсролын сургуулийн хичээлийн хуваарь, багшийн бүртгэл, ажлын гүйцэтгэл, төлөвлөгөө, цалингийн тооцоо, дүнгийн нэгдсэн матриц",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b9ad6",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="mn">
      <body>{children}</body>
    </html>
  );
}
