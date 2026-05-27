/**
 * Antigravity // Quant Trading Grid — Chart & Data Manager
 * With Full Indicator Panel + Drawing Tools
 * Bulletproof Sandboxed-Compliant Edition
 */

function startApp() {
    console.log("Antigravity Quant Trading Grid: Initializing...");

    // ──────────────────────────────────────────────
    // SafeStorage — localStorage wrapper
    // ──────────────────────────────────────────────
    const SafeStorage = {
        _data: {},
        getItem(key) {
            try { return localStorage.getItem(key); }
            catch(e) { return this._data[key] || null; }
        },
        setItem(key, value) {
            try { localStorage.setItem(key, value); }
            catch(e) { this._data[key] = String(value); }
        }
    };

    // ──────────────────────────────────────────────
    // App State
    // ──────────────────────────────────────────────
    const STATE = {
        activePanesCount: 6,
        panes: {},           // paneId → pane instance
        mt5Status: 'disconnected'
    };

    const TRADING_STATE = {
        positions: [],
        orders: [],
        dragActive: false
    };

    const cMenu = document.getElementById('chart-context-menu');
    let cMenuTargetPane = null;
    let cMenuPrice = 0;
    let activeSMCSettingsPaneId = null;
    let activeIndicatorLibraryPaneId = null;
    let selectedIndicatorKey = null;
    let editingIndicatorKey = null;


    // DOM refs
    const chartCountSelect   = document.getElementById('chart-count-select');
    const paneLayoutButtons  = Array.from(document.querySelectorAll('.pane-layout-btn'));
    const mt5StatusPanel     = document.getElementById('mt5-status-panel');
    const gridContainer      = document.getElementById('grid-container');
    const chartPaneTemplate  = document.getElementById('chart-pane-template');

    // Default per-pane configs
    const DEFAULT_PANE_CONFIGS = {
        1: { source: 'hyperliquid', symbol: 'BTC',         timeframe: '5m'  },
        2: { source: 'hyperliquid', symbol: 'ETH',         timeframe: '5m'  },
        3: { source: 'yfinance',    symbol: 'RELIANCE.NS',  timeframe: '1d'  },
        4: { source: 'yfinance',    symbol: 'TCS.NS',       timeframe: '1d'  },
        5: { source: 'mt5',         symbol: 'EURUSD',       timeframe: '15m' },
        6: { source: 'mt5',         symbol: 'XAUUSD',       timeframe: '15m' },
        7: { source: 'hyperliquid', symbol: 'SOL',          timeframe: '5m'  },
        8: { source: 'yfinance',    symbol: '^NSEI',        timeframe: '1d'  }
    };

    const HISTORY_BACKFILL_LIMIT = 300;
    const HISTORY_BACKFILL_EDGE_BARS = 80;
    const OSCILLATOR_PANEL_DEFAULT_HEIGHT = 120;
    const OSCILLATOR_PANEL_MIN_HEIGHT = 70;

    // Indicator colour palette
    const IND_COLORS = {
        sma20:  '#F5A623',  // amber
        sma50:  '#4CD9FF',  // sky blue
        ema9:   '#FF6B6B',  // coral
        ema21:  '#B07FFF',  // violet
        bbUpper:'#4ECDC4',  // teal
        bbMiddle:'#888',    // grey
        bbLower:'#4ECDC4',  // teal
        vwap:   '#FFD166',  // gold
        rsi:    '#00F2FE',  // cyan
        macdLine:'#4ECDC4', // teal
        macdSig: '#FF6B6B', // coral
        volume:  'auto'
    };

    const INDICATOR_DEFS = {
        sma20: { name: 'Simple Moving Average', short: 'SMA 20', category: 'Moving Averages', kind: 'overlay', defaults: { period: 20, color: IND_COLORS.sma20, width: 2 }, fields: [['period', 'Length', 'number', 1, 500], ['color', 'Color', 'color'], ['width', 'Line width', 'number', 1, 5]] },
        sma50: { name: 'Simple Moving Average 50', short: 'SMA 50', category: 'Moving Averages', kind: 'overlay', defaults: { period: 50, color: IND_COLORS.sma50, width: 2 }, fields: [['period', 'Length', 'number', 1, 500], ['color', 'Color', 'color'], ['width', 'Line width', 'number', 1, 5]] },
        ema9: { name: 'Exponential Moving Average', short: 'EMA 9', category: 'Moving Averages', kind: 'overlay', defaults: { period: 9, color: IND_COLORS.ema9, width: 2 }, fields: [['period', 'Length', 'number', 1, 500], ['color', 'Color', 'color'], ['width', 'Line width', 'number', 1, 5]] },
        ema21: { name: 'Exponential Moving Average 21', short: 'EMA 21', category: 'Moving Averages', kind: 'overlay', defaults: { period: 21, color: IND_COLORS.ema21, width: 2 }, fields: [['period', 'Length', 'number', 1, 500], ['color', 'Color', 'color'], ['width', 'Line width', 'number', 1, 5]] },
        wma20: { name: 'Weighted Moving Average', short: 'WMA', category: 'Moving Averages', kind: 'overlay', defaults: { period: 20, color: '#fbc02d', width: 2 }, fields: [['period', 'Length', 'number', 1, 500], ['color', 'Color', 'color'], ['width', 'Line width', 'number', 1, 5]] },
        hma20: { name: 'Hull Moving Average', short: 'HMA', category: 'Moving Averages', kind: 'overlay', defaults: { period: 20, color: '#ff9800', width: 2 }, fields: [['period', 'Length', 'number', 1, 500], ['color', 'Color', 'color'], ['width', 'Line width', 'number', 1, 5]] },
        bb20: { name: 'Bollinger Bands', short: 'BB', category: 'Volatility', kind: 'overlay', defaults: { period: 20, stdDev: 2, color: IND_COLORS.bbUpper, middleColor: '#787b86' }, fields: [['period', 'Length', 'number', 1, 500], ['stdDev', 'StdDev', 'number', 0.1, 10, 0.1], ['color', 'Band color', 'color'], ['middleColor', 'Basis color', 'color']] },
        vwap: { name: 'VWAP', short: 'VWAP', category: 'Volume', kind: 'overlay', defaults: { color: IND_COLORS.vwap, width: 2 }, fields: [['color', 'Color', 'color'], ['width', 'Line width', 'number', 1, 5]] },
        ichimoku: { name: 'Ichimoku Cloud', short: 'Ichimoku', category: 'Trend', kind: 'overlay', defaults: { tenkan: 9, kijun: 26, spanB: 52, conversionColor: '#2962ff', baseColor: '#b71c1c', cloudColor: '#787b86' }, fields: [['tenkan', 'Conversion', 'number', 1, 100], ['kijun', 'Base', 'number', 1, 200], ['spanB', 'Span B', 'number', 1, 300], ['conversionColor', 'Conversion color', 'color'], ['baseColor', 'Base color', 'color'], ['cloudColor', 'Cloud color', 'color']] },
        supertrend: { name: 'Supertrend', short: 'Supertrend', category: 'Trend', kind: 'overlay', defaults: { period: 10, multiplier: 3, width: 2 }, fields: [['period', 'ATR length', 'number', 1, 100], ['multiplier', 'Factor', 'number', 0.1, 20, 0.1], ['width', 'Line width', 'number', 1, 5]] },
        rsi14: { name: 'Relative Strength Index', short: 'RSI', category: 'Oscillators', kind: 'panel', defaults: { period: 14, color: IND_COLORS.rsi, overbought: 70, oversold: 30 }, fields: [['period', 'Length', 'number', 1, 100], ['overbought', 'Upper band', 'number', 1, 100], ['oversold', 'Lower band', 'number', 0, 99], ['color', 'Color', 'color']] },
        macd: { name: 'MACD', short: 'MACD', category: 'Oscillators', kind: 'panel', defaults: { fast: 12, slow: 26, signal: 9, macdColor: IND_COLORS.macdLine, signalColor: IND_COLORS.macdSig }, fields: [['fast', 'Fast length', 'number', 1, 100], ['slow', 'Slow length', 'number', 1, 200], ['signal', 'Signal smoothing', 'number', 1, 100], ['macdColor', 'MACD color', 'color'], ['signalColor', 'Signal color', 'color']] },
        stoch: { name: 'Stochastic', short: 'Stoch', category: 'Oscillators', kind: 'panel', defaults: { k: 14, d: 3, smooth: 3, kColor: '#2962ff', dColor: '#ff6d00' }, fields: [['k', '%K length', 'number', 1, 100], ['d', '%D smoothing', 'number', 1, 50], ['smooth', 'Smooth', 'number', 1, 50], ['kColor', '%K color', 'color'], ['dColor', '%D color', 'color']] },
        cci: { name: 'Commodity Channel Index', short: 'CCI', category: 'Oscillators', kind: 'panel', defaults: { period: 20, color: '#26a69a' }, fields: [['period', 'Length', 'number', 1, 200], ['color', 'Color', 'color']] },
        momentum: { name: 'Momentum', short: 'MOM', category: 'Oscillators', kind: 'panel', defaults: { period: 10, color: '#ab47bc' }, fields: [['period', 'Length', 'number', 1, 200], ['color', 'Color', 'color']] },
        roc: { name: 'Rate of Change', short: 'ROC', category: 'Oscillators', kind: 'panel', defaults: { period: 9, color: '#29b6f6' }, fields: [['period', 'Length', 'number', 1, 200], ['color', 'Color', 'color']] },
        atr: { name: 'Average True Range', short: 'ATR', category: 'Volatility', kind: 'panel', defaults: { period: 14, color: '#ffb74d' }, fields: [['period', 'Length', 'number', 1, 200], ['color', 'Color', 'color']] },
        adx: { name: 'Average Directional Index', short: 'ADX', category: 'Trend', kind: 'panel', defaults: { period: 14, adxColor: '#fbc02d', plusColor: '#089981', minusColor: '#f23645' }, fields: [['period', 'Length', 'number', 1, 100], ['adxColor', 'ADX color', 'color'], ['plusColor', '+DI color', 'color'], ['minusColor', '-DI color', 'color']] },
        obv: { name: 'On Balance Volume', short: 'OBV', category: 'Volume', kind: 'panel', defaults: { color: '#7e57c2' }, fields: [['color', 'Color', 'color']] },
        volume: { name: 'Volume', short: 'VOL', category: 'Volume', kind: 'panel', defaults: {}, fields: [] },
        smc: { name: 'Smart Money Concepts', short: 'SMC', category: 'Smart Money', kind: 'overlay', defaults: {}, fields: [] }
    };

    // ──────────────────────────────────────────────
    // INIT
    // ──────────────────────────────────────────────
    function init() {
        const savedCount = SafeStorage.getItem('ag_pane_count');
        if (savedCount && ['1','2','4','6','8'].includes(savedCount)) {
            STATE.activePanesCount = parseInt(savedCount);
            if (chartCountSelect) chartCountSelect.value = savedCount;
        }

        if (chartCountSelect)
            chartCountSelect.addEventListener('change', e => updateGridCount(parseInt(e.target.value)));

        paneLayoutButtons.forEach(btn => {
            btn.addEventListener('click', () => updateGridCount(parseInt(btn.dataset.paneCount, 10)));
        });

        if (mt5StatusPanel)
            mt5StatusPanel.addEventListener('click', testMT5Connection);

        updateGridCount(STATE.activePanesCount);
        testMT5Connection();
        window.addEventListener('resize', handleResize);
        initSMCSettingsEvents();
        initIndicatorLibraryEvents();
    }

    // ──────────────────────────────────────────────
    // GRID
    // ──────────────────────────────────────────────
    function syncPaneLayoutControl(count) {
        if (chartCountSelect) chartCountSelect.value = String(count);
        paneLayoutButtons.forEach(btn => {
            const active = btn.dataset.paneCount === String(count);
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-checked', active ? 'true' : 'false');
        });
    }

    function updateGridCount(count) {
        STATE.activePanesCount = count;
        SafeStorage.setItem('ag_pane_count', count);
        syncPaneLayoutControl(count);

        if (gridContainer) {
            gridContainer.className = `grid-container grid-${count}-pane`;
        }

        Object.keys(STATE.panes).forEach(id => {
            if (parseInt(id) > count) destroyPane(parseInt(id));
        });

        for (let i = 1; i <= count; i++) {
            if (!STATE.panes[i]) createPane(i);
        }

        setTimeout(handleResize, 80);
    }

    // ──────────────────────────────────────────────
    // CREATE PANE
    // ──────────────────────────────────────────────
    function createPane(paneId) {
        if (!chartPaneTemplate || !gridContainer) return;

        let clone;
        if (chartPaneTemplate.content && typeof chartPaneTemplate.content.cloneNode === 'function') {
            clone = chartPaneTemplate.content.cloneNode(true);
        } else {
            const tmp = document.createElement('div');
            tmp.innerHTML = chartPaneTemplate.innerHTML;
            clone = tmp;
        }

        const paneEl = clone.querySelector('.chart-pane');
        if (!paneEl) return;

        paneEl.setAttribute('data-pane-id', paneId);
        const numEl = paneEl.querySelector('.pane-num');
        if (numEl) numEl.textContent = paneId;

        gridContainer.appendChild(paneEl);

        const sourceSelect  = paneEl.querySelector('.pane-source-select');
        const symbolInput   = paneEl.querySelector('.pane-symbol-input');
        const tfSelect      = paneEl.querySelector('.pane-tf-select');
        const chartMount    = paneEl.querySelector('.chart-mount');
        const oscillatorsContainer  = paneEl.querySelector('.oscillators-container');
        const overlay       = paneEl.querySelector('.pane-loading-overlay');

        if (typeof LightweightCharts === 'undefined') {
            if (overlay) overlay.querySelector('.loading-text').innerHTML = '<span class="bear-text">LightweightCharts library not loaded.</span>';
            return;
        }

        // Load saved or default config
        const rawConfig = SafeStorage.getItem(`ag_pane_config_${paneId}`);
        let config = DEFAULT_PANE_CONFIGS[paneId] || { source: 'hyperliquid', symbol: 'BTC', timeframe: '5m' };
        if (rawConfig) {
            try { config = JSON.parse(rawConfig); } catch(e) {}
        }

        if (sourceSelect) sourceSelect.value = config.source;
        if (symbolInput)  symbolInput.value  = config.symbol;
        if (tfSelect)     tfSelect.value     = config.timeframe;

        // Load saved indicator states
        const rawIndicators = SafeStorage.getItem(`ag_pane_indicators_${paneId}`);
        let activeIndicators = {};
        if (rawIndicators) {
            try { activeIndicators = JSON.parse(rawIndicators); } catch(e) {}
        }

        const rawIndicatorSettings = SafeStorage.getItem(`ag_pane_indicator_settings_${paneId}`);
        let indicatorSettings = {};
        if (rawIndicatorSettings) {
            try { indicatorSettings = JSON.parse(rawIndicatorSettings); } catch(e) {}
        }

        const rawIndicatorVisibility = SafeStorage.getItem(`ag_pane_indicator_visibility_${paneId}`);
        let indicatorVisibility = {};
        if (rawIndicatorVisibility) {
            try { indicatorVisibility = JSON.parse(rawIndicatorVisibility); } catch(e) {}
        }

        const rawOscillatorSizes = SafeStorage.getItem(`ag_pane_oscillator_sizes_${paneId}`);
        let oscillatorSizes = {};
        if (rawOscillatorSizes) {
            try { oscillatorSizes = JSON.parse(rawOscillatorSizes); } catch(e) {}
        }

        // ── Main Chart ──
        const chart = LightweightCharts.createChart(chartMount, {
            layout: {
                background: { type: 'solid', color: 'transparent' },
                textColor: '#909296',
                fontFamily: 'Inter, sans-serif',
                fontSize: 11
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.025)' },
                horzLines: { color: 'rgba(255,255,255,0.025)' }
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: { color: '#7B2CBF', width: 1, style: LightweightCharts.LineStyle.Solid },
                horzLine: { color: '#7B2CBF', width: 1, style: LightweightCharts.LineStyle.Solid }
            },
            rightPriceScale: {
                borderColor: 'rgba(255,255,255,0.07)', visible: true, minimumWidth: 80
            },
            timeScale: {
                borderColor: 'rgba(255,255,255,0.07)',
                timeVisible: true, secondsVisible: false
            }
        });

        // ── Candlestick Series ──
        const series = chart.addSeries(LightweightCharts.CandlestickSeries, {
            upColor:        '#00E676', downColor:        '#FF1744',
            borderUpColor:  '#00E676', borderDownColor:  '#FF1744',
            wickUpColor:    '#00E676', wickDownColor:    '#FF1744',
            priceLineStyle: LightweightCharts.LineStyle.Solid,
            priceLineWidth: 1
        });

        // ── Oscillator Charts Stack ──
        const oscillators = {}; // { rsi14: { chart, series: {}, mountEl, resizeObserver }, ... }

        // ── ResizeObserver ──
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) chart.resize(width, height);
            }
        });
        resizeObserver.observe(chartMount);

        // Load saved SMC settings
        const savedSmcSettings = SafeStorage.getItem(`ag_pane_smc_settings_${paneId}`);
        let smcSettings = {};
        if (savedSmcSettings) {
            try { smcSettings = JSON.parse(savedSmcSettings); } catch(e) {}
        }

        // ── Pane state object ──
        STATE.panes[paneId] = {
            id: paneId,
            element: paneEl,
            source: config.source,
            symbol: config.symbol,
            timeframe: config.timeframe,
            chart,
            series,
            oscillators,
            oscillatorsContainer,
            resizeObserver,
            ws: null,
            pollingTimer: null,
            lastPrice: null,
            lastCandle: null,
            candles: [],
            isBackfilling: false,
            hasMoreHistory: true,
            activeIndicators,
            indicatorSettings,
            indicatorVisibility,
            oscillatorSizes,
            overlaySeries: {},
            smcSeries: [],
            smcSettings: smcSettings,
            activeTool: null,
            drawings: []
        };

        wireHistoryBackfill(STATE.panes[paneId]);

        // ── Wire event listeners ──
        if (sourceSelect) sourceSelect.addEventListener('change', () => handlePaneConfigChange(paneId));
        if (symbolInput)  symbolInput.addEventListener('change',  () => handlePaneConfigChange(paneId));
        if (tfSelect)     tfSelect.addEventListener('change',     () => handlePaneConfigChange(paneId));

        // Active pane highlight
        paneEl.addEventListener('click', () => {
            document.querySelectorAll('.chart-pane').forEach(el => el.classList.remove('active-pane'));
            paneEl.classList.add('active-pane');
        });

        // Right-click context menu for trading
        paneEl.addEventListener('contextmenu', (evt) => {
            evt.preventDefault();
            const p = STATE.panes[paneId];
            if (p.source !== 'mt5' || STATE.mt5Status !== 'connected') return;
            showContextMenu(evt, paneId);
        });

        // Re-render overlays when chart pans/zooms using a robust animation loop
        // because LWC doesn't provide a hook for vertical price-scale dragging.
        const syncOverlays = () => {
            if (STATE.panes[paneId] && STATE.panes[paneId].source === 'mt5') {
                syncTradingOverlays(paneId);
            }
            if (STATE.panes[paneId]) requestAnimationFrame(syncOverlays);
        };
        requestAnimationFrame(syncOverlays);

        // Indicator toolbar wiring
        paneEl.querySelectorAll('.ind-chip').forEach(btn => {
            const ind = btn.dataset.indicator;
            if (Object.entries(activeIndicators || {}).some(([key, active]) => active && getIndicatorBaseKey(key) === ind)) {
                btn.classList.add('active');
                const group = btn.closest('.ind-chip-group');
                if (group) group.classList.add('active');
            }
            btn.addEventListener('click', e => {
                e.stopPropagation();
                toggleIndicator(paneId, ind, btn);
            });
        });

        const indicatorLibraryBtn = paneEl.querySelector('.indicator-library-btn');
        if (indicatorLibraryBtn) {
            indicatorLibraryBtn.addEventListener('click', e => {
                e.stopPropagation();
                openIndicatorLibrary(paneId);
            });
        }

        // Settings gear wiring
        paneEl.querySelectorAll('.ind-settings-icon').forEach(btn => {
            const ind = btn.dataset.indicator;
            btn.addEventListener('click', e => {
                e.stopPropagation();
                if (ind === 'smc') {
                    openSMCSettings(paneId);
                }
            });
        });

        // Drawing tool wiring
        paneEl.querySelectorAll('.tool-chip').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                handleToolClick(paneId, btn.dataset.tool, btn);
            });
        });

        // Drawing tool click on chart
        chartMount.addEventListener('click', e => handleChartClick(e, paneId));

        // Load data
        loadChartData(paneId);
    }

    // ──────────────────────────────────────────────
    // DESTROY PANE
    // ──────────────────────────────────────────────
    function destroyPane(paneId) {
        const pane = STATE.panes[paneId];
        if (!pane) return;
        cleanupFeeds(pane);
        try { pane.resizeObserver.disconnect(); } catch(e) {}
        try { pane.oscResizeObserver.disconnect(); } catch(e) {}
        try { pane.chart.remove(); } catch(e) {}
        try { if (pane.oscChart) pane.oscChart.remove(); } catch(e) {}
        if (pane.element && pane.element.parentNode)
            pane.element.parentNode.removeChild(pane.element);
        delete STATE.panes[paneId];
    }

    function cleanupFeeds(pane) {
        if (pane.ws)            { try { pane.ws.close(); } catch(e) {} pane.ws = null; }
        if (pane.pollingTimer)  { clearInterval(pane.pollingTimer); pane.pollingTimer = null; }
    }

    // ──────────────────────────────────────────────
    // CONFIG CHANGE
    // ──────────────────────────────────────────────
    function handlePaneConfigChange(paneId) {
        const pane = STATE.panes[paneId];
        if (!pane) return;
        const source    = pane.element.querySelector('.pane-source-select').value;
        const symbol    = pane.element.querySelector('.pane-symbol-input').value.trim().toUpperCase();
        const timeframe = pane.element.querySelector('.pane-tf-select').value;

        pane.source = source; pane.symbol = symbol; pane.timeframe = timeframe;
        SafeStorage.setItem(`ag_pane_config_${paneId}`, JSON.stringify({ source, symbol, timeframe }));
        loadChartData(paneId);
    }

    // ──────────────────────────────────────────────
    // LOAD CHART DATA
    // ──────────────────────────────────────────────
    function loadChartData(paneId) {
        const pane = STATE.panes[paneId];
        if (!pane) return;

        cleanupFeeds(pane);
        pane.lastPrice = null; pane.lastCandle = null; pane.candles = [];
        pane.isBackfilling = false;
        pane.hasMoreHistory = true;

        // Clear all overlay series
        Object.values(pane.overlaySeries).forEach(s => {
            try { pane.chart.removeSeries(s); } catch(e) {}
        });
        pane.overlaySeries = {};
        clearSMC(pane);

        // Clear oscillator
        clearOscillator(pane);

        // Update ticker
        pane.element.querySelector('.ticker-symbol').textContent = pane.symbol;
        pane.element.querySelector('.ticker-price').textContent  = '--';
        pane.element.querySelector('.ticker-direction').textContent = '--';

        // Show spinner
        const overlay = pane.element.querySelector('.pane-loading-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.querySelector('.loading-text').innerHTML =
                '<div class="spinner"></div><span class="loading-text">Fetching historical data...</span>';
        }

        const url = buildHistoricalUrl(pane, 500);
        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (data.error || !Array.isArray(data) || data.length === 0)
                    throw new Error(data.error || 'No data returned');

                pane.candles = data;
                rebuildTimeIndexMap(pane);
                
                pane.series.setData(data);
                pane.chart.timeScale().fitContent();

                if (data.length > 0) {
                    pane.lastCandle = { ...data[data.length - 1] };
                    pane.lastPrice  = pane.lastCandle.close;
                    updateTickerDisplay(pane, pane.lastPrice, 0.0);
                }

                if (overlay) overlay.classList.add('hidden');

                // Dynamic price format from backend
                applySymbolFormat(pane);

                // Re-render all active indicators
                Object.keys(pane.activeIndicators).forEach(ind => {
                    if (pane.activeIndicators[ind]) renderIndicator(pane, ind);
                });

                wireLiveFeed(paneId);
            })
            .catch(err => {
                console.error(`Pane #${paneId} data error:`, err);
                if (overlay)
                    overlay.querySelector('.loading-text').innerHTML =
                        `<span class="bear-text">Failed to fetch data.<br>${err.message}</span>`;
            });
    }

    function buildHistoricalUrl(pane, limit, beforeTime = null) {
        const params = new URLSearchParams({
            source: pane.source,
            symbol: pane.symbol,
            timeframe: pane.timeframe,
            limit: String(limit)
        });
        if (beforeTime != null) params.set('before', String(beforeTime));
        return `/api/historical?${params.toString()}`;
    }

    function rebuildTimeIndexMap(pane) {
        pane.timeToIndexMap = new Map();
        pane.candles.forEach((c, idx) => pane.timeToIndexMap.set(c.time, idx));
    }

    function mergeCandles(existing, incoming) {
        const byTime = new Map();
        [...incoming, ...existing].forEach(candle => {
            if (candle && candle.time != null) byTime.set(candle.time, candle);
        });
        return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
    }

    function applySymbolFormat(pane) {
        fetch(`/api/symbol_format?source=${pane.source}&symbol=${pane.symbol}`)
            .then(r => r.json())
            .then(fd => pane.series.applyOptions({
                priceFormat: { type: 'price', precision: fd.precision, minMove: fd.minMove }
            }))
            .catch(() => {
                const fo = getPriceFormatOptions(pane.source, pane.symbol, pane.lastPrice);
                pane.series.applyOptions({ priceFormat: fo });
            });
    }

    // ══════════════════════════════════════════════
    //  INDICATOR ENGINE
    // ══════════════════════════════════════════════

    function toggleIndicator(paneId, indKey, btn) {
        const pane = STATE.panes[paneId];
        if (!pane) return;

        const isActive = getActiveIndicatorKeysByBase(pane, indKey).length > 0;

        if (isActive) {
            if (indKey === 'smc') {
                // SMC is a singleton overlay because it owns shared chart markers.
                removeIndicatorsByBase(pane, indKey);
                btn.classList.remove('active');
                const group = btn.closest('.ind-chip-group');
                if (group) group.classList.remove('active');
            } else {
                const instanceKey = createIndicatorInstanceKey(pane, indKey);
                pane.indicatorVisibility = pane.indicatorVisibility || {};
                pane.indicatorVisibility[instanceKey] = true;
                renderIndicator(pane, instanceKey);
                pane.activeIndicators[instanceKey] = true;
                btn.classList.add('active');
            }
        } else {
            // Add
            if (pane.candles.length === 0) {
                console.warn(`Pane #${paneId}: No data loaded yet. Load chart first.`);
                return;
            }

            pane.indicatorVisibility = pane.indicatorVisibility || {};
            pane.indicatorVisibility[indKey] = true;
            renderIndicator(pane, indKey);
            pane.activeIndicators[indKey] = true;
            btn.classList.add('active');
            const group = btn.closest('.ind-chip-group');
            if (group) group.classList.add('active');
        }

        saveIndicatorState(pane);
        updateActiveIndicatorLegend(pane);
        renderIndicatorLibrary();
    }

    function getIndicatorBaseKey(indKey) {
        return String(indKey || '').split('__')[0];
    }

    function getIndicatorDef(indKey) {
        return INDICATOR_DEFS[getIndicatorBaseKey(indKey)];
    }

    function getActiveIndicatorKeysByBase(pane, baseKey) {
        return Object.entries(pane.activeIndicators || {})
            .filter(([key, active]) => active && getIndicatorBaseKey(key) === baseKey)
            .map(([key]) => key);
    }

    function createIndicatorInstanceKey(pane, baseKey) {
        if (!pane.activeIndicators?.[baseKey]) return baseKey;
        let key;
        do {
            key = `${baseKey}__${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        } while (pane.activeIndicators?.[key]);
        return key;
    }

    function seriesKey(indKey, suffix = 'line') {
        return getIndicatorBaseKey(indKey) === indKey && suffix === 'line'
            ? indKey
            : `${indKey}:${suffix}`;
    }

    function getIndicatorConfig(pane, indKey) {
        const def = getIndicatorDef(indKey) || { defaults: {} };
        const cfg = { ...(def.defaults || {}), ...((pane.indicatorSettings || {})[indKey] || {}) };
        (def.fields || []).forEach(field => {
            const [key, , type, min, max] = field;
            if (type !== 'number') return;
            const value = Number(cfg[key]);
            cfg[key] = Number.isFinite(value) && (min == null || value >= min) && (max == null || value <= max)
                ? value
                : def.defaults?.[key];
        });
        return cfg;
    }

    function setIndicatorConfig(pane, indKey, cfg) {
        pane.indicatorSettings = pane.indicatorSettings || {};
        pane.indicatorSettings[indKey] = { ...(getIndicatorDef(indKey)?.defaults || {}), ...cfg };
        SafeStorage.setItem(`ag_pane_indicator_settings_${pane.id}`, JSON.stringify(pane.indicatorSettings));
    }

    function saveIndicatorState(pane) {
        SafeStorage.setItem(`ag_pane_indicators_${pane.id}`, JSON.stringify(pane.activeIndicators));
        SafeStorage.setItem(`ag_pane_indicator_settings_${pane.id}`, JSON.stringify(pane.indicatorSettings || {}));
        SafeStorage.setItem(`ag_pane_indicator_visibility_${pane.id}`, JSON.stringify(pane.indicatorVisibility || {}));
    }

    function isIndicatorVisible(pane, indKey) {
        return (pane.indicatorVisibility || {})[indKey] !== false;
    }

    function setIndicatorVisibility(pane, indKey, visible) {
        pane.indicatorVisibility = pane.indicatorVisibility || {};
        pane.indicatorVisibility[indKey] = visible;
        saveIndicatorState(pane);
    }

    function toggleIndicatorVisibility(pane, indKey) {
        if (!pane || !pane.activeIndicators?.[indKey]) return;

        const nextVisible = !isIndicatorVisible(pane, indKey);
        setIndicatorVisibility(pane, indKey, nextVisible);

        if (nextVisible) {
            renderIndicator(pane, indKey);
        } else {
            removeIndicator(pane, indKey);
        }

        updateActiveIndicatorLegend(pane);
        renderIndicatorLibrary();
    }

    function setIndicatorActive(pane, indKey, active) {
        if (!pane || !indKey) return;
        if (active) {
            pane.activeIndicators[indKey] = true;
            pane.indicatorVisibility = pane.indicatorVisibility || {};
            pane.indicatorVisibility[indKey] = true;
            if (pane.candles.length > 0) renderIndicator(pane, indKey);
        } else {
            removeIndicator(pane, indKey);
            pane.activeIndicators[indKey] = false;
            if (pane.indicatorVisibility) delete pane.indicatorVisibility[indKey];
        }
        saveIndicatorState(pane);
        updateToolbarIndicatorState(pane, indKey);
        updateActiveIndicatorLegend(pane);
    }

    function addIndicatorFromLibrary(pane, baseKey) {
        if (!pane || !baseKey || !getIndicatorDef(baseKey)) return null;

        const indKey = createIndicatorInstanceKey(pane, baseKey);
        setIndicatorConfig(pane, indKey, readIndicatorSettingsForm(baseKey));
        setIndicatorActive(pane, indKey, true);
        selectedIndicatorKey = indKey;
        return indKey;
    }

    function removeIndicatorsByBase(pane, baseKey) {
        getActiveIndicatorKeysByBase(pane, baseKey).forEach(indKey => {
            removeIndicator(pane, indKey);
            pane.activeIndicators[indKey] = false;
            if (pane.indicatorVisibility) delete pane.indicatorVisibility[indKey];
        });
        saveIndicatorState(pane);
        updateToolbarIndicatorState(pane, baseKey);
        updateActiveIndicatorLegend(pane);
    }

    function updateToolbarIndicatorState(pane, indKey) {
        const baseKey = getIndicatorBaseKey(indKey);
        const btn = pane.element.querySelector(`.ind-chip[data-indicator="${baseKey}"]`);
        if (!btn) return;
        const active = getActiveIndicatorKeysByBase(pane, baseKey).length > 0;
        btn.classList.toggle('active', active);
        const group = btn.closest('.ind-chip-group');
        if (group) group.classList.toggle('active', active);
    }

    function getIndicatorLegendLabel(pane, indKey) {
        const baseKey = getIndicatorBaseKey(indKey);
        const def = getIndicatorDef(indKey);
        const cfg = getIndicatorConfig(pane, indKey);
        if (!def) return indKey;

        switch (baseKey) {
            case 'sma20':
            case 'sma50':
                return `SMA ${cfg.period}`;
            case 'ema9':
            case 'ema21':
                return `EMA ${cfg.period}`;
            case 'wma20':
                return `WMA ${cfg.period}`;
            case 'hma20':
                return `HMA ${cfg.period}`;
            case 'bb20':
                return `BB ${cfg.period} ${cfg.stdDev}`;
            case 'ichimoku':
                return `Ichimoku ${cfg.tenkan} ${cfg.kijun} ${cfg.spanB}`;
            case 'supertrend':
                return `Supertrend ${cfg.period} ${cfg.multiplier}`;
            case 'rsi14':
                return `RSI ${cfg.period}`;
            case 'macd':
                return `MACD ${cfg.fast} ${cfg.slow} ${cfg.signal}`;
            case 'stoch':
                return `Stoch ${cfg.k} ${cfg.d} ${cfg.smooth}`;
            case 'cci':
                return `CCI ${cfg.period}`;
            case 'momentum':
                return `Mom ${cfg.period}`;
            case 'roc':
                return `ROC ${cfg.period}`;
            case 'atr':
                return `ATR ${cfg.period}`;
            case 'adx':
                return `ADX ${cfg.period}`;
            default:
                return def.short || def.name;
        }
    }

    function openIndicatorSettings(paneId, indKey) {
        if (getIndicatorBaseKey(indKey) === 'smc') {
            openSMCSettings(paneId);
            return;
        }

        const pane = STATE.panes[paneId];
        if (!pane) return;
        activeIndicatorLibraryPaneId = paneId;
        selectedIndicatorKey = indKey;
        editingIndicatorKey = indKey;

        const paneLabel = document.getElementById('indicator-library-pane-label');
        if (paneLabel) paneLabel.textContent = `Pane #${paneId} · ${pane.symbol} · ${pane.timeframe}`;
        const search = document.getElementById('indicator-library-search');
        if (search) search.value = '';
        const modal = document.getElementById('indicator-library-dialog');
        if (modal) modal.classList.remove('hidden');
        renderIndicatorLibrary();
    }

    function makeIndicatorLegendItem(pane, indKey) {
        const item = document.createElement('div');
        item.className = 'indicator-legend-item';
        item.dataset.indicatorKey = indKey;
        item.classList.toggle('is-hidden', !isIndicatorVisible(pane, indKey));

        const name = document.createElement('span');
        name.className = 'indicator-legend-name';
        name.textContent = getIndicatorLegendLabel(pane, indKey);
        item.appendChild(name);

        const actions = document.createElement('span');
        actions.className = 'indicator-legend-actions';

        const hideBtn = document.createElement('button');
        hideBtn.type = 'button';
        hideBtn.className = 'indicator-action-btn indicator-hide-btn';
        hideBtn.title = isIndicatorVisible(pane, indKey) ? 'Hide indicator' : 'Show indicator';
        hideBtn.setAttribute('aria-label', `${hideBtn.title}: ${name.textContent}`);
        hideBtn.textContent = isIndicatorVisible(pane, indKey) ? '◉' : '○';
        hideBtn.addEventListener('click', event => {
            event.stopPropagation();
            toggleIndicatorVisibility(pane, indKey);
        });

        const settingsBtn = document.createElement('button');
        settingsBtn.type = 'button';
        settingsBtn.className = 'indicator-action-btn';
        settingsBtn.title = 'Indicator settings';
        settingsBtn.setAttribute('aria-label', `${name.textContent} settings`);
        settingsBtn.textContent = '⚙';
        settingsBtn.addEventListener('click', event => {
            event.stopPropagation();
            openIndicatorSettings(pane.id, indKey);
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'indicator-action-btn';
        removeBtn.title = 'Remove indicator';
        removeBtn.setAttribute('aria-label', `Remove ${name.textContent}`);
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', event => {
            event.stopPropagation();
            setIndicatorActive(pane, indKey, false);
            renderIndicatorLibrary();
        });

        actions.appendChild(hideBtn);
        actions.appendChild(settingsBtn);
        actions.appendChild(removeBtn);
        item.appendChild(actions);
        return item;
    }

    function updateActiveIndicatorLegend(pane) {
        if (!pane?.element) return;
        const legend = pane.element.querySelector('.indicator-legend');
        if (!legend) return;

        legend.innerHTML = '';
        Object.entries(pane.activeIndicators || {}).forEach(([indKey, active]) => {
            const def = getIndicatorDef(indKey);
            if (!active || !def) return;
            if (def.kind !== 'overlay' && isIndicatorVisible(pane, indKey)) return;
            legend.appendChild(makeIndicatorLegendItem(pane, indKey));
        });
    }

    function renderIndicator(pane, indKey) {
        if (!pane.candles || pane.candles.length === 0) return;

        if (!isIndicatorVisible(pane, indKey)) {
            removeIndicator(pane, indKey);
            updateActiveIndicatorLegend(pane);
            return;
        }

        const c = pane.candles;
        const cfg = getIndicatorConfig(pane, indKey);
        const baseKey = getIndicatorBaseKey(indKey);

        switch(baseKey) {
            case 'sma20': renderLineSeries(pane, seriesKey(indKey), Indicators.sma(c, cfg.period), cfg.color, cfg.width); break;
            case 'sma50': renderLineSeries(pane, seriesKey(indKey), Indicators.sma(c, cfg.period), cfg.color, cfg.width); break;
            case 'ema9':  renderLineSeries(pane, seriesKey(indKey), Indicators.ema(c, cfg.period), cfg.color, cfg.width); break;
            case 'ema21': renderLineSeries(pane, seriesKey(indKey), Indicators.ema(c, cfg.period), cfg.color, cfg.width); break;
            case 'wma20': renderLineSeries(pane, seriesKey(indKey), Indicators.wma(c, cfg.period), cfg.color, cfg.width); break;
            case 'hma20': renderLineSeries(pane, seriesKey(indKey), Indicators.hma(c, cfg.period), cfg.color, cfg.width); break;
            case 'vwap':  renderLineSeries(pane, seriesKey(indKey), Indicators.vwap(c), cfg.color, cfg.width); break;

            case 'bb20': {
                const bb = Indicators.bollingerBands(c, cfg.period, cfg.stdDev);
                renderLineSeries(pane, seriesKey(indKey, 'bbUpper'),  bb.upper,  cfg.color,  1.5);
                renderLineSeries(pane, seriesKey(indKey, 'bbMiddle'), bb.middle, cfg.middleColor, 1);
                renderLineSeries(pane, seriesKey(indKey, 'bbLower'),  bb.lower,  cfg.color,  1.5);
                break;
            }

            case 'ichimoku': renderIchimoku(pane, cfg, indKey); break;
            case 'supertrend': renderSupertrend(pane, cfg, indKey); break;
            case 'rsi14': renderOscillatorRSI(pane, cfg, indKey); break;
            case 'macd':  renderOscillatorMACD(pane, cfg, indKey); break;
            case 'stoch': renderOscillatorStochastic(pane, cfg, indKey); break;
            case 'cci': renderOscillatorLine(pane, indKey, `CCI (${cfg.period})`, Indicators.cci(c, cfg.period), cfg.color, 2, [{ value: 100, color: 'rgba(255,23,68,0.35)' }, { value: -100, color: 'rgba(0,230,118,0.35)' }]); break;
            case 'momentum': renderOscillatorLine(pane, indKey, `Momentum (${cfg.period})`, Indicators.momentum(c, cfg.period), cfg.color, 4, [{ value: 0, color: 'rgba(120,123,134,0.35)' }]); break;
            case 'roc': renderOscillatorLine(pane, indKey, `ROC (${cfg.period})`, Indicators.roc(c, cfg.period), cfg.color, 2, [{ value: 0, color: 'rgba(120,123,134,0.35)' }]); break;
            case 'atr': renderOscillatorLine(pane, indKey, `ATR (${cfg.period})`, Indicators.atr(c, cfg.period), cfg.color, 5); break;
            case 'obv': renderOscillatorLine(pane, indKey, 'OBV', Indicators.obv(c), cfg.color, 0); break;
            case 'adx': renderOscillatorADX(pane, cfg, indKey); break;
            case 'volume': renderOscillatorVolume(pane, indKey); break;
            case 'smc': renderSMC(pane); break;
        }

        updateActiveIndicatorLegend(pane);
    }

    function removeIndicator(pane, indKey) {
        const baseKey = getIndicatorBaseKey(indKey);
        if (baseKey === 'smc') {
            clearSMC(pane);
            return;
        }

        const legacyOverlayKeys = {
            sma20:  ['sma20'],
            sma50:  ['sma50'],
            ema9:   ['ema9'],
            ema21:  ['ema21'],
            wma20:  ['wma20'],
            hma20:  ['hma20'],
            vwap:   ['vwap'],
            bb20:   ['bbUpper', 'bbMiddle', 'bbLower'],
            ichimoku: ['ichiConversion', 'ichiBase', 'ichiSpanA', 'ichiSpanB'],
            supertrend: ['supertrend']
        };

        Object.keys(pane.overlaySeries || {}).forEach(k => {
            const isInstanceSeries = k === indKey || k.startsWith(`${indKey}:`);
            const isLegacySeries = baseKey === indKey && legacyOverlayKeys[baseKey]?.includes(k);
            if (!isInstanceSeries && !isLegacySeries) return;
            try { pane.chart.removeSeries(pane.overlaySeries[k]); } catch(e) {}
            delete pane.overlaySeries[k];
        });

        // Oscillator removal
        if (['rsi14', 'macd', 'volume', 'stoch', 'cci', 'momentum', 'roc', 'atr', 'obv', 'adx'].includes(baseKey)) {
            clearOscillator(pane, indKey);
        }
    }

    // ── Helper to pad indicator data arrays to match candles 1:1 ──
    function alignDataToCandles(indicatorData, candles) {
        if (!indicatorData || !candles) return [];
        const dataMap = new Map();
        for (const item of indicatorData) {
            if (item && item.time) dataMap.set(item.time, item);
        }
        return candles.map(c => {
            if (dataMap.has(c.time)) {
                return dataMap.get(c.time);
            } else {
                return { time: c.time }; // Point with time but no value creates a gap
            }
        });
    }

    // ── Render an overlay LineSeries on the main chart ──
    function renderLineSeries(pane, key, data, color, lineWidth = 1.5, extraOpts = {}) {
        if (!data || data.length === 0) return;

        if (pane.overlaySeries[key]) {
            pane.overlaySeries[key].applyOptions({ color, lineWidth, ...extraOpts });
            pane.overlaySeries[key].setData(data);
            return;
        }

        const s = pane.chart.addSeries(LightweightCharts.LineSeries, {
            color,
            lineWidth,
            priceLineVisible: false,
            lastValueVisible: true,
            crosshairMarkerVisible: false,
            ...extraOpts
        });
        s.setData(data);
        pane.overlaySeries[key] = s;
    }

    function renderIchimoku(pane, cfg, indKey = 'ichimoku') {
        const data = Indicators.ichimoku(pane.candles, cfg.tenkan, cfg.kijun, cfg.spanB);
        renderLineSeries(pane, seriesKey(indKey, 'ichiConversion'), data.conversion, cfg.conversionColor, 1.5);
        renderLineSeries(pane, seriesKey(indKey, 'ichiBase'), data.base, cfg.baseColor, 1.5);
        renderLineSeries(pane, seriesKey(indKey, 'ichiSpanA'), data.spanA, cfg.cloudColor, 1, { lineStyle: 2 });
        renderLineSeries(pane, seriesKey(indKey, 'ichiSpanB'), data.spanB, cfg.cloudColor, 1, { lineStyle: 2 });
    }

    function renderSupertrend(pane, cfg, indKey = 'supertrend') {
        const data = Indicators.supertrend(pane.candles, cfg.period, cfg.multiplier);
        renderLineSeries(pane, seriesKey(indKey), data.line, '#089981', cfg.width, {
            priceLineVisible: false,
            lastValueVisible: true
        });
    }

    function setGuideLine(seriesMap, chart, key, firstTime, lastTime, guide) {
        if (!seriesMap[key]) {
            seriesMap[key] = chart.addSeries(LightweightCharts.LineSeries, {
                color: guide.color,
                lineWidth: 1,
                lineStyle: 2,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false
            });
        } else {
            seriesMap[key].applyOptions({ color: guide.color });
        }
        seriesMap[key].setData([{ time: firstTime, value: guide.value }, { time: lastTime, value: guide.value }]);
    }

    function renderOscillatorLine(pane, indKey, label, data, color, precision = 2, guides = []) {
        if (!data || data.length === 0) return;
        const alignedData = alignDataToCandles(data, pane.candles);
        const osc = ensureOscChart(pane, indKey, label);
        if (!osc) return;
        osc.alignedData = alignedData;

        if (!osc.series.mainLine) {
            osc.series.mainLine = osc.chart.addSeries(LightweightCharts.LineSeries, {
                color,
                lineWidth: 1.5,
                priceLineVisible: false,
                lastValueVisible: true,
                crosshairMarkerVisible: false,
                priceFormat: { type: 'price', precision, minMove: Math.pow(10, -precision) }
            });
        } else {
            osc.series.mainLine.applyOptions({ color });
        }
        osc.series.mainLine.setData(alignedData);

        const tFirst = pane.candles[0].time;
        const tLast = pane.candles[pane.candles.length - 1].time;
        guides.forEach((guide, idx) => setGuideLine(osc.series, osc.chart, `guide${idx}`, tFirst, tLast, guide));

        syncTimeScales(pane);
    }

    // ── RSI sub-pane ──
    function renderOscillatorRSI(pane, cfg = getIndicatorConfig(pane, 'rsi14'), indKey = 'rsi14') {
        const rsiData = Indicators.rsi(pane.candles, cfg.period);
        if (!rsiData || rsiData.length === 0) return;

        const alignedRsiData = alignDataToCandles(rsiData, pane.candles);
        const osc = ensureOscChart(pane, indKey, `RSI (${cfg.period})`);
        if (!osc) return;

        // Store aligned data for crosshair O(1) lookups
        osc.alignedData = alignedRsiData;

        if (!osc.series.rsiLine) {
            const rsiSeries = osc.chart.addSeries(LightweightCharts.LineSeries, {
                color: cfg.color, lineWidth: 1.5,
                priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,
                priceFormat: { type: 'price', precision: 1, minMove: 0.1 }
            });
            const obLine = osc.chart.addSeries(LightweightCharts.LineSeries, {
                color: 'rgba(255,23,68,0.4)', lineWidth: 1, lineStyle: 2,
                priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
            });
            const osLine = osc.chart.addSeries(LightweightCharts.LineSeries, {
                color: 'rgba(0,230,118,0.4)', lineWidth: 1, lineStyle: 2,
                priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
            });
            osc.series.rsiLine = rsiSeries;
            osc.series.rsiOB   = obLine;
            osc.series.rsiOS   = osLine;
        } else {
            osc.series.rsiLine.applyOptions({ color: cfg.color });
        }

        osc.series.rsiLine.setData(alignedRsiData);

        const tFirst = pane.candles[0].time;
        const tLast = pane.candles[pane.candles.length - 1].time;
        osc.series.rsiOB.setData([{ time: tFirst, value: cfg.overbought }, { time: tLast, value: cfg.overbought }]);
        osc.series.rsiOS.setData([{ time: tFirst, value: cfg.oversold }, { time: tLast, value: cfg.oversold }]);

        syncTimeScales(pane);
    }

    // ── MACD sub-pane ──
    function renderOscillatorMACD(pane, cfg = getIndicatorConfig(pane, 'macd'), indKey = 'macd') {
        const macdData = Indicators.macd(pane.candles, cfg.fast, cfg.slow, cfg.signal);
        if (!macdData) return;

        const alignedMacdLine = alignDataToCandles(macdData.macdLine, pane.candles);
        const alignedSignalLine = alignDataToCandles(macdData.signalLine, pane.candles);
        const alignedHistogram = alignDataToCandles(macdData.histogram, pane.candles);

        const osc = ensureOscChart(pane, indKey, `MACD (${cfg.fast},${cfg.slow},${cfg.signal})`);
        if (!osc) return;

        // Store aligned data for crosshair O(1) lookups
        osc.alignedLineData = alignedMacdLine;

        if (!osc.series.macdLine) {
            const histSeries = osc.chart.addSeries(LightweightCharts.HistogramSeries, {
                priceLineVisible: false, lastValueVisible: false,
                priceFormat: { type: 'price', precision: 5, minMove: 0.00001 }
            });
            const macdLine = osc.chart.addSeries(LightweightCharts.LineSeries, {
                color: cfg.macdColor, lineWidth: 1.5,
                priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
                priceFormat: { type: 'price', precision: 5, minMove: 0.00001 }
            });
            const sigLine = osc.chart.addSeries(LightweightCharts.LineSeries, {
                color: cfg.signalColor, lineWidth: 1, lineStyle: 1,
                priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
                priceFormat: { type: 'price', precision: 5, minMove: 0.00001 }
            });
            osc.series.macdHist = histSeries;
            osc.series.macdLine = macdLine;
            osc.series.macdSig  = sigLine;
        } else {
            osc.series.macdLine.applyOptions({ color: cfg.macdColor });
            osc.series.macdSig.applyOptions({ color: cfg.signalColor });
        }

        osc.series.macdHist.setData(alignedHistogram);
        osc.series.macdLine.setData(alignedMacdLine);
        osc.series.macdSig.setData(alignedSignalLine);

        syncTimeScales(pane);
    }

    function renderOscillatorStochastic(pane, cfg, indKey = 'stoch') {
        const data = Indicators.stochastic(pane.candles, cfg.k, cfg.d, cfg.smooth);
        if (!data.kLine || data.kLine.length === 0) return;
        const osc = ensureOscChart(pane, indKey, `Stoch (${cfg.k},${cfg.d},${cfg.smooth})`);
        if (!osc) return;

        const kLine = alignDataToCandles(data.kLine, pane.candles);
        const dLine = alignDataToCandles(data.dLine, pane.candles);
        osc.alignedData = kLine;

        if (!osc.series.kLine) {
            osc.series.kLine = osc.chart.addSeries(LightweightCharts.LineSeries, {
                color: cfg.kColor, lineWidth: 1.5,
                priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,
                priceFormat: { type: 'price', precision: 1, minMove: 0.1 }
            });
            osc.series.dLine = osc.chart.addSeries(LightweightCharts.LineSeries, {
                color: cfg.dColor, lineWidth: 1,
                priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,
                priceFormat: { type: 'price', precision: 1, minMove: 0.1 }
            });
        } else {
            osc.series.kLine.applyOptions({ color: cfg.kColor });
            osc.series.dLine.applyOptions({ color: cfg.dColor });
        }
        osc.series.kLine.setData(kLine);
        osc.series.dLine.setData(dLine);

        const tFirst = pane.candles[0].time;
        const tLast = pane.candles[pane.candles.length - 1].time;
        setGuideLine(osc.series, osc.chart, 'upperGuide', tFirst, tLast, { value: 80, color: 'rgba(255,23,68,0.35)' });
        setGuideLine(osc.series, osc.chart, 'lowerGuide', tFirst, tLast, { value: 20, color: 'rgba(0,230,118,0.35)' });
        syncTimeScales(pane);
    }

    function renderOscillatorADX(pane, cfg, indKey = 'adx') {
        const data = Indicators.adx(pane.candles, cfg.period);
        if (!data.adxLine || data.adxLine.length === 0) return;
        const osc = ensureOscChart(pane, indKey, `ADX (${cfg.period})`);
        if (!osc) return;

        const adxLine = alignDataToCandles(data.adxLine, pane.candles);
        const plusDI = alignDataToCandles(data.plusDI, pane.candles);
        const minusDI = alignDataToCandles(data.minusDI, pane.candles);
        osc.alignedData = adxLine;

        if (!osc.series.adxLine) {
            osc.series.adxLine = osc.chart.addSeries(LightweightCharts.LineSeries, { color: cfg.adxColor, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false });
            osc.series.plusDI = osc.chart.addSeries(LightweightCharts.LineSeries, { color: cfg.plusColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false });
            osc.series.minusDI = osc.chart.addSeries(LightweightCharts.LineSeries, { color: cfg.minusColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false });
        } else {
            osc.series.adxLine.applyOptions({ color: cfg.adxColor });
            osc.series.plusDI.applyOptions({ color: cfg.plusColor });
            osc.series.minusDI.applyOptions({ color: cfg.minusColor });
        }

        osc.series.adxLine.setData(adxLine);
        osc.series.plusDI.setData(plusDI);
        osc.series.minusDI.setData(minusDI);
        syncTimeScales(pane);
    }

    // ── Volume sub-pane ──
    function renderOscillatorVolume(pane, indKey = 'volume') {
        const volData = Indicators.volume(pane.candles);
        if (!volData || volData.length === 0) return;

        const alignedVolData = alignDataToCandles(volData, pane.candles);
        const osc = ensureOscChart(pane, indKey, 'Volume');
        if (!osc) return;

        // Store aligned data for crosshair O(1) lookups
        osc.alignedData = alignedVolData;

        if (!osc.series.volBars) {
            const volSeries = osc.chart.addSeries(LightweightCharts.HistogramSeries, {
                priceLineVisible: false, lastValueVisible: false
            });
            osc.series.volBars = volSeries;
        }

        osc.series.volBars.setData(alignedVolData);
        syncTimeScales(pane);
    }

    // ── Ensure oscillator sub-chart exists ──
    function ensureOscChart(pane, indKey, label) {
        const container = pane.oscillatorsContainer;
        if (!container) return null;

        container.classList.remove('hidden');

        if (!pane.oscillators[indKey]) {
            const subpaneEl = document.createElement('div');
            subpaneEl.className = 'oscillator-subpane';
            applyOscillatorPanelHeight(pane, indKey, subpaneEl, pane.oscillatorSizes?.[indKey] || OSCILLATOR_PANEL_DEFAULT_HEIGHT);
            container.appendChild(subpaneEl);

            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'oscillator-resize-handle';
            resizeHandle.title = 'Drag to resize panel';
            subpaneEl.appendChild(resizeHandle);

            const lbl = document.createElement('div');
            lbl.className = 'oscillator-label';
            lbl.dataset.indicatorKey = indKey;
            lbl.classList.toggle('is-hidden', !isIndicatorVisible(pane, indKey));
            const labelName = document.createElement('span');
            labelName.className = 'indicator-legend-name';
            labelName.textContent = getIndicatorLegendLabel(pane, indKey);
            lbl.appendChild(labelName);

            const actions = document.createElement('span');
            actions.className = 'indicator-legend-actions';

            const hideBtn = document.createElement('button');
            hideBtn.type = 'button';
            hideBtn.className = 'indicator-action-btn indicator-hide-btn';
            hideBtn.title = 'Hide indicator';
            hideBtn.setAttribute('aria-label', `Hide ${labelName.textContent}`);
            hideBtn.textContent = '◉';
            hideBtn.addEventListener('click', event => {
                event.stopPropagation();
                toggleIndicatorVisibility(pane, indKey);
            });

            const settingsBtn = document.createElement('button');
            settingsBtn.type = 'button';
            settingsBtn.className = 'indicator-action-btn';
            settingsBtn.title = 'Indicator settings';
            settingsBtn.setAttribute('aria-label', `${labelName.textContent} settings`);
            settingsBtn.textContent = '⚙';
            settingsBtn.addEventListener('click', event => {
                event.stopPropagation();
                openIndicatorSettings(pane.id, indKey);
            });

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'indicator-action-btn';
            removeBtn.title = 'Remove indicator';
            removeBtn.setAttribute('aria-label', `Remove ${labelName.textContent}`);
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', event => {
                event.stopPropagation();
                setIndicatorActive(pane, indKey, false);
                renderIndicatorLibrary();
            });

            actions.appendChild(hideBtn);
            actions.appendChild(settingsBtn);
            actions.appendChild(removeBtn);
            lbl.appendChild(actions);
            subpaneEl.appendChild(lbl);

            const oscMountEl = document.createElement('div');
            oscMountEl.style.cssText = 'position:absolute;inset:0;';
            subpaneEl.appendChild(oscMountEl);

            const chart = LightweightCharts.createChart(oscMountEl, {
                layout: {
                    background: { type: 'solid', color: 'transparent' },
                    textColor: '#666',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 10
                },
                grid: {
                    vertLines: { color: 'rgba(255,255,255,0.02)' },
                    horzLines: { color: 'rgba(255,255,255,0.02)' }
                },
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Normal,
                    vertLine: { color: '#7B2CBF', width: 1, style: LightweightCharts.LineStyle.Solid },
                    horzLine: { color: '#7B2CBF', width: 1, style: LightweightCharts.LineStyle.Solid }
                },
                rightPriceScale: { borderColor: 'rgba(255,255,255,0.05)', visible: true, scaleMargins: { top: 0.1, bottom: 0.1 }, minimumWidth: 80 },
                timeScale:       { borderColor: 'rgba(255,255,255,0.05)', visible: true, timeVisible: true, secondsVisible: false }
            });

            const resizeObserver = new ResizeObserver(entries => {
                for (const entry of entries) {
                    const { width, height } = entry.contentRect;
                    if (width > 0 && height > 0) chart.resize(width, height);
                }
            });
            resizeObserver.observe(subpaneEl);

            pane.oscillators[indKey] = {
                chart,
                series: {},
                subpaneEl,
                resizeHandle,
                resizeObserver
            };

            wireOscillatorPanelResize(pane, indKey, subpaneEl, resizeHandle);
            
            // Initial resize
            const rect = subpaneEl.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) chart.resize(rect.width, rect.height);
        } else {
            const lbl = pane.oscillators[indKey].subpaneEl?.querySelector('.oscillator-label');
            const labelName = lbl?.querySelector('.indicator-legend-name');
            if (labelName) labelName.textContent = getIndicatorLegendLabel(pane, indKey);
            if (lbl) lbl.classList.toggle('is-hidden', !isIndicatorVisible(pane, indKey));
        }
        
        return pane.oscillators[indKey];
    }

    function applyOscillatorPanelHeight(pane, indKey, subpaneEl, height) {
        const paneHeight = pane.element?.clientHeight || 360;
        const maxHeight = Math.max(OSCILLATOR_PANEL_MIN_HEIGHT, Math.floor(paneHeight * 0.72));
        const nextHeight = Math.max(OSCILLATOR_PANEL_MIN_HEIGHT, Math.min(Math.round(height), maxHeight));
        subpaneEl.style.height = `${nextHeight}px`;
        subpaneEl.style.flexBasis = `${nextHeight}px`;
        if (pane.oscillatorSizes) pane.oscillatorSizes[indKey] = nextHeight;
        return nextHeight;
    }

    function saveOscillatorPanelSizes(pane) {
        SafeStorage.setItem(`ag_pane_oscillator_sizes_${pane.id}`, JSON.stringify(pane.oscillatorSizes || {}));
    }

    function wireOscillatorPanelResize(pane, indKey, subpaneEl, handle) {
        if (!handle) return;

        handle.addEventListener('mousedown', event => {
            event.preventDefault();
            event.stopPropagation();

            const startY = event.clientY;
            const startHeight = subpaneEl.getBoundingClientRect().height;
            document.body.classList.add('is-resizing-panel');
            subpaneEl.classList.add('is-resizing');

            const onMove = moveEvent => {
                const delta = moveEvent.clientY - startY;
                const nextHeight = applyOscillatorPanelHeight(pane, indKey, subpaneEl, startHeight - delta);
                const osc = pane.oscillators[indKey];
                if (osc?.chart) {
                    const rect = subpaneEl.getBoundingClientRect();
                    if (rect.width > 0 && nextHeight > 0) osc.chart.resize(rect.width, nextHeight);
                }
                handleResize();
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.classList.remove('is-resizing-panel');
                subpaneEl.classList.remove('is-resizing');
                saveOscillatorPanelSizes(pane);
                handleResize();
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    function clearOscillator(pane, indKey) {
        const osc = pane.oscillators[indKey];
        if (osc) {
            try { osc.chart.remove(); } catch(e) {}
            if (osc.resizeObserver) osc.resizeObserver.disconnect();
            if (osc.subpaneEl && osc.subpaneEl.parentNode) {
                osc.subpaneEl.parentNode.removeChild(osc.subpaneEl);
            }
            delete pane.oscillators[indKey];
        }
        
        // Hide container if no oscillators are left
        if (Object.keys(pane.oscillators).length === 0 && pane.oscillatorsContainer) {
            pane.oscillatorsContainer.classList.add('hidden');
        }
        updateActiveIndicatorLegend(pane);
    }

    function wireHistoryBackfill(pane) {
        if (!pane || pane._historyBackfillSynced) return;
        pane._historyBackfillSynced = true;

        pane.chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
            if (!range || pane._isSyncing || pane._isRestoringBackfillRange) return;
            if (range.from <= HISTORY_BACKFILL_EDGE_BARS) {
                loadOlderCandles(pane);
            }
        });
    }

    function loadOlderCandles(pane) {
        if (!pane || pane.isBackfilling || !pane.hasMoreHistory) return;
        if (!pane.candles || pane.candles.length === 0) return;

        const firstTime = pane.candles[0].time;
        if (firstTime == null) return;

        pane.isBackfilling = true;
        const previousCount = pane.candles.length;
        const previousRange = pane.chart.timeScale().getVisibleLogicalRange();

        fetch(buildHistoricalUrl(pane, HISTORY_BACKFILL_LIMIT, firstTime))
            .then(r => r.json())
            .then(data => {
                if (!Array.isArray(data) || data.length === 0) {
                    pane.hasMoreHistory = false;
                    return;
                }

                const olderCandles = data.filter(c => c && c.time < firstTime);
                if (olderCandles.length === 0) {
                    pane.hasMoreHistory = false;
                    return;
                }

                pane.candles = mergeCandles(pane.candles, olderCandles);
                const addedCount = pane.candles.length - previousCount;
                if (addedCount <= 0) {
                    pane.hasMoreHistory = false;
                    return;
                }

                rebuildTimeIndexMap(pane);
                pane.series.setData(pane.candles);
                pane.lastCandle = pane.candles[pane.candles.length - 1];
                updateActiveIndicators(pane);
                syncTimeScales(pane);

                if (previousRange) {
                    const restoredRange = {
                        from: previousRange.from + addedCount,
                        to: previousRange.to + addedCount
                    };
                    pane._isRestoringBackfillRange = true;
                    pane.chart.timeScale().setVisibleLogicalRange(restoredRange);
                    Object.values(pane.oscillators).forEach(osc => {
                        if (osc.chart) osc.chart.timeScale().setVisibleLogicalRange(restoredRange);
                    });
                    pane._isRestoringBackfillRange = false;
                }
            })
            .catch(err => console.warn(`Pane #${pane.id} backfill failed:`, err))
            .finally(() => {
                pane.isBackfilling = false;
            });
    }

    // Sync main + osc time scales (loose coupling — just keep range in sync)
    function syncTimeScales(pane) {
        if (!pane._mainChartSynced) {
            pane._mainChartSynced = true;
            pane.chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
                if (!range || pane._isSyncing) return;
                pane._isSyncing = true;
                Object.values(pane.oscillators).forEach(osc => {
                    if (osc.chart) osc.chart.timeScale().setVisibleLogicalRange(range);
                });
                pane._isSyncing = false;
            });
        }
        
        Object.values(pane.oscillators).forEach(osc => {
            if (osc.chart && !osc._synced) {
                osc._synced = true;
                osc.chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
                    if (!range || pane._isSyncing) return;
                    pane._isSyncing = true;
                    pane.chart.timeScale().setVisibleLogicalRange(range);
                    Object.values(pane.oscillators).forEach(otherOsc => {
                        if (otherOsc.chart && otherOsc !== osc) {
                            otherOsc.chart.timeScale().setVisibleLogicalRange(range);
                        }
                    });
                    pane._isSyncing = false;
                });
            }
        });
        
        // Immediate sync for new oscillators
        const currentRange = pane.chart.timeScale().getVisibleLogicalRange();
        if (currentRange) {
            Object.values(pane.oscillators).forEach(osc => {
                if (osc.chart) osc.chart.timeScale().setVisibleLogicalRange(currentRange);
            });
        }

        // Wire or refresh crosshair sync
        syncCrosshairs(pane);
    }

    // ── High-Performance Crosshair Synchronization ──
    function getPrimaryOscillatorSeries(osc) {
        return osc.series.rsiLine || osc.series.macdLine || osc.series.mainLine ||
            osc.series.kLine || osc.series.adxLine || osc.series.volBars;
    }

    function syncCrosshairs(pane) {
        // Collect all charts to sync
        const sources = [
            { chart: pane.chart, series: pane.series, id: 'main' }
        ];

        Object.entries(pane.oscillators).forEach(([key, osc]) => {
            if (osc.chart) {
                const series = getPrimaryOscillatorSeries(osc);
                if (series) {
                    sources.push({ chart: osc.chart, series: series, id: key, osc: osc });
                }
            }
        });

        sources.forEach(source => {
            if (source.chart && !source._crosshairSynced) {
                source._crosshairSynced = true;
                source.chart.subscribeCrosshairMove(param => {
                    if (pane._isCrosshairSyncing) return;
                    pane._isCrosshairSyncing = true;

                    const time = param.time;
                    const hasPosition = param.point && time;

                    // Dynamically compile targets to support clean live additions/removals without closures issues
                    const targets = [];
                    Object.entries(pane.oscillators).forEach(([key, osc]) => {
                        if (osc.chart && osc.chart !== source.chart) {
                            const series = getPrimaryOscillatorSeries(osc);
                            if (series) {
                                targets.push({ chart: osc.chart, series: series, id: key, osc: osc });
                            }
                        }
                    });
                    if (pane.chart !== source.chart) {
                        targets.push({ chart: pane.chart, series: pane.series, id: 'main' });
                    }

                    targets.forEach(target => {
                        if (!hasPosition) {
                            target.chart.clearCrosshairPosition();
                        } else {
                            let price = 0;
                            if (pane.timeToIndexMap && pane.timeToIndexMap.has(time)) {
                                const idx = pane.timeToIndexMap.get(time);
                                if (target.id === 'main') {
                                    price = pane.candles[idx] ? pane.candles[idx].close : 0;
                                } else if (getIndicatorBaseKey(target.id) === 'macd') {
                                    const item = target.osc.alignedLineData && target.osc.alignedLineData[idx];
                                    price = (item && item.value !== undefined) ? item.value : 0;
                                } else {
                                    const item = target.osc.alignedData && target.osc.alignedData[idx];
                                    price = (item && item.value !== undefined) ? item.value : 0;
                                }
                            }
                            target.chart.setCrosshairPosition(price, time, target.series);
                        }
                    });

                    pane._isCrosshairSyncing = false;
                });
            }
        });
    }

    // ── Recalculate indicators dynamically when live feed ticks occur ──
    function updateActiveIndicators(pane) {
        if (!pane.candles || pane.candles.length === 0) return;
        Object.keys(pane.activeIndicators).forEach(indKey => {
            if (pane.activeIndicators[indKey]) {
                renderIndicator(pane, indKey);
            }
        });
    }

    // ── SMC Render & Settings Support ──
    function clearSMC(pane) {
        if (pane.smcSeries && pane.smcSeries.length > 0) {
            pane.smcSeries.forEach(s => {
                try { pane.chart.removeSeries(s); } catch(e) {}
            });
            pane.smcSeries = [];
        }
        if (pane.markersPlugin) {
            try { pane.markersPlugin.setMarkers([]); } catch(e) {}
        } else {
            try { pane.series.setMarkers([]); } catch(e) {}
        }
    }

    function renderSMC(pane) {
        if (!pane.candles || pane.candles.length === 0) return;
        
        clearSMC(pane);

        const smcData = Indicators.smc(pane.candles, pane.smcSettings || {});
        if (!smcData) return;

        const cfg = smcData.settings;
        const candles = pane.candles;
        const lastTime = candles[candles.length - 1].time;
        const isMono = cfg.style === 'Monochrome';

        const greenColor = isMono ? '#b2b5be' : '#089981';
        const redColor = isMono ? '#5d606b' : '#F23645';

        const allMarkers = [];

        // 1. Swing Highs/Lows Markers
        if (cfg.showSwings && smcData.swingHighsLows) {
            smcData.swingHighsLows.forEach(shl => {
                allMarkers.push({
                    time: shl.time,
                    position: shl.position,
                    color: isMono ? (shl.position === 'aboveBar' ? '#5d606b' : '#b2b5be') : shl.color,
                    shape: shl.position === 'aboveBar' ? 'arrowDown' : 'arrowUp',
                    text: shl.label,
                    size: 1
                });
            });
        }

        // Helper to draw segment with text overlay
        const drawSegment = (start, end, price, text, color, lineStyle, lineWidth, textPosition = 'aboveBar') => {
            if (start >= end) return;
            const s = pane.chart.addSeries(LightweightCharts.LineSeries, {
                color: lineStyle === null ? 'transparent' : color,
                lineWidth: lineWidth,
                lineStyle: lineStyle === null ? LightweightCharts.LineStyle.Solid : lineStyle,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false
            });
            s.setData([
                { time: start, value: price },
                { time: end, value: price }
            ]);
            if (text) {
                allMarkers.push({
                    time: end,
                    position: textPosition,
                    color: color === 'transparent' ? '#878b94' : color,
                    shape: textPosition === 'aboveBar' ? 'arrowDown' : 'arrowUp',
                    text: text,
                    size: 1
                });
            }
            pane.smcSeries.push(s);
        };

        // Helper to draw closed rectangle box
        const drawBox = (start, end, top, bottom, color, lineWidth = 1) => {
            if (start >= end) return;
            const sTop = pane.chart.addSeries(LightweightCharts.LineSeries, {
                color: color,
                lineWidth: lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false
            });
            sTop.setData([
                { time: start, value: top },
                { time: end, value: top }
            ]);
            pane.smcSeries.push(sTop);

            const sBot = pane.chart.addSeries(LightweightCharts.LineSeries, {
                color: color,
                lineWidth: lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false
            });
            sBot.setData([
                { time: start, value: bottom },
                { time: end, value: bottom }
            ]);
            pane.smcSeries.push(sBot);
        };

        // 2. Breakouts (BOS / CHoCH)
        if (smcData.breakouts) {
            smcData.breakouts.forEach(b => {
                const color = b.direction === 'bull' ? greenColor : redColor;
                const style = b.type === 'swing' 
                    ? LightweightCharts.LineStyle.Solid 
                    : LightweightCharts.LineStyle.Dashed;
                const width = b.type === 'swing' ? 1.5 : 1;
                const textPos = b.direction === 'bull' ? 'aboveBar' : 'belowBar';
                drawSegment(b.start.time, b.end.time, b.start.price, `${b.tag}`, color, style, width, textPos);
            });
        }

        // 3. Equal Highs/Lows (EQH / EQL)
        if (cfg.showEqualHighsLows && smcData.equalHighsLows) {
            smcData.equalHighsLows.forEach(eq => {
                const color = eq.type === 'EQH' ? redColor : greenColor;
                const textPos = eq.type === 'EQH' ? 'aboveBar' : 'belowBar';
                drawSegment(eq.start.time, eq.end.time, eq.start.price, eq.type, color, LightweightCharts.LineStyle.Dotted, 1, textPos);
            });
        }

        // 4. Order Blocks (OBs)
        if (cfg.showSwingOrderBlocks && smcData.swingOBs) {
            smcData.swingOBs.forEach(ob => {
                const color = ob.bias === 1
                    ? (isMono ? 'rgba(178, 181, 190, 0.6)' : 'rgba(24, 72, 204, 0.6)')
                    : (isMono ? 'rgba(93, 96, 107, 0.6)' : 'rgba(178, 40, 51, 0.6)');
                drawBox(ob.time, lastTime, ob.high, ob.low, color, 1.5);
            });
        }

        if (cfg.showInternalOrderBlocks && smcData.internalOBs) {
            smcData.internalOBs.forEach(ob => {
                const color = ob.bias === 1
                    ? (isMono ? 'rgba(178, 181, 190, 0.45)' : 'rgba(49, 121, 245, 0.45)')
                    : (isMono ? 'rgba(93, 96, 107, 0.45)' : 'rgba(247, 124, 128, 0.45)');
                drawBox(ob.time, lastTime, ob.high, ob.low, color, 1);
            });
        }

        // 5. Fair Value Gaps (FVG)
        if (cfg.showFairValueGaps && smcData.fvgs) {
            const tfSeconds = getTimeframeDurationSeconds(pane.timeframe);
            const extendTime = addTime(lastTime, (cfg.fairValueGapsExtend || 0) * tfSeconds);

            smcData.fvgs.forEach(fvg => {
                const color = fvg.bias === 1
                    ? (isMono ? 'rgba(178, 181, 190, 0.4)' : 'rgba(0, 255, 104, 0.4)')
                    : (isMono ? 'rgba(93, 96, 107, 0.4)' : 'rgba(255, 0, 8, 0.4)');
                drawBox(fvg.time, extendTime, fvg.top, fvg.bottom, color, 1);
            });
        }

        // 6. Premium & Discount Zones
        if (cfg.showPremiumDiscountZones && smcData.trailing) {
            const t = smcData.trailing;
            const startTime = t.barTime;
            const range = t.top - t.bottom;

            if (range > 0) {
                // Premium Zone Box
                const premTop = t.top;
                const premBot = t.top - 0.05 * range;
                const premColor = isMono ? 'rgba(93, 96, 107, 0.4)' : 'rgba(242, 54, 69, 0.4)';
                drawBox(startTime, lastTime, premTop, premBot, premColor, 1);
                drawSegment(startTime, lastTime, (premTop + premBot)/2, 'Premium', 'transparent', null, 0, 'aboveBar');

                // Equilibrium Line
                const eqLevel = (t.top + t.bottom) / 2;
                drawSegment(startTime, lastTime, eqLevel, 'Equilibrium', 'rgba(135, 139, 148, 0.4)', LightweightCharts.LineStyle.Dashed, 1, 'belowBar');

                // Discount Zone Box
                const discTop = t.bottom + 0.05 * range;
                const discBot = t.bottom;
                const discColor = isMono ? 'rgba(178, 181, 190, 0.4)' : 'rgba(8, 153, 129, 0.4)';
                drawBox(startTime, lastTime, discTop, discBot, discColor, 1);
                drawSegment(startTime, lastTime, (discTop + discBot)/2, 'Discount', 'transparent', null, 0, 'belowBar');
            }
        }

        // 7. Strong & Weak High/Low Trailing Levels
        if (cfg.showHighLowSwings && smcData.trailing) {
            const t = smcData.trailing;
            if (t.top !== null) {
                const label = t.swingTrendBias === -1 ? 'Strong High' : 'Weak High';
                drawSegment(t.lastTopTime, lastTime, t.top, label, redColor, LightweightCharts.LineStyle.Solid, 1, 'aboveBar');
            }
            if (t.bottom !== null) {
                const label = t.swingTrendBias === 1 ? 'Strong Low' : 'Weak Low';
                drawSegment(t.lastBottomTime, lastTime, t.bottom, label, greenColor, LightweightCharts.LineStyle.Solid, 1, 'belowBar');
            }
        }

        // Set all sorted markers on the main candlestick series
        if (allMarkers.length > 0) {
            allMarkers.sort((a, b) => {
                const timeA = typeof a.time === 'object' && a.time !== null ? (new Date(Date.UTC(a.time.year, a.time.month - 1, a.time.day)).getTime()) : (typeof a.time === 'string' ? new Date(a.time).getTime() : a.time);
                const timeB = typeof b.time === 'object' && b.time !== null ? (new Date(Date.UTC(b.time.year, b.time.month - 1, b.time.day)).getTime()) : (typeof b.time === 'string' ? new Date(b.time).getTime() : b.time);
                return timeA - timeB;
            });
            if (LightweightCharts.createSeriesMarkers) {
                if (!pane.markersPlugin) {
                    pane.markersPlugin = LightweightCharts.createSeriesMarkers(pane.series, allMarkers);
                } else {
                    pane.markersPlugin.setMarkers(allMarkers);
                }
            } else {
                pane.series.setMarkers(allMarkers);
            }
        }
    }

    function initIndicatorLibraryEvents() {
        const modal = document.getElementById('indicator-library-dialog');
        const closeBtn = document.getElementById('indicator-library-close');
        const search = document.getElementById('indicator-library-search');
        const applyBtn = document.getElementById('indicator-library-apply');
        const removeBtn = document.getElementById('indicator-library-remove');

        if (closeBtn && modal) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
        if (search) search.addEventListener('input', renderIndicatorLibrary);

        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const pane = STATE.panes[activeIndicatorLibraryPaneId];
                if (!pane || !selectedIndicatorKey) return;
                if (editingIndicatorKey && pane.activeIndicators?.[editingIndicatorKey]) {
                    setIndicatorConfig(pane, editingIndicatorKey, readIndicatorSettingsForm(editingIndicatorKey));
                    setIndicatorActive(pane, editingIndicatorKey, true);
                } else {
                    addIndicatorFromLibrary(pane, getIndicatorBaseKey(selectedIndicatorKey));
                }
                renderIndicatorLibrary();
            });
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                const pane = STATE.panes[activeIndicatorLibraryPaneId];
                if (!pane || !editingIndicatorKey) return;
                setIndicatorActive(pane, editingIndicatorKey, false);
                editingIndicatorKey = null;
                renderIndicatorLibrary();
            });
        }
    }

    function openIndicatorLibrary(paneId) {
        const pane = STATE.panes[paneId];
        if (!pane) return;

        activeIndicatorLibraryPaneId = paneId;
        editingIndicatorKey = null;
        const activeKey = Object.keys(pane.activeIndicators || {}).find(key => pane.activeIndicators[key]);
        selectedIndicatorKey = selectedIndicatorKey && getIndicatorDef(selectedIndicatorKey)
            ? selectedIndicatorKey
            : (activeKey || 'sma20');

        const paneLabel = document.getElementById('indicator-library-pane-label');
        if (paneLabel) paneLabel.textContent = `Pane #${paneId} · ${pane.symbol} · ${pane.timeframe}`;

        const search = document.getElementById('indicator-library-search');
        if (search) search.value = '';

        const modal = document.getElementById('indicator-library-dialog');
        if (modal) modal.classList.remove('hidden');
        renderIndicatorLibrary();
    }

    function renderIndicatorLibrary() {
        const pane = STATE.panes[activeIndicatorLibraryPaneId];
        const list = document.getElementById('indicator-library-list');
        if (!pane || !list) return;

        const query = (document.getElementById('indicator-library-search')?.value || '').trim().toLowerCase();
        const entries = Object.entries(INDICATOR_DEFS)
            .filter(([, def]) => !query || `${def.name} ${def.short} ${def.category}`.toLowerCase().includes(query));

        const categories = [];
        entries.forEach(([key, def]) => {
            let group = categories.find(item => item.name === def.category);
            if (!group) {
                group = { name: def.category, items: [] };
                categories.push(group);
            }
            group.items.push([key, def]);
        });

        list.innerHTML = categories.map(group => `
            <div class="indicator-category-label">${group.name}</div>
            ${group.items.map(([key, def]) => `
                <button class="indicator-list-item ${key === getIndicatorBaseKey(selectedIndicatorKey) ? 'selected' : ''}" data-indicator-key="${key}">
                    <span>
                        <span class="indicator-list-name">${def.name}</span>
                        <span class="indicator-list-meta">${def.short} · ${def.kind === 'overlay' ? 'On chart' : 'Separate panel'}</span>
                    </span>
                    <span class="indicator-active-badge">${getActiveIndicatorKeysByBase(pane, key).length ? `${getActiveIndicatorKeysByBase(pane, key).length} active` : ''}</span>
                </button>
            `).join('')}
        `).join('');

        list.querySelectorAll('.indicator-list-item').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedIndicatorKey = btn.dataset.indicatorKey;
                editingIndicatorKey = null;
                renderIndicatorLibrary();
            });
        });

        renderIndicatorSettingsPanel(pane);
    }

    function renderIndicatorSettingsPanel(pane) {
        const activeEditKey = editingIndicatorKey && pane.activeIndicators?.[editingIndicatorKey] ? editingIndicatorKey : null;
        const settingsKey = activeEditKey || selectedIndicatorKey;
        const baseKey = getIndicatorBaseKey(settingsKey);
        const def = getIndicatorDef(settingsKey);
        const fieldsEl = document.getElementById('indicator-settings-fields');
        const nameEl = document.getElementById('indicator-settings-name');
        const categoryEl = document.getElementById('indicator-settings-category');
        const removeBtn = document.getElementById('indicator-library-remove');
        const applyBtn = document.getElementById('indicator-library-apply');
        if (!def || !fieldsEl) return;

        const cfg = getIndicatorConfig(pane, settingsKey);
        const editingExisting = !!activeEditKey;
        if (nameEl) nameEl.textContent = editingExisting ? getIndicatorLegendLabel(pane, activeEditKey) : def.name;
        if (categoryEl) categoryEl.textContent = `${def.category} · ${def.kind === 'overlay' ? 'On chart' : 'Separate panel'}${editingExisting ? ' · Editing active instance' : ' · Add new instance'}`;
        if (removeBtn) removeBtn.disabled = !editingExisting;
        if (applyBtn) applyBtn.textContent = editingExisting ? 'Apply' : `Add ${def.short || def.name}`;

        if (!def.fields || def.fields.length === 0) {
            fieldsEl.innerHTML = baseKey === 'smc'
                ? '<p class="indicator-list-meta">Use the SMC gear in the toolbar for its full LuxAlgo-style settings.</p>'
                : '<p class="indicator-list-meta">This indicator has no configurable inputs.</p>';
            return;
        }

        fieldsEl.innerHTML = def.fields.map(field => {
            const [key, label, type, min, max, step] = field;
            const value = cfg[key] ?? def.defaults[key] ?? '';
            const attrs = [
                `data-field-key="${key}"`,
                `type="${type}"`,
                min != null ? `min="${min}"` : '',
                max != null ? `max="${max}"` : '',
                step != null ? `step="${step}"` : (type === 'number' ? 'step="1"' : ''),
                `value="${value}"`
            ].filter(Boolean).join(' ');
            return `
                <label class="indicator-field-row">
                    <span>${label}</span>
                    <input ${attrs}>
                </label>
            `;
        }).join('');
    }

    function readIndicatorSettingsForm(indKey) {
        const def = getIndicatorDef(indKey);
        const cfg = { ...(def?.defaults || {}) };
        document.querySelectorAll('#indicator-settings-fields [data-field-key]').forEach(input => {
            const key = input.dataset.fieldKey;
            if (input.type === 'number') {
                const field = (def?.fields || []).find(item => item[0] === key);
                const min = field?.[3];
                const max = field?.[4];
                const value = parseFloat(input.value);
                cfg[key] = Number.isFinite(value) && (min == null || value >= min) && (max == null || value <= max)
                    ? value
                    : cfg[key];
            } else {
                cfg[key] = input.value;
            }
        });
        return cfg;
    }

    function openSMCSettings(paneId) {
        const pane = STATE.panes[paneId];
        if (!pane) return;
        activeSMCSettingsPaneId = paneId;

        const cfg = pane.smcSettings || {};

        document.getElementById('smc-cfg-mode').value = cfg.mode || 'Historical';
        document.getElementById('smc-cfg-style').value = cfg.style || 'Colored';
        
        document.getElementById('smc-cfg-showStructure').checked = cfg.showStructure !== false;
        document.getElementById('smc-cfg-swingsLength').value = cfg.swingsLength !== undefined ? cfg.swingsLength : 50;
        document.getElementById('smc-cfg-showSwings').checked = !!cfg.showSwings;
        document.getElementById('smc-cfg-showSwingBull').value = cfg.showSwingBull || 'All';
        document.getElementById('smc-cfg-showSwingBear').value = cfg.showSwingBear || 'All';
        document.getElementById('smc-cfg-showHighLowSwings').checked = cfg.showHighLowSwings !== false;

        document.getElementById('smc-cfg-showInternals').checked = cfg.showInternals !== false;
        document.getElementById('smc-cfg-internalFilterConfluence').checked = !!cfg.internalFilterConfluence;
        document.getElementById('smc-cfg-showInternalBull').value = cfg.showInternalBull || 'All';
        document.getElementById('smc-cfg-showInternalBear').value = cfg.showInternalBear || 'All';

        document.getElementById('smc-cfg-showSwingOrderBlocks').checked = !!cfg.showSwingOrderBlocks;
        document.getElementById('smc-cfg-swingOrderBlocksSize').value = cfg.swingOrderBlocksSize !== undefined ? cfg.swingOrderBlocksSize : 5;
        document.getElementById('smc-cfg-showInternalOrderBlocks').checked = cfg.showInternalOrderBlocks !== false;
        document.getElementById('smc-cfg-internalOrderBlocksSize').value = cfg.internalOrderBlocksSize !== undefined ? cfg.internalOrderBlocksSize : 5;
        document.getElementById('smc-cfg-orderBlockFilter').value = cfg.orderBlockFilter || 'Atr';
        document.getElementById('smc-cfg-orderBlockMitigation').value = cfg.orderBlockMitigation || 'High/Low';

        document.getElementById('smc-cfg-showEqualHighsLows').checked = cfg.showEqualHighsLows !== false;
        document.getElementById('smc-cfg-equalHighsLowsLength').value = cfg.equalHighsLowsLength !== undefined ? cfg.equalHighsLowsLength : 3;
        document.getElementById('smc-cfg-equalHighsLowsThreshold').value = cfg.equalHighsLowsThreshold !== undefined ? cfg.equalHighsLowsThreshold : 0.1;
        document.getElementById('smc-cfg-showFairValueGaps').checked = !!cfg.showFairValueGaps;
        document.getElementById('smc-cfg-fairValueGapsThreshold').checked = cfg.fairValueGapsThreshold !== false;
        document.getElementById('smc-cfg-fairValueGapsExtend').value = cfg.fairValueGapsExtend !== undefined ? cfg.fairValueGapsExtend : 1;

        document.getElementById('smc-cfg-showPremiumDiscountZones').checked = !!cfg.showPremiumDiscountZones;

        const modal = document.getElementById('smc-settings-dialog');
        if (modal) modal.classList.remove('hidden');
    }

    function initSMCSettingsEvents() {
        const modal = document.getElementById('smc-settings-dialog');
        const closeBtn = document.getElementById('smc-settings-close');
        const resetBtn = document.getElementById('smc-settings-reset');
        const saveBtn = document.getElementById('smc-settings-save');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (modal) modal.classList.add('hidden');
                activeSMCSettingsPaneId = null;
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                document.getElementById('smc-cfg-mode').value = 'Historical';
                document.getElementById('smc-cfg-style').value = 'Colored';
                document.getElementById('smc-cfg-showStructure').checked = true;
                document.getElementById('smc-cfg-swingsLength').value = 50;
                document.getElementById('smc-cfg-showSwings').checked = false;
                document.getElementById('smc-cfg-showSwingBull').value = 'All';
                document.getElementById('smc-cfg-showSwingBear').value = 'All';
                document.getElementById('smc-cfg-showHighLowSwings').checked = true;
                document.getElementById('smc-cfg-showInternals').checked = true;
                document.getElementById('smc-cfg-internalFilterConfluence').checked = false;
                document.getElementById('smc-cfg-showInternalBull').value = 'All';
                document.getElementById('smc-cfg-showInternalBear').value = 'All';
                document.getElementById('smc-cfg-showSwingOrderBlocks').checked = false;
                document.getElementById('smc-cfg-swingOrderBlocksSize').value = 5;
                document.getElementById('smc-cfg-showInternalOrderBlocks').checked = true;
                document.getElementById('smc-cfg-internalOrderBlocksSize').value = 5;
                document.getElementById('smc-cfg-orderBlockFilter').value = 'Atr';
                document.getElementById('smc-cfg-orderBlockMitigation').value = 'High/Low';
                document.getElementById('smc-cfg-showEqualHighsLows').checked = true;
                document.getElementById('smc-cfg-equalHighsLowsLength').value = 3;
                document.getElementById('smc-cfg-equalHighsLowsThreshold').value = 0.1;
                document.getElementById('smc-cfg-showFairValueGaps').checked = false;
                document.getElementById('smc-cfg-fairValueGapsThreshold').checked = true;
                document.getElementById('smc-cfg-fairValueGapsExtend').value = 1;
                document.getElementById('smc-cfg-showPremiumDiscountZones').checked = false;
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                if (activeSMCSettingsPaneId === null) return;
                const pane = STATE.panes[activeSMCSettingsPaneId];
                if (!pane) return;

                const settings = {
                    mode: document.getElementById('smc-cfg-mode').value,
                    style: document.getElementById('smc-cfg-style').value,
                    showStructure: document.getElementById('smc-cfg-showStructure').checked,
                    swingsLength: parseInt(document.getElementById('smc-cfg-swingsLength').value, 10) || 50,
                    showSwings: document.getElementById('smc-cfg-showSwings').checked,
                    showSwingBull: document.getElementById('smc-cfg-showSwingBull').value,
                    showSwingBear: document.getElementById('smc-cfg-showSwingBear').value,
                    showHighLowSwings: document.getElementById('smc-cfg-showHighLowSwings').checked,
                    showInternals: document.getElementById('smc-cfg-showInternals').checked,
                    internalFilterConfluence: document.getElementById('smc-cfg-internalFilterConfluence').checked,
                    showInternalBull: document.getElementById('smc-cfg-showInternalBull').value,
                    showInternalBear: document.getElementById('smc-cfg-showInternalBear').value,
                    showSwingOrderBlocks: document.getElementById('smc-cfg-showSwingOrderBlocks').checked,
                    swingOrderBlocksSize: parseInt(document.getElementById('smc-cfg-swingOrderBlocksSize').value, 10) || 5,
                    showInternalOrderBlocks: document.getElementById('smc-cfg-showInternalOrderBlocks').checked,
                    internalOrderBlocksSize: parseInt(document.getElementById('smc-cfg-internalOrderBlocksSize').value, 10) || 5,
                    orderBlockFilter: document.getElementById('smc-cfg-orderBlockFilter').value,
                    orderBlockMitigation: document.getElementById('smc-cfg-orderBlockMitigation').value,
                    showEqualHighsLows: document.getElementById('smc-cfg-showEqualHighsLows').checked,
                    equalHighsLowsLength: parseInt(document.getElementById('smc-cfg-equalHighsLowsLength').value, 10) || 3,
                    equalHighsLowsThreshold: parseFloat(document.getElementById('smc-cfg-equalHighsLowsThreshold').value) || 0.1,
                    showFairValueGaps: document.getElementById('smc-cfg-showFairValueGaps').checked,
                    fairValueGapsThreshold: document.getElementById('smc-cfg-fairValueGapsThreshold').checked,
                    fairValueGapsExtend: parseInt(document.getElementById('smc-cfg-fairValueGapsExtend').value, 10) || 1,
                    showPremiumDiscountZones: document.getElementById('smc-cfg-showPremiumDiscountZones').checked
                };

                pane.smcSettings = settings;
                SafeStorage.setItem(`ag_pane_smc_settings_${activeSMCSettingsPaneId}`, JSON.stringify(settings));

                if (pane.activeIndicators['smc']) {
                    renderSMC(pane);
                }

                if (modal) modal.classList.add('hidden');
                activeSMCSettingsPaneId = null;
            });
        }
    }

    // ══════════════════════════════════════════════
    //  DRAWING TOOLS
    // ══════════════════════════════════════════════
    function handleToolClick(paneId, tool, btn) {
        const pane = STATE.panes[paneId];
        if (!pane) return;

        if (tool === 'erase') {
            eraseLastDrawing(pane);
            return;
        }

        // Toggle tool
        if (pane.activeTool === tool) {
            pane.activeTool = null;
            pane.element.querySelector('.chart-mount').classList.remove('drawing-mode');
            pane.element.querySelectorAll('.tool-chip').forEach(b => b.classList.remove('active'));
        } else {
            pane.activeTool = tool;
            pane.element.querySelector('.chart-mount').classList.add('drawing-mode');
            pane.element.querySelectorAll('.tool-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
    }

    // Tracks first click for two-point tools
    const _drawingState = {};

    function handleChartClick(evt, paneId) {
        const pane = STATE.panes[paneId];
        if (!pane || !pane.activeTool) return;

        const rect  = evt.currentTarget.getBoundingClientRect();
        const x     = evt.clientX - rect.left;
        const y     = evt.clientY - rect.top;

        // LWC v5: coordinateToPrice lives on the SERIES, not the priceScale object
        let price = null;
        try {
            price = pane.series.coordinateToPrice(y);
        } catch(e) {
            console.warn('coordinateToPrice fallback:', e);
        }

        // coordinateToTime still lives on the timeScale — but may return null if outside range
        let time = null;
        try {
            time = pane.chart.timeScale().coordinateToTime(x);
        } catch(e) {
            console.warn('coordinateToTime fallback:', e);
        }

        // If time is null (click was outside candle range), snap to nearest edge
        if (time == null && pane.candles.length > 0) {
            const ts  = pane.chart.timeScale();
            const log = ts.coordinateToLogical(x);
            if (log !== null) {
                const idx  = Math.max(0, Math.min(Math.round(log), pane.candles.length - 1));
                time = pane.candles[idx].time;
            } else {
                time = x < rect.width / 2
                    ? pane.candles[0].time
                    : pane.candles[pane.candles.length - 1].time;
            }
        }

        if (price == null || time == null) {
            console.warn(`Pane #${paneId}: Could not resolve click coordinates (price=${price}, time=${time})`);
            return;
        }

        switch (pane.activeTool) {
            case 'hline': drawHorizontalLine(pane, price); break;
            case 'tline': drawTrendLine(pane, paneId, time, price); break;
            case 'rect':  drawRectangle(pane, paneId, time, price); break;
        }
    }

    function drawHorizontalLine(pane, price) {
        if (price == null) return;
        const s = pane.chart.addSeries(LightweightCharts.LineSeries, {
            color: 'rgba(255, 214, 102, 0.75)',
            lineWidth: 1.5, lineStyle: LightweightCharts.LineStyle.Solid,
            priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,
            priceFormat: { type: 'price', precision: 5, minMove: 0.00001 }
        });
        if (pane.candles.length > 0) {
            s.setData([
                { time: pane.candles[0].time, value: price },
                { time: pane.candles[pane.candles.length - 1].time, value: price }
            ]);
        }
        pane.drawings.push({ type: 'hline', series: s });
        console.log(`Pane #${pane.id}: H-Line drawn at ${price}`);
    }

    function drawTrendLine(pane, paneId, time, price) {
        const key = `tline_${paneId}`;
        if (!_drawingState[key]) {
            // First click — store anchor
            _drawingState[key] = { time, price };
            console.log(`Pane #${paneId}: Trend line — first point set.`);
        } else {
            const p1 = _drawingState[key];
            const p2 = { time, price };
            delete _drawingState[key];

            if (p1.time === p2.time) return;

            // Sort by time
            const sorted = [p1, p2].sort((a, b) => a.time - b.time);

            const s = pane.chart.addSeries(LightweightCharts.LineSeries, {
                color: 'rgba(176, 127, 255, 0.85)',
                lineWidth: 1.5, lineStyle: 0,
                priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
            });
            s.setData([
                { time: sorted[0].time, value: sorted[0].price },
                { time: sorted[1].time, value: sorted[1].price }
            ]);
            pane.drawings.push({ type: 'tline', series: s });
            console.log(`Pane #${paneId}: Trend line drawn.`);
        }
    }

    function drawRectangle(pane, paneId, time, price) {
        const key = `rect_${paneId}`;
        if (!_drawingState[key]) {
            _drawingState[key] = { time, price };
            console.log(`Pane #${paneId}: Rectangle — first corner set.`);
        } else {
            const p1 = _drawingState[key];
            const p2 = { time, price };
            delete _drawingState[key];

            if (p1.time === p2.time) return;
            const sorted = [p1, p2].sort((a, b) => a.time - b.time);
            const high = Math.max(sorted[0].price, sorted[1].price);
            const low  = Math.min(sorted[0].price, sorted[1].price);

            // Draw 4 sides of rectangle using LineSeries
            const color = 'rgba(0,230,118,0.5)';
            const draws = [];

            // Top line
            const top = pane.chart.addSeries(LightweightCharts.LineSeries, {
                color, lineWidth: 1, lineStyle: 0,
                priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
            });
            top.setData([{ time: sorted[0].time, value: high }, { time: sorted[1].time, value: high }]);
            draws.push(top);

            // Bottom line
            const bot = pane.chart.addSeries(LightweightCharts.LineSeries, {
                color, lineWidth: 1, lineStyle: 0,
                priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
            });
            bot.setData([{ time: sorted[0].time, value: low }, { time: sorted[1].time, value: low }]);
            draws.push(bot);

            // Left line
            const lft = pane.chart.addSeries(LightweightCharts.LineSeries, {
                color, lineWidth: 1, lineStyle: 0,
                priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
            });
            lft.setData([{ time: sorted[0].time, value: low }, { time: sorted[0].time, value: high }]);
            draws.push(lft);

            // Right line
            const rgt = pane.chart.addSeries(LightweightCharts.LineSeries, {
                color, lineWidth: 1, lineStyle: 0,
                priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
            });
            rgt.setData([{ time: sorted[1].time, value: low }, { time: sorted[1].time, value: high }]);
            draws.push(rgt);

            pane.drawings.push({ type: 'rect', series: draws });
            console.log(`Pane #${paneId}: Rectangle drawn.`);
        }
    }

    function eraseLastDrawing(pane) {
        const last = pane.drawings.pop();
        if (!last) return;

        const toRemove = Array.isArray(last.series) ? last.series : [last.series];
        toRemove.forEach(s => { try { pane.chart.removeSeries(s); } catch(e) {} });
        console.log(`Pane #${pane.id}: Erased last drawing.`);
    }

    // ══════════════════════════════════════════════
    //  LIVE FEEDS
    // ══════════════════════════════════════════════
    function wireLiveFeed(paneId) {
        const pane = STATE.panes[paneId];
        if (!pane) return;
        if (pane.source === 'hyperliquid') connectHyperliquidWS(pane);
        else startLivePolling(pane);
    }

    function connectHyperliquidWS(pane) {
        const wsUrl = 'wss://api.hyperliquid.xyz/ws';
        try {
            const ws = new WebSocket(wsUrl);
            pane.ws = ws;

            ws.onopen = () => {
                ws.send(JSON.stringify({
                    method: 'subscribe',
                    subscription: { type: 'candle', coin: pane.symbol, interval: pane.timeframe }
                }));
            };

            ws.onmessage = evt => {
                try {
                    const resp = JSON.parse(evt.data);
                    if (resp.channel === 'candle' && resp.data) {
                        const cd = resp.data;
                        if (cd.s.toUpperCase() !== pane.symbol) return;
                        const candle = {
                            time:  Math.floor(cd.t / 1000),
                            open:  parseFloat(cd.o), high: parseFloat(cd.h),
                            low:   parseFloat(cd.l), close: parseFloat(cd.c)
                        };
                        const newPrice = candle.close;
                        if (newPrice !== pane.lastPrice) {
                            triggerTickerFlash(pane, newPrice, pane.lastPrice);
                            pane.lastPrice = newPrice;
                        }
                        pane.series.update(candle);
                        pane.lastCandle = candle;
                        // Update last candle in candles array
                        if (pane.candles.length > 0) {
                            const last = pane.candles[pane.candles.length - 1];
                            if (last.time === candle.time) {
                                pane.candles[pane.candles.length - 1] = candle;
                            } else if (candle.time > last.time) {
                                pane.candles.push(candle);
                                if (pane.timeToIndexMap) {
                                    pane.timeToIndexMap.set(candle.time, pane.candles.length - 1);
                                }
                            }
                            updateActiveIndicators(pane);
                        }
                    }
                } catch(e) { console.error('WS parse error:', e); }
            };

            ws.onerror = () => {};
            ws.onclose = () => {
                if (STATE.panes[pane.id] && STATE.panes[pane.id].source === 'hyperliquid' && STATE.panes[pane.id].ws === ws)
                    setTimeout(() => connectHyperliquidWS(pane), 5000);
            };
        } catch(e) {
            console.warn(`WS blocked for Pane #${pane.id}, falling back to polling`);
            startLivePolling(pane);
        }
    }

    function startLivePolling(pane) {
        const interval = pane.source === 'mt5' ? 1500 : 3000;
        pane.pollingTimer = setInterval(() => {
            fetch(`/api/live?source=${pane.source}&symbol=${pane.symbol}`)
                .then(r => r.json())
                .then(data => {
                    if (data.error) return;
                    const newPrice = parseFloat(data.price);
                    const oldPrice = pane.lastPrice;
                    if (newPrice !== oldPrice && oldPrice !== null) triggerTickerFlash(pane, newPrice, oldPrice);
                    pane.lastPrice = newPrice;

                    if (pane.lastCandle) {
                        const now      = Math.floor(Date.now() / 1000);
                        const tfSec    = getTimeframeDurationSeconds(pane.timeframe);
                        const candleT  = pane.lastCandle.time;

                        let updated;
                        if (now >= candleT + tfSec) {
                            updated = { time: candleT + tfSec, open: newPrice, high: newPrice, low: newPrice, close: newPrice };
                        } else {
                            updated = {
                                time:  candleT,
                                open:  pane.lastCandle.open,
                                high:  Math.max(pane.lastCandle.high, newPrice),
                                low:   Math.min(pane.lastCandle.low,  newPrice),
                                close: newPrice
                            };
                        }
                        pane.series.update(updated);
                        pane.lastCandle = updated;
                        if (pane.candles.length > 0) {
                            const lc = pane.candles[pane.candles.length - 1];
                            if (lc.time === updated.time) pane.candles[pane.candles.length - 1] = updated;
                            else if (updated.time > lc.time) {
                                pane.candles.push(updated);
                                if (pane.timeToIndexMap) {
                                    pane.timeToIndexMap.set(updated.time, pane.candles.length - 1);
                                }
                            }
                            updateActiveIndicators(pane);
                        }
                    }
                })
                .catch(() => {});
        }, interval);
    }

    // ══════════════════════════════════════════════
    //  TICKER & VISUAL POLISH
    // ══════════════════════════════════════════════
    function triggerTickerFlash(pane, newPrice, oldPrice) {
        const bar  = pane.element.querySelector('.ticker-bar');
        const lbl  = pane.element.querySelector('.ticker-price');
        const dir  = pane.element.querySelector('.ticker-direction');
        if (!bar || !lbl || !dir) return;

        bar.classList.remove('flash-up', 'flash-down');
        lbl.classList.remove('bull-text', 'bear-text');
        const change  = oldPrice !== null ? newPrice - oldPrice : 0;
        const pct     = oldPrice && oldPrice !== 0 ? (change / oldPrice) * 100 : 0;
        void bar.offsetWidth; // reflow

        if (change >= 0) {
            bar.classList.add('flash-up');
            lbl.classList.add('bull-text');
            dir.textContent = `▲ +${pct.toFixed(2)}%`;
            dir.className   = 'ticker-direction bull-text';
        } else {
            bar.classList.add('flash-down');
            lbl.classList.add('bear-text');
            dir.textContent = `▼ ${pct.toFixed(2)}%`;
            dir.className   = 'ticker-direction bear-text';
        }
        lbl.textContent = formatPriceValue(pane.source, newPrice);
    }

    function updateTickerDisplay(pane, price, pctChange) {
        const lbl = pane.element.querySelector('.ticker-price');
        const dir = pane.element.querySelector('.ticker-direction');
        if (!lbl || !dir) return;
        lbl.textContent = formatPriceValue(pane.source, price);
        if (pctChange >= 0) {
            dir.textContent = `▲ +${pctChange.toFixed(2)}%`;
            dir.className   = 'ticker-direction bull-text';
        } else {
            dir.textContent = `▼ ${pctChange.toFixed(2)}%`;
            dir.className   = 'ticker-direction bear-text';
        }
    }

    // ══════════════════════════════════════════════
    //  HELPERS
    // ══════════════════════════════════════════════
    function handleResize() {
        Object.values(STATE.panes).forEach(pane => {
            if (!pane?.chart || !pane.element) return;
            const mount = pane.element.querySelector('.chart-mount');
            if (mount) {
                const w = mount.clientWidth, h = mount.clientHeight;
                if (w > 0 && h > 0) pane.chart.resize(w, h);
            }
            Object.values(pane.oscillators || {}).forEach(osc => {
                if (!osc?.chart || !osc.subpaneEl) return;
                const r = osc.subpaneEl.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) osc.chart.resize(r.width, r.height);
            });
        });
    }

    function testMT5Connection() {
        if (!mt5StatusPanel) return;
        mt5StatusPanel.className = 'mt5-status-badge';
        mt5StatusPanel.querySelector('.status-label').textContent = 'MT5: CHECKING...';

        fetch('/api/test_mt5')
            .then(r => r.json())
            .then(data => {
                if (data.status === 'connected') {
                    STATE.mt5Status = 'connected';
                    mt5StatusPanel.className = 'mt5-status-badge connected';
                    mt5StatusPanel.querySelector('.status-label').textContent = 'MT5: CONNECTED';
                    mt5StatusPanel.setAttribute('title', `Connected: ${data.company} — ${data.version}`);
                } else {
                    STATE.mt5Status = 'disconnected';
                    mt5StatusPanel.className = 'mt5-status-badge disconnected';
                    mt5StatusPanel.querySelector('.status-label').textContent = 'MT5: DISCONNECTED';
                    mt5StatusPanel.setAttribute('title', data.message || 'Not connected');
                }
            })
            .catch(() => {
                mt5StatusPanel.className = 'mt5-status-badge disconnected';
                mt5StatusPanel.querySelector('.status-label').textContent = 'MT5: ERROR';
            });
    }

    function getPriceFormatOptions(source, symbol, price) {
        if (!price) return { type: 'price', precision: 2, minMove: 0.01 };
        if (source === 'mt5') {
            if ((symbol || '').toUpperCase().includes('JPY')) return { type: 'price', precision: 3, minMove: 0.001 };
            if (price < 10)  return { type: 'price', precision: 5, minMove: 0.00001 };
            if (price < 100) return { type: 'price', precision: 4, minMove: 0.0001 };
            return { type: 'price', precision: 2, minMove: 0.01 };
        }
        if (price < 0.01) return { type: 'price', precision: 6, minMove: 0.000001 };
        if (price < 1)    return { type: 'price', precision: 4, minMove: 0.0001 };
        if (price < 10)   return { type: 'price', precision: 3, minMove: 0.001 };
        return { type: 'price', precision: 2, minMove: 0.01 };
    }

    function getTimeframeDurationSeconds(tf) {
        return { '1m':60,'2m':120,'5m':300,'15m':900,'30m':1800,'1h':3600,'4h':14400,'1d':86400 }[tf] || 300;
    }

    function addTime(timeVal, durationSeconds) {
        if (typeof timeVal === 'number') {
            return timeVal + durationSeconds;
        }
        if (typeof timeVal === 'string') {
            const date = new Date(timeVal);
            if (!isNaN(date.getTime())) {
                const newTime = date.getTime() + durationSeconds * 1000;
                const newDate = new Date(newTime);
                const yyyy = newDate.getUTCFullYear();
                const mm = String(newDate.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(newDate.getUTCDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }
        }
        if (typeof timeVal === 'object' && timeVal !== null && 'year' in timeVal) {
            const date = new Date(Date.UTC(timeVal.year, timeVal.month - 1, timeVal.day));
            const newTime = date.getTime() + durationSeconds * 1000;
            const newDate = new Date(newTime);
            return {
                year: newDate.getUTCFullYear(),
                month: newDate.getUTCMonth() + 1,
                day: newDate.getUTCDate()
            };
        }
        return timeVal;
    }


    function formatPriceValue(source, price) {
        if (price == null) return '--';
        if (source === 'mt5' && price < 10) return price.toFixed(5);
        if (price < 1)   return price.toFixed(6);
        if (price < 100) return price.toFixed(4);
        return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // ══════════════════════════════════════════════
    //  TRADING UI ENGINE (Overlays & Context Menu)
    // ══════════════════════════════════════════════
    setInterval(() => {
        if (STATE.mt5Status === 'connected' && !TRADING_STATE.dragActive) fetchTradingState();
    }, 2000);

    function fetchTradingState() {
        fetch('/api/trading/state?source=mt5')
            .then(r => r.json())
            .then(data => {
                if (data.positions) {
                    TRADING_STATE.positions = data.positions;
                    TRADING_STATE.orders = data.orders;
                    Object.keys(STATE.panes).forEach(id => {
                        const p = STATE.panes[id];
                        if (p && p.source === 'mt5') rebuildTradingOverlays(id);
                    });
                }
            }).catch(console.warn);
    }

    function showContextMenu(evt, paneId) {
        const pane = STATE.panes[paneId];
        if (!pane || !cMenu) return;
        
        const rect = pane.element.querySelector('.chart-mount').getBoundingClientRect();
        const y = evt.clientY - rect.top;
        
        try {
            cMenuPrice = pane.series.coordinateToPrice(y);
        } catch(e) { return; } // clicked out of bounds
        
        if (cMenuPrice == null) return;
        
        cMenuTargetPane = pane;
        const fmt = formatPriceValue('mt5', cMenuPrice);
        
        // Update menu text
        cMenu.querySelectorAll('.cmenu-symbol').forEach(el => el.textContent = pane.symbol);
        cMenu.querySelectorAll('.cmenu-price').forEach(el => el.textContent = fmt);
        
        cMenu.style.left = `${evt.clientX}px`;
        cMenu.style.top = `${evt.clientY}px`;
        cMenu.classList.remove('hidden');
    }

    // Hide menu on any global click
    window.addEventListener('click', () => {
        if (cMenu) cMenu.classList.add('hidden');
    });

    // Sync lot size inputs
    const globalLotInput = document.getElementById('global-lot-size');
    const cMenuLotInput = document.getElementById('cmenu-volume-input');
    
    if (globalLotInput && cMenuLotInput) {
        globalLotInput.addEventListener('input', (e) => {
            cMenuLotInput.value = e.target.value;
            if (cMenu) cMenu.querySelectorAll('.cmenu-vol-disp').forEach(el => el.textContent = e.target.value);
        });
        cMenuLotInput.addEventListener('input', (e) => {
            globalLotInput.value = e.target.value;
            if (cMenu) cMenu.querySelectorAll('.cmenu-vol-disp').forEach(el => el.textContent = e.target.value);
        });
        cMenuLotInput.addEventListener('mousedown', e => e.stopPropagation());
        
        // Init
        if (cMenu) cMenu.querySelectorAll('.cmenu-vol-disp').forEach(el => el.textContent = globalLotInput.value);
    }

    // Wire up menu actions using onmousedown to avoid click-away conflicts
    if (cMenu) {
        document.getElementById('cmenu-buy-limit').onmousedown = (e) => { e.stopPropagation(); sendTradeAction('buy_limit', cMenuPrice); cMenu.classList.add('hidden'); };
        document.getElementById('cmenu-sell-limit').onmousedown = (e) => { e.stopPropagation(); sendTradeAction('sell_limit', cMenuPrice); cMenu.classList.add('hidden'); };
        document.getElementById('cmenu-buy-stop').onmousedown = (e) => { e.stopPropagation(); sendTradeAction('buy_stop', cMenuPrice); cMenu.classList.add('hidden'); };
        document.getElementById('cmenu-sell-stop').onmousedown = (e) => { e.stopPropagation(); sendTradeAction('sell_stop', cMenuPrice); cMenu.classList.add('hidden'); };
        document.getElementById('cmenu-close-menu').onmousedown = (e) => { e.stopPropagation(); cMenu.classList.add('hidden'); };
    }

    function sendTradeAction(type, price, volume=null) {
        if (!cMenuTargetPane) return;
        const volInput = document.getElementById('cmenu-volume-input');
        const finalVolume = volume || (volInput ? parseFloat(volInput.value) : 0.1) || 0.1;
        
        fetch('/api/trading/place', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                source: 'mt5', symbol: cMenuTargetPane.symbol, type, price, volume: finalVolume
            })
        }).then(r => r.json()).then(data => {
            console.log('Trade result:', data);
            if (data.status === 'error') {
                alert("Order Failed: " + (data.message || "Unknown error"));
            }
            fetchTradingState();
        }).catch(e => alert("API Error: " + e));
    }

    // The core rendering engine for dragging lines
    function rebuildTradingOverlays(paneId) {
        const pane = STATE.panes[paneId];
        if (!pane || TRADING_STATE.dragActive) return;
        
        const container = pane.element.querySelector('.trading-overlay-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Filter for this pane's symbol
        const pos = TRADING_STATE.positions.filter(p => p.symbol === pane.symbol);
        const ord = TRADING_STATE.orders.filter(o => o.symbol === pane.symbol);
        
        pos.forEach(p => renderTradingLine(pane, container, p, true));
        ord.forEach(o => renderTradingLine(pane, container, o, false));
        
        syncTradingOverlays(paneId);
    }
    
    // Runs at 60fps via requestAnimationFrame to keep lines synced with chart scale
    function syncTradingOverlays(paneId) {
        const pane = STATE.panes[paneId];
        if (!pane || TRADING_STATE.dragActive) return;
        
        const container = pane.element.querySelector('.trading-overlay-container');
        if (!container) return;
        
        const wrappers = container.querySelectorAll('.order-line-wrapper');
        wrappers.forEach(w => {
            const price = parseFloat(w.dataset.price);
            if (isNaN(price)) return;
            try {
                const y = pane.series.priceToCoordinate(price);
                if (y !== null && y >= -50 && y <= container.clientHeight + 50) {
                    w.style.top = `${y}px`;
                    w.style.display = 'block';
                } else {
                    w.style.display = 'none';
                }
            } catch(e) {}
        });
    }

    function renderTradingLine(pane, container, item, isPosition) {
        // Main entry line
        const entryPrice = isPosition ? item.price_open : item.price_open;
        createDraggableLine(pane, container, item, isPosition, 'entry', entryPrice, item.type.includes('buy') ? 'buy' : 'sell');
        
        // TP Line
        if (item.tp > 0) {
            createDraggableLine(pane, container, item, isPosition, 'tp', item.tp, 'tp');
        }
        
        // SL Line
        if (item.sl > 0) {
            createDraggableLine(pane, container, item, isPosition, 'sl', item.sl, 'sl');
        }
    }

    function createDraggableLine(pane, container, item, isPosition, lineRole, priceVal, colorRole) {
        const wrapper = document.createElement('div');
        wrapper.className = `order-line-wrapper order-type-${colorRole}`;
        wrapper.dataset.price = priceVal;
        
        let y = null;
        try { y = pane.series.priceToCoordinate(priceVal); } catch(e) {}
        if (y !== null && y >= -50 && y <= container.clientHeight + 50) {
            wrapper.style.top = `${y}px`;
        } else {
            wrapper.style.display = 'none';
        }
        
        // The dashed line
        const dash = document.createElement('div');
        dash.className = 'order-dashed-line';
        wrapper.appendChild(dash);
        
        // The interactive badge
        const badge = document.createElement('div');
        badge.className = `order-badges`;
        
        let labelText = '';
        if (lineRole === 'entry') {
            labelText = isPosition ? (item.type === 'buy' ? `BUY ${item.volume}` : `SELL ${item.volume}`) : `${item.type.replace('_', ' ').toUpperCase()} ${item.volume}`;
        } else {
            labelText = lineRole.toUpperCase();
        }
        
        let extraText = '';
        let addBtns = '';
        if (lineRole === 'entry') {
            if (isPosition) {
                const pnl = item.profit >= 0 ? `+${item.profit.toFixed(2)}` : item.profit.toFixed(2);
                extraText = ` <span style="margin-left:8px; color: ${item.profit>=0 ? '#00E676' : '#FF1744'}">${pnl}</span>`;
            }
            if (!item.tp || item.tp === 0) {
                addBtns += `<span class="badge-add-btn" data-add="tp" title="Add Take Profit">+TP</span>`;
            }
            if (!item.sl || item.sl === 0) {
                addBtns += `<span class="badge-add-btn" data-add="sl" title="Add Stop Loss">+SL</span>`;
            }
        } else if (lineRole === 'tp' && item.tp_profit !== undefined) {
            const pnl = item.tp_profit >= 0 ? `+${item.tp_profit.toFixed(2)}` : item.tp_profit.toFixed(2);
            extraText = ` <span style="margin-left:8px; color: ${item.tp_profit>=0 ? '#00E676' : '#FF1744'}">${pnl}</span>`;
        } else if (lineRole === 'sl' && item.sl_profit !== undefined) {
            const pnl = item.sl_profit >= 0 ? `+${item.sl_profit.toFixed(2)}` : item.sl_profit.toFixed(2);
            extraText = ` <span style="margin-left:8px; color: ${item.sl_profit>=0 ? '#00E676' : '#FF1744'}">${pnl}</span>`;
        }
        
        badge.innerHTML = `
            <div class="order-badge badge-type-${colorRole}">
                <span class="badge-label">${labelText}</span>
                ${extraText}
                ${addBtns}
                <span class="badge-close" title="Cancel/Close">×</span>
            </div>
        `;
        
        // Wire up +TP / +SL buttons
        badge.querySelectorAll('.badge-add-btn').forEach(btn => {
            btn.onmousedown = (e) => {
                e.stopPropagation(); // prevent dragging
                const role = btn.dataset.add;
                const offset = priceVal * 0.002; // 0.2% offset by default
                const isBuy = item.type.includes('buy');
                
                let newPrice = priceVal;
                if (role === 'tp') {
                    newPrice = isBuy ? (priceVal + offset) : (priceVal - offset);
                } else if (role === 'sl') {
                    newPrice = isBuy ? (priceVal - offset) : (priceVal + offset);
                }
                
                commitDragAction(item.ticket, isPosition, role, newPrice);
            };
        });
        
        // Draggable logic
        const badgeEl = badge.querySelector('.order-badge');
        
        badgeEl.onmousedown = (e) => {
            if (e.target.classList.contains('badge-close') || e.target.classList.contains('badge-add-btn')) return; // let inner clicks pass
            e.preventDefault();
            TRADING_STATE.dragActive = true;
            badgeEl.classList.add('is-dragging');
            
            const startY = e.clientY;
            const startTop = parseFloat(wrapper.style.top);
            
            const onMove = (mv) => {
                const dy = mv.clientY - startY;
                let newY = startTop + dy;
                // Clamp
                newY = Math.max(0, Math.min(newY, container.clientHeight));
                wrapper.style.top = `${newY}px`;
                
                // Live price update visually (optional: could update the badge text here)
            };
            
            const onUp = (up) => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                badgeEl.classList.remove('is-dragging');
                TRADING_STATE.dragActive = false;
                
                const finalY = parseFloat(wrapper.style.top);
                if (Math.abs(finalY - startTop) < 2) return; // Didn't actually drag
                
                let newPrice = null;
                try { newPrice = pane.series.coordinateToPrice(finalY); } catch(err){}
                
                if (newPrice != null) {
                    commitDragAction(item.ticket, isPosition, lineRole, newPrice);
                }
            };
            
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        };
        
        // Close / Cancel logic
        badge.querySelector('.badge-close').onclick = (e) => {
            e.stopPropagation();
            fetch('/api/trading/cancel', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    source: 'mt5', ticket: item.ticket, is_position: isPosition,
                    symbol: item.symbol, volume: item.volume, type: item.type
                })
            }).then(() => fetchTradingState());
        };
        
        wrapper.appendChild(badge);
        container.appendChild(wrapper);
    }

    function commitDragAction(ticket, isPosition, role, newPrice) {
        const payload = { source: 'mt5', ticket, is_position: isPosition };
        if (role === 'entry' && !isPosition) {
            payload.price = newPrice;
        } else if (role === 'sl') {
            payload.sl = newPrice;
        } else if (role === 'tp') {
            payload.tp = newPrice;
        } else {
            return; // Can't drag a position's entry price
        }
        
        fetch('/api/trading/modify', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        }).then(r => r.json()).then(data => {
            console.log('Modify result:', data);
            fetchTradingState();
        }).catch(console.error);
    }


    // ── Kick off ──
    init();
}

// Bulletproof DOM-ready guard
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
