// 개발용 조각 모음(B4). 개발 서버에서만 열려요(빌드 · 운영에서는 404). 모든 ui 조각 · 껍데기를 한 화면에 모아 360 · 1280에서 봐요.
// 숫자 · 날짜는 모두 9판 시안의 예시 값이에요(계산 엔진 값이 아니에요).
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppHeader } from "@/components/site/AppHeader";
import { AsideOpenButton } from "@/components/site/AsideSlot";
import { ProjectBand } from "@/components/site/ProjectBand";
import { TabBar } from "@/components/site/TabBar";
import { Gallery } from "./Gallery";

export const metadata: Metadata = { title: "조각 모음", robots: { index: false, follow: false } };

export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <>
      <AppHeader phone={{ title: "조각 모음", back: "/", action: <AsideOpenButton /> }} />
      <ProjectBand
        name="상계동 아파트 도배"
        href="/dev/ui#band"
        current={3}
        steps={[
          { label: "기본 정보", href: "/dev/ui#steps" },
          { label: "표준견적서", href: "/dev/ui#quote" },
          { label: "업체 담기", href: "/dev/ui#vendor" },
          { label: "실측 일정", href: "/dev/ui#compare" },
          { label: "실측" },
          { label: "실측 뒤" },
        ]}
        todo={[{ label: "마루와벽 날짜 고르기", href: "/dev/ui#date" }]}
        waiting={[{ label: "결도배 답 기다림", due: "11.19(목) 21:40까지" }]}
      />
      <Gallery />
      <TabBar />
    </>
  );
}
