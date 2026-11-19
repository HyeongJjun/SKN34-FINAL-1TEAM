// 승인 전 업체 홈: 심사 기다림 · 보완 요청(V14 v_needinfo) · 거절(V22 v_rejected, D26 A). 머리 메뉴는 HeaderBar가 잠가요.
// 보완 요청이면 관리자가 연 칸만 고쳐 다시 보내요(ResubmitForm). 거절이면 이유를 보고 다시 신청해요(/signup/vendor?again=1).
// 화면 전체(Main + 아래 단추 띠)를 여기서 그려요. 부르는 쪽은 머리만 그려요.
import { Main } from "@/components/site/Frame";
import { Badge } from "@/components/ui/Badge";
import { BottomBar } from "@/components/ui/BottomBar";
import { Button } from "@/components/ui/Button";
import type { VendorApplicationMine } from "@/lib/api/vendor";
import { dateLong, dateShort } from "@/lib/format";
import { bizNoText, needsInfoOpenText, needsInfoTitle, reasonLabel } from "@/lib/labels";
import { rejectLabel } from "../text";
import { FileRow } from "@/components/ui/FileRow";
import { Eyebrow, Group, Hero, Quote, Row, Rows, Small } from "../ui/parts";
import { ResubmitForm } from "./ResubmitForm";

/** 심사 기록: 가입 신청 + 관리자가 마지막으로 정한 것 */
function History({ app }: { app: VendorApplicationMine }) {
  const d = app.decision;
  const why = d ? (d.action === "reject" ? rejectLabel(d.code) : reasonLabel("needs_info", d.code)) : null;
  return (
    <Group flush>
      <Eyebrow>심사 기록</Eyebrow>
      <Rows label="심사 기록">
        {app.applied_at ? <Row label="가입 신청" value={dateShort(app.applied_at)} /> : null}
        {d && d.action !== "apply" ? <Row label={d.action === "reject" ? "거절" : d.action === "approve" ? "승인" : "보완 요청"} sub={why ?? d.note ?? undefined} value={dateShort(d.at)} /> : null}
      </Rows>
    </Group>
  );
}

export function ApplicationScreen({ app }: { app: VendorApplicationMine }) {
  const d = app.decision;
  if (app.status === "needs_info") {
    const said = d?.note || (d ? reasonLabel("needs_info", d.code) : null);
    return (
      <ResubmitForm
        open={app.open_fields}
        openText={needsInfoOpenText(d?.code)}
        bizName={app.biz_name ?? ""}
        ownerName={app.owner_name ?? ""}
        head={
          <Hero badge={<Badge tone="wait">보완이 필요해요</Badge>} title={needsInfoTitle(d?.code)}>
            {said ? <Quote>{said}</Quote> : null}
            {d ? <Small>관리자가 {dateLong(d.at)}에 남긴 말이에요</Small> : null}
          </Hero>
        }
        history={<History app={app} />}
      />
    );
  }
  if (app.status === "rejected") {
    const why = d ? rejectLabel(d.code) : null;
    return (
      <>
        <Main narrow>
          {/* CF-56: 머리는 상태, 제목은 다음 할 일 */}
          <Hero badge={<Badge tone="bad">거절됐어요</Badge>} title="고쳐서 다시 신청할 수 있어요">
            {why || d?.note ? <Quote>{why ?? d?.note}</Quote> : null}
            {d ? <Small>관리자가 {dateLong(d.at)}에 남긴 이유예요{why && d.note ? ` · 메모: ${d.note}` : ""}</Small> : null}
          </Hero>
          <Group flush>
            <Eyebrow>다시 신청하려면</Eyebrow>
            <Rows label="다시 신청하려면">
              {/* 다시 신청(ReapplyIn)으로는 사업자등록번호를 못 바꿔요 → '등록번호'는 빼고 적었어요(verification/b3.md 부탁) */}
              <Row label="신청 정보 고치기" sub="상호 · 등록번호 · 대표자를 등록증과 같게" href="/signup/vendor?again=1" />
              <Row label="사업자등록증 다시 올리기" sub="흐리지 않게 찍어 주세요" href="/signup/vendor?again=1#v-doc" />
            </Rows>
          </Group>
          <Small>다시 신청하면 처음부터 다시 심사해요.</Small>
        </Main>
        <BottomBar>
          <Button size="lg" block href="/signup/vendor?again=1">다시 신청</Button>
        </BottomBar>
      </>
    );
  }
  return (
    <Main narrow>
      <Hero badge={<Badge tone="wait">심사 기다림</Badge>} title="신청서를 확인하고 있어요" sub="관리자가 확인하고, 승인되면 알림으로 알려 드려요." />
      <Group>
        <Rows label="낸 신청">
          <Row label="상호" value={app.biz_name ?? "—"} />
          <Row label="대표자" value={app.owner_name ?? "—"} />
          <Row label="사업자등록번호" value={bizNoText(app.biz_no) || "—"} />
        </Rows>
        {app.license ? <FileRow name={app.license.filename} size={app.license.size} /> : null}
        <Small>심사 중에는 신청 내용을 고칠 수 없어요.</Small>
      </Group>
      <History app={app} />
    </Main>
  );
}
