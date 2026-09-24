import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile
spec=importlib.util.spec_from_file_location('release_gate',Path(__file__).resolve().parents[1]/'release_gate.py')
gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
class GateTests(unittest.TestCase):
    def fixture(self,kind='memory'):
        files={'manifest.json':json.dumps({'version':'1.3.1','js':'index.js','css':'style.css'}).encode(),'index.js':b"import { VERSION } from './defs.js';",'defs.js':b"export const VERSION = '1.3.1';",'style.css':b':root {--lm-css-version: "1.3.1";}', 'README.md':b'Synthetic fixture'}
        if kind=='theme':
            del files['defs.js'];files['index.js']=b"import './src/notice.js';";files['src/notice.js']=b"import './notice-data.js';";files['src/notice-data.js']=b'export const NOTICES = [{"version":"1.3.1"}];'
        return files
    def test_valid_memory(self):self.assertEqual(gate.validate(self.fixture(),'memory'),'1.3.1')
    def test_embedded_addon_css_versions(self):
        for source, folder, variable in gate.ADDON_CSS_VERSIONS:
            with self.subTest(addon=source):
                f=self.fixture('theme')
                # Include all sources sharing the same stylesheet.
                for other, group, prop in gate.ADDON_CSS_VERSIONS:
                    if group==folder:
                        f['src/addons/'+other]=b"export const VERSION = '1.3.5';"
                        key=f'src/addons/{folder}/style.css'
                        f[key]=f.get(key,b'')+(prop+': "1.3.5";\n').encode()
                self.assertEqual(gate.validate(f,'theme'),'1.3.1')
                key=f'src/addons/{folder}/style.css'
                f[key]=f[key].replace((variable+': "1.3.5"').encode(),(variable+': "1.3.3"').encode())
                with self.assertRaisesRegex(gate.GateError,'Addon CSS'):gate.validate(f,'theme')
                del f[key]
                with self.assertRaisesRegex(gate.GateError,'Addon CSS'):gate.validate(f,'theme')
    def test_stale_css_blocks(self):
        f=self.fixture();f['style.css']=b'--lm-css-version: "1.2.9";'
        with self.assertRaisesRegex(gate.GateError,'CSS'):gate.validate(f,'memory')
    def test_stale_code_blocks(self):
        f=self.fixture();f['defs.js']=b"export const VERSION='1.3.0';"
        with self.assertRaisesRegex(gate.GateError,'code'):gate.validate(f,'memory')
    def test_stale_notice_blocks(self):
        f=self.fixture('theme');f['src/notice-data.js']=b'export const NOTICES=[{version:"1.2.9"}];'
        with self.assertRaisesRegex(gate.GateError,'notice'):gate.validate(f,'theme')
    def test_weather_artwork_must_be_packaged(self):
        f=self.fixture('theme');f['src/weather-art.js']=b'export const artwork = true;'
        with self.assertRaisesRegex(gate.GateError,'weather artwork'):gate.validate(f,'theme')
        for name in gate.WEATHER_ARTWORK:f['src/weather-art/'+name]=b'RIFF0000WEBPfixture'
        self.assertEqual(gate.validate(f,'theme'),'1.3.1')
    def test_inventory_only_adds_named_weather_images(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);f=self.fixture('theme')
            for name,data in f.items():
                p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
            art=root/'src/weather-art';art.mkdir()
            for name in ('nature.webp','light.webp','private.webp'):(art/name).write_bytes(b'RIFF0000WEBPfixture')
            files=gate.inventory(root,'theme')
            self.assertIn('src/weather-art/nature.webp',files);self.assertIn('src/weather-art/light.webp',files)
            self.assertNotIn('src/weather-art/private.webp',files)
    def test_missing_dependency_blocks(self):
        f=self.fixture();f['index.js']=b"import('./missing.js')"
        with self.assertRaisesRegex(gate.GateError,'missing'):gate.validate(f,'memory')
    def test_mirror_content_mismatch_blocks(self):
        f=self.fixture();other={**f,'index.js':b'stale'}
        with self.assertRaisesRegex(gate.GateError,'content'):gate.compare(f,other,'mirror')
    def test_extra_private_file_blocks(self):
        f=self.fixture();other={**f,'settings.json':b'private'}
        with self.assertRaisesRegex(gate.GateError,'extra'):gate.compare(f,other,'ZIP')
    def test_zip_is_deterministic_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as d:
            a=Path(d)/'a.zip';b=Path(d)/'b.zip';f=self.fixture()
            gate.build_zip(a,f,'long-memory');gate.build_zip(b,f,'long-memory')
            self.assertEqual(a.read_bytes(),b.read_bytes());gate.compare(f,gate.read_zip(a,'long-memory'),'ZIP')
            with self.assertRaisesRegex(gate.GateError,'overwrite'):gate.build_zip(a,f,'long-memory')
    def test_unsafe_zip_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'bad.zip'
            for entry in ['../secrets','long-memory/../../secrets','wrong/index.js','long-memory/../secrets']:
                with zipfile.ZipFile(p,'w') as z:z.writestr(entry,b'x')
                with self.assertRaises(gate.GateError):gate.read_zip(p,'long-memory')
    def test_version_carry(self):
        f=self.fixture();m=json.loads(f['manifest.json']);m['version']='1.3.10';f['manifest.json']=json.dumps(m).encode()
        with self.assertRaisesRegex(gate.GateError,'carry'):gate.validate(f,'memory')
if __name__=='__main__':unittest.main()
