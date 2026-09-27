import unittest, tempfile, json, subprocess, sys, zipfile
from pathlib import Path
from decimal import Decimal
from engine.api import dispatch
from engine.common import EngineError

def fact(c,v,p='2025',**extra):
    unit='percent' if c=='peer_gross_margin' else 'number' if c in ('peer_count','deposits_eligible','covenant_limit','covenant_actual') else 'currency'
    return {'id':f'{c}:{p}','concept':c,'period':p,'value':v,'original_value':v,'scale':1,'currency':'SAR','unit':unit,'source':{'sheet':'Input','cell':f'B{len(c)}'},'review_status':'reviewed','scope':'consolidated',**extra}

def fixture():
    facts=[]
    for p,r in [('2023',1000),('2024',1200),('2025',1500)]:
        values={'revenue':r,'cogs':r*.6,'gross_profit':r*.4,'ebit':r*.25,'net_income':r*.2,'cfo':r*.23,'cash':100,'deposits':200,'receivables':300,'contract_assets':100,'inventory':0,'current_assets':700,'noncurrent_assets':300,'total_assets':1000,'current_liabilities':250,'noncurrent_liabilities':250,'total_liabilities':500,'equity':500,'borrowing_current':0,'borrowing_noncurrent':100,'lease_current':10,'lease_noncurrent':20,'finance_cost':10,'depreciation_amortization':20,'sga':100,'gna':70,'credit_sales':r,'trade_payables':100,'purchases':r*.5,'capex':50,'ar_allowance':30,'gross_receivables':330}
        facts.extend(fact(c,v,p) for c,v in values.items())
    return facts

def metrics(facts):return {(m['key'],m['period']):m for m in dispatch({'op':'analyze','facts':facts})['metrics']}

class FinancialTests(unittest.TestCase):
    def test_all_35_metrics_numeric_reference_case(self):
        fs=fixture()
        for f in fs:
            if f['concept']=='inventory':f['value']=20
        for p in ('2024','2025'):
            fs.extend(fact(c,v,p) for c,v in {'contract_liabilities':40,'net_income_parent':290,'equity_parent':400,'nopat':250,'invested_capital':500,'organic_revenue_current':1100,'organic_revenue_prior':1000,'largest_customer_revenue':150,'overdue_receivables':33,'cfads':100,'debt_service':50,'covenant_actual':2.5,'customer_revenue':100,'customer_service_cost':70}.items())
            fs.append(fact('covenant_limit',4,p,comparison='maximum'))
            fs.append(fact('forecast_cash',88,p,forecast_approved=True))
        m=metrics(fs)
        expected={'revenue_growth':25,'ebit_growth':25,'gross_margin':40,'ebit_margin':25,'net_margin':20,'sga_ratio':100/1500*100,'ebitda':395,'ebitda_margin':395/1500*100,'cfo_to_net_income':115,'operating_cash_margin':23,'free_cash_flow':295,'current_ratio':2.8,'quick_ratio':1.6,'cash_ratio':.4,'operating_working_capital':280,'receivables_days':73,'dso':73,'dio':20/900*365,'dpo':100/750*365,'ccc':73+20/900*365-100/750*365,'contract_assets_ratio':100/1500*100,'net_debt':30,'net_debt_to_ebitda':30/395,'interest_coverage':37.5,'roa':30,'roe':72.5,'roic':50,'organic_growth':10,'customer_concentration':10,'allowance_coverage':30/330*100,'overdue_receivables_ratio':10,'dscr':2,'covenant_headroom':1.5,'customer_profit':30,'liquidity_forecast':88}
        self.assertEqual(len(expected),35)
        for key,value in expected.items():
            with self.subTest(metric=key):self.assertAlmostEqual(m[key,'2025']['value'],value,places=8)
    def test_complete_library_and_units(self):
        m=metrics(fixture());self.assertEqual(len(m),105)
        self.assertEqual(m['gross_margin','2025']['value'],40)
        self.assertEqual(m['revenue_growth','2025']['value'],25)
        self.assertEqual(m['ebitda','2025']['value'],395)
        self.assertEqual(m['free_cash_flow','2025']['value'],295)
        self.assertEqual(m['receivables_days','2025']['value'],73)
        self.assertEqual(m['dso','2025']['value'],73)
        self.assertAlmostEqual(m['dpo','2025']['value'],365*100/750)
        self.assertAlmostEqual(m['ccc','2025']['value'],73-365*100/750)
        self.assertEqual(m['dio','2025']['status'],'not_applicable')
        self.assertEqual(m['roa','2023']['status'],'insufficient_data')
        self.assertTrue(m['gross_margin','2025']['inputs'])
        self.assertTrue(m['gross_margin','2025']['source_refs'])
    def test_zero_and_negative_denominators(self):
        for denominator in (0,-100):
            m=metrics([fact('revenue',denominator),fact('gross_profit',-30),fact('net_income',denominator),fact('cfo',10)])
            self.assertIsNone(m['gross_margin','2025']['value'])
            self.assertEqual(m['gross_margin','2025']['status'],'invalid_denominator')
            self.assertEqual(m['cfo_to_net_income','2025']['status'],'invalid_denominator')
        self.assertEqual(metrics([fact('revenue',100),fact('gross_profit',-30)])['gross_margin','2025']['value'],-30)
    def test_missing_never_zero(self):
        m=metrics([fact('revenue',100),fact('inventory',None)])
        self.assertIsNone(m['gross_margin','2025']['value'])
        self.assertEqual(m['gross_margin','2025']['status'],'insufficient_data')
        self.assertEqual(m['dio','2025']['status'],'insufficient_data')
        self.assertEqual(m['ccc','2025']['status'],'insufficient_data')
        self.assertEqual(m['receivables_days','2025']['status'],'insufficient_data')
    def test_conflicting_sources_block_instead_of_last_wins(self):
        facts=[fact('revenue',100),fact('gross_profit',30),fact('gross_profit',40,id='alternate')]
        a=dispatch({'op':'analyze','facts':facts})
        self.assertIsNone(next(m for m in a['metrics'] if m['key']=='gross_margin')['value'])
        self.assertTrue(any(c['id'].startswith('conflict') and c['status']=='fail' for c in a['checks']))
        self.assertTrue(any(f['rule_id']=='DQ01' for f in a['findings']))
    def test_duplicate_identical_allowed(self):
        f=fact('revenue',100)
        a=dispatch({'op':'analyze','facts':[f,dict(f,id='copy'),fact('gross_profit',30)]})
        self.assertFalse(any(c['id'].startswith('conflict') for c in a['checks']))
    def test_currency_scope_and_units_block(self):
        m=metrics([fact('revenue',100,currency='SAR'),fact('gross_profit',30,currency='USD')])
        self.assertEqual(m['gross_margin','2025']['status'],'insufficient_data')
        m=metrics([fact('revenue',100,'2024',currency='USD'),fact('revenue',200,'2025',currency='SAR')])
        self.assertIsNone(m['revenue_growth','2025']['value'])
        m=metrics([fact('revenue',100,unit='days'),fact('gross_profit',30)])
        self.assertIsNone(m['gross_margin','2025']['value'])
    def test_nonfinite_and_invalid_fact_check(self):
        for value in (float('nan'),float('inf'),-float('inf'),'not a number'):
            a=dispatch({'op':'analyze','facts':[fact('revenue',value)]})
            self.assertTrue(any(c['status']=='fail' for c in a['checks']))
            self.assertIsNone(next(m for m in a['metrics'] if m['key']=='gross_margin')['value'])
    def test_eligible_cash_and_leases_policy(self):
        facts=fixture();m=metrics(facts)
        self.assertEqual(m['net_debt','2025']['value'],30)
        self.assertEqual(m['net_debt','2025']['status'],'proxy')
        self.assertEqual(m['net_debt','2025']['including_all_deposits_value'],-170)
        m=metrics(facts+[fact('deposits_eligible',1)])
        self.assertEqual(m['net_debt','2025']['value'],-170)
        a=dispatch({'op':'analyze','facts':facts,'settings':{'include_leases':False}})
        self.assertEqual(next(m for m in a['metrics'] if m['id']=='net_debt:2025')['value'],0)
    def test_broad_payables_not_supplier_days(self):
        fs=[f for f in fixture() if f['concept'] not in ('trade_payables','purchases','credit_sales')]
        fs += [fact('payables_other',500)]
        m=metrics(fs)
        self.assertEqual(m['dpo','2025']['status'],'insufficient_data')
        self.assertEqual(m['ccc','2025']['status'],'insufficient_data')
    def test_no_nonadjacent_opening_balance(self):
        fs=[f for f in fixture() if f['period']!='2024']
        self.assertIsNone(metrics(fs)['roa','2025']['value'])
    def test_reconciliation_detects_material_difference(self):
        fs=fixture()
        for f in fs:
            if f['concept']=='equity' and f['period']=='2025':f['value']=400
        a=dispatch({'op':'analyze','facts':fs})
        c=next(c for c in a['checks'] if c['id']=='balance_sheet:2025')
        self.assertEqual(c['status'],'fail');self.assertEqual(c['difference'],100)
    def test_all_ten_rules_justified(self):
        fs=[]
        for p,vals in [('2024',{'revenue':1000,'gross_profit':400,'net_income':200,'cfo':100,'receivables':100,'contract_assets':100,'gna':50,'borrowing_current':0,'borrowing_noncurrent':0,'ar_allowance':10,'gross_receivables':100}),('2025',{'revenue':1000,'gross_profit':200,'net_income':200,'cfo':100,'receivables':300,'contract_assets':300,'gna':100,'borrowing_current':100,'borrowing_noncurrent':200,'ar_allowance':30,'gross_receivables':100,'cash':10,'liquidity_requirements':100,'undrawn_facility':0,'peer_gross_margin':40,'peer_count':5,'action_effect_actual':10,'action_effect_target':100})]:
            fs.extend(fact(c,v,p) for c,v in vals.items())
        a=dispatch({'op':'analyze','facts':fs})
        self.assertEqual({f['rule_id'] for f in a['findings']},{f'R{i:02d}' for i in range(1,11)})
        self.assertTrue(all(f['source_refs'] and f['questions_ar'] for f in a['findings']))
    def test_rule_abstains_on_currency_or_scope_mismatch(self):
        for mismatch in ({'currency':'USD'},{'scope':'standalone'}):
            fs=[fact('cash',10,**mismatch),fact('liquidity_requirements',100),fact('undrawn_facility',0)]
            self.assertFalse(dispatch({'op':'analyze','facts':fs})['findings'])
            fs=[fact('action_effect_actual',10,**mismatch),fact('action_effect_target',100)]
            self.assertFalse(dispatch({'op':'analyze','facts':fs})['findings'])
            fs=[fact('borrowing_current',0,'2024',**mismatch),fact('borrowing_noncurrent',0,'2024',**mismatch),fact('borrowing_current',100),fact('borrowing_noncurrent',100)]
            self.assertFalse(dispatch({'op':'analyze','facts':fs})['findings'])
        self.assertFalse(dispatch({'op':'analyze','facts':[fact('cash',10),fact('liquidity_requirements',100)]})['findings'])
    def test_unresolved_formula_blocks_review_only_and_accepts_documented_override(self):
        for state in ('unsupported_or_missing_precedent','cache_mismatch',None):
            f=fact('revenue',100,formula='=WEBSERVICE("https://invalid.example")',cache_status=state)
            a=dispatch({'op':'analyze','facts':[f]})
            self.assertTrue(any(c['id'].startswith('formula_unresolved') and c['status']=='fail' for c in a['checks']))
            f['manual_override']={'reason':'Independently confirmed source-page amount','by':'reviewer','at':'2026-09-27T00:00:00Z'}
            a=dispatch({'op':'analyze','facts':[f]})
            self.assertTrue(any(c['id'].startswith('formula_unresolved') and c['status']=='pass' for c in a['checks']))
            f['value']=None
            a=dispatch({'op':'analyze','facts':[f]})
            self.assertTrue(any(c['id'].startswith('formula_unresolved') and c['status']=='fail' for c in a['checks']))
    def test_empty_and_unknown_operation(self):
        self.assertEqual(dispatch({'op':'analyze','facts':[]})['metrics'],[])
        with self.assertRaises(EngineError):dispatch({'op':'do_something'})

class ScenarioTests(unittest.TestCase):
    def calculate(self,kind,low=5,base=10,high=15,**extra):
        return dispatch({'op':'scenario','facts':fixture(),'scenario':{'type':kind,'low':low,'base':base,'high':high,**extra}})
    def test_distinct_cases_exact_amounts(self):
        s=self.calculate('collection_days')
        self.assertAlmostEqual(s['base'],1500/365*10)
        self.assertEqual(s['effect_type'],'cash_release')
        self.assertLess(s['low'],s['base']);self.assertLess(s['base'],s['high'])
        self.assertFalse(s['recurring'])
    def test_percentage_points_not_relative_percent(self):
        self.assertEqual(self.calculate('gross_margin',.5,1,2)['low'],7.5)
        self.assertEqual(self.calculate('opex_reduction',1,3,5)['base'],3)
        self.assertEqual(self.calculate('financing_rate',25,50,100)['base'],.5)
        self.assertEqual(self.calculate('contract_assets',5,10,15)['base'],10)
    def test_cost_and_financing_effect_separate(self):
        s=self.calculate('collection_days',implementation_cost=100,financing_rate=5)
        self.assertAlmostEqual(s['base'],1500/365*10)
        self.assertEqual(s['implementation_cost'],100)
        self.assertAlmostEqual(s['conditional_annual_financing_saving']['base'],s['base']*.05)
    def test_double_counting_semantics(self):
        ar=self.calculate('collection_days');ca=self.calculate('contract_assets')
        self.assertEqual(ar['dependency_group'],ca['dependency_group'])
        self.assertIn('do_not_sum',ar['aggregation_policy'])
        self.assertEqual(self.calculate('gross_margin',.5,1,2)['dependency_group'],self.calculate('opex_reduction')['dependency_group'])
    def test_reject_bad_assumptions(self):
        for low,base,high in [(-1,2,3),(5,2,10),(1,2,366),(float('nan'),2,3),(1,float('inf'),3),('1',2,3),(False,2,3)]:
            with self.assertRaises(EngineError):self.calculate('collection_days',low,base,high)
        with self.assertRaises(EngineError):self.calculate('gross_margin',1,20,80)
        with self.assertRaises(EngineError):self.calculate('contract_assets',1,20,101)
        with self.assertRaises(EngineError):self.calculate('financing_rate',1,20,10001)
    def test_missing_borrowing_not_zero(self):
        with self.assertRaises(EngineError):dispatch({'op':'scenario','facts':[fact('borrowing_current',100)],'scenario':{'type':'financing_rate','low':25,'base':50,'high':100}})

class ExtractionTests(unittest.TestCase):
    def test_xlsx_formulas_sign_and_no_execution(self):
        from openpyxl import Workbook
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'case.xlsx';marker=Path(tmp)/'should-not-exist'
            w=Workbook();s=w.active;s.title='Financial Statements'
            s.append(['Line Item','2024','2025'])
            s.append(['Revenue',1000,1500]);s.append(['Cost of Revenue',-600,-900]);s.append(['Gross Profit','=B2+B3','=C2+C3'])
            s.append(['Net Income',None,f'=WEBSERVICE("https://invalid.example/{marker.name}")'])
            s.append(['Operating cash flow',None,"='[external.xlsx]Sheet1'!A1"])
            s.append(['General and administrative',0,20]);w.save(path)
            out=dispatch({'op':'extract','path':str(path),'filename':'case.xlsx','scale':1})
            fs={(f['concept'],f['period']):f for f in out['facts']}
            self.assertEqual(fs['gross_profit','2025']['value'],600)
            self.assertEqual(fs['gross_profit','2025']['cache_status'],'recalculated_no_cache')
            self.assertEqual(fs['cogs','2025']['value'],900)
            self.assertEqual(fs['cogs','2025']['original_value'],-900)
            self.assertIsNone(fs['net_income','2025']['value'])
            self.assertIn('WEBSERVICE',fs['net_income','2025']['formula'])
            self.assertIsNone(fs['cfo','2025']['value'])
            self.assertEqual(fs['gna','2024']['value'],0)
            self.assertFalse(marker.exists())
    def test_csv_and_mapping(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'case.csv';path.write_text('concept,period,value\nrevenue,2025,100\nMystery,2025,42\n',encoding='utf8')
            out=dispatch({'op':'extract','path':str(path),'scale':1000})
            self.assertEqual(out['facts'][0]['value'],100000)
            self.assertTrue(out['requires_manual_mapping'])
            self.assertEqual(out['facts'][1]['concept'],'unmapped')
    def test_text_pdf_provisional_source(self):
        from pypdf import PdfWriter
        from pypdf.generic import DictionaryObject,NameObject,DecodedStreamObject
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'case.pdf';writer=PdfWriter();page=writer.add_blank_page(width=600,height=800)
            font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Courier')})
            page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):writer._add_object(font)})})
            stream=DecodedStreamObject();stream.set_data(b'BT /F1 12 Tf 50 750 Td (Line Item            2024        2025) Tj 0 -20 Td (Revenue              1000        1500) Tj ET')
            page[NameObject('/Contents')]=writer._add_object(stream)
            with path.open('wb') as handle:writer.write(handle)
            out=dispatch({'op':'extract','path':str(path),'scale':1})
            self.assertEqual(out['document_type'],'pdf')
            self.assertEqual(next(f for f in out['facts'] if f['period']=='2025')['value'],1500)
            self.assertEqual(out['facts'][0]['source']['page'],1)
            self.assertTrue(any('provisional' in w for w in out['warnings']))
            self.assertEqual(out['facts'][0]['review_status'],'needs_review')
            self.assertEqual(out['facts'][0]['source']['bbox_status'],'unavailable_text_line_only')
    def test_pdf_fragmented_header_and_note_reference_column(self):
        # Regression test for a real bug found against a real official annual-report PDF:
        # (1) the period header can arrive as its own standalone line with no leading label
        # cell at all ("2024   2025", not "Line Item   2024   2025") — index-aligning data
        # rows against such a header used to slice every label to an empty string and drop
        # the row entirely; (2) a bare note-reference number between the label and the values
        # ("Revenue   25   1000   1500") used to get glued onto the label ("Revenue 25"),
        # silently breaking concept matching even though the row was otherwise clean.
        from pypdf import PdfWriter
        from pypdf.generic import DictionaryObject,NameObject,DecodedStreamObject
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'case.pdf';writer=PdfWriter();page=writer.add_blank_page(width=600,height=800)
            font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Courier')})
            page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):writer._add_object(font)})})
            stream=DecodedStreamObject();stream.set_data(
                b'BT /F1 12 Tf '
                b'50 750 Td (2024) Tj 100 0 Td (2025) Tj '
                b'-150 -20 Td (Revenue) Tj 150 0 Td (25) Tj 80 0 Td (1000) Tj 100 0 Td (1500) Tj '
                b'-330 -20 Td (Gross Profit) Tj 130 0 Td (400) Tj 100 0 Td (600) Tj '
                b'ET')
            page[NameObject('/Contents')]=writer._add_object(stream)
            with path.open('wb') as handle:writer.write(handle)
            out=dispatch({'op':'extract','path':str(path),'scale':1})
            revenue={f['period']:f['value'] for f in out['facts'] if f['concept']=='revenue'}
            gross={f['period']:f['value'] for f in out['facts'] if f['concept']=='gross_profit'}
            self.assertEqual(revenue.get('2024'),1000);self.assertEqual(revenue.get('2025'),1500)
            self.assertEqual(gross.get('2024'),400);self.assertEqual(gross.get('2025'),600)
    def test_blank_pdf_manual_fallback(self):
        from pypdf import PdfWriter
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'blank.pdf';writer=PdfWriter();writer.add_blank_page(width=600,height=800)
            with path.open('wb') as handle:writer.write(handle)
            out=dispatch({'op':'extract','path':str(path),'scale':1})
            self.assertEqual(out['facts'],[]);self.assertTrue(out['requires_manual_mapping'])
            self.assertTrue(any('OCR' in w for w in out['warnings']))
    def test_formula_cache_match_mismatch_and_unsupported(self):
        from openpyxl import Workbook
        import re
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'cache.xlsx';w=Workbook();s=w.active;s.title='Statements'
            s.append(['Line Item','2024','2025']);s.append(['Revenue',100,200]);s.append(['COGS',70,140]);s.append(['Gross Profit','=B2-B3','=C2-C3']);s.append(['Net Income','=WEBSERVICE("https://invalid.example")',None]);w.save(path)
            with zipfile.ZipFile(path) as z:contents={n:z.read(n) for n in z.namelist()}
            xml=contents['xl/worksheets/sheet1.xml'].decode()
            for cell,value in [('B4',30),('C4',999),('B5',123)]:
                # openpyxl writes formula cells with a self-closing <v/> (no cached result);
                # match both that form and an open/close <v>...</v> so the injected cache value sticks.
                xml=re.sub(r'(<c r="'+cell+r'"[^>]*>(?:(?!</c>).)*?)<v(?:\s*/>|>.*?</v>)',lambda m:m.group(1)+f'<v>{value}</v>',xml)
            contents['xl/worksheets/sheet1.xml']=xml.encode()
            with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
                for n,content in contents.items():z.writestr(n,content)
            out=dispatch({'op':'extract','path':str(path),'scale':1})
            fs={f['source']['cell']:f for f in out['facts']}
            self.assertEqual(fs['B4']['cache_status'],'independently_verified')
            self.assertEqual(fs['C4']['cache_status'],'cache_mismatch');self.assertEqual(fs['C4']['value'],60);self.assertEqual(fs['C4']['cached_value'],999)
            self.assertIsNone(fs['B5']['value']);self.assertEqual(fs['B5']['cached_value'],123)
            self.assertIn('WEBSERVICE',fs['B5']['raw_text']);self.assertIn('formula_engine',fs['B5']);self.assertIn('engine_version',out)
            for f in out['facts']:f['review_status']='reviewed'
            checks=dispatch({'op':'analyze','facts':out['facts']})['checks']
            self.assertEqual(sum(c['status']=='fail' and c['id'].startswith('formula_unresolved') for c in checks),2)
    def test_cli_single_json_and_nonfinite(self):
        cli=Path(__file__).resolve().parents[2]/'engine'/'cli.py'
        result=subprocess.run([sys.executable,str(cli)],input='{"op":"analyze","facts":[]}',text=True,capture_output=True)
        self.assertEqual(result.returncode,0);self.assertEqual(len(result.stdout.splitlines()),1);json.loads(result.stdout)
        result=subprocess.run([sys.executable,str(cli)],input='{"op":"analyze","facts":NaN}',text=True,capture_output=True)
        self.assertNotEqual(result.returncode,0);self.assertIn('error',json.loads(result.stdout))

if __name__=='__main__':unittest.main()
