import datetime, requests
print('TODAY DATE:', datetime.date.today())
base = 'http://127.0.0.1:5000'

tests = [
    ('GET /',                          base + '/'),
    ('indicators.js',                  base + '/static/js/indicators.js'),
    ('chart_manager.js',               base + '/static/js/chart_manager.js'),
    ('test_mt5',                       base + '/api/test_mt5'),
    ('historical BTC hyperliquid',     base + '/api/historical?source=hyperliquid&symbol=BTC&timeframe=5m&limit=3'),
    ('historical EURUSD mt5',          base + '/api/historical?source=mt5&symbol=EURUSD&timeframe=15m&limit=3'),
    ('symbol_format EURUSD',           base + '/api/symbol_format?source=mt5&symbol=EURUSD'),
    ('live EURUSD',                    base + '/api/live?source=mt5&symbol=EURUSD'),
]

all_ok = True
for label, url in tests:
    try:
        r = requests.get(url, timeout=10)
        status = 'OK' if r.status_code == 200 else 'FAIL'
        ct = r.headers.get('Content-Type', '')
        if 'json' in ct:
            d = r.json()
            note = str(d)[:100] if isinstance(d, dict) else str(len(d)) + ' items'
        else:
            note = str(len(r.content)) + ' bytes'
        print(status, label, 'HTTP', r.status_code, '|', note)
        if r.status_code != 200:
            all_ok = False
    except Exception as e:
        print('ERR', label, str(e))
        all_ok = False

print()
print('ALL TESTS PASSED' if all_ok else 'SOME TESTS FAILED')
