"use client";
// 가운데 창 · 아래 시트 · 크게 보기가 같이 쓰는 <dialog> 다루기.
// - showModal()로 뒤를 막고 초점을 창 안에 가둬요. Esc · 바깥 누르기로 닫고, 닫으면 누른 단추로 초점을 돌려줘요.
// - closeOnBack: 폰 시트처럼 뒤로 가기로 닫혀야 하면 열 때 기록 한 칸을 넣고, 뒤로 가기가 오면 닫아요(NN/g 아래 시트).
// - 여는 일과 걷는 일을 효과 하나에 짝지어 두었어요. 걷을 때 '뒤로'와 초점 돌려주기는 한 박자 미뤄요:
//   개발 모드(React StrictMode)는 처음 그릴 때 효과를 걷었다 바로 다시 돌리는데, 그때 미뤄 둔 일을 취소해
//   처음부터 열린 창이 스스로 닫히지 않아요(전에는 걷을 때 부른 history.back()이 popstate로 돌아와 창을 닫았어요).
// - Esc를 브라우저가 먼저 닫아도(사용자 동작 없이 연 창은 cancel을 막아도 닫혀요) 같은 뒷정리를 해요.
import { useEffect, useRef, type RefObject } from "react";

type Opts = { closeOnBack?: () => boolean; dismissible?: boolean };

export function useModal(ref: RefObject<HTMLDialogElement | null>, open: boolean, onClose: () => void, opts: Opts = {}) {
  const opener = useRef<Element | null>(null);
  const pushed = useRef(false);
  const leaving = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ onClose, opts });
  useEffect(() => { latest.current = { onClose, opts }; });
  const dismissible = opts.dismissible ?? true;

  useEffect(() => {
    const d = ref.current;
    if (!d || !open) return;
    // 걷자마자 다시 돌면(StrictMode) 미뤄 둔 뒷정리를 취소하고, 누른 단추 · 기록 칸을 그대로 이어 써요
    const again = leaving.current !== null;
    if (leaving.current) { clearTimeout(leaving.current); leaving.current = null; }
    if (!again) opener.current = document.activeElement;
    // 뒤 페이지를 멈추기 전에 스크롤 막대 폭을 재 둬요(globals.css가 그만큼 비워 화면이 흔들리지 않아요).
    // 이미 다른 창이 열려 막대가 없으면 재지 않아요(0으로 덮으면 흔들려요)
    if (!document.querySelector("dialog[open]")) {
      const root = document.documentElement;
      root.style.setProperty("--mj-sbw", `${Math.max(0, window.innerWidth - root.clientWidth)}px`);
    }
    if (!d.open) d.showModal();
    if (!again && latest.current.opts.closeOnBack?.()) {
      history.pushState({ ...history.state, mjModal: true }, "");
      pushed.current = true;
    }
    // 뒤로 가기 → 닫기(기록 칸은 브라우저가 이미 걷었어요)
    const onPop = () => {
      if (pushed.current) { pushed.current = false; latest.current.onClose(); }
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (d.open) d.close();
      leaving.current = setTimeout(() => {
        leaving.current = null;
        if (pushed.current) {
          pushed.current = false;
          // 다른 화면으로 옮긴 뒤면(기록이 새 칸) 뒤로 가지 않아요
          if (history.state?.mjModal) history.back();
        }
        const el = opener.current as HTMLElement | null;
        if (el && typeof el.focus === "function" && document.contains(el)) el.focus();
      }, 0);
    };
  }, [open, ref]);

  return {
    /** <dialog onCancel>: Esc */
    onCancel: (e: React.SyntheticEvent) => { e.preventDefault(); if (dismissible) latest.current.onClose(); },
    /** <dialog onClick>: 바깥(창 바탕) 누르기 */
    onClick: (e: React.MouseEvent<HTMLDialogElement>) => { if (dismissible && e.target === e.currentTarget) latest.current.onClose(); },
  };
}
