from .common import EngineError

def dispatch(request):
    if not isinstance(request,dict):raise EngineError('Request must be a JSON object')
    operation=request.get('op')
    if operation=='extract':
        from .extraction import extract
        return extract(request)
    if operation=='analyze':
        from .metrics import analyze
        settings=request.get('settings') or {}
        if not isinstance(settings,dict):raise EngineError('settings must be an object')
        return analyze(request.get('facts',[]),settings)
    if operation=='scenario':
        from .scenarios import evaluate
        return evaluate(request.get('facts',[]),request.get('scenario'))
    raise EngineError('Supported operations: extract, analyze, scenario','unsupported_operation')
