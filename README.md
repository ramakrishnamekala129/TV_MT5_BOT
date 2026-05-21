# Quant Trading

[![Python Version](https://img.shields.io/badge/python-3.8%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/framework-Flask-lightgrey.svg)](https://flask.palletsprojects.com/)
[![MetaTrader 5](https://img.shields.io/badge/terminal-MetaTrader_5-blue.svg)](https://www.mql5.com/)
[![Hyperliquid](https://img.shields.io/badge/exchange-Hyperliquid-orange.svg)](https://hyperliquid.xyz/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#license)

**Quant Trading** is a multi-pane interactive trading dashboard for discretionary and quantitative market monitoring. It integrates MetaTrader 5 for FX/CFDs, Hyperliquid for crypto, and Yahoo Finance for equities into a TradingView-style web interface built on Lightweight Charts, Flask, and a custom client-side indicators engine.

---

## Key Features

### Multi-Pane Dynamic Grid Layout
* Configure the dashboard layout on the fly with **1, 2, 4, 6, or 8 charts** arranged in highly responsive layouts.
* Independent data source, symbol, and timeframe selection per pane.
* Perfect for multi-asset monitoring, cross-correlation trading, and multi-timeframe analysis.

### Multi-Source Integration
1. **MetaTrader 5 (FX/CFDs/Metals)**: Full integration with a running local MT5 Terminal. Fetch historical tick/bar data and place real-time trades.
2. **Hyperliquid (Crypto)**: Direct integration with Hyperliquid's public API to view crypto derivatives and spot pairs (BTC, ETH, SOL, etc.).
3. **Yahoo Finance (Stocks/Indices)**: Real-time and historical data for global equities and major indices (e.g., NIFTY 50, Reliance, TCS, INFY).

### TradingView-Style Chart UX
* Compact, scrollable TradingView-style indicator toolbar.
* Indicator library modal with searchable built-ins, per-indicator inputs, color settings, and add/apply/remove actions.
* Active indicator legends on the chart and panel headers with hide/show, settings, and delete controls.
* Resizable oscillator sub-panels with persisted per-pane heights.
* Historical backfill: dragging or scrolling back near the left edge fetches older candles using the `/api/historical?before=...` API.

### Drag-and-Drop MT5 Trading & Context Menu
* **Right-Click Context Menu**: Right-click directly on any MT5 chart to place pending Limit or Stop orders at that exact cursor price.
* **Interactive Order Badges**: Active positions and pending orders are plotted directly on the chart with draggable visual badges. 
* **Seamless Modify/Cancel**: Modify Stop Loss (SL) or Take Profit (TP) levels by dragging the badges, or close positions instantly from the UI.

### Technical Indicators & Drawing Tools
* **Overlays**: SMA, EMA, WMA, HMA, Bollinger Bands, VWAP, Ichimoku Cloud, Supertrend, and Smart Money Concepts.
* **Panels/Oscillators**: RSI, MACD, Stochastic, CCI, Momentum, ROC, ATR, ADX, OBV, and Volume.
* **Settings**: Indicator periods, widths, colors, thresholds, and multi-line styles are configurable from the indicator library.
* **Drawing Tools**: Draw Horizontal Lines, Trend Lines, and Rectangles directly over the candlestick data.

---

## Architecture & Tech Stack

* **Backend**: Python (Flask) acting as a high-performance bridge to Python bindings (`MetaTrader5`, `yfinance`, `requests`).
* **Frontend**: Vanilla HTML5, CSS3 (Premium dark-mode glassmorphism styling, outfit typography), and custom ES6 JavaScript.
* **Charting**: TradingView Lightweight Charts (Standalone edition running locally).
* **Indicators Engine**: Pure client-side calculations (`static/js/indicators.js`) for lightning-fast performance without server-side compute bottlenecks.

---

## Getting Started

### Prerequisites

1. **Operating System**: Windows (required for the `MetaTrader5` python package).
2. **MetaTrader 5 Terminal**: Installed and running locally.
3. **Python 3.8+** installed.

### Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/ramakrishnamekala129/TV_MT5_BOT.git
   cd TV_MT5_BOT
   ```

2. **Install Dependencies**:
   ```bash
   pip install flask yfinance requests MetaTrader5
   ```

3. **Configure MetaTrader 5**:
   * Open the MetaTrader 5 Terminal.
   * Go to **Tools** > **Options** > **Expert Advisors**.
   * Check **"Allow Algo Trading"** and **"Allow WebRequest for listed URLs"**.

### Running the Application

Start the bridge server by running:
```bash
python app.py
```

The Flask server will start on **[http://127.0.0.1:3000](http://127.0.0.1:3000)**.

Open the link in any modern browser to launch the dashboard.

---

## Directory Structure

```text
TV_MT5_BOT/
├── app.py                      # Flask core server & API routing
├── data_source.py              # Unified DataSourceManager (MT5, HL, yfinance)
├── smoke_test.py               # Backend connection testing script
├── test_indicators.js          # Client-side indicator test suite
├── templates/
│   └── index.html              # Modern dashboard template
├── static/
│   ├── css/
│   │   ├── style.css           # Global layout & glassmorphic system styles
│   │   └── trading.css         # Trading context menus & active order badges
│   └── js/
│       ├── chart_manager.js    # Multi-pane grid orchestration and event loops
│       ├── indicators.js       # Client-side quantitative indicators calculator
│       └── lightweight-charts.standalone.production.js # Charting library
└── README.md                   # Project documentation
```

---

## API Endpoints Reference

The backend exposes a developer-friendly REST API for custom integrations:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/test_mt5` | `GET` | Verifies local MT5 Terminal connection and gets system info |
| `/api/historical` | `GET` | Fetches historical OHLCV data from MT5, yfinance, or Hyperliquid. Supports `before` for older-candle backfill |
| `/api/live` | `GET` | Polling endpoint for real-time bid/ask & ticker prices |
| `/api/trading/state` | `GET` | Returns list of open positions & pending orders |
| `/api/trading/place` | `POST` | Places market or pending orders in MetaTrader 5 |
| `/api/trading/modify` | `POST` | Modifies active order/position price, SL, or TP |
| `/api/trading/cancel` | `POST` | Cancels pending orders or closes active market positions |

---

## Developer & System Reference Documentation

For detailed guides covering each aspect of the codebase, please refer to the comprehensive developer documentation:

* **Core Developer Manual**: [DEVELOPER_DOCUMENTATION.md](DEVELOPER_DOCUMENTATION.md) — file mappings, styling variables, chart UX workflows, and verification commands.
* **System Architecture**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — grid lifecycle, chart synchronization, backfill, and interactive trading coordinate formulas.
* **Indicators & SMC Math**: [docs/QUANTITATIVE_INDICATORS.md](docs/QUANTITATIVE_INDICATORS.md) — indicator formulas, settings model, active legend behavior, and rendering constraints.
* **API & Broker Integrations**: [docs/API_AND_INTEGRATION.md](docs/API_AND_INTEGRATION.md) — REST API reference, MT5 bridge protocols, Hyperliquid REST/WS configuration, yfinance intervals, and historical backfill.

---

## 🛡️ License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Built for local trading research and MT5 execution workflows.
