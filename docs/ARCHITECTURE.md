# Antigravity Technical Architecture Guide

This document describes the high-level architecture, design patterns, and engineering details of **Antigravity // Quant Trading Grid**. 

---

## 🏛️ System Overview

Antigravity uses a hybrid **Python (Flask) Backend + Client-Side ES6 JavaScript** architecture designed for low-latency market analysis and seamless broker communication:

```mermaid
graph TD
    UI[HTML5/CSS3 Dashboard UI] <--> CM[JS Chart Manager]
    CM <--> IE[JS Technical Indicators Engine]
    CM <--> WS[Hyperliquid WebSocket]
    CM <--> API[Flask REST API app.py]
    API <--> DSM[DataSourceManager data_source.py]
    DSM <--> MT5[MetaTrader 5 Windows Terminal]
    DSM <--> YF[yfinance API]
    DSM <--> HL[Hyperliquid REST API]
```

### Key Engineering Decisions

1. **Client-Side Quantitative Engine**: Rather than calculating heavy mathematical indicators (like Bollinger Bands, RSI, MACD, and Smart Money Concepts) on the server, all calculations are performed locally in the browser via `static/js/indicators.js`. This:
   - Eliminates backend server bottlenecks and scales perfectly to 8+ simultaneous charts.
   - Saves expensive server CPU cycles, enabling the Flask app to run smoothly as a lightweight local proxy.
   - Allows instant parameter recalculation when indicators settings are tweaked, with zero network latency.
2. **Synchronized Multi-Pane Grid**: Orchestrated by `static/js/chart_manager.js`, the dashboard supports dynamic layout re-scaling (1, 2, 4, 6, or 8 panes) using a custom template clone method combined with precise Lightweight Charts pane lifecycle controls.
3. **Draggable Visual Badging for MT5 Trading**: Order tickets and active positions are rendered as absolute-positioned DOM element badges inside a dedicated `trading-overlay-container` directly on top of the charting canvas. Draggable events map client coordinates to chart prices dynamically, enabling intuitive visual execution.

---

## 📊 Client-Side Multi-Pane Orchestration

The dashboard leverages a unified template mounting mechanism:

### 1. Grid Resizing and Pane Lifecycles
* **Grid Rendering**: When the user selects a pane layout (e.g. 6 panes), `updateGridCount(count)` is triggered.
* **Component Clones**: The manager clones the `<template id="chart-pane-template">` from `index.html`, assigns it a unique `data-pane-id` (e.g. `pane-0`, `pane-1`), and mounts it within the grid.
* **Cleanup and Destroy**: When resizing down, obsolete panes are safely deleted via `destroyPane(paneId)` which terminates active WebSocket feeds, clears polling timers, removes DOM elements, and calls `chart.remove()` to prevent memory leaks in Lightweight Charts.

### 2. Time-Scale and Crosshair Synchronization
To allow unified multi-timeframe or multi-asset inspection, the chart manager synchronizes all active charts:
* **Time Scale Sync**: When the user zooms or scrolls a pane, the visible logical range is propagated to all other active panes via `syncTimeScales(pane)`.
* **Crosshair Position Sync**: When the user hovers over a chart, a custom subscriber `subscribeCrosshairMove` tracks the hover price and time and updates the crosshair coordinates on all other charts in real-time, facilitating perfect spatial alignment.

---

## 🔌 Data Ingestion Pipeline

Antigravity handles three distinct data pipelines with unique characteristics:

| Pipeline | Type | Protocol | Format | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **MetaTrader 5** | Bid/Ask Tick | HTTP Polling | JSON REST | High-fidelity FX/CFD pricing & order flow |
| **Hyperliquid** | Order Book | WebSockets | JSON WS | Low-latency cryptocurrency order books |
| **Yahoo Finance** | Bar Close | HTTP Fetch | JSON REST | Indian Equities & Global Indices |

### Real-Time Update Logic
- **WebSocket Feeds**: Hyperliquid channels subscribe directly to public feeds (e.g., `wss://api.hyperliquid.xyz/ws`). New ticks feed into the primary series via `series.update()`, and volume bars adapt in real time.
- **REST Polling**: For sources without native browser WebSockets (such as local MT5 connection or Yahoo Finance), the client initiates a polling loop (`startLivePolling`) every 1.5 seconds to query the Flask API for the latest bid/ask.

---

## 📐 Drag-and-Drop MT5 Visual Trading Engine

The visual trading engine is a standout feature, enabling drag-and-drop order placement and modification on MetaTrader 5 charts:

```mermaid
sequenceDiagram
    participant User as User (UI Browser)
    participant Overlay as JS Trading Overlay
    participant CM as chart_manager.js
    participant Server as Flask Server (app.py)
    participant MT5 as MT5 Terminal (Windows)

    User->>Overlay: Right-Click Chart at Price X
    Overlay->>User: Show Context Menu
    User->>Overlay: Select Limit Order
    Overlay->>Server: HTTP POST /api/trading/place
    Server->>MT5: mt5.order_send(Pending Request)
    MT5-->>Server: Retcode: Done, Ticket ID
    Server-->>CM: Return Ticket
    CM->>Overlay: Draw Interactive Price Badge at Price X
    User->>Overlay: Drag Badge to Price Y
    Overlay->>Server: HTTP POST /api/trading/modify (Ticket, Price Y)
    Server->>MT5: mt5.order_send(Modify Request)
    MT5-->>Overlay: Order Modified Visual Success
```

### Draggable Mathematics (Coordinate Mapping)
Lightweight Charts does not natively support interactive HTML elements within its canvas. Antigravity bridges this by placing a translucent `trading-overlay-container` directly over the canvas:
1. **Price to Coordinate**: The chart's `priceToCoordinate` API maps financial prices to pixel-level Y coordinates inside the container.
2. **Drag Event Binding**: Badges are absolute-positioned using this coordinate. A `mousedown` event initiates drag tracking.
3. **Coordinate to Price**: As the user drags the badge, the Y coordinate is recalculated and mapped back to a raw financial price using the `coordinateToPrice` API.
4. **Debounced Network Dispatches**: When released, a `POST` request is sent to `/api/trading/modify` to update the Stop Loss (SL), Take Profit (TP), or entry price in MT5.
