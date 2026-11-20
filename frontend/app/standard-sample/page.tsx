import { SheetSample } from "@/components/v2/sheet/SheetSample";

export const metadata = { title: "표준견적서 견본" };

// 로그인 · API 없이 표준견적서 쉽게 보기 화면을 확인하는 견본 페이지. 값은 계산 엔진으로 미리 만든 예시다.
export default function StandardSamplePage() {
  return <SheetSample />;
}
