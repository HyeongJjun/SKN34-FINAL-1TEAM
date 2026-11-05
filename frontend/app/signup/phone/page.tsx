// 휴대폰 번호 넣기(시안 WPhone).
// - 로그인 안 함: 카카오가 휴대폰 번호를 주지 않았을 때만 오는 단계. 카카오를 연결할 때 그 경우에만 이리로 보낸다
//   (지금은 카카오 버튼이 이 화면으로 오지 않아서 오는 길이 없다. '가입 마치기'는 준비 중 안내만).
// - 로그인 함: 번호를 저장한다. 업체 고르기에서 '휴대폰 번호 넣기'로 오면(?next=) 저장한 뒤 거기로 돌아간다.
import { SiteHeader } from "@/components/site/SiteHeader";
import { PhoneForm } from "@/components/auth/PhoneForm";
import { safeNext } from "@/components/auth/next";
import { getSession } from "@/lib/session";
import s from "@/components/auth/auth.module.css";

export const metadata = { title: "휴대폰 번호" };

const VENDOR_PICK = /^\/projects\/[^/?#]+\/vendors(?:[/?#]|$)/;

export default async function PhonePage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw);
  const session = await getSession();
  const returning = !!session && !!next;
  const label = !returning ? "가입 마치기" : VENDOR_PICK.test(next) ? "저장하고 업체 고르기로 돌아가기" : "저장하고 돌아가기";
  return (
    <>
      <SiteHeader />
      <main id="main" className={`mj-wrap ${s.page}`}>
        <div className={s.single}>
          <div className={s.head}>
            <h1 className="mj-h1">연락처를 넣어 주세요</h1>
            {returning ? <p className="mj-sub">실측을 요청하려면 휴대폰 번호가 필요해요.</p> : null}
          </div>
          <PhoneForm role={session?.role ?? null} next={next} submitLabel={label} draftNote={!returning} />
        </div>
      </main>
    </>
  );
}
