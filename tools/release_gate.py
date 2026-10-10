"""Read-only release gate and deterministic ZIP builder. Python standard library only."""
import argparse
import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import re
import subprocess
import uuid
import zipfile


class GateError(ValueError):
    pass

# wings*.webp belonged to the retired feather / butterfly weather and is no longer shipped.
WEATHER_ARTWORK = tuple(f'{pack}{style}.webp' for pack in ('nature', 'light') for style in ('', '-anime', '-cel'))
PREVIEW_ARTWORK = ('ade-game.webp', 'ade-lemon.webp', 'ade-cat.webp', 'ade-nap.webp', 'ade-rain.webp', 'character.webp')

# Only this reviewed, pinned sound pack may enter a public release. Never sweep
# arbitrary local recordings or trust a catalog path when constructing inventory.
TTS_SFX_FILES = tuple('''bell.mp3 bell_2.mp3 box_open.mp3 bullet_hit.mp3 clang.mp3 dishes.mp3
door_close.mp3 door_creak.mp3 door_creak_2.mp3 door_open.mp3 door_open_2.mp3
door_slam.mp3 door_slam_2.mp3 drop.mp3 explosion.mp3 footsteps.mp3 footsteps_wet.mp3
footsteps_wood.mp3 glass_break.mp3 glass_break_2.mp3 glass_clink.mp3 gong.mp3
gunshot.mp3 gunshot_2.mp3 gunshot_3.mp3 impact.mp3 impact_2.mp3 key.mp3 knock.mp3
knock_2.mp3 paper.mp3 pickup.mp3 pistol.mp3 pot.mp3 punch.mp3 running.mp3 shotgun.mp3
smash.mp3 splash.mp3 stones.mp3 switch.mp3 thud.mp3 thunder.mp3 unlock.mp3 whoosh.mp3
wind.mp3 wood_crack.mp3'''.split())
TTS_SFX_REPOSITORY = 'https://github.com/JINSIN2/MultiCast-TTS'
TTS_SFX_COMMIT = 'f48ebeef9b19d814bf8d4568af13613544007e63'
TTS_SFX_RESOURCES = ('LICENSE-MultiCast.txt', 'NOTICE.md', 'sfx/SOURCES.json', 'script-editor.css')

# Reviewed everyday additions. Keep filenames and origins independent of the
# shipped catalog so a local recording cannot join the release by editing JSON.
TTS_EXTRA_BIGSOUNDBANK = {
    'daily_cat_purr': ('cat-purr-s0436.html', 'Joseph SARDIN'),
    'daily_cat_meow': ('miaulement-chat-2-s1890.html', 'Joseph SARDIN'),
    'daily_water_pour': ('cold-water-in-a-mug-2-s3314.html', 'Joseph SARDIN'),
    'daily_faucet': ('faucet-hands-s0041.html', 'Joseph SARDIN'),
    'daily_stream': ('small-cascade-s0507.html', 'Joseph SARDIN'),
    'daily_rain': ('rain-on-puddle-s1290.html', 'Joseph SARDIN'),
    'daily_keyboard': ('computer-keyboard-s0229.html', 'Joseph SARDIN'),
    'daily_zipper': ('zip-1-s0014.html', 'Joseph SARDIN'),
    'daily_clock': ('clock-s0007.html', 'Joseph SARDIN'),
    'daily_coffee_stir': ('spoon-into-a-mug-of-coffee-s0410.html', 'Joseph SARDIN'),
    'daily_cup': ('cup-on-a-table-s0627.html', 'cecilegatina'),
    'daily_coins': ('coins-1-s0193.html', 'Joseph SARDIN'),
}
TTS_EXTRA_GONGU = {'daily_scissors': '13263912', 'daily_snack_bag': '13263932',
                   'daily_soup': '13263933', 'daily_ladle': '13263935'}
TTS_EXTRA_IDS = tuple(TTS_EXTRA_BIGSOUNDBANK) + tuple(TTS_EXTRA_GONGU)
TTS_EXTRA_RESOURCES = ('sfx-extra/SOURCES.json', 'sfx-extra/LICENSE-CC0.txt', 'sfx-extra/LICENSE-CC-BY.txt')
TTS_EXTRA_MODULE = 'src/addons/tts/src/sfx-daily.js'

# Reviewed 2026-10-10 originals and selected single-action/short-ambience exports.
TTS_EXTRA_SHA256 = {
    'daily_cat_purr': '6d983eda87f313e9f952a69d596748e56da40862d56ef6824f2e411792e95fda',
    'daily_cat_meow': 'c89166f6767b92dfb65de464eb5ae117ea5f0274439f75e02233bd01c0748f43',
    'daily_water_pour': '16c9c2f8dc7cc9d616173439d872e89f1bf2fbaeb60ff07d341b585dea5ebeec',
    'daily_faucet': '8e953a92ddd2c0c6b64ff20cdc59487ea9beaa225295ce530ee968cd457f0944',
    'daily_stream': '4683a7b7c248b1f94557c99365861103027a4017d1972761def12bf97bd95012',
    'daily_rain': '8824a63c4a891163348d7a0012c02629c24773b49a9110ce221b02abc7a864cd',
    'daily_keyboard': 'b4b0b1b8c7ab7b78f21e6bc563d79004365c52c0350a8fd41ac4ea0670231c1f',
    'daily_zipper': '59fe614a2b361abfb95b5f612c73e75768000b5b4b97a5c1d97c519d74f3d337',
    'daily_clock': '153b80ae0facf735aafc71bfb3b36582cc41dedb692401413cb5ead65896e1aa',
    'daily_coffee_stir': '4314a8bbd18f715898ab9a2a2b813da50a73695191689966877af4e473397f57',
    'daily_cup': 'a5594e574bd3ce038d594ce34034a539932d709980e5bde0857d2ec6ffa3d2d5',
    'daily_coins': 'c25336583df688e4bf90393dfaec5cbefba712ffd064ae61327365cfe70354c2',
    'daily_scissors': 'd1d7ec1e00e45d4f1705e566c2af671113bf61b54d8cff80e6f8f9347e375255',
    'daily_snack_bag': '1f30a7022ceacb130c20646e3fd977792f89783d187ed233a28810795f53bfdc',
    'daily_soup': '8a4a3c985618c6f25c3ccab5b2be3ccbf2c9255f52bf7a69f4df5ba808d69638',
    'daily_ladle': '546d04638480e1a9a0cb899d71a8922e0766348704093f38acf71f7e36c56810',
}
TTS_EXTRA_SOURCE_SHA256 = {
    'daily_cat_purr': '1809316c24ddd40363201bdf09d1f43ae72a275c2510c552c286fee0ec53cac5',
    'daily_cat_meow': '87fb2d293e3d6ac6bf36b3d2910bc11df9155fe8b196fc273e2e4e52b950f4a2',
    'daily_water_pour': '28b10f2f09d0cf4e0064663f7a3539fdf04ce5ef1329a300be482be35e281f20',
    'daily_faucet': '019ae09ac333b50588c4cdc68adf08121209a2679104775ed3e1ee715dbbe023',
    'daily_stream': '3e6fbaa07e8ef92ba2905f90105f959fba0362b69d8695cafe59b77b5bbd3106',
    'daily_rain': 'aa5a6824c92440431ec38b3de692a941b61fdfa3c29c69b14307651000269360',
    'daily_keyboard': 'ee2265725caf7b68e339e5d8ab76e59e0957a9d80a8db62f06753352205bb066',
    'daily_zipper': '946f17d34d1ae19d35a789a8520c16fb6a8bb04874ce2af5368eacb381e730eb',
    'daily_clock': '86d8c2af45b11f2abc7ba09acd060d02665e52cebeca162dfde478fcf1c86458',
    'daily_coffee_stir': 'a0f0adc43205ec0e335b58a2fa62c2a636c67da4cb62229df02a36d2ff9203ab',
    'daily_cup': '7df9020013eef48851760d08ccad0ef80e289b9c4e5f3fce11fb18b5922930b7',
    'daily_coins': '63a208f2934fa49e9a9882adec389cb22dcdf1fce65493c10c56247a7d67d461',
    'daily_scissors': 'f4c8a129e86142ef8290f7284e77fd3f27901538a178e3223760903d60d49d87',
    'daily_snack_bag': 'e20bc62681279a63359c71be50449118250f23ed9a4e5efb52b469660380ff9f',
    'daily_soup': '8a6a2ec7b686ac897c7c72c493e0c420263689b766976689d1591419d2c391b4',
    'daily_ladle': '291b1d6b318853b7bdc8c1b70ea77e5163a3e1ea805396a9541a426907db31a6',
}


def tts_extra_origin(ident):
    if ident in TTS_EXTRA_BIGSOUNDBANK:
        slug, author = TTS_EXTRA_BIGSOUNDBANK[ident]
        number = re.search(r'-s(\d+)\.html$', slug)[1]
        return {'source': 'https://bigsoundbank.com/' + slug, 'author': author,
                'license': 'CC0-1.0', 'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/',
                'downloadUrl': f'https://bigsoundbank.com/UPLOAD/mp3/{number}.mp3'}
    sn = TTS_EXTRA_GONGU[ident]
    return {'source': f'https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=100219&wrtSn={sn}',
            'author': '한국저작권위원회', 'license': 'CC-BY-4.0',
            'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
            'downloadUrl': f'https://gongu.copyright.or.kr/gongu/wrt/cmmn/wrtFileMediaPlay.do?wrtSn={sn}&fileSn=1'}

# Embedded tools have their own versions, independent of the theme release.
ADDON_CSS_VERSIONS = (
    ('zipinstall/index.js', 'zipinstall', '--blzi-css-version'),
    ('tts/version.js', 'tts', '--lv-css-version', 'TTS_VERSION'),
    ('direction/index.js', 'direction', '--jj-css-version'),
    ('assets/state.js', 'assets', '--eh-css-version'),
    ('bookmarks/state.js', 'bookmarks', '--cg-css-version'),
    ('models/state.js', 'models', '--mr-css-version'),
    ('order/state.js', 'order', '--po-css-version'),
    ('rewrite/index.js', 'rewrite', '--bwr-css-version'),
    ('perf/watchdog-main.js', 'perf', '--sw-css-version'),
    ('perf/perfassist.js', 'perf', '--pa-css-version'),
    ('perf/state.js', 'perf', '--rl-css-version'),
    ('perf/savededupe.js', 'perf', '--sv-css-version'),
    # Names that do not follow the --xx-css-version / const VERSION pattern.
    ('regexlink/index.js', 'regexlink', '--rl-version'),
    ('modelswitch/index.js', 'modelswitch', '--ms-version'),
    ('notes/version.js', 'notes', '--bl-notes-css-version', 'NOTES_VERSION'),
)


def addon_css_versions():
    # (source, folder, css variable, code constant); the constant defaults to VERSION.
    return [(*entry, 'VERSION')[:4] for entry in ADDON_CSS_VERSIONS]


# 5.3.7: 번역기 서랍 · 한글화 패널은 화면에 버전을 글자로 박아 둔다 (index.html · guide.js · settings-ui.js).
# 번역 서랍이 v2.1.6 으로 남은 채 2.1.9 까지 나간 일이 있어 manifest 와 같은지 본다.
EMBEDDED_VERSIONS = (
    ('tts/manifest.json', 'tts/version.js', r'\bTTS_VERSION\s*=\s*[\'\"](\d+\.\d+\.\d+)[\'\"]'),
    ('translator/manifest.json', 'translator/index.html', r'>v(\d+\.\d+\.\d+)<'),
    ('prompt/manifest.json', 'prompt/guide.js', r'textContent\s*=\s*[\'"`]v(\d+\.\d+\.\d+)[\'"`]'),
    ('prompt/manifest.json', 'prompt/settings-ui.js', r'>v(\d+\.\d+\.\d+)<'),
)


def validate_embedded_versions(files):
    for manifest, source, pattern in EMBEDDED_VERSIONS:
        manifest, source = 'src/addons/' + manifest, 'src/addons/' + source
        if manifest not in files and source not in files:
            continue
        expected = json.loads(files.get(manifest, b'{}').decode('utf-8-sig')).get('version')
        shown = re.findall(pattern, files.get(source, b'').decode('utf-8'))
        require(bool(expected) and bool(shown) and set(shown) == {expected},
                f'Embedded version mismatch: {source} shows {shown or "nothing"}, {manifest} is {expected}')


def validate_addon_css(files):
    for source, folder, variable, constant in addon_css_versions():
        source = 'src/addons/' + source
        css_path = f'src/addons/{folder}/style.css'
        if source not in files and css_path not in files:
            continue
        code = files.get(source, b'').decode('utf-8')
        css = files.get(css_path, b'').decode('utf-8')
        code_version = re.search(r'\bconst\s+' + constant + r'\s*=\s*[\'\"]([^\'\"]+)', code)
        css_versions = re.findall(re.escape(variable) + r'\s*:\s*[\'\"]([^\'\"]+)', css)
        require(code_version is not None and css_versions == [code_version[1]],
                f'Addon CSS version mismatch: {source} / {variable}')


def require(condition, message):
    if not condition:
        raise GateError(message)


def validate_tts_sfx(files):
    prefix = 'src/addons/tts/'
    if prefix + 'src/sfx-library.js' not in files:
        return  # Older releases do not contain this feature.
    for name in TTS_SFX_RESOURCES:
        require(bool(files.get(prefix + name)), f'Missing TTS sound resource: {name}')
    expected = {'sfx/' + name for name in TTS_SFX_FILES}
    actual = {name[len(prefix):] for name in files if name.startswith(prefix + 'sfx/')}
    require(actual == expected | {'sfx/SOURCES.json'}, 'TTS sound file list differs from the reviewed pack')
    try:
        catalog = json.loads(files[prefix + 'sfx/SOURCES.json'].decode('utf-8'))
    except (ValueError, UnicodeError) as error:
        raise GateError('Invalid TTS sound catalog JSON') from error
    require(isinstance(catalog, dict), 'Invalid TTS sound catalog')
    require(catalog.get('repository') == TTS_SFX_REPOSITORY and catalog.get('commit') == TTS_SFX_COMMIT,
            'TTS sound catalog source differs from the pinned upstream')
    rows = catalog.get('files')
    require(isinstance(rows, list) and len(rows) == len(TTS_SFX_FILES), 'TTS sound catalog must list the complete reviewed pack')
    seen = set()
    for row in rows:
        require(isinstance(row, dict), 'Invalid TTS sound catalog entry')
        name = row.get('path')
        require(isinstance(name, str) and name in expected and name not in seen,
                'Unsafe, unknown or duplicate TTS sound catalog path')
        seen.add(name)
        require(row.get('url') == f'https://raw.githubusercontent.com/JINSIN2/MultiCast-TTS/{TTS_SFX_COMMIT}/{name}',
                f'TTS sound source URL differs: {name}')
        content = files[prefix + name]
        require(type(row.get('bytes')) is int and row['bytes'] > 0 and row['bytes'] == len(content),
                f'TTS sound byte count differs: {name}')
        require(isinstance(row.get('sha256'), str) and re.fullmatch(r'[a-f0-9]{64}', row['sha256']) is not None
                and hashlib.sha256(content).hexdigest() == row['sha256'], f'TTS sound SHA256 differs: {name}')
    require(seen == expected, 'TTS sound catalog is incomplete')


def validate_tts_extra_sfx(files):
    prefix = 'src/addons/tts/'
    actual = {name[len(prefix):] for name in files if name.startswith(prefix + 'sfx-extra/')}
    if not actual and TTS_EXTRA_MODULE not in files:
        return  # 5.8.8 and earlier have no everyday pack.
    expected = {f'sfx-extra/{ident}.mp3' for ident in TTS_EXTRA_IDS}
    for name in TTS_EXTRA_RESOURCES:
        require(bool(files.get(prefix + name)), f'Missing TTS everyday sound resource: {name}')
    require(actual == expected | set(TTS_EXTRA_RESOURCES),
            'TTS everyday sound file list differs from the reviewed pack')
    try:
        catalog = json.loads(files[prefix + 'sfx-extra/SOURCES.json'].decode('utf-8'))
    except (ValueError, UnicodeError) as error:
        raise GateError('Invalid TTS everyday sound catalog JSON') from error
    require(isinstance(catalog, dict) and type(catalog.get('version')) is int and catalog['version'] == 1
            and catalog.get('collection') == 'Blue Lemonade everyday sounds',
            'Invalid TTS everyday sound catalog')
    rows = catalog.get('files')
    require(isinstance(rows, list) and len(rows) == len(TTS_EXTRA_IDS),
            'TTS everyday sound catalog must list the complete reviewed pack')
    seen = set()
    finite = lambda value: type(value) in (int, float) and math.isfinite(value)
    digest = lambda value: isinstance(value, str) and re.fullmatch(r'[a-f0-9]{64}', value) is not None
    for row in rows:
        require(isinstance(row, dict), 'Invalid TTS everyday sound catalog entry')
        ident = row.get('id')
        require(isinstance(ident, str) and ident in TTS_EXTRA_IDS and ident not in seen,
                'Unknown or duplicate TTS everyday sound ID')
        seen.add(ident)
        name = f'sfx-extra/{ident}.mp3'
        require(row.get('path') == name, 'Unsafe or mismatched TTS everyday sound catalog path')
        for key, value in tts_extra_origin(ident).items():
            require(row.get(key) == value, f'TTS everyday sound {key} differs from the reviewed origin: {ident}')
        content = files[prefix + name]
        require(type(row.get('bytes')) is int and row['bytes'] > 0 and row['bytes'] == len(content),
                f'TTS everyday sound byte count differs: {ident}')
        require(digest(row.get('sha256')) and hashlib.sha256(content).hexdigest() == row['sha256'],
                f'TTS everyday sound SHA256 differs: {ident}')
        require(row['sha256'] == TTS_EXTRA_SHA256[ident], f'TTS everyday sound differs from reviewed audio SHA256: {ident}')
        require(digest(row.get('sourceSha256')) and type(row.get('sourceBytes')) is int and row['sourceBytes'] > 0
                and finite(row.get('sourceDuration')) and row['sourceDuration'] > 0,
                f'Invalid TTS everyday sound original-file metadata: {ident}')
        require(row['sourceSha256'] == TTS_EXTRA_SOURCE_SHA256[ident],
                f'TTS everyday sound differs from reviewed original SHA256: {ident}')
        require(isinstance(row.get('retrieved'), str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', row['retrieved']) is not None,
                f'Missing TTS everyday sound retrieval date: {ident}')
        mods = row.get('modifications')
        require(isinstance(mods, dict), f'Missing TTS everyday sound modification notice: {ident}')
        for key in ('excerptStart', 'excerptSeconds', 'gainDb', 'fadeInSeconds', 'fadeOutSeconds'):
            require(finite(mods.get(key)), f'Invalid TTS everyday sound modification notice: {ident}')
        require(mods['excerptStart'] >= 0 and mods['excerptSeconds'] > 0
                and mods['excerptStart'] + mods['excerptSeconds'] <= row['sourceDuration'] + 0.1
                and all(0 <= mods[key] <= mods['excerptSeconds'] for key in ('fadeInSeconds', 'fadeOutSeconds'))
                and isinstance(mods.get('encoding'), str) and bool(mods['encoding'].strip()),
                f'Invalid TTS everyday sound modification notice: {ident}')
    require(seen == set(TTS_EXTRA_IDS), 'TTS everyday sound catalog is incomplete')


def inventory(root, kind):
    root = Path(root).resolve()
    names = ['manifest.json', 'index.js', 'style.css', 'README.md']
    if kind == 'theme':
        if (root / 'server-plugin').is_dir():
            names += ['server-plugin/' + n for n in ('setup.mjs', 'setup-windows.cmd', 'README.md', 'blue-lemonade-zip/index.mjs', 'blue-lemonade-zip/archive.mjs', 'blue-lemonade-zip/install.mjs')]
        names += [p.relative_to(root).as_posix() for p in (root / 'src').rglob('*') if p.is_file() and p.suffix in {'.js', '.css'}]
        # Corresponding editable source, build tools and bundled license/template files.
        for name in ['LICENSE', 'THIRD-PARTY-NOTICES.md']:
            if (root / name).is_file(): names.append(name)
        names += [p.relative_to(root).as_posix() for p in (root / 'css').glob('*.css')]
        for name in ['build-css.cjs','build-plain-scripts.mjs','gen-preview-css.js','gen-user-profile.cjs','css-lib.cjs','css-bucket.cjs','css-park.cjs','extension-color-guard.cjs']:
            if (root / 'tools' / name).is_file(): names.append('tools/' + name)
        for folder in ['translator','prompt','customstyle']:
            bundle = root / 'src' / 'addons' / folder
            if bundle.is_dir():
                require((bundle / 'LICENSE').is_file(), f'Missing bundled license: {folder}')
                names += [p.relative_to(root).as_posix() for p in bundle.rglob('*') if p.is_file() and (p.suffix in {'.html','.json','.md'} or p.name == 'LICENSE')]
        if (root / 'src/addons/direction').is_dir():
            require((root / 'src/addons/direction/NOTICE.md').is_file(), 'Missing Direction Manager permission notice')
            names.append('src/addons/direction/NOTICE.md')
        if (root / 'src/addons/assets').is_dir():
            require((root / 'src/addons/assets/NOTICE.md').is_file(), 'Missing Character Assets permission notice')
            names.append('src/addons/assets/NOTICE.md')
        # The public TTS bundle has only these non-code resources; never sweep voice data.
        if (root / 'src/addons/tts').is_dir():
            for name in ('settings.html', 'manifest.json', 'README.md', 'LICENSE', 'NOTICE.md'):
                item = root / 'src/addons/tts' / name
                if item.is_file(): names.append(item.relative_to(root).as_posix())
            require((root / 'src/addons/tts/settings.html').is_file(), 'Missing TTS settings template')
            if (root / 'src/addons/tts/src/sfx-library.js').is_file():
                for name in (*TTS_SFX_RESOURCES, *('sfx/' + name for name in TTS_SFX_FILES)):
                    item = root / 'src/addons/tts' / name
                    require(item.is_file(), f'Missing TTS sound resource: {name}')
                    names.append(item.relative_to(root).as_posix())
            if (root / 'src/addons/tts/sfx-extra').exists() or (root / TTS_EXTRA_MODULE).is_file():
                for name in (*TTS_EXTRA_RESOURCES, *(f'sfx-extra/{ident}.mp3' for ident in TTS_EXTRA_IDS)):
                    item = root / 'src/addons/tts' / name
                    require(item.is_file(), f'Missing TTS everyday sound resource: {name}')
                    names.append(item.relative_to(root).as_posix())
        if (root / 'src/addons/perf/README.md').is_file(): names.append('src/addons/perf/README.md')
        if (root / 'src/vendor/README.md').is_file(): names.append('src/vendor/README.md')
        # Only these curated weather atlases are runtime images. Do not sweep
        # arbitrary local images into the public package.
        for name in WEATHER_ARTWORK:
            asset = root / 'src' / 'weather-art' / name
            if asset.is_file():
                names.append(asset.relative_to(root).as_posix())
        for name in PREVIEW_ARTWORK:
            asset = root / 'src' / 'preview-art' / name
            if asset.is_file():
                names.append(asset.relative_to(root).as_posix())
    else:
        names += [p.name for p in root.glob('*.js') if p.name != 'index.js']
    require(len(names) > 4, 'No runtime modules found')
    result = {}
    for name in sorted(names):
        path = root / name
        require(path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(root), f'Missing or unsafe runtime file: {name}')
        result[name] = path.read_bytes()
    return result


def validate(files, kind):
    manifest = json.loads(files['manifest.json'].decode('utf-8-sig'))
    version = manifest.get('version', '')
    require(bool(re.fullmatch(r'\d+\.[0-9]\.[0-9]', version)), 'Version must carry at 10, e.g. 3.9.9 -> 4.0.0')
    require(manifest.get('js') == 'index.js' and manifest.get('css') == 'style.css', 'Unexpected manifest entry points')
    if kind == 'theme':
        validate_addon_css(files)
        validate_embedded_versions(files)
        validate_tts_sfx(files)
        validate_tts_extra_sfx(files)
        if b'./preview-art/' in files.get('src/panel.js', b''):
            for name in PREVIEW_ARTWORK:
                data = files.get('src/preview-art/' + name, b'')
                require(data.startswith(b'RIFF') and data[8:12] == b'WEBP', f'Missing preview artwork: {name}')
        if 'src/weather-art.js' in files:
            for name in WEATHER_ARTWORK:
                data = files.get('src/weather-art/' + name, b'')
                require(data.startswith(b'RIFF') and data[8:12] == b'WEBP', f'Missing weather artwork: {name}')
        # 4.5.0: 공지 본문이 src/notice-data.js 로 갈라졌다 (팝업 열 때만 읽는다). 옛 판도 받아 준다.
        notice = files.get('src/notice-data.js', files.get('src/notice.js', b'')).decode('utf-8')
        found = re.search(r'\bNOTICES\s*=\s*\[\s*\{\s*[\'"]?version[\'"]?\s*:\s*[\'"]([^\'"]+)', notice)
        require(found is not None and found[1] == version, 'Manifest and newest notice versions differ')
    else:
        code = files.get('defs.js', b'').decode('utf-8')
        css = files['style.css'].decode('utf-8')
        code_version = re.search(r'\bVERSION\s*=\s*[\'"]([^\'"]+)', code)
        css_version = re.search(r'--lm-css-version\s*:\s*[\'"]([^\'"]+)', css)
        require(code_version is not None and code_version[1] == version, 'Manifest and code versions differ')
        require(css_version is not None and css_version[1] == version, 'Manifest and CSS versions differ')
    # Literal imports within this extension must be packaged; host imports outside
    # its root are intentionally left to SillyTavern.
    import posixpath
    for name, content in files.items():
        if not name.endswith('.js'):
            continue
        for spec in re.findall(r'(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)[\'"](\.[^\'"]+)[\'"]', content.decode('utf-8')):
            target = posixpath.normpath(posixpath.join(posixpath.dirname(name), spec.split('?')[0]))
            if not target.startswith('../'):
                require(target in files, f'{name} imports missing file {target}')
    return version


def compare(expected, actual, label):
    require(expected.keys() == actual.keys(), f'{label}: file list differs; missing={sorted(expected.keys()-actual.keys())}, extra={sorted(actual.keys()-expected.keys())}')
    for name in expected:
        require(expected[name] == actual[name], f'{label}: content differs: {name}')


def read_zip(path, prefix):
    result = {}
    with zipfile.ZipFile(path) as archive:
        for entry in archive.infolist():
            name = entry.filename
            parts = PurePosixPath(name).parts
            require('\\' not in name and '..' not in parts and not name.startswith('/'), f'Unsafe ZIP path: {name}')
            require(name.startswith(prefix + '/'), f'Unexpected ZIP root: {name}')
            if entry.is_dir():
                continue
            relative = name[len(prefix) + 1:]
            require(relative not in result, f'Duplicate ZIP entry: {name}')
            require(entry.file_size <= 16 * 1024 * 1024, f'Oversized ZIP file: {name}')
            require((entry.external_attr >> 16) & 0o170000 != 0o120000, f'ZIP symlink: {name}')
            result[relative] = archive.read(entry)
    return result


def build_zip(path, files, prefix):
    path = Path(path)
    require(not path.exists(), f'Refusing to overwrite release: {path.name}')
    path.parent.mkdir(parents=True, exist_ok=True)
    # Write then validate before publishing the artifact at its final path.
    # A private TemporaryDirectory on Windows gives the ZIP an owner-only ACL,
    # which survives rename and prevents the desktop user from opening it.
    # Create the staging file beside the output with normal directory inheritance.
    staged = path.parent / ('.release-' + uuid.uuid4().hex + '.tmp')
    try:
        with staged.open('xb') as stream, zipfile.ZipFile(stream, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, content in sorted(files.items()):
                info = zipfile.ZipInfo(prefix + '/' + name, (2020, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                archive.writestr(info, content)
        compare(files, read_zip(staged, prefix), 'Built ZIP')
        staged.rename(path)
    finally:
        staged.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--kind', choices=['theme', 'memory'], required=True)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--mirror', type=Path, action='append', default=[])
    parser.add_argument('--zip', type=Path, action='append', default=[])
    parser.add_argument('--build', type=Path)
    args = parser.parse_args()
    try:
        files = inventory(args.source, args.kind)
        version = validate(files, args.kind)
        prefix = 'blue-lemonade' if args.kind == 'theme' else 'long-memory'
        for root in args.mirror:
            other = inventory(root, args.kind)
            validate(other, args.kind)
            compare(files, other, 'Mirror ' + root.name)
        # This build check is available in the private development tree. CI uses
        # the shipped root and verifies every byte of the public ZIP instead.
        builder = args.source / 'tools/build-css.cjs'
        if args.kind == 'theme' and builder.is_file():
            subprocess.run(['node', str(builder.resolve()), '--check'], check=True, cwd=args.source, capture_output=True, text=True, encoding='utf-8')
        for path in args.zip:
            require(path.name == f'{prefix}-{version}.zip', 'ZIP filename version differs')
            packaged = read_zip(path, prefix)
            validate(packaged, args.kind)
            compare(files, packaged, 'ZIP ' + path.name)
        if args.build:
            require(args.build.name == f'{prefix}-{version}.zip', 'Output filename version differs')
            build_zip(args.build, files, prefix)
        print(json.dumps({'ok': True, 'version': version, 'files': len(files), 'bytes': sum(map(len, files.values())), 'sha256': {name: hashlib.sha256(data).hexdigest() for name, data in files.items()}}, indent=2))
    except (GateError, OSError, ValueError, KeyError, zipfile.BadZipFile, subprocess.CalledProcessError) as error:
        parser.exit(1, f'RELEASE BLOCKED: {error}\n')


if __name__ == '__main__':
    main()
