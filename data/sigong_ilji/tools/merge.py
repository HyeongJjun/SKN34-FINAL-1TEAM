"""쪽별 JSON(pNNN.json) → json_csv 입력 JSON. 번호 · id를 여기서 매긴다.

    python -I merge.py <쪽 JSON 폴더> <출력 JSON> [joins.json]
    cd backend && uv run python -m app.knowledge.json_csv <출력 JSON> ../data/local/sigong_ilji_rag.csv

- 번호 K6000 + 쪽×50 + 쪽 JSON 원래 순번(1~49), id sigong-p007-03. 한 쪽 49조각을 넘으면 멈춘다(번호 겹침 방지).
  쪽 경계 잇기로 앞 쪽에 합쳐진 조각의 번호는 비워 둔다(다른 조각 번호가 밀리지 않게)
- doc: book → 시공 안내서(kind book), cases → 사례 · 설문(kind platform, 비용 · 법 · 안전 질문에서 빠짐)
- sec · 문맥 머리의 "■ " 기호는 지우고, 문맥 머리는 sec로 다시 쓴다
- 쪽 경계 잇기: joins.json {"p096": ""}에 적은 쪽의 마지막 조각을 다음 쪽 첫 조각과 합친다(page [앞, 뒤], 사이 글자 = 값).
  출처 줄은 합친 조각 끝으로 옮긴다. 적지 않은 경계 중 sec가 같고 문장부호로 끝나지 않는 곳은 확인용으로 보여 준다
"""

import json
import re
import sys
from itertools import pairwise
from pathlib import Path

BASE, PER = 6000, 50
# source 열은 원본 자료명 하나(두 문서 같은 제목), sha256은 원본 PDF 해시(#133 json_csv가 문서별 해시를 쓰면 반영)
PDF_SHA = "65eced5777b0bbc3cda2c8763c2bb8b652934531607046a238711b818b2a5571"
_DOC = {"title": "시공일지", "pub": "", "url": "", "rel": "", "date": "", "sha256": PDF_SHA}
DOCS = {"sigong-ilji": _DOC | {"kind": "book"}, "sigong-ilji-cases": _DOC | {"kind": "platform"}}
DOC = {"book": "sigong-ilji", "cases": "sigong-ilji-cases"}
TOPICS = {"budget", "table", "case_note", "case_summary", "quote_review", "checklist", "general"}
END = re.compile(r"[.?!。…”’\"')\]]\s*$")


# 원 뒤에 조사(을 · 이 …)가 붙어도 금액으로 본다. \b는 한글 조사 앞에서 걸리지 않아 쓰지 않는다 ("3원칙"은 금액 아님)
MONEY = re.compile(
    r"\d[\d,]*\s*(만|억|천)\s*원|\d[\d,]*\s*원(?=[을이은에도과의만씩\s.,)~/]|$)|\d+억"
)
TALK = re.compile(r"^.*?(크리에이터 인터뷰|시공 선배 이야기)\s*>\s*")


def clean_sec(sec: str) -> str:
    sec = re.sub(r"\s*■\s*", " ", sec).strip().replace("  ", " ")
    return TALK.sub(r"\1 > ", sec)  # 인터뷰 앞에 붙은 Q 제목 지우기 (형식 통일)


def body(text: str, sec: str) -> str:
    lines = text.strip().splitlines()
    if lines and lines[0].startswith("["):
        lines = lines[1:]
    last = sec.split(" > ")[-1].strip()
    if lines and lines[0].strip(" ■") in (last, "공통 의견"):
        lines = lines[1:]  # 문맥 머리와 겹치는 제목 줄 (형식 통일)
    return "\n".join(lines).strip()


def load(f: Path) -> tuple[int, list[dict]]:
    d = json.loads(f.read_text(encoding="utf-8"))
    p, cs = d["page"], d["chunks"]
    assert f.stem == f"p{p:03d}", f"{f.name}: 파일 이름과 page({p})가 달라요"
    out = []
    for i, c in enumerate(cs, 1):
        where = f"{f.name} {i}번"
        assert c["text"].strip() and c["sec"].strip(), f"{where}: 본문 · 절이 비었어요"
        assert c["doc"] in DOC, f"{where}: doc은 book · cases 중 하나"
        assert set(c.get("topics", [])) <= TOPICS, f"{where}: 모르는 topics"
        sec = clean_sec(c["sec"])
        text = body(c["text"], sec)
        # 금액이 들어간 조각은 출처와 상관없이 cases (상담 금액은 계산 엔진만)
        doc = "cases" if MONEY.search(text) else c["doc"]
        out.append(
            {
                "n": i, "doc": doc, "sec": sec, "body": text, "pages": [p],  # n: 쪽 안 원래 순번 (번호용)
                "trades": list(c.get("trades", [])), "topics": list(c.get("topics", []))[:1],  # category 한 값 (#133)
                "hints": list(c.get("hints", [])),
            }
        )  # fmt: skip
    return p, out


SRC = re.compile(r"\n출처: [^\n]*$")


def split_src(text: str) -> tuple[str, str]:
    m = SRC.search(text)
    return (text[: m.start()], m.group(0)) if m else (text, "")


def join(pages: list[tuple[int, list[dict]]], joins: dict[str, str]) -> list[str]:
    """joins.json에 적은 쪽만 다음 쪽 첫 조각과 합친다. 합칠 만해 보이는 나머지 경계는 목록으로 돌려준다"""
    maybe = []
    for (p, prev), (_, nxt) in pairwise(pages):
        if not prev or not nxt:
            continue
        a, b = prev[-1], nxt[0]
        a_body, a_src = split_src(a["body"])
        b_body, b_src = split_src(b["body"])
        key = f"p{p:03d}"
        if key not in joins:
            if a["sec"] == b["sec"] and not END.search(a_body):
                maybe.append(f"{key}: …{a_body[-15:]} | {b_body[:15]}…")
            continue
        assert a["sec"] == b["sec"], f"{key}: 다음 쪽 첫 조각과 sec가 달라요"
        a["body"] = a_body + joins[key] + b_body + (b_src or a_src)
        a["pages"] += b["pages"]
        for k in ("trades", "hints"):  # topics는 앞 조각 한 값 유지
            a[k] += [x for x in b[k] if x not in a[k]]
        nxt.pop(0)
    return maybe


def main() -> None:
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    joins = json.loads(Path(sys.argv[3]).read_text(encoding="utf-8")) if len(sys.argv) > 3 else {}
    pages = [load(f) for f in sorted(src.glob("p[0-9][0-9][0-9].json"))]
    maybe = join(pages, joins)
    if maybe:
        print('합칠지 볼 경계 (joins.json에 "" 붙임 · " " 띄움 · "\\n" 줄바꿈):', *maybe, sep="\n")
    chunks = []
    for p, cs in pages:
        # 번호는 쪽 JSON의 원래 순번으로 매긴다. 쪽 경계 잇기로 빠진 조각 자리는 빈 번호로 남아
        # joins.json을 바꿔도 다른 조각의 번호(평가 정답이 가리키는 K번호)가 밀리지 않는다
        for c in cs:
            i = c["n"]
            assert i < PER, f"p{p:03d}: {i}번 조각 ({PER - 1}번까지)"
            chunks.append(
                {
                    "k": f"K{BASE + p * PER + i}", "id": f"sigong-p{p:03d}-{i:02d}", "doc": DOC[c["doc"]],
                    "text": f"[{c['sec']}]\n{c['body']}", "sec": c["sec"], "page": c["pages"],
                    "trades": c["trades"], "topics": c["topics"], "hints": c["hints"],
                }
            )  # fmt: skip
    out.write_text(
        json.dumps({"version": 1, "docs": DOCS, "chunks": chunks}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"{out.name}: {len(chunks)}조각")


if __name__ == "__main__":
    main()
