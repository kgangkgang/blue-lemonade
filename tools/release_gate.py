"""Read-only release gate and deterministic ZIP builder. Python standard library only."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import tempfile
import zipfile


class GateError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise GateError(message)


def inventory(root, kind):
    root = Path(root).resolve()
    names = ['manifest.json', 'index.js', 'style.css', 'README.md']
    if kind == 'theme':
        names += [p.relative_to(root).as_posix() for p in (root / 'src').rglob('*.js')]
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
        notice = files.get('src/notice.js', b'').decode('utf-8')
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
    with tempfile.TemporaryDirectory(dir=path.parent) as folder:
        staged = Path(folder) / 'release.zip'
        with zipfile.ZipFile(staged, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, content in sorted(files.items()):
                info = zipfile.ZipInfo(prefix + '/' + name, (2020, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                archive.writestr(info, content)
        compare(files, read_zip(staged, prefix), 'Built ZIP')
        staged.rename(path)


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
