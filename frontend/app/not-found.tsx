// 404 · 찾는 화면이 없어요(C56). 없는 주소, 지운 것, 남의 공사도 같은 화면이에요(있는지조차 알리지 않아요).
import { AppHeader } from "@/components/site/AppHeader";
import { Main } from "@/components/site/Frame";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "찾는 화면이 없어요" };

export default function NotFound() {
  return (
    <>
      <AppHeader phone={{ title: "", back: "/" }} />
      <Main narrow>
        <EmptyState
          icon="doc"
          as="h1"
          title="찾는 화면이 없어요"
          action={<><Button size="sm" href="/">홈으로</Button><Button variant="text" arrow href="/my">내 공사</Button></>}
        >
          주소가 바뀌었거나, 볼 수 없는 공사예요.
        </EmptyState>
      </Main>
    </>
  );
}
