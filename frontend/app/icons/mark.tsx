// 앱 아이콘 그림(dev-01 PWA): 파랑 바탕(--mj-primary #1b66d8) + 흰 지붕 · 'ㅁ' 칸. app/icon.svg와 같은 그림이에요.
// Next ImageResponse로 PNG를 만들어서 내려받는 파일이 없어요. 빌드 때 한 번 그려 정적 파일로 둬요.
//   any      둥근 네모(모서리 25%) · 투명 모서리 — 192 · 512
//   maskable 바탕이 꽉 찬 네모 · 그림을 80%로 줄여 안전 원(지름 80%) 안에 — 512
//   apple    바탕이 꽉 찬 네모(iOS가 모서리를 깎아요) · 그림 90% — 180
// 아이콘은 CSS 변수를 못 읽어서 색 값을 직접 써요(tokens.css --mj-blue-600과 같은 값).
import { ImageResponse } from "next/og";

export type MarkKind = "any" | "maskable" | "apple";
const BLUE = "#1b66d8";
const SCALE: Record<MarkKind, number> = { any: 1, maskable: 0.8, apple: 0.9 };

export function markImage(size: number, kind: MarkKind, headers?: Record<string, string>) {
  const k = SCALE[kind];
  const half = 16 / k;
  const box = `${16 - half} ${16 - half} ${half * 2} ${half * 2}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          background: BLUE, borderRadius: kind === "any" ? size * 0.25 : 0,
        }}
      >
        <svg width={size} height={size} viewBox={box} xmlns="http://www.w3.org/2000/svg">
          <path d="M6.5 14.5 16 7l9.5 7.5" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          <rect x={10} y={14.5} width={12} height={10.5} rx={1.5} fill="none" stroke="#fff" strokeWidth={2.6} />
        </svg>
      </div>
    ),
    { width: size, height: size, headers },
  );
}
