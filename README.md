# Antigravity // Quant Trading Grid

[![Python Version](https://img.shields.io/badge/python-3.8%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/framework-Flask-lightgrey.svg)](https://flask.palletsprojects.com/)
[![MetaTrader 5](https://img.shields.io/badge/terminal-MetaTrader_5-blue.svg)](https://www.mql5.com/)
[![Hyperliquid](https://img.shields.io/badge/exchange-Hyperliquid-orange.svg)](https://hyperliquid.xyz/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#license)

**Antigravity // Quant Trading Grid** is a high-performance, premium multi-pane interactive trading dashboard. It integrates three major financial markets (MetaTrader 5 for FX/CFDs, Hyperliquid for Crypto, and Yahoo Finance for Equities) into a single, cohesive glassmorphism web interface built on TradingView's Lightweight Charts and a custom Vanilla JS indicators engine.

---

## 🌟 Key Features

### 📊 Multi-Pane Dynamic Grid Layout
* Configure the dashboard layout on the fly with **1, 2, 4, 6, or 8 charts** arranged in highly responsive layouts.
* Independent data source, symbol, and timeframe selection per pane.
* Perfect for multi-asset monitoring, cross-correlation trading, and multi-timeframe analysis.

### 🔌 Multi-Source Integration
1. **MetaTrader 5 (FX/CFDs/Metals)**: Full integration with a running local MT5 Terminal. Fetch historical tick/bar data and place real-time trades.
2. **Hyperliquid (Crypto)**: Direct integration with Hyperliquid's public API to view crypto derivatives and spot pairs (BTC, ETH, SOL, etc.).
3. **Yahoo Finance (Stocks/Indices)**: Real-time and historical data for global equities and major indices (e.g., NIFTY 50, Reliance, TCS, INFY).

### 📈 Drag-and-Drop MT5 Trading & Context Menu
* **Right-Click Context Menu**: Right-click directly on any MT5 chart to place pending Limit or Stop orders at that exact cursor price.
* **Interactive Order Badges**: Active positions and pending orders are plotted directly on the chart with draggable visual badges. 
* **Seamless Modify/Cancel**: Modify Stop Loss (SL) or Take Profit (TP) levels by dragging the badges, or close positions instantly from the UI.

### 📐 Technical Indicators & Drawing Tools
* **Overlays**: Simple Moving Averages (SMA 20/50), Exponential Moving Averages (EMA 9/21), Bollinger Bands (20, 2), and VWAP.
* **Oscillators**: Relative Strength Index (RSI 14), MACD (12, 26, 9), and Volume.
* **Drawing Tools**: Draw Horizontal Lines, Trend Lines, and Rectangles directly over the candlestick data.

---

## 🛠️ Architecture & Tech Stack

* **Backend**: Python (Flask) acting as a high-performance bridge to Python bindings (`MetaTrader5`, `yfinance`, `requests`).
* **Frontend**: Vanilla HTML5, CSS3 (Premium dark-mode glassmorphism styling, outfit typography), and custom ES6 JavaScript.
* **Charting**: TradingView Lightweight Charts (Standalone edition running locally).
* **Indicators Engine**: Pure client-side calculations (`static/js/indicators.js`) for lightning-fast performance without server-side compute bottlenecks.

---

## 🚀 Getting Started

### 📋 Prerequisites

1. **Operating System**: Windows (required for the `MetaTrader5` python package).
2. **MetaTrader 5 Terminal**: Installed and running locally.
3. **Python 3.8+** installed.

### 🔧 Installation

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

### 💻 Running the Application

Start the bridge server by running:
```bash
python app.py
```

The Flask server will spin up on:
👉 **[http://127.0.0.1:3000](http://127.0.0.1:3000)**

Open the link in any modern browser to launch the dashboard.

---

## 📁 Directory Structure

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

## 📊 API Endpoints Reference

The backend exposes a developer-friendly REST API for custom integrations:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/test_mt5` | `GET` | Verifies local MT5 Terminal connection and gets system info |
| `/api/historical` | `GET` | Fetches historical OHLCV data from MT5, yfinance, or Hyperliquid |
| `/api/live` | `GET` | Polling endpoint for real-time bid/ask & ticker prices |
| `/api/trading/state` | `GET` | Returns list of open positions & pending orders |
| `/api/trading/place` | `POST` | Places market or pending orders in MetaTrader 5 |
| `/api/trading/modify` | `POST` | Modifies active order/position price, SL, or TP |
| `/api/trading/cancel` | `POST` | Cancels pending orders or closes active market positions |

---

## 🛡️ License

This project is licensed under the MIT License - see the LICENSE file for details.

---

*Crafted with 💖 by Antigravity*
