// 단계 표시(design-system 3.1 Steps · 9판 k-steps). 6단계: 기본 정보 · 표준견적서 · 업체 담기 · 실측 일정 · 실측 · 실측 뒤.
// 폰: 막대 6칸 + '지금 3/6 · 업체 담기' 한 줄(13px 단계 이름 여섯은 360px에 안 들어가서, 이름은 화면 읽기용 목록으로).
// 웹(≥768): 막대 아래 이름 여섯(13). 끝남 blue-400 · 지금 blue-600 + 굵게 · 남음 gray-200.
// 실측 뒤 작은 단계는 SubSteps(알약)로 따로 그려요.
import { Icon } from "./Icon";
import s from "./Steps.module.css";

export type StepItem = { label: string; href?: string };
export const PROJECT_STEPS: StepItem[] = ["기본 정보", "표준견적서", "업체 담기", "실측 일정", "실측", "실측 뒤"].map((label) => ({ label }));
export const AFTER_VISIT_STEPS: StepItem[] = ["견적서 비교", "업체 확정", "공사 날짜", "공사", "끝 확인"].map((label) => ({ label }));

export function Steps({ steps = PROJECT_STEPS, current, label = "공사 단계" }: { steps?: StepItem[]; current: number; label?: string }) {
  const now = steps[current]?.label ?? "";
  return (
    <div className={s.steps}>
      <div className={s.bars} aria-hidden="true" style={{ ["--n" as string]: steps.length }}>
        {steps.map((st, i) => <span key={st.label} className={i < current ? s.done : i === current ? s.now : ""} />)}
      </div>
      <p className={s.sum} aria-hidden="true"><span className="mj-num">지금 {current + 1}/{steps.length}</span> · <b>{now}</b></p>
      <ol className={s.names} aria-label={label} style={{ ["--n" as string]: steps.length }}>
        {steps.map((st, i) => (
          <li key={st.label} className={i < current ? s.doneT : i === current ? s.nowT : ""} aria-current={i === current ? "step" : undefined}>
            {st.label}{i < current ? <span className="mj-sr"> 끝남</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** 실측 뒤 작은 단계 알약: ✓ 끝남 · 지금(파랑) · 남음 */
export function SubSteps({ steps = AFTER_VISIT_STEPS, current, label = "실측 뒤 단계" }: { steps?: StepItem[]; current: number; label?: string }) {
  return (
    <ol className={s.subs} aria-label={label}>
      {steps.map((st, i) => (
        <li key={st.label} className={i < current ? s.sdone : i === current ? s.snow : ""} aria-current={i === current ? "step" : undefined}>
          {i < current ? <Icon name="check" size={12} strokeWidth={3} /> : null}{st.label}
          {i < current ? <span className="mj-sr"> 끝남</span> : null}
        </li>
      ))}
    </ol>
  );
}
