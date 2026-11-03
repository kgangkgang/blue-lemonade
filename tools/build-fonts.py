#!/usr/bin/env python3
"""글꼴 로컬 woff2 만들기 (9.0.9) — tools/build-fonts.py

기본 글꼴 목록(src/catalog.js)의 글꼴 2개(프리젠테이션 · 갈무리모노11)를 jsDelivr 에서 받던 것을
테마 안 fonts/ 의 woff2 조각으로 바꿔요. 1.0.0: 리디바탕은 담지 않아요 — 글꼴 파일에 라이선스 칸이 없어 수정본을 다시 배포할 근거가 약해서,
목록 · 기본값은 그대로 두고 다른 목록 글꼴처럼 공개 배포 주소(jsDelivr noonnu)에서 받아요. 조각은 글자 갈래별로 나눠 unicode-range 로 필요한 것만 받게 해요.

  latin   영문 · 숫자 · 문장 부호(일반 구두점 · 화살표 포함)
  ko      한글 자모 · CJK 구두점 · 전각 · KS X 1001 완성형 2,350자 (한국어 글 대부분이 여기서 끝나요)
  ko2     나머지 완성형 한글 · 옛 자모 (드문 글자 — 그 글자가 화면에 나올 때만 받아요)
  rest    그 밖에 글꼴에 든 글자(한자 · 가나 · 기호 …)

ko 와 ko2 는 둘 다 한글 완성형 블록(U+AC00-D7A3)을 맡는다고 적고, CSS 에는 ko2 를 먼저 · ko 를 나중에 써요.
같은 가족 안에서 범위가 겹치면 브라우저는 뒤에 적힌 것부터 보고, 그 조각에 글자가 없을 때만 다음 조각을 받아요
(CSS Fonts 4 「unicode-range 가 겹치면 나중 규칙부터」). 그래서 2,350자 목록을 unicode-range 에 길게 적지 않아도 돼요.

원본은 아래 SOURCES 의 주소 · sha256 으로 고정해요. 둘 다 원본 글꼴의 name 표 13 · 14 칸에 SIL Open Font License 1.1 이 적혀 있어요(fonts/LICENSE-OFL.txt).
OFL 은 수정 · 재배포를 허락하고, 조각으로 나눈 것은 수정본이라 글꼴 안 이름(name 표 1 · 3 · 4 · 6 · 16 · 17)을
「Salty <id> <조각>」으로 바꿔 원래 이름을 쓰지 않아요(예약 글꼴 이름 조항 대비). 저작권 · 라이선스 칸은 원본 그대로 두고,
원본에 라이선스 칸(13 · 14)이 없으면 만들기를 멈춰요 — 라이선스 문구를 우리가 글꼴에 써넣지 않아요.

  python tools/build-fonts.py [--cache 폴더]     fonts/ · fonts/SOURCES.json · src/fonts-local.gen.js 를 다시 써요
  (fontTools · brotli 필요: pip install fonttools brotli. 같은 원본 · 같은 fontTools 면 같은 바이트가 나와요)
"""
import argparse
import hashlib
import json
import sys
import tempfile
import unicodedata
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'fonts'
GEN = ROOT / 'src' / 'fonts-local.gen.js'

SOURCES = [
    dict(id='freesentation', weight=400, url='https://cdn.jsdelivr.net/gh/projectnoonnu/2404@1.0/Freesentation-4Regular.woff2',
         sha256='e5226655ccd69e9607ea9c11580f53efd10bbc5051b13fe38368944f0f30290d',
         copyright='Copyright (c) 2024 PT& (Lee Juim)', license='OFL-1.1', license_note='글꼴 name 표 13 · 14 칸: SIL Open Font License 1.1'),
    dict(id='freesentation', weight=700, url='https://cdn.jsdelivr.net/gh/projectnoonnu/2404@1.0/Freesentation-7Bold.woff2',
         sha256='b31687c4d07206062b05581cd61bb97c16ddf8089eae8a332bc61b77fd906df1',
         copyright='Copyright (c) 2024 PT& (Lee Juim)', license='OFL-1.1', license_note='글꼴 name 표 13 · 14 칸: SIL Open Font License 1.1'),
    dict(id='galmurimono11', weight=400, url='https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/GalmuriMono11.woff2',
         sha256='a8cce715cd74367b3af0e8b36a6358448a58f949454f3d3e6bcc520567cdb9b2',
         copyright='Copyright (c) 2019-2025 Lee Minseo (quiple@quiple.dev)', license='OFL-1.1', license_note='글꼴 name 표 13 · 14 칸과 galmuri@2.40.3/ofl.md: SIL Open Font License 1.1, 예약 글꼴 이름 없음'),
]

HANGUL = (0xAC00, 0xD7A3)
LATIN = [(0x0000, 0x02FF), (0x0300, 0x036F), (0x1E00, 0x1EFF), (0x2000, 0x206F), (0x20A0, 0x20CF), (0x2100, 0x214F),
         (0x2190, 0x21FF), (0x2212, 0x2212), (0xFB00, 0xFB4F), (0xFEFF, 0xFEFF), (0xFFFD, 0xFFFD)]
KO_EXTRA = [(0x3000, 0x303F), (0x3130, 0x318F), (0xFF00, 0xFFEF)]   # 자모 · 구두점 · 전각 — 2,350자와 같은 조각
KO2_EXTRA = [(0x1100, 0x11FF), (0xA960, 0xA97F), (0xD7B0, 0xD7FF)]  # 옛 자모 — 드문 한글과 같은 조각
GAP = 32   # rest 조각의 범위 적기: 이만큼 안쪽의 빈 칸은 이어서 적어요(목록을 짧게 · 없는 글자는 다음 글꼴로 넘어가요)


def ksx1001(cp):
    # 파이썬 euc_kr 은 2,350자 밖의 글자를 8바이트 자모 조합(KS X 1001 부속서 3)으로 적어요 — 2바이트인 것만 완성형이에요
    try:
        return len(chr(cp).encode('euc_kr')) == 2
    except UnicodeEncodeError:
        return False


def inside(cp, ranges):
    return any(a <= cp <= b for a, b in ranges)


def compress(cps, gap=0):
    out = []
    for cp in sorted(cps):
        if out and cp - out[-1][1] <= gap + 1:
            out[-1][1] = cp
        else:
            out.append([cp, cp])
    return out


def fmt(ranges):
    return ', '.join(f'U+{a:X}' if a == b else f'U+{a:X}-{b:X}' for a, b in ranges)


def fetch(src, cache):
    path = cache / (hashlib.sha256(src['url'].encode()).hexdigest()[:16] + Path(src['url']).suffix)
    if not path.is_file():
        with urllib.request.urlopen(src['url'], timeout=60) as res:
            path.write_bytes(res.read())
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != src['sha256']:
        raise SystemExit(f'원본 해시가 달라요: {src["url"]} {digest}')
    return path


def parts_of(cmap):
    """글꼴의 글자 → 조각별 (글자 집합, unicode-range 목록). 순서 = CSS 에 적는 순서 (ko2 가 ko 앞)"""
    cps = set(cmap)
    latin = {cp for cp in cps if inside(cp, LATIN)}
    hangul = {cp for cp in cps if HANGUL[0] <= cp <= HANGUL[1]}
    ko = {cp for cp in hangul if ksx1001(cp)} | {cp for cp in cps if inside(cp, KO_EXTRA)}
    ko2 = (hangul - ko) | {cp for cp in cps if inside(cp, KO2_EXTRA)}
    rest = cps - latin - ko - ko2
    declared = lambda chars, blocks: [[a, b] for a, b in blocks if any(a <= cp <= b for cp in chars)]
    parts = [
        ('latin', latin, compress(latin, GAP)),
        ('ko2', ko2, declared(ko2, [*KO2_EXTRA, HANGUL])),
        ('ko', ko, declared(ko, [*KO_EXTRA, HANGUL])),
        ('rest', rest, compress(rest, GAP)),
    ]
    return [p for p in parts if p[1]]


# src/fonts.js blankScripts 가 부팅 때 캔버스로 하던 검사를 빌드 때: 표본 글자가 글꼴에 있으면 그림이 비어 있지 않아야 해요
# (빈 글리프면 브라우저가 다음 글꼴로 넘기지 않고 빈칸으로 그려요). 통과한 글꼴은 catalog.js 에서 probe: false 로 부팅 검사를 건너뛰어요
PROBE = '愛早美あアAg'


def check_blank(font, label):
    from fontTools.pens.boundsPen import BoundsPen
    cmap, glyphs = font.getBestCmap(), font.getGlyphSet()
    for ch in PROBE:
        name = cmap.get(ord(ch))
        if name is None:
            continue
        pen = BoundsPen(glyphs)
        glyphs[name].draw(pen)
        if pen.bounds is None:
            raise SystemExit(f'{label}: 표본 글자 {ch} 가 빈 글리프예요 — probe: false 로 둘 수 없어요')


def rename(font, fid, part, src):
    name = font['name']
    family, ps = f'Salty {fid} {part}', f'Salty-{fid}-{part}-{src["weight"]}'
    style = 'Bold' if src['weight'] >= 700 else 'Regular'
    for nid in (1, 3, 4, 6, 16, 17):
        name.removeNames(nameID=nid)
    for nid, text in ((1, family), (2, style), (3, ps), (4, f'{family} {style}'), (6, ps)):
        name.removeNames(nameID=nid)
        name.setName(text, nid, 3, 1, 0x409)
    if not name.getDebugName(0):
        name.setName(src['copyright'], 0, 3, 1, 0x409)
    # 1.0.0: 라이선스 칸은 원본에 있을 때만 — 없으면 멈춰요 (예전엔 비어 있으면 OFL 문구를 써넣었어요)
    if not name.getDebugName(13) or not name.getDebugName(14):
        raise SystemExit(f'{src["url"]}: 글꼴 안에 라이선스 칸(name 13 · 14)이 없어요 — 담지 말고 배포 주소에서 받게 두세요')


def main():
    try:
        from fontTools import subset
        from fontTools.ttLib import TTFont
    except ImportError:
        raise SystemExit('fontTools 가 없어요: pip install fonttools brotli')
    import logging
    logging.getLogger('fontTools.subset').setLevel(logging.ERROR)   # 'FFTM NOT subset' (FontForge 만든 날짜 표 — 버려도 돼요)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=Path(tempfile.gettempdir()) / 'bl-font-src')
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(exist_ok=True)
    catalog, gen = [], {}
    for src in SOURCES:
        path = fetch(src, args.cache)
        base = TTFont(path)
        check_blank(base, src['url'])
        cmap = base.getBestCmap()
        files = []
        for part, chars, ranges in parts_of(cmap):
            font = TTFont(path, recalcTimestamp=False)   # 만든 시각을 안 바꿔야 다시 돌려도 같은 바이트
            opts = subset.Options()
            opts.flavor = 'woff2'
            opts.layout_features = ['*']
            opts.name_IDs = ['*']
            opts.name_languages = ['*']
            opts.name_legacy = True
            opts.notdef_outline = True
            opts.legacy_kern = True
            opts.glyph_names = False
            sub = subset.Subsetter(opts)
            sub.populate(unicodes=sorted(chars))
            sub.subset(font)
            rename(font, src['id'], part, src)
            out = OUT / f'{src["id"]}-{src["weight"]}-{part}.woff2'
            font.flavor = 'woff2'
            font.save(out)
            data = out.read_bytes()
            files.append(dict(file=out.name, part=part, chars=len(chars), bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), range=fmt(ranges)))
            gen.setdefault(src['id'], []).append(dict(file=out.name, part=part, weight=src['weight'], range=fmt(ranges)))
        catalog.append(dict(id=src['id'], weight=src['weight'], url=src['url'], sha256=src['sha256'], bytes=path.stat().st_size,
                            copyright=src['copyright'], license=src['license'], licenseNote=src['license_note'], files=files))
    (OUT / 'SOURCES.json').write_text(json.dumps(dict(
        note='tools/build-fonts.py 가 만든 파일 — 원본 주소 · 해시 · 저작권 · 라이선스와 조각별 범위. 라이선스 전문은 LICENSE-OFL.txt',
        fonts=catalog), ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    lines = ['// tools/build-fonts.py 가 만든 파일 — 고치지 말고 그 도구를 다시 돌려요 (9.0.9 글꼴 로컬 woff2)',
             '// 글꼴 id → fonts/ 조각 [{ file, part, weight, range }]. 같은 가족에서 ko2 가 ko 앞(범위가 겹치면 뒤에 적힌 ko 부터 봐요)',
             'export const LOCAL_FONT_FILES = Object.freeze({']
    for fid, items in gen.items():
        lines.append(f'    {fid}: Object.freeze([')
        for item in items:
            lines.append(f'        Object.freeze({{ file: {json.dumps(item["file"])}, part: {json.dumps(item["part"])}, weight: {item["weight"]}, range: {json.dumps(item["range"])} }}),')
        lines.append('    ]),')
    lines.append('});')
    GEN.write_text('\n'.join(lines) + '\n', encoding='utf-8', newline='\n')
    for item in catalog:
        print(item['id'], item['weight'], f'{item["bytes"] / 1024:.0f}KB →', ' · '.join(f'{f["part"]} {f["bytes"] / 1024:.0f}KB({f["chars"]}자)' for f in item['files']))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
