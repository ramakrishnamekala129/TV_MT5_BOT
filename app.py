import os
import logging
from flask import Flask, render_template, jsonify, request
from data_source import data_source

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("app")

# Initialize Flask App
app = Flask(__name__)

# Disable caching for development
@app.after_request
def add_header(r):
    r.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    r.headers["Pragma"] = "no-cache"
    r.headers["Expires"] = "0"
    r.headers['Cache-Control'] = 'public, max-age=0'
    return r

# Basic routing
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/test_mt5')
def test_mt5():
    """
    Test and initialize the MetaTrader 5 terminal connection.
    Returns terminal configuration status.
    """
    try:
        status_info = data_source.test_mt5_connection()
        return jsonify(status_info)
    except Exception as e:
        logger.error(f"Error testing MT5 connection: {e}")
        return jsonify({
            "status": "error",
            "message": f"Server error: {e}"
        }), 500

@app.route('/api/historical')
def historical():
    """
    Fetch historical candle data.
    Query parameters:
      - source: mt5, yfinance, hyperliquid
      - symbol: e.g. EURUSD, RELIANCE.NS, BTC
      - timeframe: 1m, 5m, 15m, 1h, 4h, 1d (default: 5m)
      - limit: int (default: 300)
    """
    source = request.args.get('source')
    symbol = request.args.get('symbol')
    timeframe = request.args.get('timeframe', '5m')
    limit_str = request.args.get('limit', '300')

    if not source or not symbol:
        return jsonify({"error": "Missing 'source' or 'symbol' parameter."}), 400

    try:
        limit = int(limit_str)
    except ValueError:
        limit = 300

    logger.info(f"Fetching historical candles: Source={source}, Symbol={symbol}, Timeframe={timeframe}, Limit={limit}")

    try:
        candles = data_source.get_historical_candles(source, symbol, timeframe, limit)
        return jsonify(candles)
    except Exception as e:
        logger.error(f"Error fetching historical candles: {e}")
        return jsonify({"error": f"Failed to retrieve data: {e}"}), 500

@app.route('/api/live')
def live():
    """
    Fetch the latest live price tick.
    Used for MT5 and yfinance live price polling.
    Query parameters:
      - source: mt5, yfinance, hyperliquid
      - symbol: e.g. EURUSD, RELIANCE.NS
    """
    source = request.args.get('source')
    symbol = request.args.get('symbol')

    if not source or not symbol:
        return jsonify({"error": "Missing 'source' or 'symbol' parameter."}), 400

    try:
        price_data = data_source.get_live_price(source, symbol)
        if price_data:
            return jsonify(price_data)
        else:
            return jsonify({"error": f"No live price data found for {symbol} on {source}."}), 404
    except Exception as e:
        logger.error(f"Error fetching live price: {e}")
        return jsonify({"error": f"Failed to retrieve live price: {e}"}), 500



@app.route('/api/log_error', methods=['POST'])
def log_error():
    """
    Log client-side browser errors to Flask terminal.
    """
    try:
        data = request.get_json()
        logger.error(f"CLIENT ERROR: {data.get('message')} at {data.get('source')}:{data.get('lineno')}:{data.get('colno')}\nStack: {data.get('stack')}")
        return jsonify({"status": "ok"})
    except Exception as e:
        logger.error(f"Error logging client error: {e}")
        return jsonify({"status": "error"}), 500


@app.route('/api/symbol_format')
def symbol_format():
    """
    Returns the exact precision (digits) and minMove (point/step) for formatting.
    Used by frontend to automatically scale prices.
    """
    source = request.args.get('source')
    symbol = request.args.get('symbol')
    if not source or not symbol:
        return jsonify({"precision": 2, "minMove": 0.01})
    
    try:
        precision, min_move = data_source.get_symbol_format(source, symbol)
        return jsonify({
            "precision": precision,
            "minMove": min_move
        })
    except Exception as e:
        logger.error(f"Error getting symbol format: {e}")
        return jsonify({"precision": 2, "minMove": 0.01})


# ==========================================
# Trading Endpoints
# ==========================================
@app.route('/api/trading/state')
def trading_state():
    source = request.args.get('source', 'mt5')
    symbol = request.args.get('symbol')
    if source != 'mt5':
        return jsonify({"positions": [], "orders": [], "error": "Trading only supported for MT5"})
    
    state = data_source.get_active_orders(symbol)
    return jsonify(state)

@app.route('/api/trading/place', methods=['POST'])
def trading_place():
    data = request.get_json()
    source = data.get('source', 'mt5')
    if source != 'mt5':
        return jsonify({"status": "error", "message": "Trading only supported for MT5"}), 400
        
    symbol = data.get('symbol')
    order_type = data.get('type')
    volume = data.get('volume')
    price = data.get('price')
    sl = data.get('sl')
    tp = data.get('tp')
    
    if not symbol or not order_type or not volume:
        return jsonify({"status": "error", "message": "Missing required fields"}), 400
        
    result = data_source.place_order(symbol, order_type, volume, price, sl, tp)
    return jsonify(result), 200 if result.get('status') == 'success' else 400

@app.route('/api/trading/modify', methods=['POST'])
def trading_modify():
    data = request.get_json()
    source = data.get('source', 'mt5')
    ticket = data.get('ticket')
    is_position = data.get('is_position', False)
    price = data.get('price')
    sl = data.get('sl')
    tp = data.get('tp')
    
    if not ticket:
        return jsonify({"status": "error", "message": "Missing ticket ID"}), 400
        
    result = data_source.modify_order(ticket, is_position, price, sl, tp)
    return jsonify(result), 200 if result.get('status') == 'success' else 400

@app.route('/api/trading/cancel', methods=['POST'])
def trading_cancel():
    data = request.get_json()
    source = data.get('source', 'mt5')
    ticket = data.get('ticket')
    is_position = data.get('is_position', False)
    symbol = data.get('symbol')
    volume = data.get('volume')
    order_type = data.get('type')
    
    if not ticket:
        return jsonify({"status": "error", "message": "Missing ticket ID"}), 400
        
    result = data_source.cancel_order(ticket, is_position, symbol, volume, order_type)
    return jsonify(result), 200 if result.get('status') == 'success' else 400


if __name__ == '__main__':
    # Make sure static and template folders exist
    os.makedirs(os.path.join(app.root_path, 'templates'), exist_ok=True)
    os.makedirs(os.path.join(app.root_path, 'static', 'css'), exist_ok=True)
    os.makedirs(os.path.join(app.root_path, 'static', 'js'), exist_ok=True)

    # Start Flask Server on localhost:3000 in development/debug mode
    logger.info("Starting local Flask server on port 3000...")
    app.run(host='127.0.0.1', port=3000, debug=True)
