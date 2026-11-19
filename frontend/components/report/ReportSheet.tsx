"use client";
// 신고 · 차단(C31). 채팅 ⋯ 메뉴 · 업체 상세 '업체 신고'(C11) · 리뷰 전체 '링크 신고'(C48)가 같은 창을 써요(B2a · B3도 가져다 써요).
// POST /reports {kind, thread_id?, message_id?, vendor_id?, link_sort?, reason_code, block}. 믿집 관리자가 확인하고(A02) 결과를 알림으로 알려요.
// 차단(block)은 고객의 채팅 신고에만 있어요: 그 대화가 읽기만이 되고 업체 쪽 쓰기가 막혀요(dev-05).
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { errorText } from "@/lib/backend/client";
import { eulReul } from "@/lib/format";
import { send } from "@/lib/mock/v3b/client";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { OptionRow, Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import s from "./report.module.css";

export type ReportKind = "chat" | "vendor" | "link";
const REASONS: Record<"person" | "link", { key: string; label: string }[]> = {
  person: [
    { key: "offsite", label: "믿집 밖 거래를 권해요" },
    { key: "abuse", label: "막말 · 불쾌한 말" },
    { key: "promise", label: "약속을 안 지켜요" },
    { key: "other", label: "그 밖" },
  ],
  link: [
    { key: "wrong_place", label: "엉뚱한 곳으로 가요" },
    { key: "not_vendor", label: "이 업체 리뷰가 아니에요" },
    { key: "other", label: "그 밖" },
  ],
};

export function ReportSheet({ open, onClose, kind, targetName, threadId, messageId, vendorId, linkSort, canBlock = false, onDone }: {
  open: boolean;
  onClose: () => void;
  kind: ReportKind;
  /** '마루와벽' · '상계동 고객' · 링크 이름 */
  targetName: string;
  threadId?: string;
  messageId?: string;
  vendorId?: string;
  linkSort?: number;
  /** 고객의 채팅 신고: '이 업체 차단하기' */
  canBlock?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [why, setWhy] = useState<string | null>(null);
  const [block, setBlock] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errId = useId();
  const blockId = useId();
  const list = REASONS[kind === "link" ? "link" : "person"];

  async function submit() {
    if (!why) { setErr("신고 이유를 골라 주세요."); return; }
    setErr(null);
    setBusy(true);
    try {
      await send("POST", "/reports", {
        kind,
        thread_id: threadId ?? null,
        message_id: messageId ?? null,
        vendor_id: vendorId ?? null,
        link_sort: linkSort ?? null,
        reason_code: why,
        block: canBlock && kind === "chat" ? block : false,
      });
      toast.show(block && canBlock ? "신고하고 차단했어요" : "신고했어요");
      setWhy(null);
      setBlock(false);
      onClose();
      if (onDone) onDone();
      else if (block) router.refresh();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => !busy && onClose()}
      title={`${eulReul(targetName)} 신고할까요?`}
      dismissible={!busy}
      hideClose
      actions={
        <div className={s.btns}>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={busy}>닫기</Button>
          <Button size="lg" onClick={submit} busy={busy}>{busy ? "보내는 중" : "신고"}</Button>
        </div>
      }
    >
      <div role="radiogroup" aria-label="신고 이유" aria-describedby={err ? errId : undefined}>
        {list.map((r) => (
          <OptionRow key={r.key} selected={why === r.key} onClick={() => { setWhy(r.key); setErr(null); }}>{r.label}</OptionRow>
        ))}
      </div>
      {err ? <p id={errId} className={s.err} role="alert"><Icon name="error" size={16} />{err}</p> : null}
      {canBlock && kind === "chat" ? (
        <label className={s.block} htmlFor={blockId}>
          <input id={blockId} type="checkbox" className={s.check} checked={block} onChange={(e) => setBlock(e.currentTarget.checked)} />
          <span className={s.box} aria-hidden="true"><Icon name="check" size={16} strokeWidth={3} /></span>
          <span className={s.blockText}>
            <b>이 업체 차단하기</b>
            <span>채팅을 더 받지 않아요</span>
          </span>
        </label>
      ) : null}
      <p className={s.note}>믿집이 확인하고 처리 결과를 알림으로 알려 드려요.</p>
    </Sheet>
  );
}
