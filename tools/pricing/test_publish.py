from pathlib import Path
import tempfile,unittest,os,json,base64
from unittest.mock import patch
import publish

class PublisherTests(unittest.TestCase):
    def test_existing_feed_is_loaded_from_exact_commit_blob(self):
        value=json.dumps({'schema':1,'providers':{}})
        responses={'/git/ref/heads/pricing-data':{'object':{'sha':'head'}},'/git/commits/head':{'tree':{'sha':'tree'}},'/git/trees/tree':{'tree':[{'path':'official-prices.json','type':'blob','sha':'blob'}]},'/git/blobs/blob':{'encoding':'base64','content':base64.b64encode(value.encode()).decode()}}
        with tempfile.TemporaryDirectory() as d,patch.dict(os.environ,{'GITHUB_REPOSITORY':publish.REPO}),patch('sys.argv',['publish.py','prepare','--directory',d]),patch('publish.api',side_effect=lambda method,path,**kw:responses[path]):
            publish.main();self.assertEqual(Path(d,'previous.json').read_text(),value);self.assertEqual(Path(d,'expected-head.txt').read_text(),'head')

    def test_concurrent_head_change_aborts_before_writing(self):
        with tempfile.TemporaryDirectory() as d,patch.dict(os.environ,{'GITHUB_REPOSITORY':publish.REPO}),patch('sys.argv',['publish.py','publish','--directory',d]),patch('publish.api',return_value={'object':{'sha':'new'}}) as api:
            Path(d,'expected-head.txt').write_text('old')
            with self.assertRaises(ValueError):publish.main()
            self.assertEqual(api.call_count,1)

    def test_only_data_branch_is_written_without_force(self):
        seen=[]
        def api(method,path,**kw):
            seen.append((method,path,kw))
            if path=='/git/ref/heads/pricing-data':return {'object':{'sha':'head'}}
            if path=='/git/commits/head':return {'tree':{'sha':'tree'}}
            return {'sha':'new'}
        with tempfile.TemporaryDirectory() as d,patch.dict(os.environ,{'GITHUB_REPOSITORY':publish.REPO}),patch('sys.argv',['publish.py','publish','--directory',d]),patch('publish.api',side_effect=api):
            Path(d,'expected-head.txt').write_text('head');Path(d,'official-prices.json').write_text('{}');publish.main()
        self.assertEqual(seen[-1],('PATCH','/git/refs/heads/pricing-data',{'json':{'sha':'new','force':False}}))
        self.assertFalse(any('/main' in path or 'gh-pages' in path or 'releases' in path for _,path,_ in seen))

    def test_other_repository_is_rejected(self):
        with patch.dict(os.environ,{'GITHUB_REPOSITORY':'someone/else'}),patch('sys.argv',['publish.py','prepare','--directory','.']),patch('publish.api') as api:
            with self.assertRaises(ValueError):publish.main()
            api.assert_not_called()

if __name__=='__main__':unittest.main()
