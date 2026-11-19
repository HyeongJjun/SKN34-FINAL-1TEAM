"""카드 쓰기 묶음 만들기: 공종마다 주제 후보(dev 질문 · 조각 예시 질문)와 근거 조각을 한 파일로. LLM · DB 없음.

    cd backend && .venv/Scripts/python.exe ../evaluation/v3/card_packs.py

- 주제 후보: data/v3/questions/<공종>.jsonl 중 dev만(held-out은 카드 쓰기에 쓰지 않음) + 그 공종 조각의 예시 질문(hints)
- 근거: 후보마다 v3 검색(search3, 공종 무게) 위 6개를 모아 많이 걸린 조각부터. 책(시공 안내서) 조각은 표시
- 출력: evaluation/v3/.cache/packs/<공종>.md (git 밖) · 카드 쓰는 하위 에이전트가 이 파일만 보고 쓴다
"""

import json
from collections import Counter

from common import CACHE, ROOT, corpus_path, jsonl, utf8_stdout
from rank_server import load_index

from app.agent.v3.trades import BY_CODE, SPECS, TAG_TO_CODE
from app.knowledge import search3

OUT = CACHE / "packs"
QDIR = ROOT / "data/v3/questions"
TARGET = {"common": 52, "dobae": 52, "mokgong": 44}
MAX_CHUNKS = {"common": 150, "dobae": 140, "mokgong": 140}
TEXT_CUT = 480


def main() -> None:
    utf8_stdout()
    ix = load_index(corpus_path())
    sc = search3.scopes(ix, TAG_TO_CODE)
    OUT.mkdir(parents=True, exist_ok=True)
    for spec in SPECS:
        code = spec.code
        qfile = QDIR / f"{code}.jsonl"
        dev = [q for q in jsonl(qfile) if q.get("split") == "dev"] if qfile.exists() else []
        hints = []
        for x in ix.items:
            if code in sc[x.chunk.ref]:
                hints.extend(h.strip() for h in x.chunk.hints if h.strip())
        hints = list(dict.fromkeys(hints))[:140]
        cands = [("dev " + q.get("intent", ""), q["text"]) for q in dev] + [
            ("예시", h) for h in hints
        ]
        want = [] if code == "common" else [code]
        hit_count: Counter[str] = Counter()
        lines = []
        for tag, text in cands:
            r = search3.search(ix, text, trades=want, tags=TAG_TO_CODE, k=6)
            refs = [h.ref for h in r.hits]
            hit_count.update(refs)
            lines.append(f"- [{tag}] {text} → {' '.join(refs)}{'' if r.enough else ' (자료 약함)'}")
        # 이 공종(또는 공통) 표시가 있는 조각을 먼저, 많이 걸린 순
        refs = sorted(hit_count, key=lambda r: (code not in sc[r], -hit_count[r]))
        refs = refs[: MAX_CHUNKS.get(code, 80)]
        body = [
            f"# 카드 쓰기 묶음: {spec.ko} ({code}) — 목표 {TARGET.get(code, 17)}장",
            "",
            f"- 깊이: {spec.depth} · 주제 후보 {len(cands)}개(dev 질문 {len(dev)} · 예시 질문 {len(hints)}) · 근거 조각 {len(refs)}개",
            "- 규칙은 _rules.md. 근거 조각에 없는 내용은 쓰지 않아요.",
            "",
            "## 주제 후보 → 검색 위 6개 조각",
            *lines,
            "",
            "## 근거 조각 (번호 · 출처 종류 · 문서 · 절 · 공종 표시)",
        ]
        for ref in refs:
            x = ix.by_ref[ref]
            kind = x.doc.kind + (
                " ⚠책: 화면에 원문 안 보임, 요지로만" if x.doc.kind == "book" else ""
            )
            tags = ",".join(sorted(sc[ref]))
            text = x.chunk.text.replace("\n", " ")
            text = text[:TEXT_CUT] + ("…" if len(text) > TEXT_CUT else "")
            body += [
                "",
                f"### {ref} · {kind} · {x.doc.title[:60]} · {x.chunk.sec[:50]} · [{tags}]",
                text,
            ]
        (OUT / f"{code}.md").write_text("\n".join(body) + "\n", encoding="utf-8")
        print(f"{code}: 후보 {len(cands)} · 조각 {len(refs)} · {len(''.join(body)):,}자")
    meta = {
        "corpus": ix.version,
        "codes": [s.code for s in SPECS],
        "depth": {s.code: BY_CODE[s.code].depth for s in SPECS},
    }
    (OUT / "_meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
