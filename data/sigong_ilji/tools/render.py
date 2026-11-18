"""PDF → 쪽 지도용 축소판 · 읽기용 반쪽 이미지.

    python -I render.py <pdf> <작업 폴더> [쪽 번호 ...]

- thumb/sheetNN.png: 24쪽씩 한 장, 쪽 번호 표시 (쪽 번호를 주면 만들지 않음)
- img/pNNNL.png · img/pNNNR.png: 펼침면 왼쪽 · 오른쪽 220dpi
- 숫자 확인용 300dpi 자르기는 page.get_pixmap(dpi=300, clip=Rect)로 따로 한다
"""

import sys
from pathlib import Path

import pymupdf

DPI, PER_SHEET, W, H = 220, 24, 420, 300


def halves(doc, out: Path, pages) -> None:
    out.mkdir(parents=True, exist_ok=True)
    for n in pages:
        p = doc[n - 1]
        w, h = p.rect.width / 2, p.rect.height
        for side, x in (("L", 0), ("R", w)):
            p.get_pixmap(dpi=DPI, clip=pymupdf.Rect(x, 0, x + w, h)).save(
                out / f"p{n:03d}{side}.png"
            )


def sheets(doc, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    for s in range(0, len(doc), PER_SHEET):
        sheet = pymupdf.open()
        sp = sheet.new_page(width=W * 6, height=H * 4)
        for k, i in enumerate(range(s, min(s + PER_SHEET, len(doc)))):
            r = pymupdf.Rect((k % 6) * W, (k // 6) * H, (k % 6 + 1) * W, (k // 6 + 1) * H)
            sp.show_pdf_page(r, doc, i)
            sp.insert_text((r.x0 + 6, r.y0 + 16), str(i + 1), fontsize=16, color=(1, 0, 0))
        sp.get_pixmap(dpi=100).save(out / f"sheet{s // PER_SHEET + 1:02d}.png")


def main() -> None:
    pdf, work = Path(sys.argv[1]), Path(sys.argv[2])
    doc = pymupdf.open(pdf)
    pages = [int(x) for x in sys.argv[3:]] or range(1, len(doc) + 1)
    if not sys.argv[3:]:
        sheets(doc, work / "thumb")
    halves(doc, work / "img", pages)
    print(f"{len(pages)}쪽 이미지 완료")


if __name__ == "__main__":
    main()
