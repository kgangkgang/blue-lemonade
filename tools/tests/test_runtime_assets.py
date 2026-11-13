"""1.4.1 실행 때 받는 자원 검사(tools/release_gate.py runtime_requirements · runtime_files · check_runtime_assets).

ZIP 목록 · 무결성 표 · 빠진 파일 검사가 같은 목록을 쓰는지, 코드가 받는 파일이 ZIP 에서 빠지면 관문이 멈추는지 봐요.
되돌림: 1.4.x 최적화 분기에서 사전을 fetch(new URL(`./ko-ui-text.${name}.gen.json`, import.meta.url)) 로 받게 바꿨을 때
JSON 일곱 장이 ZIP 에 안 들어갔는데 관문이 조용히 통과했어요(글자 그대로 쓴 import 만 봤어요).
"""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('release_gate', Path(__file__).resolve().parents[1] / 'release_gate.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)
ROOT = Path(__file__).resolve().parents[2]


def theme_tree(extra):
    files = {
        'manifest.json': json.dumps({'version': '1.3.1', 'js': 'index.js', 'css': 'style.css'}).encode(),
        'index.js': b"import './src/notice.js';",
        'style.css': b':root{}',
        'README.md': b'Synthetic fixture',
        'src/notice.js': b"import './notice-data.js';",
        'src/notice-data.js': b'export const NOTICES = [{"version":"1.3.1"}];',
    }
    files.update(extra)
    return files


def write(root, files):
    for name, data in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


KO_UI = b"""// sample
const load = name => fetch(new URL(`./ko-ui-text.${name}.gen.json`, import.meta.url)).then(r => r.json());
export const index = () => load('index');
"""
KO_JSON = {f'src/ko-ui-text.{n}.gen.json': b'{}' for n in ('index', 'a', 'b')}


class RuntimeAssetTests(unittest.TestCase):
    def problems(self, files):
        return gate.runtime_requirements(files)[1]

    def test_template_url_files_are_packaged_and_required(self):
        # 되돌림 시험: 이어 붙인 주소로 받는 .json 이 목록에 실리고, ZIP 에서 빠지면 관문이 멈춰요
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write(root, theme_tree({'src/ko-ui.js': KO_UI, **KO_JSON}))
            files = gate.inventory(root, 'theme')
            for name in KO_JSON:
                self.assertIn(name, files)
            self.assertEqual(gate.validate(files, 'theme'), '1.3.1')
            for drop in (list(KO_JSON), ['src/ko-ui-text.index.gen.json', 'src/ko-ui-text.a.gen.json', 'src/ko-ui-text.b.gen.json']):
                broken = {k: v for k, v in files.items() if k not in drop}
                with self.assertRaisesRegex(gate.GateError, 'ko-ui-text'):
                    gate.validate(broken, 'theme')
            # 반쯤 빠진 ZIP 은 목록 비교(compare)가 잡아요 — 관문은 늘 소스 목록과 ZIP 을 견줘요
            partial = {k: v for k, v in files.items() if k != 'src/ko-ui-text.a.gen.json'}
            with self.assertRaisesRegex(gate.GateError, 'ko-ui-text.a.gen.json'):
                gate.compare(files, partial, 'ZIP')

    def test_template_without_any_file_blocks_inventory(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write(root, theme_tree({'src/ko-ui.js': KO_UI}))
            with self.assertRaisesRegex(gate.GateError, 'ko-ui-text'):
                gate.inventory(root, 'theme')

    def test_css_url_and_literal_url_assets_are_packaged(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write(root, theme_tree({
                'src/sheet.css': b"/* url('./ignored.woff2') */ @font-face{src:url('./icons.woff2') format('woff2')} .a{background:url(data:image/png;base64,AA)} .b{mask:url(#m)}",
                'src/icons.woff2': b'wOF2',
                'src/table.js': b"export const T = new URL('./table.json', import.meta.url);",
                'src/table.json': b'{}',
                'src/private.json': b'{"not":"referenced"}',
            }))
            files = gate.inventory(root, 'theme')
            self.assertIn('src/icons.woff2', files)
            self.assertIn('src/table.json', files)
            self.assertNotIn('src/private.json', files, '받지 않는 파일은 싣지 않아요')
            for gone in ('src/icons.woff2', 'src/table.json'):
                with self.assertRaisesRegex(gate.GateError, 'Runtime files missing'):
                    gate.check_runtime_assets({k: v for k, v in files.items() if k != gone})

    def test_missing_literal_asset_blocks_inventory(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write(root, theme_tree({'src/table.js': b"fetch(new URL('../data/x.json', import.meta.url));"}))
            with self.assertRaisesRegex(gate.GateError, 'do not exist'):
                gate.inventory(root, 'theme')

    def test_unresolved_addresses_need_review(self):
        cases = {
            'variable import': b'const u = pick(); import(u);',
            'folder base': b"const BASE = new URL('./parts/', import.meta.url); fetch(BASE + name);",
            'too broad pattern': b"new URL(`./parts/${rel}`, import.meta.url);",
            'page-relative fetch': b"fetch('./data.json');",
            'variable worker': b'new Worker(url, { type: "module" });',
        }
        for label, code in cases.items():
            with self.subTest(label):
                self.assertTrue(any('확인 필요' in p for p in self.problems(theme_tree({'src/a.js': code}))), label)

    def test_registered_addresses_pass(self):
        files = theme_tree({'src/a.js': b"const BASE = new URL('./parts/', import.meta.url); import(u);\nconst local = rel => new URL(`../${rel}`, import.meta.url).href;\nlocal('LICENSE'); local('src/parts/x.css');",
                            'src/parts/x.css': b'', 'LICENSE': b'L'})
        refs = {('src/a.js', "'./parts/'"): ('glob', 'src/parts/*.css'), ('src/a.js', 'u'): ('none', 'host'),
                ('src/a.js', '`../${rel}`'): ('helper', 'local', 0, '../{}')}
        with patch.dict(gate.RUNTIME_REFS, refs):
            needed, problems = gate.runtime_requirements(files)
        self.assertEqual(problems, [])
        self.assertTrue({'src/parts/x.css', 'LICENSE'} <= needed)

    def test_helper_with_non_literal_argument_needs_review(self):
        files = theme_tree({'src/a.js': b"const local = rel => new URL(`../${rel}`, import.meta.url).href;\nlocal(name);"})
        with patch.dict(gate.RUNTIME_REFS, {('src/a.js', '`../${rel}`'): ('helper', 'local', 0, '../{}')}):
            self.assertTrue(any('확인 필요' in p for p in gate.runtime_requirements(files)[1]))

    def test_outside_extension_comments_and_external_urls_are_ignored(self):
        code = b"""// import x from './gone.js'
/* new URL('./gone.json', import.meta.url) */
import('../../../../script.js');
new URL('../../../../../img/icon.png', import.meta.url);
new URL(`../../../../${folder}/panel.js`, import.meta.url);
fetch('/api/settings/get');
fetch(`https://example.invalid/${x}`);
"""
        self.assertEqual(self.problems(theme_tree({'src/deep/a/b.js': code})), [])
        self.assertEqual(gate.runtime_requirements(theme_tree({'src/deep/a/b.js': code}))[0], {'src/notice.js', 'src/notice-data.js'})

    def test_workers_and_dynamic_imports_are_required(self):
        files = theme_tree({'src/w.js': b"new Worker(new URL(`./save-worker.js?v=${V}`, import.meta.url), {type:'module'}); import(`./plain/${f}.js`);",
                            'src/plain/a.js': b'', 'src/save-worker.js': b''})
        needed, problems = gate.runtime_requirements(files)
        self.assertEqual(problems, [])
        self.assertTrue({'src/save-worker.js', 'src/plain/a.js'} <= needed)
        with self.assertRaisesRegex(gate.GateError, 'save-worker'):
            gate.check_runtime_assets({k: v for k, v in files.items() if k != 'src/save-worker.js'})

    def test_this_tree_packages_every_runtime_file(self):
        # 이 저장소의 실제 목록: 실행 때 받는 파일이 모두 ZIP 목록에 있고, 하나라도 빼면 관문이 멈춰요
        files = gate.inventory(ROOT, 'theme')
        needed = gate.check_runtime_assets(files)
        self.assertIn('src/ext-status-icons.woff2', files, '맞춤 시트(src/ext-status.css)의 url() 글꼴')
        assets = sorted(n for n in needed if not n.endswith(gate.RUNTIME_CODE_SUFFIXES))
        self.assertTrue(assets)
        with self.assertRaises(gate.GateError):
            gate.check_runtime_assets({k: v for k, v in files.items() if k != assets[0]})
        runtime = gate.runtime_files(ROOT, list(files))
        self.assertTrue(runtime <= files.keys(), '무결성 표 목록(--runtime-list)은 ZIP 목록 안에 있어요')
        self.assertTrue(needed <= runtime)

    def test_integrity_list_stays_small(self):
        # 「다시 검사」가 받는 양: 코드가 받는 작은 자원만 더해요(링크 · 큰 묶음 · 글꼴 한 벌은 빼요)
        files = gate.inventory(ROOT, 'theme')
        extra = gate.integrity_files(ROOT, list(files))
        self.assertIn('src/ext-status-icons.woff2', extra)
        for gone in ('LICENSE', 'THIRD-PARTY-NOTICES.md', 'src/addons/prompt-template/ST-Prompt-Template.zip', 'src/weather-art/nature.webp'):
            self.assertNotIn(gone, extra)
        self.assertFalse([n for n in extra if n.startswith('fonts/')])
        # 효과음 · 장면 음악 mp3 는 1.4.0 표에도 있던 것이라 빼고 재요
        assets = [n for n in extra if not n.endswith(gate.RUNTIME_CODE_SUFFIXES + ('.mp3',)) and not n.startswith('dist/')]
        self.assertLess(sum((ROOT / n).stat().st_size for n in assets), 512 * 1024)
        self.assertTrue(extra <= gate.runtime_files(ROOT, list(files)))

    def test_bundled_addon_license_texts_ship(self):
        files = gate.inventory(ROOT, 'theme')
        for folder in sorted((ROOT / 'src/addons').iterdir()):
            for name in ('LICENSE', 'NOTICE.md'):
                if (folder / name).is_file():
                    self.assertIn(f'src/addons/{folder.name}/{name}', files)


if __name__ == '__main__':
    unittest.main()
