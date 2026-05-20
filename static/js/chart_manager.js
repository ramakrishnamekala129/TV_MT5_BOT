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


    // DOM refs
    const chartCountSelect   = document.getElementById('chart-count-select');
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

        if (mt5StatusPanel)
            mt5StatusPanel.addEventListener('click', testMT5Connection);

        updateGridCount(STATE.activePanesCount);
        testMT5Connection();
        window.addEventListener('resize', handleResize);
        initSMCSettingsEvents();
    }

    // ──────────────────────────────────────────────
    // GRID
    // ──────────────────────────────────────────────
    function updateGridCount(count) {
        STATE.activePanesCount = count;
        SafeStorage.setItem('ag_pane_count', count);

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
                vertLine: { color: '#7B2CBF', width: 1, style: 2 },
                horzLine: { color: '#7B2CBF', width: 1, style: 2 }
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
            wickUpColor:    '#00E676', wickDownColor:    '#FF1744'
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
            activeIndicators,
            overlaySeries: {},
            smcSeries: [],
            smcSettings: smcSettings,
            activeTool: null,
            drawings: []
        };

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
            if (activeIndicators[ind]) {
                btn.classList.add('active');
                const group = btn.closest('.ind-chip-group');
                if (group) group.classList.add('active');
            }
            btn.addEventListener('click', e => {
                e.stopPropagation();
                toggleIndicator(paneId, ind, btn);
            });
        });

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

        const url = `/api/historical?source=${pane.source}&symbol=${pane.symbol}&timeframe=${pane.timeframe}&limit=500`;
        fetch(url)
            .then(r => r.json())
            .then(data => {
                if (data.error || !Array.isArray(data) || data.length === 0)
                    throw new Error(data.error || 'No data returned');

                pane.candles = data;
                // Cache timeToIndexMap for fast O(1) crosshair lookup
                pane.timeToIndexMap = new Map();
                data.forEach((c, idx) => pane.timeToIndexMap.set(c.time, idx));
                
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

        const isActive = !!pane.activeIndicators[indKey];

        if (isActive) {
            // Remove
            removeIndicator(pane, indKey);
            pane.activeIndicators[indKey] = false;
            btn.classList.remove('active');
        } else {
            // Add
            if (pane.candles.length === 0) {
                console.warn(`Pane #${paneId}: No data loaded yet. Load chart first.`);
                return;
            }
            
            renderIndicator(pane, indKey);
            pane.activeIndicators[indKey] = true;
            btn.classList.add('active');
        }

        SafeStorage.setItem(`ag_pane_indicators_${paneId}`, JSON.stringify(pane.activeIndicators));
    }

    function renderIndicator(pane, indKey) {
        if (!pane.candles || pane.candles.length === 0) return;

        const c = pane.candles;

        switch(indKey) {
            case 'sma20': renderLineSeries(pane, 'sma20', Indicators.sma(c, 20),  IND_COLORS.sma20,   1.5); break;
            case 'sma50': renderLineSeries(pane, 'sma50', Indicators.sma(c, 50),  IND_COLORS.sma50,   1.5); break;
            case 'ema9':  renderLineSeries(pane, 'ema9',  Indicators.ema(c,  9),  IND_COLORS.ema9,    1.5); break;
            case 'ema21': renderLineSeries(pane, 'ema21', Indicators.ema(c, 21),  IND_COLORS.ema21,   1.5); break;
            case 'vwap':  renderLineSeries(pane, 'vwap',  Indicators.vwap(c),     IND_COLORS.vwap,    1.5); break;

            case 'bb20': {
                const bb = Indicators.bollingerBands(c, 20, 2);
                renderLineSeries(pane, 'bbUpper',  bb.upper,  IND_COLORS.bbUpper,  1,  { lineStyle: 1 });
                renderLineSeries(pane, 'bbMiddle', bb.middle, IND_COLORS.bbMiddle, 1,  { lineStyle: 2 });
                renderLineSeries(pane, 'bbLower',  bb.lower,  IND_COLORS.bbLower,  1,  { lineStyle: 1 });
                break;
            }

            case 'rsi14': renderOscillatorRSI(pane); break;
            case 'macd':  renderOscillatorMACD(pane); break;
            case 'volume': renderOscillatorVolume(pane); break;
            case 'smc': renderSMC(pane); break;
        }
    }

    function removeIndicator(pane, indKey) {
        if (indKey === 'smc') {
            clearSMC(pane);
            return;
        }

        // Overlay series removal
        const overlayKeys = {
            sma20:  ['sma20'],
            sma50:  ['sma50'],
            ema9:   ['ema9'],
            ema21:  ['ema21'],
            vwap:   ['vwap'],
            bb20:   ['bbUpper', 'bbMiddle', 'bbLower']
        };

        if (overlayKeys[indKey]) {
            overlayKeys[indKey].forEach(k => {
                if (pane.overlaySeries[k]) {
                    try { pane.chart.removeSeries(pane.overlaySeries[k]); } catch(e) {}
                    delete pane.overlaySeries[k];
                }
            });
        }

        // Oscillator removal
        if (['rsi14', 'macd', 'volume'].includes(indKey)) {
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

    // ── RSI sub-pane ──
    function renderOscillatorRSI(pane) {
        const indKey = 'rsi14';
        const rsiData = Indicators.rsi(pane.candles, 14);
        if (!rsiData || rsiData.length === 0) return;

        const alignedRsiData = alignDataToCandles(rsiData, pane.candles);
        const osc = ensureOscChart(pane, indKey, 'RSI (14)');
        if (!osc) return;

        // Store aligned data for crosshair O(1) lookups
        osc.alignedData = alignedRsiData;

        if (!osc.series.rsiLine) {
            const rsiSeries = osc.chart.addSeries(LightweightCharts.LineSeries, {
                color: IND_COLORS.rsi, lineWidth: 1.5,
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
        }

        osc.series.rsiLine.setData(alignedRsiData);

        const tFirst = pane.candles[0].time;
        const tLast = pane.candles[pane.candles.length - 1].time;
        osc.series.rsiOB.setData([{ time: tFirst, value: 70 }, { time: tLast, value: 70 }]);
        osc.series.rsiOS.setData([{ time: tFirst, value: 30 }, { time: tLast, value: 30 }]);

        syncTimeScales(pane);
    }

    // ── MACD sub-pane ──
    function renderOscillatorMACD(pane) {
        const indKey = 'macd';
        const macdData = Indicators.macd(pane.candles, 12, 26, 9);
        if (!macdData) return;

        const alignedMacdLine = alignDataToCandles(macdData.macdLine, pane.candles);
        const alignedSignalLine = alignDataToCandles(macdData.signalLine, pane.candles);
        const alignedHistogram = alignDataToCandles(macdData.histogram, pane.candles);

        const osc = ensureOscChart(pane, indKey, 'MACD (12,26,9)');
        if (!osc) return;

        // Store aligned data for crosshair O(1) lookups
        osc.alignedLineData = alignedMacdLine;

        if (!osc.series.macdLine) {
            const histSeries = osc.chart.addSeries(LightweightCharts.HistogramSeries, {
                priceLineVisible: false, lastValueVisible: false,
                priceFormat: { type: 'price', precision: 5, minMove: 0.00001 }
            });
            const macdLine = osc.chart.addSeries(LightweightCharts.LineSeries, {
                color: IND_COLORS.macdLine, lineWidth: 1.5,
                priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
                priceFormat: { type: 'price', precision: 5, minMove: 0.00001 }
            });
            const sigLine = osc.chart.addSeries(LightweightCharts.LineSeries, {
                color: IND_COLORS.macdSig, lineWidth: 1, lineStyle: 1,
                priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
                priceFormat: { type: 'price', precision: 5, minMove: 0.00001 }
            });
            osc.series.macdHist = histSeries;
            osc.series.macdLine = macdLine;
            osc.series.macdSig  = sigLine;
        }

        osc.series.macdHist.setData(alignedHistogram);
        osc.series.macdLine.setData(alignedMacdLine);
        osc.series.macdSig.setData(alignedSignalLine);

        syncTimeScales(pane);
    }

    // ── Volume sub-pane ──
    function renderOscillatorVolume(pane) {
        const indKey = 'volume';
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
            container.appendChild(subpaneEl);

            const lbl = document.createElement('div');
            lbl.className = 'oscillator-label';
            lbl.textContent = label;
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
                    vertLine: { color: '#7B2CBF', width: 1, style: 2 },
                    horzLine: { color: '#7B2CBF', width: 1, style: 2 }
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
                resizeObserver
            };
            
            // Initial resize
            const rect = subpaneEl.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) chart.resize(rect.width, rect.height);
        }
        
        return pane.oscillators[indKey];
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
    function syncCrosshairs(pane) {
        // Collect all charts to sync
        const sources = [
            { chart: pane.chart, series: pane.series, id: 'main' }
        ];

        Object.entries(pane.oscillators).forEach(([key, osc]) => {
            if (osc.chart) {
                const series = osc.series.rsiLine || osc.series.macdLine || osc.series.volBars;
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
                            const series = osc.series.rsiLine || osc.series.macdLine || osc.series.volBars;
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
                                } else if (target.id === 'rsi14') {
                                    const item = target.osc.alignedData && target.osc.alignedData[idx];
                                    price = (item && item.value !== undefined) ? item.value : 50;
                                } else if (target.id === 'macd') {
                                    const item = target.osc.alignedLineData && target.osc.alignedLineData[idx];
                                    price = (item && item.value !== undefined) ? item.value : 0;
                                } else if (target.id === 'volume') {
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
            lineWidth: 1, lineStyle: 1,
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
            if (pane.oscChart && pane.oscillatorEl) {
                const r = pane.oscillatorEl.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) pane.oscChart.resize(r.width, r.height);
            }
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
