"""Fixture tests for the parsers and contracts that follow today's official page shapes (reviewed 2026-10-19)."""
from pathlib import Path
import unittest, json, copy
from parsers import parse_generic
from collect import text_contract, api_shapes, validate_models, CATALOG_PROVIDERS

FIXTURES=Path(__file__).with_name('fixtures')
CONTRACTS=json.loads(Path(__file__).with_name('contracts.json').read_text(encoding='utf8'))
NOTE='짧은 문맥 기본 단가예요. 긴 문맥·도구 비용은 응답 총액을 확인하세요.'

class ParserFixtureTests(unittest.TestCase):
    def test_cometapi_public_catalog_applies_pay_ratio_and_tiered_expressions(self):
        models=parse_generic('cometapi',FIXTURES)
        self.assertEqual(models['claude-sonnet-5-5'],{'rates':{'input':1.6,'output':8.0,'cacheRead':0.16,'cacheWrite':2.0}})
        haiku=models['claude-haiku-5-5']
        self.assertEqual(haiku['longAbove'],100000)
        self.assertAlmostEqual(haiku['rates']['input'],0.08);self.assertAlmostEqual(haiku['rates']['cacheWrite5m'],0.1);self.assertAlmostEqual(haiku['rates']['cacheWrite1h'],0.16)
        self.assertAlmostEqual(haiku['longRates']['output'],2.0)
        self.assertEqual(models['muse-wonder'],{'rates':{'input':3.2,'output':16.0}})
        # Routers, per-request text models and non-text models never receive token rates.
        self.assertEqual(set(models),{'claude-sonnet-5-5','claude-haiku-5-5','muse-wonder'})
        fields=CONTRACTS['providers']['cometapi']['apiFields'];raw=(FIXTURES/'cometapi-catalog.json').read_text(encoding='utf8')
        self.assertEqual(api_shapes('cometapi',raw,fields),[])
        self.assertTrue(api_shapes('cometapi',raw.replace('"USD / M Tokens"','"USD / K Tokens"'),fields))
        self.assertTrue(api_shapes('cometapi',raw.replace('"ratio"','"pay_ratio"'),fields))

    def test_pollinations_accepts_new_per_token_field_mixes_but_not_new_units(self):
        models=parse_generic('pollinations',FIXTURES)
        self.assertEqual(models['openai/gpt-5.4-nano'],{'rates':{'input':0.15,'output':0.9375,'cacheRead':0.015}})
        self.assertEqual(models['gpt-5.4-nano'],models['openai/gpt-5.4-nano'])
        self.assertEqual(models['community/MarcosFRG/gemini-3-flash-preview:paid'],{'rates':{'input':0.4,'output':2.5,'cacheRead':0.04}})
        self.assertNotIn('qwen/qwen3guard-gen-8b',models);self.assertNotIn('tongyi-mai/z-image-turbo',models)
        fields=CONTRACTS['providers']['pollinations']['apiFields'];raw=(FIXTURES/'pollinations-catalog.json').read_text(encoding='utf8')
        self.assertEqual(api_shapes('pollinations',raw,fields),[])
        self.assertTrue(api_shapes('pollinations',raw.replace('"promptTextTokens"','"promptTextChars"',1),fields))
        self.assertTrue(api_shapes('pollinations',raw.replace('"pollen"','"usd"',1),fields))
        self.assertTrue(api_shapes('pollinations',raw.replace('"0.00000015"','"n/a"',1),fields))

    def test_siliconflow_cn_www_page_rows_tiers_and_time_based_rows(self):
        models=parse_generic('siliconflow_cn',FIXTURES)
        self.assertEqual(models,{'deepseek-ai/DeepSeek-V3.2':{'rates':{'input':4.0,'output':6.0,'cacheRead':0.4}},
            'Pro/zai-org/GLM-5.1':{'rates':{'input':6.0,'output':24.0,'cacheRead':1.3},'longAbove':31999,'longRates':{'input':8.0,'output':28.0,'cacheRead':2.0}}})

    def test_perplexity_vendor_tables(self):
        models=parse_generic('perplexity',FIXTURES)
        self.assertEqual(models['xai/grok-4.7'],{'rates':{'input':2.0,'output':6.0,'cacheRead':0.5},'note':NOTE})
        self.assertEqual(models['openai/gpt-6.1-sol']['rates'],{'input':2.0,'output':10.0,'cacheRead':0.1})
        self.assertEqual(models['openai/gpt-5.5']['rates'],{'input':5.0,'output':30.0,'cacheRead':0.5})
        self.assertEqual(len(models),11)

    def test_aimlapi_language_rows_only(self):
        models=parse_generic('aimlapi',FIXTURES)
        self.assertEqual(models,{'aion-labs/aion-2.0':{'rates':{'input':1.10032,'output':2.20064,'cacheRead':0.2751}},'aion-labs/aion-3.0':{'rates':{'input':4.1262,'output':8.2524,'cacheRead':1.0316}}})

    def test_marketplace_contracts_ignore_catalog_rows_but_not_headers_or_prose(self):
        for provider,name,row,header in [('perplexity','perplexity-models','xai/grok-4.7','Input ($/1M)'),('aimlapi','aimlapi-price','aion-labs/aion-2.0','per 1M tokens')]:
            raw=(FIXTURES/(name+'.raw')).read_text(encoding='utf8');base=text_contract(provider,name,raw)
            self.assertIn(row,raw);self.assertIn(header,raw)
            self.assertEqual(base,text_contract(provider,name,raw.replace(row,row+'-next')))
            self.assertNotEqual(base,text_contract(provider,name,raw.replace(header,header.replace('1M','1K'))))
        raw=(FIXTURES/'perplexity-models.raw').read_text(encoding='utf8')
        self.assertNotEqual(text_contract('perplexity','perplexity-models',raw),text_contract('perplexity','perplexity-models',raw.replace('token-based pricing','request-based pricing')))

    def test_gemini_promotional_price_carries_its_expiry(self):
        models=parse_generic('gemini',FIXTURES)
        argon=models['gemini-4-argon']
        self.assertEqual(argon['rates'],{'input':2.0,'output':10.0,'cacheRead':0.1})
        self.assertEqual(argon['tiers']['batch'],{'input':1.0,'output':5.0,'cacheRead':0.05})
        self.assertEqual(argon['tiers']['priority'],{'input':3.6,'output':18.0,'cacheRead':0.18})
        self.assertNotIn('contributor',argon['tiers'])
        self.assertEqual(argon['expires'],'2026-11-30T23:59:59Z');self.assertIn('2026-11-30',argon['note'])
        pro=models['gemini-3.1-pro-preview']
        self.assertEqual(pro['longAbove'],200000);self.assertNotIn('expires',pro)
        self.assertEqual(pro['rates'],{'input':2.0,'output':12.0,'cacheRead':0.2});self.assertEqual(pro['longRates'],{'input':4.0,'output':18.0,'cacheRead':0.4})

class CatalogPolicyTests(unittest.TestCase):
    def setUp(self):
        self.old={f'm{i}':{'rates':{'input':1.0,'output':2.0}} for i in range(20)}

    def test_catalog_drops_a_few_removed_models_but_not_a_collapsed_catalog(self):
        new=copy.deepcopy(self.old);del new['m0'];del new['m1'];del new['m2']
        self.assertEqual(validate_models(new,self.old,'generic',catalog=True)['removed'],['m0','m1','m2'])
        with self.assertRaises(ValueError):validate_models(copy.deepcopy(new),self.old,'generic')
        collapsed={k:v for k,v in self.old.items() if k>'m3'}
        with self.assertRaises(ValueError):validate_models(collapsed,self.old,'generic',catalog=True)

    def test_catalog_holds_out_of_band_moves_at_the_last_verified_price(self):
        new=copy.deepcopy(self.old);new['m5']={'rates':{'input':10.0,'output':2.0}};new['m6']={'rates':{'input':0.0,'output':0.0}};new['m7']={'rates':{'input':1.5,'output':2.0}}
        outcome=validate_models(new,self.old,'generic',catalog=True)
        self.assertEqual(set(outcome['held']),{'m5','m6'})
        self.assertEqual(new['m5'],self.old['m5']);self.assertEqual(new['m6'],self.old['m6']);self.assertEqual(new['m7']['rates']['input'],1.5)
        self.assertEqual(outcome['held']['m5']['seen']['rates']['input'],10.0)
        with self.assertRaises(ValueError):validate_models(copy.deepcopy(new)|{'m5':{'rates':{'input':10.0,'output':2.0}}},self.old,'generic')

    def test_reviewed_acceptances_apply_exactly_once(self):
        new=copy.deepcopy(self.old);del new['m0'];new['m5']={'rates':{'input':10.0,'output':2.0}}
        reviewed={'removed':['m0'],'rates':{'m5':{'input':10.0,'output':2.0}}}
        outcome=validate_models(new,self.old,'generic',catalog=False,reviewed=reviewed)
        self.assertEqual(outcome,{'removed':['m0'],'held':{}});self.assertEqual(new['m5']['rates']['input'],10.0)
        with self.assertRaises(ValueError):validate_models(copy.deepcopy(new)|{'m5':{'rates':{'input':11.0,'output':2.0}}},self.old,'generic',reviewed=reviewed)

    def test_curated_providers_are_not_catalogs(self):
        for provider in ['anthropic','openai','deepseek','xai','gemini','groq','mistral','minimax','moonshot','zai','fireworks','together','workers','siliconflow']:
            self.assertNotIn(provider,CATALOG_PROVIDERS)

if __name__=='__main__':unittest.main()
