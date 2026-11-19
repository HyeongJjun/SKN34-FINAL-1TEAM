// 오프라인 안내 한 장(dev-01). 서비스 워커(public/sw.js)가 설치할 때 이 화면과 CSS만 받아 두고,
// 화면을 여는데 네트워크가 안 되면 원래 주소 그대로 이 내용을 보여 줘요. 로그인 정보 · 공사 내용은 넣지 않아요(받아 둔 화면에 남지 않게).
// '다시 시도'는 스크립트 없이 같은 주소를 다시 여는 링크예요(href="" = 지금 주소).
// 요청 때 그리는 것은 뿌리(app/layout.tsx의 connection())가 맡아요 → 받아 둔 HTML의 nonce와 함께 받아 둔 CSP 머리가 맞아요.
import type { Metadata } from "next";
import { StatusPage } from "@/components/site/StatusPage";

export const metadata: Metadata = { title: "인터넷 연결 없음", robots: { index: false, follow: false } };

export default function OfflinePage() {
  return (
    <StatusPage title="인터넷에 연결되지 않았어요" actions={<a className="mj-btn mj-btn-pri" href="">다시 시도</a>}>
      <p className="mj-sub">와이파이나 모바일 데이터가 켜져 있는지 확인한 뒤 다시 시도해 주세요. 믿집은 견적 · 일정을 늘 새로 받아 와서, 연결이 없으면 화면을 보여 드리지 못해요.</p>
    </StatusPage>
  );
}
