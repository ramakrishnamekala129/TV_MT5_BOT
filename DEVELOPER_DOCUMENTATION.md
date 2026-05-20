# Antigravity // Developer Manual & Codebase Guide

Welcome to the **Antigravity // Quant Trading Grid** Developer Manual. This guide provides a detailed overview of the codebase, developer setup workflows, stylesheet structures, and system directory maps.

For in-depth sub-module specifications, see the links below:
- 🏛️ [System Architecture & Lifecycle Management](file:///d:/TV_MT5_BOT/docs/ARCHITECTURE.md)
- 📐 [Quantitative Indicators Engine & SMC Math](file:///d:/TV_MT5_BOT/docs/QUANTITATIVE_INDICATORS.md)
- 🔌 [REST API Reference & Broker Integrations](file:///d:/TV_MT5_BOT/docs/API_AND_INTEGRATION.md)

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
│   └── index.html              # Core HTML structure, settings models & templates
└── static/
    ├── css/
    │   ├── style.css           # Outfits variables, grid layouts & glassmorphism tokens
    │   └── trading.css         # Trading badges, context menus & draggable overlay rules
    └── js/
        ├── chart_manager.js    # Multi-pane grid orchestrator, chart sync & trading hooks
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

## 🎨 Visual System & Glassmorphism Tokens

The stylesheet `static/css/style.css` builds an immersive, high-end dark-mode visual interface styled around glassmorphic principles.

### Custom Styling Tokens (CSS Variables)
Styling relies on standard CSS tokens. Do not define ad-hoc hex values; always inherit from this custom palette:

```css
:root {
    --bg-dark: #0a0b0d;               /* Deep charcoal backing */
    --panel-bg: rgba(20, 24, 33, 0.6); /* Translucent glass body */
    --panel-border: rgba(255, 255, 255, 0.08); /* Clean sharp limits */
    --text-primary: #f0f3f6;          /* High contrast text */
    --text-secondary: #878b94;        /* Muted labels */
    
    /* Harmonious HSL Tailored Colors */
    --color-green: #089981;           /* Emerald Bullish */
    --color-red: #F23645;             /* Scarlet Bearish */
    --color-blue: #2196F3;            /* Accent Highlight */
    
    --font-display: 'Outfit', sans-serif;
    --font-sans: 'Inter', sans-serif;
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
2. **Interactive Toggles**: Action chips (`.ind-chip`, `.tool-chip`) utilize subtle transitions (`all 0.2s cubic-bezier(0.4, 0, 0.2, 1)`) and high-end hover responses for premium micro-animations.

---

## 🏗️ Code Quality & Verification Flow

When implementing changes or new indicators in the quantitative grid:
1. **Mathematics Validation**: Run `node test_indicators.js` to automatically verify calculations against standard synthetic arrays.
2. **Monotonic Ordering Constraint**: Ensure any data injected into Lightweight Charts series flows chronologically (`time` values must be strictly sorted ascending).
3. **No Cache Dispatches**: The Flask server forces no-cache headers in development. Ensure assets are queried with cache-busting version params (e.g. `style.css?v=1.2.0`) to immediately propagate client-side rendering updates.
