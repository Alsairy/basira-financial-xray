from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from html import escape
import json
ROOT=Path(__file__).parent/'fixtures'; ROOT.mkdir(exist_ok=True)
rows=[['Line Item','2023','2024','2025'],['Revenue',10000000,12000000,14400000],['Cost of Revenue',6000000,7800000,10080000],['Gross Profit',4000000,4200000,4320000],['EBIT',2000000,1800000,1600000],['Net Income',1500000,1300000,1100000],['Net Cash from Operating Activities',1400000,800000,300000],['Cash & Cash Equivalents',1000000,800000,600000],['Accounts Receivable',1500000,2200000,3200000],['Contract assets',200000,500000,900000],['Credit sales',8000000,10000000,12000000],['Total Current Assets',4000000,5000000,6000000],['Total Current Liabilities',2000000,3000000,4000000],['Total Assets',10000000,12000000,14000000],['Total Liabilities',4000000,5500000,7000000],['Total Equity',6000000,6500000,7000000],['Short-Term Debt',500000,1000000,1500000],['Long-Term Debt',1500000,2000000,2500000],['Lease liabilities current',0,0,0],['Lease liabilities noncurrent',0,0,0],['Finance costs',100000,200000,300000],['Depreciation and amortization',300000,350000,400000],['General and administrative expenses',1500000,1800000,2020000],['Selling and marketing expenses',500000,600000,700000],['Capital expenditure',700000,800000,900000],['Inventory',300000,400000,500000],['Trade payables',800000,1000000,1300000],['Purchases',6000000,8000000,10000000],['Allowance for doubtful accounts',50000,80000,120000],['Gross accounts receivable',1550000,2280000,3320000],['Income tax expense',400000,300000,200000],['All figures in SAR. Synthetic QA data, not a real company.']]
def workbook(name, override=None, formulas=False):
    data=[r[:] for r in rows]
    for (row,col), value in (override or {}).items(): data[row-1][col-1]=value
    out=[]
    for rn,row in enumerate(data,1):
        cells=[]
        for cn,v in enumerate(row,1):
            ref=f'{chr(64+cn)}{rn}'
            if v is None: continue
            if isinstance(v,str): cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{escape(v)}</t></is></c>')
            else:
                formula=f'<f>{chr(64+cn)}2-{chr(64+cn)}3</f>' if formulas and rn==4 and cn>1 else ''
                cells.append(f'<c r="{ref}">{formula}<v>{v}</v></c>')
        out.append(f'<row r="{rn}">{"".join(cells)}</row>')
    sheet='<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+''.join(out)+'</sheetData></worksheet>'
    contents={'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>','_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>','xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Financial Statements" sheetId="1" r:id="rId1"/></sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>','xl/worksheets/sheet1.xml':sheet}
    with ZipFile(ROOT/name,'w',ZIP_DEFLATED) as z:
        for n,c in contents.items(): z.writestr(n,c)
workbook('balanced.xlsx'); workbook('formula-cached.xlsx',formulas=True)
workbook('unbalanced.xlsx',{(16,4):6000000})
workbook('missing-negative.xlsx',{(11,4):None,(6,4):-100000})
(ROOT/'proof.txt').write_text('Synthetic QA evidence: supplied for workflow verification only. No actual company or realized benefit.\n')
(ROOT/'expected.json').write_text(json.dumps({'period':'2025','revenue':14400000,'gross_margin':30,'collection_days':[5,10,15],'collection_cash':[12000000/365*x for x in [5,10,15]],'scale':1},indent=2))
print('Created', len(list(ROOT.iterdir())), 'QA fixtures')
