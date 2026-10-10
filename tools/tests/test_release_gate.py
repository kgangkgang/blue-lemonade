import importlib.util
import hashlib
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
    def tts_sfx_fixture(self):
        files=self.fixture('theme');prefix='src/addons/tts/'
        files[prefix+'src/sfx-library.js']=b'// Synthetic sound library fixture'
        files[prefix+'settings.html']=b'<p>Sound settings</p>'
        for name in gate.TTS_SFX_RESOURCES:files[prefix+name]=b'Synthetic bundled resource'
        rows=[]
        for name in gate.TTS_SFX_FILES:
            relative='sfx/'+name;data=b'ID3 synthetic\r\n'+name.encode();files[prefix+relative]=data
            rows.append({'path':relative,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
                         'url':f'https://raw.githubusercontent.com/JINSIN2/MultiCast-TTS/{gate.TTS_SFX_COMMIT}/{relative}'})
        files[prefix+'sfx/SOURCES.json']=json.dumps({'repository':gate.TTS_SFX_REPOSITORY,'commit':gate.TTS_SFX_COMMIT,'files':rows}).encode()
        return files
    def write_fixture(self,root,files):
        for name,data in files.items():
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
    def edit_sfx_catalog(self,files,edit):
        key='src/addons/tts/sfx/SOURCES.json';catalog=json.loads(files[key]);edit(catalog);files[key]=json.dumps(catalog).encode()
    def test_valid_memory(self):self.assertEqual(gate.validate(self.fixture(),'memory'),'1.3.1')
    def test_embedded_addon_css_versions(self):
        for source, folder, variable, constant in gate.addon_css_versions():
            with self.subTest(addon=source):
                f=self.fixture('theme')
                # Include all sources sharing the same stylesheet.
                for other, group, prop, name in gate.addon_css_versions():
                    if group==folder:
                        f['src/addons/'+other]=f"export const {name} = '1.3.5';".encode()
                        key=f'src/addons/{folder}/style.css'
                        f[key]=f.get(key,b'')+(prop+': "1.3.5";\n').encode()
                # A version source may also be checked against its bundled manifest.
                for manifest, version_source, _ in gate.EMBEDDED_VERSIONS:
                    if 'src/addons/'+version_source in f:
                        f['src/addons/'+manifest]=b'{"version":"1.3.5"}'
                self.assertEqual(gate.validate(f,'theme'),'1.3.1')
                key=f'src/addons/{folder}/style.css'
                f[key]=f[key].replace((variable+': "1.3.5"').encode(),(variable+': "1.3.3"').encode())
                with self.assertRaisesRegex(gate.GateError,'Addon CSS'):gate.validate(f,'theme')
                del f[key]
                with self.assertRaisesRegex(gate.GateError,'Addon CSS'):gate.validate(f,'theme')
    def test_embedded_version_displays(self):
        f=self.fixture('theme')
        f['src/addons/translator/manifest.json']=b'{"version":"2.1.9"}'
        f['src/addons/translator/index.html']=b'<small class="ver">v2.1.9</small>'
        f['src/addons/prompt/manifest.json']=b'{"version":"1.1.1"}'
        f['src/addons/prompt/guide.js']=b"ver.textContent='v1.1.1';"
        f['src/addons/prompt/settings-ui.js']=b'<span class="ver">v1.1.1</span>'
        self.assertEqual(gate.validate(f,'theme'),'1.3.1')
        for key,old in [('src/addons/translator/index.html',b'>v2.1.6<'),('src/addons/prompt/guide.js',b"textContent='v1.1.0'"),('src/addons/prompt/settings-ui.js',b'>v1.0.9<')]:
            with self.subTest(file=key):
                g=dict(f);g[key]=old
                with self.assertRaisesRegex(gate.GateError,'Embedded version'):gate.validate(g,'theme')
        g=dict(f);g['src/addons/translator/index.html']=b'<small class="ver"></small>'
        with self.assertRaisesRegex(gate.GateError,'Embedded version'):gate.validate(g,'theme')
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
            for name in ('nature.webp','light.webp','private.webp','wings.webp','wings-anime.webp','wings-cel.webp'):(art/name).write_bytes(b'RIFF0000WEBPfixture')
            files=gate.inventory(root,'theme')
            self.assertIn('src/weather-art/nature.webp',files);self.assertIn('src/weather-art/light.webp',files)
            self.assertNotIn('src/weather-art/private.webp',files)
            for name in ('wings.webp','wings-anime.webp','wings-cel.webp'):self.assertNotIn('src/weather-art/'+name,files)
    def test_bundled_templates_and_licenses_are_required_and_packaged(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            for name,data in self.fixture('theme').items():
                p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
            bundle=root/'src/addons/translator';bundle.mkdir(parents=True)
            (bundle/'settings.html').write_text('<label>API</label>')
            with self.assertRaisesRegex(gate.GateError,'Missing bundled license'):gate.inventory(root,'theme')
            (bundle/'LICENSE').write_text('license fixture')
            files=gate.inventory(root,'theme')
            self.assertIn('src/addons/translator/settings.html',files)
            self.assertIn('src/addons/translator/LICENSE',files)
    def test_missing_dependency_blocks(self):
        f=self.fixture();f['index.js']=b"import('./missing.js')"
        with self.assertRaisesRegex(gate.GateError,'missing'):gate.validate(f,'memory')
    def test_tts_sound_inventory_includes_only_reviewed_pack(self):
        files=self.tts_sfx_fixture()
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);self.write_fixture(root,files)
            for name in ('src/addons/tts/sfx/private.mp3','src/addons/tts/voice-recording.wav','src/addons/tts/sfx/unlisted.wav'):
                p=root/name;p.write_bytes(b'private audio fixture')
            found=gate.inventory(root,'theme')
            self.assertEqual(set(found),set(files));self.assertEqual(gate.validate(found,'theme'),'1.3.1')
            self.assertEqual(sum(n.endswith('.mp3') for n in found),47)
    def test_tts_sound_inventory_requires_every_resource(self):
        files=self.tts_sfx_fixture()
        for name in (*gate.TTS_SFX_RESOURCES,'sfx/'+gate.TTS_SFX_FILES[0]):
            with self.subTest(resource=name),tempfile.TemporaryDirectory() as d:
                root=Path(d);self.write_fixture(root,{n:b for n,b in files.items() if n!='src/addons/tts/'+name})
                with self.assertRaisesRegex(gate.GateError,'Missing TTS sound resource'):gate.inventory(root,'theme')
    def test_tts_sound_missing_and_extra_zip_resources_block(self):
        files=self.tts_sfx_fixture()
        for name in (*gate.TTS_SFX_RESOURCES,'sfx/'+gate.TTS_SFX_FILES[0]):
            with self.subTest(resource=name):
                bad=dict(files);del bad['src/addons/tts/'+name]
                with self.assertRaises(gate.GateError):gate.validate(bad,'theme')
        bad={**files,'src/addons/tts/sfx/private.mp3':b'local recording'}
        with self.assertRaisesRegex(gate.GateError,'file list'):gate.validate(bad,'theme')
    def test_tts_sound_catalog_rejects_path_traversal_unknown_and_duplicate(self):
        for name in ('../private.mp3','sfx/../../private.mp3','sfx\\bell.mp3','/sfx/bell.mp3','sfx/private.mp3','sfx/bell_2.mp3'):
            with self.subTest(path=name):
                files=self.tts_sfx_fixture();self.edit_sfx_catalog(files,lambda c:c['files'][0].update(path=name))
                with self.assertRaisesRegex(gate.GateError,'path|URL'):gate.validate(files,'theme')
    def test_tts_sound_catalog_requires_complete_unique_pack(self):
        files=self.tts_sfx_fixture();self.edit_sfx_catalog(files,lambda c:c['files'].pop())
        with self.assertRaisesRegex(gate.GateError,'complete reviewed pack'):gate.validate(files,'theme')
        files=self.tts_sfx_fixture();self.edit_sfx_catalog(files,lambda c:c['files'].__setitem__(1,dict(c['files'][0])))
        with self.assertRaisesRegex(gate.GateError,'duplicate'):gate.validate(files,'theme')
    def test_tts_sound_catalog_requires_pinned_source(self):
        for patch in ({'repository':'https://example.invalid/private'},{'commit':'0'*40}):
            files=self.tts_sfx_fixture();self.edit_sfx_catalog(files,lambda c:c.update(patch))
            with self.assertRaisesRegex(gate.GateError,'pinned upstream'):gate.validate(files,'theme')
        files=self.tts_sfx_fixture();self.edit_sfx_catalog(files,lambda c:c['files'][0].update(url='file:///private/recording.mp3'))
        with self.assertRaisesRegex(gate.GateError,'source URL'):gate.validate(files,'theme')
    def test_tts_sound_hash_detects_changed_audio_and_crlf_conversion(self):
        for convert in (lambda data:b'X'+data[1:],lambda data:data.replace(b'\r\n',b'\n')):
            files=self.tts_sfx_fixture();key='src/addons/tts/sfx/'+gate.TTS_SFX_FILES[0];files[key]=convert(files[key])
            with self.assertRaisesRegex(gate.GateError,'SHA256|byte count'):gate.validate(files,'theme')
    def test_tts_sound_catalog_rejects_invalid_metadata(self):
        for patch in ({'bytes':True},{'bytes':0},{'bytes':'20'},{'sha256':'invalid'},{'sha256':'0'*64}):
            with self.subTest(patch=patch):
                files=self.tts_sfx_fixture();self.edit_sfx_catalog(files,lambda c:c['files'][0].update(patch))
                with self.assertRaisesRegex(gate.GateError,'byte count|SHA256'):gate.validate(files,'theme')
        for invalid in (b'not-json',b'[]',b'{"files":[]}'):
            files=self.tts_sfx_fixture();files['src/addons/tts/sfx/SOURCES.json']=invalid
            with self.assertRaisesRegex(gate.GateError,'catalog'):gate.validate(files,'theme')
    def test_older_tts_without_sound_library_remains_supported(self):
        files=self.fixture('theme');files['src/addons/tts/settings.html']=b'<p>Older TTS</p>'
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);self.write_fixture(root,files)
            self.assertEqual(gate.validate(gate.inventory(root,'theme'),'theme'),'1.3.1')
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
