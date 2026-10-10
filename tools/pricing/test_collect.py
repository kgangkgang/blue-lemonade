from pathlib import Path
import unittest,json,tempfile,copy
from unittest.mock import patch
from collect import text_contract,validate_models,collect,api_shapes,read_models

class PricingTests(unittest.TestCase):
    def test_money_changes_but_not_units_pass_the_document_contract(self):
        a='<html><main>USD per 1M tokens $2.00 input $4 output. Context 200k.</main></html>'
        self.assertEqual(text_contract('groq','groq',a),text_contract('groq','groq',a.replace('$2.00','$2.50')))
        for changed in [a.replace('USD','CNY'),a.replace('1M','1K'),a.replace('200k','100k')]:
            self.assertNotEqual(text_contract('groq','groq',a),text_contract('groq','groq',changed))

    def test_review_only_providers_cannot_silently_reconfirm_new_rates(self):
        for p in ['vertex','cohere','ai21']:
            self.assertNotEqual(text_contract(p,p,'Price $2'),text_contract(p,p,'Price $3'))

    def test_claude_long_context_and_other_tables_are_protected(self):
        a='## Model pricing\n| Claude Haiku 5.5 (for prompts up to 100,000 tokens) | $0.1 |\n| Claude Haiku 5.5 (for prompts over 100,000 tokens) | $0.5 |\n## Fast\n| Claude Opus 5 | $10 |'
        b=a.replace('$0.1','$0.2')
        self.assertEqual(text_contract('anthropic','a',a),text_contract('anthropic','a',b))
        for value in ['$0.5','$10']:
            self.assertNotEqual(text_contract('anthropic','a',a),text_contract('anthropic','a',a.replace(value,'$99')))

    def test_empty_deleted_negative_huge_and_free_switches_are_quarantined(self):
        old={'model':{'rates':{'input':2,'output':4}}}
        for new in [{},{'other':old['model']},{'model':{'rates':{'input':-1,'output':4}}},{'model':{'rates':{'input':10000,'output':4}}},{'model':{'rates':{'input':0,'output':4}}}]:
            with self.assertRaises(ValueError):validate_models(new,old,'generic')
        validate_models({'model':{'rates':{'input':2.5,'output':4}}},old,'generic')

    def test_api_price_numbers_may_change_but_units_must_not(self):
        def raw(unit='per_million_tokens',price='2'):
            return json.dumps({'data':[{'id':'m','pricing':{'unit':unit,'currency':'USD','prompt':price,'completion':'4'}}]})
        self.assertEqual(api_shapes('nanogpt',raw()),api_shapes('nanogpt',raw(price='3')))
        self.assertNotEqual(api_shapes('nanogpt',raw()),api_shapes('nanogpt',raw(unit='per_thousand_tokens')))

    def test_source_failure_isolated_and_last_verified_date_preserved(self):
        raw=json.dumps({'data':[{'id':'test','architecture':{'output_modalities':['text']},'pricing':{'prompt':'0.000002','completion':'0.000004'}}]})
        old={'schema':1,'generatedAt':'2026-01-01T00:00:00Z','providers':{}}
        for provider in ['openrouter','cohere']:
            old['providers'][provider]={'provider':provider,'format':'generic','currency':'USD','checkedAt':'2026-01-01T00:00:00Z','status':'ok','revision':'old','models':{'test':{'rates':{'input':2,'output':4}}}}
        c={'sources':{'openrouter-catalog':{},'cohere':{}},'providers':{'openrouter':{'sources':['openrouter-catalog'],'apiShapes':api_shapes('openrouter',raw)},'cohere':{'sources':['cohere'],'contracts':{'cohere':'anything'}}}}
        def fake(item):return (item[0],raw,None) if item[0]=='openrouter-catalog' else ('cohere',None,'Timeout')
        with tempfile.TemporaryDirectory() as d,patch('collect.fetch_source',side_effect=fake):feed,report=collect(old,c,d)
        self.assertEqual(report['openrouter']['status'],'ok');self.assertEqual(report['cohere']['status'],'error')
        self.assertEqual(feed['providers']['cohere']['models'],old['providers']['cohere']['models'])
        self.assertEqual(feed['providers']['cohere']['checkedAt'],'2026-01-01T00:00:00Z')
        self.assertEqual(old['providers']['cohere']['status'],'ok')

    def test_malformed_html_never_turns_into_an_empty_verified_catalog(self):
        with tempfile.TemporaryDirectory() as d:
            Path(d,'groq.raw').write_text('<html><h1>Temporarily unavailable</h1></html>')
            new=read_models('groq',d,{})
            with self.assertRaises(ValueError):validate_models(new,{'m':{'rates':{'input':1,'output':2}}},'generic')

if __name__=='__main__':unittest.main()
