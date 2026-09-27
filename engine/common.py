from decimal import Decimal, InvalidOperation
import math

class EngineError(ValueError):
    def __init__(self, message, code='invalid_input'):
        super().__init__(message)
        self.code=code

def number(value, nullable=True):
    if value is None:
        if nullable:return None
        raise EngineError('Numeric value required')
    if isinstance(value,bool):raise EngineError('Boolean is not a financial number')
    try:result=Decimal(str(value))
    except (InvalidOperation,ValueError,TypeError):raise EngineError('Invalid numeric value')
    if not result.is_finite() or abs(result)>Decimal('1e24'):raise EngineError('Non-finite or out-of-range number')
    return result

def output(value):
    if value is None:return None
    result=float(value)
    if not math.isfinite(result):raise EngineError('Non-finite result')
    return result

def ref(fact):
    s=fact.get('source') or {}
    if s.get('sheet') and s.get('cell'):return f"{s['sheet']}!{s['cell']}"
    if s.get('page'):return f"page {s['page']}"+(f" row {s['row']}" if s.get('row') else '')
    if s.get('row'):return f"row {s['row']}"
    return str(fact.get('id','unknown'))

class Facts:
    def __init__(self,facts):
        if not isinstance(facts,list) or len(facts)>50000:raise EngineError('facts must be an array, maximum50000')
        self.facts=facts;self.by_key={};self.conflicts=[];self.invalid=[]
        self.periods=sorted({str(f.get('period')) for f in facts if isinstance(f,dict) and f.get('period') is not None})
        for f in facts:
            if not isinstance(f,dict):raise EngineError('Fact must be an object')
            c,p=f.get('concept'),str(f.get('period',''))
            if not c or c=='unmapped' or not p:continue
            expected='percent' if c=='peer_gross_margin' else 'number' if c in ('peer_count','deposits_eligible','covenant_limit','covenant_actual') else 'currency'
            if f.get('unit','currency')!=expected:
                self.invalid.append(f);continue
            try:number(f.get('value'))
            except EngineError:self.invalid.append(f);continue
            self.by_key.setdefault((c,p),[]).append(f)
        for key,fs in self.by_key.items():
            sig={(number(f['value']),f.get('currency','SAR'),f.get('scope','consolidated'),f.get('unit','currency')) for f in fs if f.get('value') is not None}
            if len(sig)>1:self.conflicts.append(key)
    def fact(self,c,p):
        if (c,p) in self.conflicts:return None
        fs=self.by_key.get((c,p),[])
        return next((f for f in fs if f.get('value') is not None),fs[0] if fs else None)
    def get(self,c,p):
        f=self.fact(c,p);return number(f.get('value')) if f else None
    def refs(self,cs,p):return list(dict.fromkeys(ref(f) for c in cs for f in self.by_key.get((c,p),[])))
    def ids(self,cs,p):return list(dict.fromkeys(str(f.get('id',ref(f))) for c in cs for f in self.by_key.get((c,p),[])))
    def prior(self,p):
        try:prior=str(int(p)-1);return prior if prior in self.periods else None
        except (TypeError,ValueError):return None
    def sum(self,cs,p):
        vs=[self.get(c,p) for c in cs];return sum(vs,Decimal(0)) if all(v is not None for v in vs) else None
    def average(self,c,p):
        a,b=self.get(c,self.prior(p)),self.get(c,p)
        return (a+b)/2 if a is not None and b is not None else None
    def compatible(self,cs,p):
        fs=[self.fact(c,p) for c in cs];fs=[f for f in fs if f and f.get('value') is not None]
        return len({f.get('currency','SAR') for f in fs if f.get('unit','currency')=='currency'})<=1 and len({f.get('scope','consolidated') for f in fs})<=1
