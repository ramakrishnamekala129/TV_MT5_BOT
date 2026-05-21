# Quant Trading Developer Manual & Codebase Guide

Welcome to the **Quant Trading** developer manual. This guide provides a practical overview of the codebase, local setup, chart UX architecture, stylesheet structure, and verification workflow.

For in-depth sub-module specifications, see the links below:
- [System Architecture & Lifecycle Management](docs/ARCHITECTURE.md)
- [Quantitative Indicators Engine & SMC Math](docs/QUANTITATIVE_INDICATORS.md)
- [REST API Reference & Broker Integrations](docs/API_AND_INTEGRATION.md)

---

## 📁 Directory & File Structures

```text
TV_MT5_BOT/
├── app.py                      # Flask core router, proxy controller & REST endpoints
├── data_source.py              # Unified DataSourceManager (MetaTrader 5, yfinance, Hyperliquid)
├── smoke_test.py               # Connection debugger for local MT5 Python bindings
├── test_indicators.js          # Quantitative indicators validation suite
├── docs/                       # Comprehensive architectural & mathematical guides
│   ├── ARCHITECTURE.md
│   ├── QUANTITATIVE_INDICATORS.md
│   └── API_AND_INTEGRATION.md
├── templates/
│   └── index.html              # Core HTML template, toolbar, chart pane template, modals
└── static/
    ├── css/
    │   ├── style.css           # Outfits variables, grid layouts & glassmorphism tokens
    │   └── trading.css         # Trading badges, context menus & draggable overlay rules
    └── js/
        ├── chart_manager.js    # Multi-pane grid, backfill, indicators, legends, chart sync & trading hooks
        ├── indicators.js       # Core Javascript technical indicators & SMC calculator
        └── lightweight-charts.standalone.production.js # TradingView Charting Engine (v5.2.0)
```

---

## 🛠️ Developer Setup & Execution

### 1. Requirements & System Context
- **Operating System**: Microsoft Windows (strictly required for the `MetaTrader5` win32 native library bindings).
- **Python Runtime**: Python 3.8 to Python 3.12.
- **Local MT5 Terminal**: MetaTrader 5 installed and running. Enable Algo Trading under `Tools > Options > Expert Advisors`.

### 2. Sandbox Setup
Activate your python environment and run the following command to download core dependencies:
```bash
pip install flask yfinance requests MetaTrader5
```

### 3. Verify Connection
To ensure the Python kernel can interface with your running local MT5 instance, run the included smoke test script:
```bash
python smoke_test.py
```
A successful connection printout indicates the system is ready to launch.

### 4. Run Proxy Server
Start the local server by running:
```bash
python app.py
```
Navigate your browser to **`http://localhost:3000`** to interact with the multi-pane grid.

---

## Visual System & Toolbar UX

The stylesheet `static/css/style.css` builds the dark dashboard shell, chart pane layout, TradingView-style toolbar, indicator library modal, active indicator legends, and resizable oscillator panels.

### Custom Styling Tokens (CSS Variables)
Core styling uses tokens from `:root`:

```css
:root {
    --bg-dark: rgb(10, 11, 15);
    --bg-panel: rgba(22, 26, 37, 0.55);
    --accent-teal: #00F2FE;
    --accent-purple: #7B2CBF;
    --bull-green: #00E676;
    --bear-red: #FF1744;
    --text-primary: #F8F9FA;
    --text-secondary: #909296;
    --font-heading: 'Outfit', sans-serif;
    --font-body: 'Inter', sans-serif;
}
```

### Styling Guidelines
1. **Glass Panels**: All container cards should inherit `.glass-effect` for backdrop blur matching modern design standards:
   ```css
   .glass-effect {
       background: var(--panel-bg);
       backdrop-filter: blur(12px);
       border: 1px solid var(--panel-border);
       border-radius: 8px;
   }
   ```
2. **TradingView-style toolbar**: `.indicator-toolbar`, `.ind-chip`, `.indicator-library-btn`, and `.ind-chip-group` use compact dark styling with horizontal overflow for dense chart workflows.
3. **Indicator legends**: `.indicator-legend` and `.oscillator-label` expose active indicator actions. Keep `pointer-events: auto` on the legend so hide/settings/delete buttons remain clickable above the chart canvas.
4. **Resizable panels**: `.oscillator-resize-handle` owns panel drag affordances. Height persistence is handled in `chart_manager.js`.

---

## 🏗️ Code Quality & Verification Flow

When implementing changes or new indicators in the quantitative grid:
1. **Mathematics Validation**: Run `node test_indicators.js` to automatically verify calculations against standard synthetic arrays.
2. **Syntax Validation**: Run `node --check static/js/chart_manager.js` and `node --check static/js/indicators.js` after JavaScript edits.
3. **Browser Verification**: Reload `http://127.0.0.1:3000`, confirm the toolbar, indicator library, legends, backfill, and oscillator resize behavior visually.
4. **Monotonic Ordering Constraint**: Ensure any data injected into Lightweight Charts series flows chronologically (`time` values must be strictly sorted ascending).
5. **No Cache Dispatches**: The Flask server forces no-cache headers in development. Ensure asset query versions in `templates/index.html` are bumped when browser cache behavior becomes ambiguous.
