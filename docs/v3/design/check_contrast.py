"""믿집 v3 토큰 점검: 색 대비 · 글자 크기 단계 · 누를 곳 크기.

tokens.draft.css를 읽어 var()를 풀고, 화면에서 실제로 만나는 글자/바탕 짝의 대비를 계산해요.
표준 라이브러리만 써요.

    python docs/v3/design/check_contrast.py            # 흰 바탕(기본)과 회색 바탕 둘 다
    python docs/v3/design/check_contrast.py --md       # 마크다운 표로

기준: 글자 4.5:1(WCAG 1.4.3 AA · KWCAG 2.2), 글자 아닌 것 3:1(WCAG 1.4.11).
하나라도 못 넘으면 끝 코드 1.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

CSS = Path(__file__).with_name("tokens.draft.css")

# (글자 · 앞 색, 바탕 색, 종류, 쓰는 곳). 종류: text = 4.5, ui = 3.0
PAIRS = [
    # 글자
    ("--mj-text", "--mj-bg", "text", "본문 · 제목 · 금액(페이지 바탕)"),
    ("--mj-text", "--mj-surface", "text", "묶음 안 본문 · 금액"),
    ("--mj-text-sub", "--mj-surface", "text", "줄 아래 설명 · 라벨"),
    ("--mj-text-sub", "--mj-bg", "text", "묶음 밖 설명(바탕 위)"),
    ("--mj-text-mute", "--mj-surface", "text", "시각 · 범례 · 각주"),
    ("--mj-text-mute", "--mj-bg", "text", "묶음 밖 각주(바탕 위)"),
    ("--mj-text-mute", "--mj-fill", "text", "말풍선 안 '자동 답변' · 파일 크기"),
    ("--mj-text-mute", "--mj-surface-sub", "text", "답글 · 인용 안 날짜"),
    ("--mj-text-mute", "--mj-primary-weak", "text", "고른 줄(작업함 표) 안 보조 글자"),
    ("--mj-text-placeholder", "--mj-field-bg", "text", "입력 칸 자리 글자"),
    ("--mj-text", "--mj-field-bg", "text", "입력 글자"),
    ("--mj-text", "--mj-fill", "text", "상대 말풍선 · AI 답"),
    ("--mj-text-sub", "--mj-fill", "text", "칩 · 나눔 칸 글자 · 시스템 줄"),
    ("--mj-text-sub", "--mj-surface-sub", "text", "답글 본문 · 펼친 답"),
    ("--mj-text-sub", "--mj-fill-strong", "text", "잡힌 반나절 날짜"),
    ("--mj-on-primary", "--mj-primary", "text", "주 단추 글자 · 내 말풍선 · 고른 날"),
    ("--mj-on-primary", "--mj-primary-hover", "text", "주 단추 올림"),
    ("--mj-on-primary", "--mj-primary-press", "text", "주 단추 누름"),
    ("--mj-on-primary-weak", "--mj-primary-weak", "text", "약한 단추 · 고른 칩 · 안내 상자"),
    ("--mj-on-primary-weak", "--mj-primary-weak-hover", "text", "약한 단추 올림"),
    ("--mj-link", "--mj-surface", "text", "글자 단추 · 자세히 ›"),
    ("--mj-link", "--mj-bg", "text", "묶음 밖 글자 단추"),
    ("--mj-link", "--mj-fill", "text", "말풍선 안 글자 단추"),
    ("--mj-link", "--mj-primary-weak", "text", "고른 줄 안 글자 단추"),
    ("--mj-badge-now-fg", "--mj-badge-now-bg", "text", "배지 · 지금"),
    ("--mj-badge-wait-fg", "--mj-badge-wait-bg", "text", "배지 · 기다림 · 기한 가까움"),
    ("--mj-badge-ok-fg", "--mj-badge-ok-bg", "text", "배지 · 확정"),
    ("--mj-badge-bad-fg", "--mj-badge-bad-bg", "text", "배지 · 지남 · 거절"),
    ("--mj-badge-mute-fg", "--mj-badge-mute-bg", "text", "배지 · 준비 중 · 닫힘"),
    ("--mj-danger", "--mj-surface", "text", "칸 아래 오류 글자"),
    ("--mj-on-danger", "--mj-danger", "text", "위험 단추(거절 · 탈퇴)"),
    ("--mj-on-danger-weak", "--mj-danger-weak", "text", "오류 줄 글자"),
    ("--mj-text", "--mj-danger-weak", "text", "오류 줄 안 본문"),
    ("--mj-on-warn-weak", "--mj-warn-weak", "text", "주의 줄(믿집 밖 거래) · 경고 줄"),
    ("--mj-text", "--mj-warn-weak", "text", "경고 줄 안 본문(단가 표)"),
    ("--mj-text-mute", "--mj-warn-weak", "text", "경고 줄 안 보조 글자"),
    ("--mj-on-count", "--mj-count", "text", "안 읽은 수"),
    ("--mj-text-inverse", "--mj-surface-inverse", "text", "진행 중 공사 띠 · 토스트"),
    ("--mj-text-inverse-sub", "--mj-surface-inverse", "text", "띠 보조 글자"),
    ("--mj-on-primary", "--mj-surface-inverse", "text", "띠 위 파란 배지 바깥(흰 글자 기준)"),
    ("--mj-proposed-text", "--mj-surface", "text", "제안한 날 글자"),
    ("--mj-on-proposed", "--mj-proposed", "text", "고른 제안 반나절"),
    ("--mj-holiday", "--mj-surface", "text", "일요일 · 공휴일 날짜"),
    ("--mj-holiday", "--mj-range-vendor", "text", "업체 가능 띠 안 일요일"),
    ("--mj-text-sub", "--mj-range-vendor", "text", "업체 가능 띠 안 날짜"),
    ("--mj-text", "--mj-range-wish", "text", "희망 기간 띠 안 날짜"),
    ("--mj-ext-pdf", "--mj-surface", "text", "파일 종류 PDF"),
    ("--mj-ext-xls", "--mj-surface", "text", "파일 종류 XLS"),
    ("--mj-ext-img", "--mj-surface", "text", "파일 종류 JPG"),
    ("--mj-avatar-fg", "--mj-avatar-bg", "text", "업체 · 고객 첫 글자"),
    ("--mj-avatar-warm-fg", "--mj-avatar-warm-bg", "text", "업체 상세 큰 얼굴"),
    ("--mj-text-inverse", "--mj-media-bg", "text", "사진 크게 보기 글자"),
    ("--mj-text-inverse-sub", "--mj-media-bg", "text", "사진 설명"),
    ("--mj-on-kakao", "--mj-kakao", "text", "카카오 단추(꺼진 모양이라 예외 · 참고)"),
    # 글자 아닌 것(테두리 · 아이콘 · 상태 표시)
    ("--mj-line-control", "--mj-surface", "ui", "입력 · 체크 · 끌어다 놓기 테두리"),
    ("--mj-line-control", "--mj-field-bg", "ui", "입력 테두리 안쪽"),
    ("--mj-line-control", "--mj-bg", "ui", "바탕 위 입력 테두리"),
    ("--mj-line-control", "--mj-fill", "ui", "나눔 칸 바닥 위 테두리"),
    ("--mj-focus", "--mj-surface", "ui", "초점 테두리"),
    ("--mj-focus", "--mj-bg", "ui", "바탕 위 초점 테두리"),
    ("--mj-primary", "--mj-surface", "ui", "고른 칩 · 가능 날 테두리 · 켜진 스위치"),
    ("--mj-primary", "--mj-primary-weak", "ui", "고른 칩 테두리(안쪽)"),
    ("--mj-primary", "--mj-fill", "ui", "고른 나눔 칸 테두리"),
    ("--mj-danger", "--mj-surface", "ui", "오류 칸 테두리"),
    ("--mj-st-todo", "--mj-surface", "ui", "상태 ● 할 일"),
    ("--mj-st-wait", "--mj-surface", "ui", "상태 ○ 기다림"),
    ("--mj-st-ok", "--mj-surface", "ui", "상태 ✓ 확정"),
    ("--mj-st-done", "--mj-surface", "ui", "상태 – 끝남"),
    ("--mj-st-late", "--mj-surface", "ui", "상태 ! 기한 지남"),
    ("--mj-st-todo", "--mj-primary-weak", "ui", "고른 줄 안 ● 할 일"),
    ("--mj-st-wait", "--mj-primary-weak", "ui", "고른 줄 안 ○ 기다림"),
    ("--mj-st-ok", "--mj-primary-weak", "ui", "고른 줄 안 ✓ 확정"),
    ("--mj-st-done", "--mj-primary-weak", "ui", "고른 줄 안 – 끝남"),
    ("--mj-st-late", "--mj-primary-weak", "ui", "고른 줄 안 ! 기한 지남"),
    ("--mj-proposed", "--mj-surface", "ui", "제안한 날 테두리"),
    ("--mj-proposed", "--mj-range-wish", "ui", "희망 띠 안 제안한 날 테두리"),
    ("--mj-proposed", "--mj-range-vendor", "ui", "업체 띠 안 제안한 날 테두리"),
    ("--mj-step-done", "--mj-surface", "ui", "단계 막대 · 끝난 단계"),
    ("--mj-step-now", "--mj-surface", "ui", "단계 막대 · 지금 단계"),
    ("--mj-accent-fill", "--mj-surface", "ui", "공정표 막대"),
    ("--mj-star", "--mj-surface", "ui", "별(리뷰 쓰기 고른 별)"),
    ("--mj-line-control", "--mj-white", "ui", "스위치 끔: 바탕과 동그라미"),
    ("--mj-count", "--mj-surface", "ui", "안 읽은 알림 점"),
]

# --nine: 9판 screens.css가 실제로 쓴 색을 같은 자리에 넣어 견줘요(바꾼 까닭 확인용)
NINE = {
    "--mj-text": "#191f28", "--mj-text-sub": "#4e5968", "--mj-text-mute": "#8b95a1",
    "--mj-text-placeholder": "#b0b8c1", "--mj-field-bg": "#f2f4f6", "--mj-fill": "#f2f4f6",
    "--mj-primary": "#3182f6", "--mj-on-primary-weak": "#3182f6", "--mj-primary-weak": "#e8f3ff",
    "--mj-link": "#3182f6", "--mj-focus": "#3182f6",
    "--mj-badge-now-fg": "#3182f6", "--mj-badge-now-bg": "#e8f3ff",
    "--mj-badge-wait-fg": "#e07b00", "--mj-badge-wait-bg": "#fff3e0",
    "--mj-badge-ok-fg": "#03a65e", "--mj-badge-ok-bg": "#e5f7ed",
    "--mj-badge-bad-fg": "#f04452", "--mj-badge-bad-bg": "#ffeeee",
    "--mj-badge-mute-fg": "#6b7684", "--mj-badge-mute-bg": "#f2f4f6",
    "--mj-danger": "#f04452", "--mj-count": "#f04452", "--mj-holiday": "#f04452",
    "--mj-line-control": "#d1d6db", "--mj-proposed": "#e07b00", "--mj-proposed-text": "#e07b00",
    "--mj-star": "#ffb800", "--mj-step-done": "#3182f6", "--mj-step-now": "#3182f6",
    "--mj-bg": "#f2f4f6", "--mj-surface-sub": "#f9fafb", "--mj-fill-strong": "#e5e8eb",
    "--mj-primary-weak-hover": "#c9e2ff", "--mj-range-wish": "#e8f3ff", "--mj-range-vendor": "#c9e2ff",
    "--mj-warn-weak": "#fff3e0", "--mj-on-warn-weak": "#9a5300",
    "--mj-danger-weak": "#ffeeee", "--mj-on-danger-weak": "#f04452",
    "--mj-surface-inverse": "#333d4b", "--mj-text-inverse-sub": "#c9d1db",
    "--mj-st-todo": "#1b64da", "--mj-st-wait": "#b35c00", "--mj-st-ok": "#027a45",
    "--mj-st-done": "#6b7684", "--mj-st-late": "#d6293a",
    "--mj-ext-pdf": "#f04452", "--mj-ext-xls": "#03a65e", "--mj-ext-img": "#3182f6",
    "--mj-avatar-bg": "#f2f4f6", "--mj-avatar-fg": "#4e5968",
    "--mj-avatar-warm-bg": "#f1ebe2", "--mj-avatar-warm-fg": "#7a5a32",
    "--mj-accent-fill": "#3182f6", "--mj-media-bg": "#0f1114",
}
NINE_EXTRA = [("--mj-field-bg", "--mj-surface", "ui", "9판 입력 칸: 테두리 없이 바탕색으로만 구분")]

TYPE_STEPS = {13, 14, 16, 18, 20, 28, 38}
HIT_TOKENS = {  # 이름: 최소 px
    "--mj-hit": 44, "--mj-btn-h-lg": 44, "--mj-btn-h-md": 44, "--mj-btn-h-sm": 40,
    "--mj-field-h": 44, "--mj-chip-h": 40, "--mj-seg-item-h": 40, "--mj-cal-cell-h": 40,
    "--mj-hit-min": 40,
}


def blocks(css: str) -> dict[str, dict[str, str]]:
    """선택자(+미디어 조건)마다 선언 모음. 주석은 지워요."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    out: dict[str, dict[str, str]] = {}

    def take(text: str, media: str = "") -> None:
        for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", text):
            key = (media + " " + sel.strip()).strip()
            decls = out.setdefault(key, {})
            for name, val in re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", body):
                decls[name] = val.strip()

    for media, inner in re.findall(r"@media([^{]+)\{((?:[^{}]*\{[^{}]*\})*)\s*\}", css):
        take(inner, "@media" + media.strip())
    take(re.sub(r"@media[^{]+\{(?:[^{}]*\{[^{}]*\})*\s*\}", "", css))
    return out


def resolve(name: str, env: dict[str, str], depth: int = 0) -> str:
    if depth > 20:
        raise ValueError(f"var() 고리가 너무 깊어요: {name}")
    val = env[name]
    m = re.fullmatch(r"var\((--[\w-]+)(?:\s*,\s*(.+))?\)", val)
    if m:
        ref, fallback = m.group(1), m.group(2)
        if ref in env:
            return resolve(ref, env, depth + 1)
        if fallback is not None:
            return fallback
        raise KeyError(f"{name} → {ref} 값이 없어요")
    return val


def lum(hex_: str) -> float:
    h = hex_.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def ratio(a: str, b: str) -> float:
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def px(val: str) -> float:
    m = re.fullmatch(r"([\d.]+)(px|rem)", val)
    if not m:
        raise ValueError(val)
    return float(m.group(1)) * (16 if m.group(2) == "rem" else 1)


def main() -> int:
    md = "--md" in sys.argv
    nine = "--nine" in sys.argv
    bl = blocks(CSS.read_text(encoding="utf-8"))
    base = bl[":root"]
    gray = bl[':root[data-canvas="gray"]']
    if nine:
        modes = {"9판 값(참고 · 회색 바탕)": {**base, **gray, **NINE}}
    else:
        modes = {"흰 바탕(기본)": dict(base), "회색 바탕(data-canvas=gray)": {**base, **gray}}
    fails = 0

    for mode, env in modes.items():
        rows = []
        for fg, bg, kind, where in PAIRS + (NINE_EXTRA if nine else []):
            a, b = resolve(fg, env), resolve(bg, env)
            r = ratio(a, b)
            need = 4.5 if kind == "text" else 3.0
            ok = r >= need
            fails += 0 if ok else 1
            rows.append((fg, a, bg, b, kind, need, r, ok, where))
        if md:
            print(f"\n#### {mode}\n")
            print("| 앞(글자 · 선) | 바탕 | 종류 | 기준 | 대비 | 결과 | 쓰는 곳 |")
            print("| --- | --- | --- | --- | --- | --- | --- |")
            for fg, a, bg, b, kind, need, r, ok, where in rows:
                k = "글자" if kind == "text" else "글자 아닌 것"
                print(f"| `{fg}` {a} | `{bg}` {b} | {k} | {need}:1 | {r:.2f}:1 | {'통과' if ok else '실패'} | {where} |")
        else:
            print(f"\n== {mode}")
            for fg, a, bg, b, kind, need, r, ok, where in rows:
                print(f"{'OK ' if ok else 'BAD'} {r:5.2f} (≥{need}) {fg} {a} on {bg} {b}  · {where}")
        low = min(rows, key=lambda x: x[6] / x[5])
        print(f"\n가장 아슬한 짝: {low[0]} / {low[2]} = {low[6]:.2f}:1 (기준 {low[5]}:1)")

    # 글자 크기: 1층 단계와 모든 미디어 블록의 2층 값이 7단계 안인지
    sizes = {k: px(v) for k, v in base.items() if k.startswith("--mj-size-")}
    bad_steps = sorted(set(sizes.values()) - TYPE_STEPS)
    used = set()
    for key, decls in bl.items():
        env = {**base, **decls}
        for k in decls:
            if k.startswith("--mj-type-"):
                used.add(px(resolve(k, env)))
    print(f"\n글자 크기 1층: {sorted(set(sizes.values()))} · 2층이 쓰는 값: {sorted(used)}")
    if bad_steps or not used <= TYPE_STEPS:
        print("글자 크기: 실패(7단계 밖 값이 있어요)")
        fails += 1
    else:
        print("글자 크기: 통과(13 · 14 · 16 · 18 · 20 · 28 · 38 안)")

    # 누를 곳
    hit_bad = []
    for key, decls in bl.items():
        for name, need in HIT_TOKENS.items():
            if name in decls and px(decls[name]) < need:
                hit_bad.append(f"{key} {name}={decls[name]} < {need}px")
    print("누를 곳 크기: " + ("통과(기본 44 · 촘촘한 곳 40 이상)" if not hit_bad else "실패 " + "; ".join(hit_bad)))
    fails += len(hit_bad)

    # KWCAG 2.2 '대각선 6.0mm'를 CSS px로 어림(폰 160px/in · 데스크톱 기준 96px/in 가정)
    side_mm = 6.0 / 2 ** 0.5
    for label, ppi in (("폰(160px/in)", 160), ("데스크톱(96px/in)", 96)):
        print(f"KWCAG 대각선 6.0mm ≈ 한 변 {side_mm:.2f}mm ≈ {side_mm / 25.4 * ppi:.1f}px · {label}")
    print(f"40px 칸의 대각선 · 폰: {40 * 2 ** 0.5 / 160 * 25.4:.1f}mm")

    print(f"\n실패 {fails}건")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
