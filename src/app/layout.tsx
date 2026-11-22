import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "학교 수강신청 · 가정통신문 통합 관리 | 2조 무명",
  description: "고교학점제 수강신청과 가정통신문을 하나로 관리하는 웹 애플리케이션",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
