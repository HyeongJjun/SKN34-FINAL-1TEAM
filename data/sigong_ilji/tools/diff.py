"""1차 · 2차 읽기 비교 → 어긋난 곳 목록(md). 청크 경계 · 문맥 머리 · 띄어쓰기 · 기호는 무시하고 글자 · 숫자만 본다.

    python -I diff.py <a 폴더> <b 폴더> <출력 md>

- 쪽마다 두 읽기의 숫자 목록이 다르면 [숫자]로 먼저 적는다
- 글자가 다른 곳은 앞뒤 12자와 함께 적는다. 이 목록만 300dpi로 다시 본다
"""

import difflib
import json
import re
import sys
from pathlib import Path

KEEP = re.compile(r"[^0-9A-Za-z가-힣]")
NUM = re.compile(r"\d[\d,.]*")


def stream(f: Path) -> str:
    d = json.loads(f.read_text(encoding="utf-8"))
    body = []
    for c in d["chunks"]:
        lines = c["text"].strip().splitlines()
        if lines and lines[0].startswith("["):
            lines = lines[1:]  # 문맥 머리는 비교하지 않음
        body.append("\n".join(lines))
    return "\n".join(body)


def scope(trades: list[str]) -> str:
    own = [t for t in ("도배", "목공") if t in trades]
    return "+".join(own) if own else ("공통" if not trades else "범위밖")


def labels(f: Path) -> dict:
    cs = json.loads(f.read_text(encoding="utf-8"))["chunks"]
    return {
        "doc": sorted(c["doc"] for c in cs),
        # 검색은 도배 · 목공 / 공통 / 범위 밖만 구분하므로 그 단위로 비교
        "scope": sorted(scope(c.get("trades", [])) for c in cs),
    }


def label_diff(fa: Path, fb: Path) -> list[str]:
    la, lb = labels(fa), labels(fb)
    return [f"- [분류 {k}] 1차 {la[k]} / 2차 {lb[k]}" for k in la if la[k] != lb[k]]


def page_diff(a: str, b: str) -> list[str]:
    out = []
    na, nb = NUM.findall(a), NUM.findall(b)
    if sorted(na) != sorted(nb):
        only_a = sorted(set(na) - set(nb))
        only_b = sorted(set(nb) - set(na))
        out.append(f"- [숫자] 1차만 {only_a or '-'} / 2차만 {only_b or '-'}")
    sa, sb = KEEP.sub("", a), KEEP.sub("", b)
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, sa, sb, autojunk=False).get_opcodes():
        if op != "equal":
            ctx = sa[max(0, i1 - 12) : i1]
            out.append(f"- …{ctx}「{sa[i1:i2] or '∅'}」 ↔ 「{sb[j1:j2] or '∅'}」")
    return out


def main() -> None:
    a_dir, b_dir, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    lines, same, missing = ["# 1차 · 2차 비교", ""], 0, []
    for fa in sorted(a_dir.glob("p[0-9][0-9][0-9].json")):
        fb = b_dir / fa.name
        if not fb.exists():
            missing.append(fa.name)
            continue
        d = label_diff(fa, fb) + page_diff(stream(fa), stream(fb))
        if d:
            lines += [f"## {fa.stem}", *d, ""]
        else:
            same += 1
    extra = sorted(
        {f.name for f in b_dir.glob("p[0-9][0-9][0-9].json")}
        - {f.name for f in a_dir.glob("p*.json")}
    )
    lines += [
        f"같은 쪽 {same}개",
        f"2차 없음: {', '.join(missing) or '-'}",
        f"1차 없음: {', '.join(extra) or '-'}",
    ]
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{out.name}: 다른 쪽 {sum(1 for x in lines if x.startswith('## '))}개, 같은 쪽 {same}개")


if __name__ == "__main__":
    main()
