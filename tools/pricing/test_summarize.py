from datetime import datetime, timezone
import unittest
from summarize import assess, markdown, STALE_DAYS

NOW=datetime(2026,10,19,3,17,tzinfo=timezone.utc)
def feed(**checked):
    return {'generatedAt':'2026-10-19T03:17:00Z','providers':{k:{'checkedAt':v,'models':{'m':{}}} for k,v in checked.items()}}
def previous(**status):
    return {'providers':{k:{'status':v} for k,v in status.items()}}

class SummaryPolicyTests(unittest.TestCase):
    def test_verified_catalog_changes_are_informational(self):
        report={'openrouter':{'status':'ok','models':450,'changed':True,'added':['a'],'removed':['b'],'held':{}},'openai':{'status':'ok','models':43,'changed':False,'added':[],'removed':[],'held':{}}}
        rows,errors,warnings,notes=assess(report,previous(openrouter='ok',openai='ok'),feed(openrouter='2026-10-19T03:17:00Z',openai='2026-10-19T03:17:00Z'),NOW)
        self.assertEqual(errors,[]);self.assertEqual(warnings,[]);self.assertEqual([p for p,_ in notes],['openrouter'])
        self.assertIn('| openai | ✅ ok | 43 | unchanged |',markdown(rows,errors,warnings,notes,report))

    def test_held_prices_warn_and_list_both_values(self):
        report={'chutes':{'status':'ok','models':12,'changed':False,'added':[],'removed':[],'held':{'q':{'kept':{'rates':{'input':0.24,'output':2.2}},'seen':{'rates':{'input':0.039,'output':1.25}}}}}}
        rows,errors,warnings,notes=assess(report,previous(chutes='ok'),feed(chutes='2026-10-19T03:17:00Z'),NOW)
        self.assertEqual(errors,[]);self.assertEqual(warnings[0][0],'chutes')
        text=markdown(rows,errors,warnings,notes,report)
        self.assertIn('"input": 0.24',text);self.assertIn('"input": 0.039',text)

    def test_a_provider_that_newly_needs_attention_fails_the_run_once(self):
        report={'xai':{'status':'review','reason':'Billing page changed; parser review required'}}
        rows,errors,warnings,notes=assess(report,previous(xai='ok'),feed(xai='2026-10-18T03:17:00Z'),NOW)
        self.assertEqual(len(errors),1);self.assertIn('newly',errors[0][1])
        rows,errors,warnings,notes=assess(report,previous(xai='review'),feed(xai='2026-10-18T03:17:00Z'),NOW)
        self.assertEqual(errors,[]);self.assertEqual(len(warnings),1);self.assertIn('Billing page changed',warnings[0][1])

    def test_an_unresolved_provider_fails_again_after_the_grace_period(self):
        report={'siliconflow_cn':{'status':'error','reason':'Official source unavailable'}}
        fresh=feed(siliconflow_cn='2026-10-10T03:17:00Z');stale=feed(siliconflow_cn='2026-10-01T03:17:00Z')
        self.assertEqual(assess(report,previous(siliconflow_cn='error'),fresh,NOW)[1],[])
        errors=assess(report,previous(siliconflow_cn='error'),stale,NOW)[1]
        self.assertEqual(len(errors),1);self.assertIn(f'unverified for {(NOW-datetime(2026,10,1,3,17,tzinfo=timezone.utc)).days} days',errors[0][1])
        self.assertGreater((NOW-datetime(2026,10,1,3,17,tzinfo=timezone.utc)).days,STALE_DAYS)

    def test_a_provider_missing_from_the_previous_feed_counts_as_new(self):
        report={'newco':{'status':'review','reason':'x'}}
        self.assertEqual(len(assess(report,previous(),feed(newco='2026-10-19T03:17:00Z'),NOW)[1]),1)

if __name__=='__main__':unittest.main()
