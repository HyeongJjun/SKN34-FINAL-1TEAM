// 업체 정보 탭(9판 V15 · V16 · V18 k-pills): 기본 · 사례 n · 링크. 주소의 ?tab=로 바뀌어요(B4 Tabs 주소 탭).
import { Tabs } from "@/components/ui/Tabs";

export type ProfileTab = "basic" | "cases" | "links";

export function ProfileTabs({ current, cases }: { current: ProfileTab; cases: number }) {
  return (
    <Tabs
      variant="pill"
      label="업체 정보 탭"
      value={current}
      items={[
        { key: "basic", label: "기본", href: "/vendor/profile?tab=basic" },
        { key: "cases", label: "사례", count: cases, href: "/vendor/profile?tab=cases" },
        { key: "links", label: "링크", href: "/vendor/profile?tab=links" },
      ]}
    />
  );
}
