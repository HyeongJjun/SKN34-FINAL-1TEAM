// 아이콘 하나(ADR design-04): 24 격자 · 선 1.8(16px 이하는 2) · currentColor · 기본은 읽지 않음(aria-hidden).
// - home · doc · chat · bell · user · box · store · camera · pin · check · calendar: 9판 시안 스프라이트(믿집 팀이 그림)
// - 나머지 선 아이콘: Lucide(ISC) · Feather(MIT)에서 경로만 옮겼어요. 허가서 전문은 같은 폴더 ICONS_LICENSE.txt
//   Lucide — Copyright (c) Lucide Contributors 2022 · Feather — Copyright (c) 2013-2022 Cole Bemis
// - 상태 기호(● ○ ✓ – !)는 9판 모양 그대로 자체로 그렸어요. 상태는 늘 글자와 함께 써요(StateTag).
// 아이콘만 있는 단추는 단추에 이름을 줘요(예: ⋯ '더 보기', × '닫기'). label을 주면 그림 자체가 이름을 가져요.
import type { ReactNode, SVGProps } from "react";

const P = (d: string) => <path d={d} />;

const PATHS = {
  // 9판 스프라이트
  home: P("M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"),
  doc: <>{P("M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z")}{P("M14 3v5h5M9 13h6M9 17h4")}</>,
  chat: P("M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"),
  bell: <>{P("M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z")}{P("M10 20.5a2 2 0 0 0 4 0")}</>,
  user: <><circle cx="12" cy="8" r="4" />{P("M4 21a8 8 0 0 1 16 0")}</>,
  box: <>{P("M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z")}{P("M3 7.5 12 12l9-4.5M12 12v9")}</>,
  store: <>{P("M4 9.5h16l-1.5-5h-13zM5 9.5V20h14V9.5")}{P("M10 20v-5h4v5")}</>,
  camera: <>{P("M4 7.5h3.5l2-2.5h5l2 2.5H20a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1z")}<circle cx="12" cy="13.5" r="3.5" /></>,
  pin: <>{P("M12 21s7-6.3 7-11.5a7 7 0 1 0-14 0C5 14.7 12 21 12 21z")}<circle cx="12" cy="9.5" r="2.5" /></>,
  check: P("M5 12.5 9.5 17 19 7.5"),
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" />{P("M3.5 10h17M8 3v4M16 3v4")}</>,
  // Lucide · Feather
  back: P("m15 18-6-6 6-6"),
  "chevron-left": P("m15 18-6-6 6-6"),
  "chevron-right": P("m9 18 6-6-6-6"),
  "chevron-down": P("m6 9 6 6 6-6"),
  "chevron-up": P("m18 15-6-6-6 6"),
  close: <>{P("M18 6 6 18")}{P("m6 6 12 12")}</>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  plus: <>{P("M5 12h14")}{P("M12 5v14")}</>,
  minus: P("M5 12h14"),
  send: <>{P("M22 2 11 13")}{P("M22 2 15 22l-4-9-9-4z")}</>,
  external: <>{P("M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6")}{P("M15 3h6v6")}{P("M10 14 21 3")}</>,
  search: <><circle cx="11" cy="11" r="8" />{P("m21 21-4.35-4.35")}</>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" />{P("M7 11V7a5 5 0 0 1 10 0v4")}</>,
  upload: <>{P("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4")}{P("m17 8-5-5-5 5")}{P("M12 3v12")}</>,
  download: <>{P("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4")}{P("m7 10 5 5 5-5")}{P("M12 15V3")}</>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />{P("m21 15-5-5L5 21")}</>,
  info: <><circle cx="12" cy="12" r="10" />{P("M12 16v-4")}{P("M12 8h.01")}</>,
  warn: <>{P("M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z")}{P("M12 9v4")}{P("M12 17h.01")}</>,
  error: <><circle cx="12" cy="12" r="10" />{P("M12 8v4")}{P("M12 16h.01")}</>,
  clock: <><circle cx="12" cy="12" r="10" />{P("M12 6v6l4 2")}</>,
  star: P("M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"),
  // 상태 기호(N4 C, 9판 모양)
  "dot-todo": <circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" />,
  "ring-wait": <circle cx="12" cy="12" r="5.5" />,
  "dash-done": P("M6.5 12h11"),
  "alert-late": <>{P("M12 4.5v10")}<circle cx="12" cy="19.5" r="1.7" fill="currentColor" stroke="none" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

/** 별은 채운 모양(고른 별)과 테두리 모양(안 고른 별) 둘 다 이 이름 하나로 그려요(fill로 바꿈). */
export function Icon({ name, size = 24, label, strokeWidth, filled, className, ...rest }: {
  name: IconName;
  size?: number;
  /** 그림만으로 뜻을 전할 때만(보통은 단추 · 글자가 이름을 가져요) */
  label?: string;
  strokeWidth?: number;
  /** 별 같은 모양을 채워 그려요 */
  filled?: boolean;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "name" | "fill">) {
  const sw = strokeWidth ?? (size <= 16 ? 2 : 1.8);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      focusable="false"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
