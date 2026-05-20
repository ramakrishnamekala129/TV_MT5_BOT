# REST API & Broker Integration Guide

This document describes the REST API endpoints exposed by the Flask backend and details the low-level broker integrations for MetaTrader 5, Hyperliquid, and Yahoo Finance.

---

## 🔌 API Endpoints Reference

All endpoints are hosted locally at `http://127.0.0.1:3000` by default.

### 1. General & Ticker Info

#### `GET /api/test_mt5`
Checks if the local MetaTrader 5 Windows terminal is running and successfully connected to the Flask proxy.
- **Success Response (`200 OK`)**:
  ```json
  {
    "status": "connected",
    "message": "Successfully connected to MetaTrader 5 terminal!",
    "version": "5.00 Build 4150 (18 Dec 2023)",
    "company": "MetaQuotes Software Corp.",
    "name": "MetaTrader 5",
    "connected": true,
    "trade_allowed": true
  }
  ```
- **Error Response (`500/400`)**:
  ```json
  {
    "status": "disconnected",
    "message": "Could not connect to MT5 terminal. Make sure the MetaTrader 5 application is running."
  }
  ```

#### `GET /api/symbol_format`
Queries formatting constraints (price decimals and minimum tick size) for scaling the UI scales dynamically.
- **Query Params**:
  - `source`: `mt5`, `yfinance`, `hyperliquid`
  - `symbol`: e.g., `EURUSD`, `RELIANCE.NS`, `BTC`
- **Response**:
  ```json
  {
    "precision": 5,
    "minMove": 0.00001
  }
  ```

---

### 2. Historical & Live Data

#### `GET /api/historical`
Fetches historical OHLCV candle arrays.
- **Query Params**:
  - `source`: `mt5`, `yfinance`, `hyperliquid`
  - `symbol`: Target asset ticker.
  - `timeframe`: `1m`, `5m`, `15m`, `1h`, `4h`, `1d`
  - `limit`: Count of bars (default: 300)
- **Response**:
  ```json
  [
    {
      "time": 1716206400,
      "open": 1.08451,
      "high": 1.08462,
      "low": 1.08432,
      "close": 1.08442,
      "volume": 328.0
    }
  ]
  ```

#### `GET /api/live`
Fetches real-time price updates (polling fallback).
- **Query Params**:
  - `source`: `mt5`, `yfinance`, `hyperliquid`
  - `symbol`: Target asset ticker.
- **Response**:
  ```json
  {
    "symbol": "EURUSD",
    "price": 1.08442,
    "time": 1716206450,
    "bid": 1.08440,
    "ask": 1.08444
  }
  ```

---

### 3. Execution & Trading (MT5 Only)

#### `GET /api/trading/state`
Returns active positions and pending limit/stop orders for visual overlay generation.
- **Query Params**:
  - `source`: `mt5` (required)
  - `symbol`: Optional filter.
- **Response**:
  ```json
  {
    "positions": [
      {
        "ticket": 501238472,
        "symbol": "EURUSD",
        "type": "buy",
        "volume": 0.1,
        "price_open": 1.08420,
        "sl": 1.08380,
        "tp": 1.08500,
        "price_current": 1.08442,
        "profit": 22.00,
        "time": 1716206000
      }
    ],
    "orders": []
  }
  ```

#### `POST /api/trading/place`
Places a market or pending order.
- **Payload**:
  ```json
  {
    "source": "mt5",
    "symbol": "EURUSD",
    "type": "buy_limit",
    "volume": 0.1,
    "price": 1.08350,
    "sl": 1.08300,
    "tp": 1.08450
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "ticket": 501238473,
    "message": "Order placed successfully"
  }
  ```

#### `POST /api/trading/modify`
Modifies an active position's SL/TP or a pending order's price levels.
- **Payload**:
  ```json
  {
    "source": "mt5",
    "ticket": 501238473,
    "is_position": false,
    "price": 1.08340,
    "sl": 1.08290,
    "tp": 1.08440
  }
  ```

#### `POST /api/trading/cancel`
Cancels pending orders or closes open positions immediately.
- **Payload**:
  ```json
  {
    "source": "mt5",
    "ticket": 501238473,
    "is_position": false
  }
  ```

---

## 🏛️ Broker Integration Internals

### 1. MetaTrader 5 Bridge
The Python script `data_source.py` uses the official standard `MetaTrader5` library. 
- **Terminal Initialization**: Done dynamically via `mt5.initialize()`. If the connection is broken or MT5 restarts, the proxy automatically attempts re-initialization on the next incoming request.
- **Order Execution Retcodes**: All operations dispatch standard structures using `mt5.order_send()`. The backend handles retcodes natively. Only `TRADE_RETCODE_DONE` (code `10009`) returns a successful status.
- **Lot Scaling / Market Watch Selection**: Before querying rates or posting trades, symbols must be selected in MT5 Market Watch using `mt5.symbol_select(symbol, True)`. Without this, subsequent tick copy routines will fail.

### 2. Hyperliquid Crypto Integrations
- **Tick Engine**: Hyperliquid uses a public JSON-RPC standard. Candles are acquired by posting a standard `candleSnapshot` request to `https://api.hyperliquid.xyz/info`.
- **WebSocket Feeds**: In `chart_manager.js`, the frontend binds a local `WebSocket` client to `wss://api.hyperliquid.xyz/ws`. Upon successful connection, it dispatches a JSON subscription payload:
  ```json
  {
    "method": "subscribe",
    "subscription": {
      "type": "activeAssetCtx",
      "coin": "BTC"
    }
  }
  ```
  Real-time ticks feed instantly into the series, completely bypassing the Python Flask proxy for Crypto assets.

### 3. Yahoo Finance Data Feed
- **Ticker Structure**: Antigravity connects directly to the standard Yahoo Finance scraper library `yfinance`. Indian stock assets require standard NSE suffixes (e.g. `RELIANCE.NS`, `INFY.NS`).
- **Data Limits**: Since yfinance pulls historical data blocks, periods are dynamically calibrated based on selected timeframes to reduce API load:
  - `1m` to `5m` timeframes request a 1-day history window.
  - `15m` to `30m` request a 5-day history window.
  - `1h` requests a 1-month window.
  - `1d` requests a 6-month window.
