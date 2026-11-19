"""개선 2회차 카드 묶음: 데이터 담당 iter2 빠진 주제(gaps.json 26개)마다 새 조각(K21001~) · 관련 조각 · 지금 카드 목록. dev만.

cd backend && uv run --no-sync python ../evaluation/v3/round2_packs.py   # → .cache/packs_r2/cards_<묶음>.md
"""

import json

from common import CACHE, ROOT, utf8_stdout
from kb3 import kb

from app.knowledge.v3_csv import START2

GAPS = ROOT / "data/v3/knowledge/iter2/gaps.json"
CHUNKS = ROOT / "data/v3/knowledge/iter2/chunks.jsonl"
GROUPS = {"common": ("common",)}  # 나머지 공종은 'trades' 한 묶음
CUT = 700


def main() -> None:
    utf8_stdout()
    K = kb()
    gaps = json.loads(GAPS.read_text(encoding="utf-8"))["topics"]
    lines = [
        json.loads(x) for x in CHUNKS.read_text(encoding="utf-8-sig").splitlines() if x.strip()
    ]
    by_gap: dict[str, list[tuple[str, dict]]] = {}
    for i, c in enumerate(lines):
        by_gap.setdefault(c["gap"], []).append((f"K{START2 + i}", c))
    out = CACHE / "packs_r2"
    out.mkdir(parents=True, exist_ok=True)
    groups: dict[str, list[dict]] = {}
    for g in gaps:
        groups.setdefault(
            next((k for k, ts in GROUPS.items() if g["trade"] in ts), "trades"), []
        ).append(g)
    for name, gs in groups.items():
        trades = sorted({g["trade"] for g in gs} | {"common"})
        md = [
            f"# 카드 보강 묶음 2회차: {name} (iter2 빠진 주제, dev 판정에서 '확인하지 못했어요'가 난 유형)",
            "",
        ]
        md += [
            "## 지금 있는 카드(같은 주제면 새로 만들지 말고 '고쳐 쓰기'로: 같은 id · version + 1)",
            "",
        ]
        md += [
            f"- `{c.id}` (v{c.version}): {c.keys[0]}" for c in K.cards.cards if c.trade in trades
        ]
        md += ["", "## 주제와 근거", ""]
        for g in gs:
            md += [f"### {g['id']} [{g['trade']}] {g['kind']} · {g['name']}", ""]
            qs = [q["text"] for q in g.get("gap_questions", [])] + [
                x.split(": ", 1)[-1] for x in g.get("dev_examples", [])
            ]
            md.append(
                "- 이런 질문에 답하지 못했어요(그대로 열쇠로 쓰지 말고 말을 바꿔요): "
                + " / ".join(dict.fromkeys(qs))
            )
            for ref, c in by_gap.get(g["id"], []):
                md.append(
                    f"- **{ref}** (새 조각 · {c['source_name'][:40]} · {c.get('clause') or ''}): {c['summary'][:CUT]}"
                )
                if c.get("answers"):
                    md.append(
                        f"  - 데이터 담당이 적은 고객 말투 질문: {' / '.join(c['answers'][:6])}"
                    )
                for r in c.get("related_ref") or []:
                    it = K.ix.by_ref.get(r)
                    if it is not None:
                        book = " ⚠책" if it.doc.kind == "book" else ""
                        md.append(
                            f"  - 관련 **{r}**{book} ({it.doc.kind} · {it.doc.title[:30]}): {it.chunk.text.replace(chr(10), ' ')[:400]}"
                        )
            md.append("")
        (out / f"cards_{name}.md").write_text("\n".join(md), encoding="utf-8")
        print(f"{name}: 주제 {len(gs)} · 새 조각 {sum(len(by_gap.get(g['id'], [])) for g in gs)}")


if __name__ == "__main__":
    main()
