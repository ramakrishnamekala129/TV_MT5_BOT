import time
import datetime
import logging
import requests

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("data_source")

# Try importing MetaTrader 5
try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False
    logger.warning("MetaTrader5 python package not available.")

# Try importing yfinance
try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False
    logger.warning("yfinance python package not available.")


class DataSourceManager:
    def __init__(self):
        self.mt5_initialized = False
        self.initialize_mt5()

    def initialize_mt5(self):
        """Initializes connection to MT5 terminal if available."""
        if not MT5_AVAILABLE:
            return False
        
        # If already initialized, check if still connected
        if self.mt5_initialized:
            try:
                if mt5.terminal_info() is not None:
                    return True
            except Exception:
                pass
            self.mt5_initialized = False

        # Attempt to initialize
        try:
            # mt5.initialize() returns True if successful
            if mt5.initialize():
                logger.info("MetaTrader 5 initialized successfully.")
                self.mt5_initialized = True
                return True
            else:
                logger.error(f"mt5.initialize() failed. Error code: {mt5.last_error()}")
                return False
        except Exception as e:
            logger.error(f"Exception while initializing MT5: {e}")
            return False

    def test_mt5_connection(self):
        """
        Tests the connection to MT5 and returns status information.
        Mainly for testing and user visual feedback.
        """
        if not MT5_AVAILABLE:
            return {
                "status": "error",
                "message": "MetaTrader5 Python library is not installed in the environment."
            }

        # Try to initialize or re-initialize
        success = self.initialize_mt5()
        if not success:
            error_code = mt5.last_error() if self.mt5_initialized or True else "Unknown"
            return {
                "status": "disconnected",
                "message": f"Could not connect to MT5 terminal. Make sure the MetaTrader 5 application is running. Error code: {error_code}"
            }

        try:
            info = mt5.terminal_info()
            version = mt5.version()
            if info is None:
                return {
                    "status": "disconnected",
                    "message": "Connected to MT5 library, but could not retrieve terminal info. Is the terminal running?"
                }

            # Build a nice info dictionary
            terminal_details = {
                "status": "connected",
                "message": "Successfully connected to MetaTrader 5 terminal!",
                "version": f"5.00 Build {version[1]} ({version[2]})",
                "company": info.company,
                "name": info.name,
                "language": info.language,
                "path": info.path,
                "data_path": info.data_path,
                "connected": info.connected,
                "trade_allowed": info.trade_allowed,
            }
            logger.info("MT5 Terminal Connection Verified.")
            return terminal_details
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error querying MT5 terminal: {e}"
            }

    def get_mt5_timeframe(self, tf_str):
        """Maps standard timeframe strings to MT5 constants."""
        if not MT5_AVAILABLE:
            return None
        
        mapping = {
            "1m": mt5.TIMEFRAME_M1,
            "2m": mt5.TIMEFRAME_M2,
            "5m": mt5.TIMEFRAME_M5,
            "15m": mt5.TIMEFRAME_M15,
            "30m": mt5.TIMEFRAME_M30,
            "1h": mt5.TIMEFRAME_H1,
            "4h": mt5.TIMEFRAME_H4,
            "1d": mt5.TIMEFRAME_D1,
        }
        return mapping.get(tf_str, mt5.TIMEFRAME_M5)

    def get_historical_candles(self, source, symbol, timeframe="5m", limit=100):
        """
        Unified historical data fetching.
        Returns a list of candles: [{'time': timestamp_sec, 'open': o, 'high': h, 'low': l, 'close': c, 'volume': v}]
        """
        source = source.lower()
        if source == "mt5":
            return self._fetch_mt5_candles(symbol, timeframe, limit)
        elif source == "yfinance":
            return self._fetch_yfinance_candles(symbol, timeframe, limit)
        elif source == "hyperliquid":
            return self._fetch_hyperliquid_candles(symbol, timeframe, limit)
        else:
            logger.error(f"Unsupported data source requested: {source}")
            return []

    def get_live_price(self, source, symbol):
        """
        Unified live price fetching (primarily for polling fallback).
        Returns: {'symbol': s, 'price': p, 'time': t, 'change': c}
        """
        source = source.lower()
        if source == "mt5":
            return self._get_mt5_live(symbol)
        elif source == "yfinance":
            return self._get_yfinance_live(symbol)
        elif source == "hyperliquid":
            return self._get_hyperliquid_live(symbol)
        else:
            return None

    # ==========================================
    # MetaTrader 5 Implementation
    # ==========================================
    def _fetch_mt5_candles(self, symbol, timeframe, limit):
        if not self.initialize_mt5():
            logger.warning("MT5 not initialized. Returning empty list.")
            return []

        mt5_tf = self.get_mt5_timeframe(timeframe)
        if mt5_tf is None:
            return []

        # Select symbol in Market Watch (required to copy rates)
        selected = mt5.symbol_select(symbol, True)
        if not selected:
            logger.error(f"Failed to select symbol '{symbol}' in MT5 Market Watch.")
            return []

        # Fetch rates from current position back
        rates = mt5.copy_rates_from_pos(symbol, mt5_tf, 0, limit)
        if rates is None or len(rates) == 0:
            logger.error(f"No rates returned from MT5 for {symbol}. Error: {mt5.last_error()}")
            return []

        candles = []
        for rate in rates:
            # MT5 time is a unix timestamp in seconds
            candles.append({
                "time": int(rate['time']),
                "open": float(rate['open']),
                "high": float(rate['high']),
                "low": float(rate['low']),
                "close": float(rate['close']),
                "volume": float(rate['tick_volume'])
            })
        return candles

    def _get_mt5_live(self, symbol):
        if not self.initialize_mt5():
            return None

        # Select symbol
        mt5.symbol_select(symbol, True)
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            logger.error(f"Failed to get tick for {symbol}. Error: {mt5.last_error()}")
            # Fallback to copy last rate
            rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, 1)
            if rates is not None and len(rates) > 0:
                return {
                    "symbol": symbol,
                    "price": float(rates[0]['close']),
                    "time": int(rates[0]['time']),
                    "bid": float(rates[0]['close']),
                    "ask": float(rates[0]['close'])
                }
            return None

        # Determine price (last or bid)
        price = float(tick.last) if tick.last != 0.0 else float(tick.bid)
        return {
            "symbol": symbol,
            "price": price,
            "time": int(tick.time),
            "bid": float(tick.bid),
            "ask": float(tick.ask)
        }

    # ==========================================
    # MetaTrader 5 Trading Implementation
    # ==========================================
    def get_active_orders(self, symbol=None):
        if not self.initialize_mt5():
            return {"positions": [], "orders": []}

        try:
            positions = mt5.positions_get(symbol=symbol) if symbol else mt5.positions_get()
            orders = mt5.orders_get(symbol=symbol) if symbol else mt5.orders_get()
            
            pos_list = []
            if positions:
                for p in positions:
                    action = mt5.ORDER_TYPE_BUY if p.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_SELL
                    tp_profit = mt5.order_calc_profit(action, p.symbol, p.volume, p.price_open, p.tp) if p.tp > 0 else 0.0
                    sl_profit = mt5.order_calc_profit(action, p.symbol, p.volume, p.price_open, p.sl) if p.sl > 0 else 0.0
                    
                    pos_list.append({
                        "ticket": p.ticket,
                        "symbol": p.symbol,
                        "type": "buy" if p.type == mt5.ORDER_TYPE_BUY else "sell",
                        "volume": p.volume,
                        "price_open": p.price_open,
                        "sl": p.sl,
                        "tp": p.tp,
                        "tp_profit": tp_profit if tp_profit else 0.0,
                        "sl_profit": sl_profit if sl_profit else 0.0,
                        "price_current": p.price_current,
                        "profit": p.profit,
                        "time": p.time
                    })
                    
            ord_list = []
            if orders:
                for o in orders:
                    type_str = "unknown"
                    action = mt5.ORDER_TYPE_BUY
                    if o.type == mt5.ORDER_TYPE_BUY_LIMIT: 
                        type_str = "buy_limit"
                        action = mt5.ORDER_TYPE_BUY
                    elif o.type == mt5.ORDER_TYPE_SELL_LIMIT: 
                        type_str = "sell_limit"
                        action = mt5.ORDER_TYPE_SELL
                    elif o.type == mt5.ORDER_TYPE_BUY_STOP: 
                        type_str = "buy_stop"
                        action = mt5.ORDER_TYPE_BUY
                    elif o.type == mt5.ORDER_TYPE_SELL_STOP: 
                        type_str = "sell_stop"
                        action = mt5.ORDER_TYPE_SELL
                        
                    tp_profit = mt5.order_calc_profit(action, o.symbol, o.volume_initial, o.price_open, o.tp) if o.tp > 0 else 0.0
                    sl_profit = mt5.order_calc_profit(action, o.symbol, o.volume_initial, o.price_open, o.sl) if o.sl > 0 else 0.0
                    
                    ord_list.append({
                        "ticket": o.ticket,
                        "symbol": o.symbol,
                        "type": type_str,
                        "volume": o.volume_initial,
                        "price_open": o.price_open,
                        "sl": o.sl,
                        "tp": o.tp,
                        "tp_profit": tp_profit if tp_profit else 0.0,
                        "sl_profit": sl_profit if sl_profit else 0.0,
                        "price_current": o.price_current,
                        "time_setup": o.time_setup
                    })
            return {"positions": pos_list, "orders": ord_list}
        except Exception as e:
            logger.error(f"Error fetching MT5 orders: {e}")
            return {"positions": [], "orders": [], "error": str(e)}

    def place_order(self, symbol, order_type_str, volume, price=None, sl=None, tp=None):
        if not self.initialize_mt5():
            return {"status": "error", "message": "MT5 not initialized"}
            
        mt5.symbol_select(symbol, True)
        
        # Map string to MT5 order type
        order_type_map = {
            "buy_market": mt5.ORDER_TYPE_BUY,
            "sell_market": mt5.ORDER_TYPE_SELL,
            "buy_limit": mt5.ORDER_TYPE_BUY_LIMIT,
            "sell_limit": mt5.ORDER_TYPE_SELL_LIMIT,
            "buy_stop": mt5.ORDER_TYPE_BUY_STOP,
            "sell_stop": mt5.ORDER_TYPE_SELL_STOP,
        }
        mt5_order_type = order_type_map.get(order_type_str.lower())
        if mt5_order_type is None:
            return {"status": "error", "message": f"Invalid order type: {order_type_str}"}
            
        # Determine action type
        if mt5_order_type in [mt5.ORDER_TYPE_BUY, mt5.ORDER_TYPE_SELL]:
            action = mt5.TRADE_ACTION_DEAL
            # If market order and price not provided, get current bid/ask
            if price is None or price == 0:
                tick = mt5.symbol_info_tick(symbol)
                price = tick.ask if mt5_order_type == mt5.ORDER_TYPE_BUY else tick.bid
        else:
            action = mt5.TRADE_ACTION_PENDING
            if price is None:
                return {"status": "error", "message": "Pending orders require a price"}

        request = {
            "action": action,
            "symbol": symbol,
            "volume": float(volume),
            "type": mt5_order_type,
            "price": float(price),
            "deviation": 20,
            "magic": 234000,
            "comment": "Antigravity UI",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        
        if sl is not None and float(sl) > 0:
            request["sl"] = float(sl)
        if tp is not None and float(tp) > 0:
            request["tp"] = float(tp)
            
        result = mt5.order_send(request)
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            logger.error(f"Order send failed, retcode={result.retcode}: {result.comment}")
            return {"status": "error", "message": f"Order failed: {result.comment}", "retcode": result.retcode}
            
        return {"status": "success", "ticket": result.order, "message": "Order placed successfully"}

    def modify_order(self, ticket, is_position=False, price=None, sl=None, tp=None):
        if not self.initialize_mt5():
            return {"status": "error", "message": "MT5 not initialized"}
            
        try:
            ticket = int(ticket)
        except ValueError:
            return {"status": "error", "message": "Invalid ticket ID"}
            
        request = {
            "action": mt5.TRADE_ACTION_SLTP if is_position else mt5.TRADE_ACTION_MODIFY,
            "position" if is_position else "order": ticket,
        }
        
        # Fetch existing to preserve fields not being modified
        if is_position:
            pos = mt5.positions_get(ticket=ticket)
            if pos and len(pos) > 0:
                p = pos[0]
                request["symbol"] = p.symbol
                request["sl"] = p.sl
                request["tp"] = p.tp
        else:
            ord = mt5.orders_get(ticket=ticket)
            if ord and len(ord) > 0:
                o = ord[0]
                request["price"] = o.price_open
                request["sl"] = o.sl
                request["tp"] = o.tp
        
        # Override with any new values
        if not is_position and price is not None:
            request["price"] = float(price)
            
        if sl is not None:
            request["sl"] = float(sl)
        if tp is not None:
            request["tp"] = float(tp)
            
        result = mt5.order_send(request)
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return {"status": "error", "message": f"Modify failed: {result.comment}", "retcode": result.retcode}
            
        return {"status": "success", "ticket": ticket, "message": "Modified successfully"}

    def cancel_order(self, ticket, is_position=False, symbol=None, volume=None, order_type=None):
        if not self.initialize_mt5():
            return {"status": "error", "message": "MT5 not initialized"}
            
        try:
            ticket = int(ticket)
        except ValueError:
            return {"status": "error", "message": "Invalid ticket ID"}
            
        if is_position:
            # Closing a position requires placing an opposite market deal
            if not symbol or not volume or not order_type:
                return {"status": "error", "message": "Closing position requires symbol, volume, and order_type"}
                
            tick = mt5.symbol_info_tick(symbol)
            close_type = mt5.ORDER_TYPE_SELL if order_type == "buy" else mt5.ORDER_TYPE_BUY
            price = tick.bid if close_type == mt5.ORDER_TYPE_SELL else tick.ask
            
            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": symbol,
                "volume": float(volume),
                "type": close_type,
                "position": ticket,
                "price": price,
                "deviation": 20,
                "magic": 234000,
                "comment": "Close from UI",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }
        else:
            # Canceling a pending order
            request = {
                "action": mt5.TRADE_ACTION_REMOVE,
                "order": ticket
            }
            
        result = mt5.order_send(request)
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return {"status": "error", "message": f"Cancel failed: {result.comment}", "retcode": result.retcode}
            
        return {"status": "success", "ticket": ticket, "message": "Canceled successfully"}

    # ==========================================
    # yfinance Implementation
    # ==========================================
    def _fetch_yfinance_candles(self, symbol, timeframe, limit):
        if not YFINANCE_AVAILABLE:
            logger.error("yfinance package is not installed.")
            return []

        # Map timeframe to yfinance period/interval
        # yfinance intervals: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
        yf_interval = timeframe
        if timeframe == "4h":
            yf_interval = "1h"  # yfinance doesn't support 4h; fetch 1h instead or let it fall back
        
        # Decide period based on interval to limit data
        period = "5d"
        if yf_interval in ["1m", "2m", "5m"]:
            period = "1d"
        elif yf_interval in ["15m", "30m"]:
            period = "5d"
        elif yf_interval in ["60m", "1h"]:
            period = "1mo"
        elif yf_interval in ["1d"]:
            period = "6mo"

        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period=period, interval=yf_interval)
            if df.empty:
                logger.warning(f"No yfinance data found for {symbol} with interval {yf_interval}.")
                return []

            # Tail df to limit
            df = df.tail(limit)

            candles = []
            for index, row in df.iterrows():
                # Convert index (timestamp) to unix timestamp in seconds
                # handle both timezone aware and naive timestamps
                timestamp_sec = int(index.timestamp())
                candles.append({
                    "time": timestamp_sec,
                    "open": float(row['Open']),
                    "high": float(row['High']),
                    "low": float(row['Low']),
                    "close": float(row['Close']),
                    "volume": float(row['Volume'])
                })
            
            # Sort chronologically
            candles.sort(key=lambda x: x['time'])
            return candles
        except Exception as e:
            logger.error(f"Error fetching yfinance candles for {symbol}: {e}")
            return []

    def _get_yfinance_live(self, symbol):
        if not YFINANCE_AVAILABLE:
            return None

        try:
            # To get real-time price efficiently without pulling huge history, we can fetch history with period='1d', interval='1m' and get the last row
            ticker = yf.Ticker(symbol)
            df = ticker.history(period="1d", interval="1m")
            if df.empty:
                # Try fallback fast info
                info = ticker.fast_info
                if 'last_price' in info and info['last_price'] is not None:
                    return {
                        "symbol": symbol,
                        "price": float(info['last_price']),
                        "time": int(time.time()),
                        "bid": float(info['last_price']),
                        "ask": float(info['last_price'])
                    }
                return None

            last_row = df.iloc[-1]
            timestamp_sec = int(df.index[-1].timestamp())
            return {
                "symbol": symbol,
                "price": float(last_row['Close']),
                "time": timestamp_sec,
                "bid": float(last_row['Close']),
                "ask": float(last_row['Close'])
            }
        except Exception as e:
            logger.error(f"Error fetching yfinance live price for {symbol}: {e}")
            return None

    # ==========================================
    # Hyperliquid Implementation
    # ==========================================
    def _fetch_hyperliquid_candles(self, symbol, timeframe, limit):
        """
        Fetches historical candles from Hyperliquid's public API.
        """
        # Map timeframes
        # HL support: 1m, 5m, 15m, 1h, 4h, 1d
        hl_tf = timeframe
        if timeframe not in ["1m", "5m", "15m", "1h", "4h", "1d"]:
            hl_tf = "5m"

        url = "https://api.hyperliquid.xyz/info"
        headers = {"Content-Type": "application/json"}

        # Calculate time range
        # We'll calculate startTime based on interval and limit
        now_ms = int(time.time() * 1000)
        tf_ms_mapping = {
            "1m": 60 * 1000,
            "5m": 5 * 60 * 1000,
            "15m": 15 * 60 * 1000,
            "1h": 60 * 60 * 1000,
            "4h": 4 * 60 * 60 * 1000,
            "1d": 24 * 60 * 60 * 1000
        }
        duration = tf_ms_mapping.get(hl_tf, 5 * 60 * 1000) * limit
        start_ms = now_ms - duration

        payload = {
            "type": "candleSnapshot",
            "req": {
                "coin": symbol.upper(),
                "interval": hl_tf,
                "startTime": start_ms,
                "endTime": now_ms
            }
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            if response.status_code != 200:
                logger.error(f"Hyperliquid API returned code {response.status_code}: {response.text}")
                return []

            data = response.json()
            if not isinstance(data, list):
                logger.warning(f"Unexpected response from Hyperliquid: {data}")
                return []

            candles = []
            for item in data:
                # Hyperliquid returns:
                # t: open time (ms), T: close time (ms), s: coin, i: interval,
                # o: open, h: high, c: close, l: low, v: volume
                candles.append({
                    "time": int(item['t']) // 1000, # convert ms to seconds
                    "open": float(item['o']),
                    "high": float(item['h']),
                    "low": float(item['l']),
                    "close": float(item['c']),
                    "volume": float(item['v'])
                })
            
            # Sort and deduplicate
            candles.sort(key=lambda x: x['time'])
            return candles[:limit]
        except Exception as e:
            logger.error(f"Error fetching Hyperliquid candles for {symbol}: {e}")
            return []

    def _get_hyperliquid_live(self, symbol):
        """
        Fetches live price from Hyperliquid REST API as fallback.
        For primary live feeds, the frontend will connect directly via websocket.
        """
        url = "https://api.hyperliquid.xyz/info"
        headers = {"Content-Type": "application/json"}
        payload = {"type": "allMids"}

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=5)
            if response.status_code == 200:
                mids = response.json()
                coin = symbol.upper()
                if coin in mids:
                    price = float(mids[coin])
                    return {
                        "symbol": symbol,
                        "price": price,
                        "time": int(time.time()),
                        "bid": price,
                        "ask": price
                    }
            return None
        except Exception as e:
            logger.error(f"Error fetching Hyperliquid live price: {e}")
            return None

    def get_symbol_format(self, source, symbol):
        """
        Returns the exact precision (digits) and minMove (point/step) for formatting.
        For MT5, it queries the live terminal directly for perfect accuracy.
        For yfinance and hyperliquid, it uses sensible defaults or queries recent prices.
        """
        source = source.lower()
        if source == "mt5":
            if self.initialize_mt5():
                info = mt5.symbol_info(symbol)
                if info is not None:
                    digits = int(info.digits)
                    point = float(info.point) if info.point and info.point > 0 else 1 / (10 ** digits)
                    return digits, point
            return 5, 0.00001
            
        elif source == "yfinance":
            if ".NS" in symbol.upper() or symbol.upper().startswith("^"):
                return 2, 0.05
            return 2, 0.01
            
        elif source == "hyperliquid":
            price_data = self.get_live_price(source, symbol)
            if price_data:
                price = float(price_data['price'])
                if price < 0.01:
                    return 6, 0.000001
                elif price < 1:
                    return 4, 0.0001
                elif price < 10:
                    return 3, 0.001
                elif price < 100:
                    return 2, 0.01
            return 2, 0.01
            
        return 2, 0.01


# Global data source instance for easy access
data_source = DataSourceManager()

if __name__ == "__main__":
    # Test connection
    print("Testing MT5 Connection:")
    status = data_source.test_mt5_connection()
    print(status)
    
    # Test Hyperliquid candle fetching
    print("\nTesting Hyperliquid Candles (BTC, 5m):")
    hl_candles = data_source.get_historical_candles("hyperliquid", "BTC", "5m", 3)
    print(hl_candles)

    # Test yfinance candle fetching if available
    print("\nTesting yfinance Candles (RELIANCE.NS, 1d):")
    yf_candles = data_source.get_historical_candles("yfinance", "RELIANCE.NS", "1d", 3)
    print(yf_candles)
