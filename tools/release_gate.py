"""Read-only release gate and deterministic ZIP builder. Python standard library only."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import uuid
import zipfile


class GateError(ValueError):
    pass

WEATHER_ARTWORK = tuple(f'{pack}{style}.webp' for pack in ('nature', 'light', 'wings') for style in ('', '-anime', '-cel'))
PREVIEW_ARTWORK = ('ade-game.webp', 'ade-lemon.webp', 'ade-cat.webp', 'ade-nap.webp', 'ade-rain.webp', 'character.webp')

# Embedded tools have their own versions, independent of the theme release.
ADDON_CSS_VERSIONS = (
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


def inventory(root, kind):
    root = Path(root).resolve()
    names = ['manifest.json', 'index.js', 'style.css', 'README.md']
    if kind == 'theme':
        names += [p.relative_to(root).as_posix() for p in (root / 'src').rglob('*') if p.is_file() and p.suffix in {'.js', '.css'}]
        # Corresponding editable source, build tools and bundled license/template files.
        for name in ['LICENSE', 'THIRD-PARTY-NOTICES.md']:
            if (root / name).is_file(): names.append(name)
        names += [p.relative_to(root).as_posix() for p in (root / 'css').glob('*.css')]
        for name in ['build-css.cjs','build-plain-scripts.mjs','gen-preview-css.js','gen-user-profile.cjs','css-lib.cjs','css-bucket.cjs','css-park.cjs']:
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
