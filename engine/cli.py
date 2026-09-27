#!/usr/bin/env python3
"""ONE JSON request on stdin, ONE JSON response on stdout. No network."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from engine.api import dispatch
from engine.common import EngineError

def main():
    try:
        payload=sys.stdin.read(25*1024*1024+1)
        if len(payload)>25*1024*1024:raise EngineError('Request exceeds25MB','request_limit')
        request=json.loads(payload,parse_constant=lambda value:(_ for _ in ()).throw(EngineError('Non-finite JSON number')))
        result=dispatch(request)
        print(json.dumps(result,ensure_ascii=False,allow_nan=False,default=str))
        return 0
    except EngineError as e:
        print(json.dumps({'error':{'code':e.code,'message':str(e)}},ensure_ascii=False));print(str(e),file=sys.stderr);return 2
    except (ValueError,TypeError,KeyError,IOError) as e:
        print(json.dumps({'error':{'code':'invalid_input','message':str(e)}},ensure_ascii=False));print(str(e),file=sys.stderr);return 2
    except Exception as e:
        print(json.dumps({'error':{'code':'engine_error','message':'Financial engine could not process the input safely.'}}));print(f'{type(e).__name__}: {e}',file=sys.stderr);return 1

if __name__=='__main__':sys.exit(main())
