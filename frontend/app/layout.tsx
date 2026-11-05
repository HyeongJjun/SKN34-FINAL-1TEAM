import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_KR({ weight: ["400", "500", "700"], subsets: ["latin"], display: "swap", preload: false, variable: "--mj-font" });

export const metadata: Metadata = {
  title: { default: "믿집", template: "%s · 믿집" },
  description: "아파트 도배·목공, 공공 기준 표준견적과 업체 가견적을 비교하고 실측까지",
};

// 머리(SiteHeader)는 화면마다 그린다. 바닥글(SiteFooter)은 지금 숨겨 두었다. 다시 보이려면 {children} 아래에 붙인다.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={noto.variable}>
      <body>
        <a className="mj-skip" href="#main">본문으로 건너뛰기</a>
        {children}
      </body>
    </html>
  );
}
