/**
 * Antigravity // Quant Trading Grid — Technical Indicators Engine
 * Pure in-browser JS. No external dependencies.
 * All functions accept candle arrays: [{time, open, high, low, close, volume}]
 * All overlay functions return: [{time, value}]
 * Band functions return: {upper: [...], middle: [...], lower: [...]}
 * Oscillator functions return: [{time, value}] or multi-line objects
 */

var Indicators = (() => {

    // ─────────────────────────────────────────────
    // SMA — Simple Moving Average
    // ─────────────────────────────────────────────
    function sma(candles, period) {
        const result = [];
        for (let i = period - 1; i < candles.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += candles[i - j].close;
            }
            result.push({ time: candles[i].time, value: sum / period });
        }
        return result;
    }

    // ─────────────────────────────────────────────
    // EMA — Exponential Moving Average
    // ─────────────────────────────────────────────
    function ema(candles, period) {
        if (candles.length < period) return [];
        const k = 2 / (period + 1);
        const result = [];
        // Seed with SMA of first `period` candles
        let prevEma = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
        result.push({ time: candles[period - 1].time, value: prevEma });
        for (let i = period; i < candles.length; i++) {
            const val = candles[i].close * k + prevEma * (1 - k);
            result.push({ time: candles[i].time, value: val });
            prevEma = val;
        }
        return result;
    }

    // ─────────────────────────────────────────────
    // WMA / HMA — Weighted and Hull Moving Averages
    // ─────────────────────────────────────────────
    function wma(candles, period) {
        if (candles.length < period) return [];
        const denom = period * (period + 1) / 2;
        const result = [];
        for (let i = period - 1; i < candles.length; i++) {
            let weighted = 0;
            for (let j = 0; j < period; j++) {
                weighted += candles[i - j].close * (period - j);
            }
            result.push({ time: candles[i].time, value: weighted / denom });
        }
        return result;
    }

    function wmaValues(values, period) {
        if (values.length < period) return [];
        const denom = period * (period + 1) / 2;
        const result = [];
        for (let i = period - 1; i < values.length; i++) {
            let weighted = 0;
            for (let j = 0; j < period; j++) {
                weighted += values[i - j] * (period - j);
            }
            result.push(weighted / denom);
        }
        return result;
    }

    function hma(candles, period = 20) {
        if (candles.length < period) return [];
        const closes = candles.map(c => c.close);
        const half = Math.max(1, Math.floor(period / 2));
        const sqrtPeriod = Math.max(1, Math.floor(Math.sqrt(period)));
        const wmaHalf = wmaValues(closes, half);
        const wmaFull = wmaValues(closes, period);
        const offset = period - half;
        const raw = wmaFull.map((full, i) => (2 * wmaHalf[i + offset]) - full);
        const smooth = wmaValues(raw, sqrtPeriod);
        const startIndex = period - 1 + sqrtPeriod - 1;
        return smooth.map((value, i) => ({
            time: candles[startIndex + i]?.time,
            value
        })).filter(item => item.time != null);
    }

    // ─────────────────────────────────────────────
    // EMA on raw value array (used internally for MACD)
    // ─────────────────────────────────────────────
    function emaValues(values, period) {
        if (values.length < period) return [];
        const k = 2 / (period + 1);
        const result = [];
        let prevEma = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
        result.push(prevEma);
        for (let i = period; i < values.length; i++) {
            const val = values[i] * k + prevEma * (1 - k);
            result.push(val);
            prevEma = val;
        }
        return result;
    }

    // ─────────────────────────────────────────────
    // Bollinger Bands — period + stddev multiplier
    // ─────────────────────────────────────────────
    function bollingerBands(candles, period = 20, stdDev = 2) {
        const upper = [], middle = [], lower = [];
        for (let i = period - 1; i < candles.length; i++) {
            const slice = candles.slice(i - period + 1, i + 1);
            const mean = slice.reduce((s, c) => s + c.close, 0) / period;
            const variance = slice.reduce((s, c) => s + Math.pow(c.close - mean, 2), 0) / period;
            const sd = Math.sqrt(variance);
            const t = candles[i].time;
            upper.push({ time: t, value: mean + stdDev * sd });
            middle.push({ time: t, value: mean });
            lower.push({ time: t, value: mean - stdDev * sd });
        }
        return { upper, middle, lower };
    }

    // ─────────────────────────────────────────────
    // VWAP — Volume Weighted Average Price (single session)
    // ─────────────────────────────────────────────
    function vwap(candles) {
        const result = [];
        let cumVolume = 0;
        let cumTPV = 0; // Typical Price × Volume
        for (const c of candles) {
            const tp = (c.high + c.low + c.close) / 3;
            cumTPV += tp * c.volume;
            cumVolume += c.volume;
            result.push({
                time: c.time,
                value: cumVolume > 0 ? cumTPV / cumVolume : c.close
            });
        }
        return result;
    }

    // ─────────────────────────────────────────────
    // Ichimoku Cloud
    // ─────────────────────────────────────────────
    function midpointRange(candles, endIndex, period) {
        let high = -Infinity;
        let low = Infinity;
        for (let i = endIndex - period + 1; i <= endIndex; i++) {
            high = Math.max(high, candles[i].high);
            low = Math.min(low, candles[i].low);
        }
        return (high + low) / 2;
    }

    function ichimoku(candles, tenkan = 9, kijun = 26, spanB = 52) {
        const conversion = [], base = [], spanA = [], spanBLine = [];
        const minPeriod = Math.max(tenkan, kijun);
        for (let i = tenkan - 1; i < candles.length; i++) {
            conversion.push({ time: candles[i].time, value: midpointRange(candles, i, tenkan) });
        }
        for (let i = kijun - 1; i < candles.length; i++) {
            base.push({ time: candles[i].time, value: midpointRange(candles, i, kijun) });
        }
        for (let i = minPeriod - 1; i < candles.length; i++) {
            const conv = midpointRange(candles, i, tenkan);
            const kij = midpointRange(candles, i, kijun);
            spanA.push({ time: candles[i].time, value: (conv + kij) / 2 });
        }
        for (let i = spanB - 1; i < candles.length; i++) {
            spanBLine.push({ time: candles[i].time, value: midpointRange(candles, i, spanB) });
        }
        return { conversion, base, spanA, spanB: spanBLine };
    }

    // ─────────────────────────────────────────────
    // RSI — Relative Strength Index
    // ─────────────────────────────────────────────
    function rsi(candles, period = 14) {
        if (candles.length < period + 1) return [];
        const result = [];
        let avgGain = 0, avgLoss = 0;

        // Initial average gain/loss
        for (let i = 1; i <= period; i++) {
            const delta = candles[i].close - candles[i - 1].close;
            if (delta > 0) avgGain += delta;
            else avgLoss -= delta;
        }
        avgGain /= period;
        avgLoss /= period;

        const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push({ time: candles[period].time, value: 100 - 100 / (1 + rs0) });

        for (let i = period + 1; i < candles.length; i++) {
            const delta = candles[i].close - candles[i - 1].close;
            const gain = delta > 0 ? delta : 0;
            const loss = delta < 0 ? -delta : 0;
            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            result.push({ time: candles[i].time, value: 100 - 100 / (1 + rs) });
        }
        return result;
    }

    // ─────────────────────────────────────────────
    // MACD — Moving Average Convergence Divergence
    // Returns { macdLine, signalLine, histogram }
    // ─────────────────────────────────────────────
    function macd(candles, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        if (candles.length < slowPeriod + signalPeriod) return null;
        const closes = candles.map(c => c.close);
        const emaFastAll = emaValues(closes, fastPeriod);
        const emaSlowAll = emaValues(closes, slowPeriod);

        // Align: EMA fast starts at fastPeriod-1, slow at slowPeriod-1
        const offset = slowPeriod - fastPeriod;
        const macdRaw = emaFastAll.slice(offset).map((f, i) => f - emaSlowAll[i]);
        const signalRaw = emaValues(macdRaw, signalPeriod);

        // Time alignment
        const startIndex = slowPeriod - 1; // first candle with both EMAs
        const signalOffset = signalPeriod - 1;

        const macdLine = [], signalLine = [], histogram = [];

        for (let i = signalOffset; i < macdRaw.length; i++) {
            const candleIndex = startIndex + i;
            if (candleIndex >= candles.length) break;
            const t = candles[candleIndex].time;
            const m = macdRaw[i];
            const s = signalRaw[i - signalOffset];
            macdLine.push({ time: t, value: m });
            signalLine.push({ time: t, value: s });
            histogram.push({ time: t, value: m - s, color: (m - s) >= 0 ? 'rgba(0,230,118,0.7)' : 'rgba(255,23,68,0.7)' });
        }

        return { macdLine, signalLine, histogram };
    }

    // ─────────────────────────────────────────────
    // Common panel indicators
    // ─────────────────────────────────────────────
    function momentum(candles, period = 10) {
        if (candles.length <= period) return [];
        const result = [];
        for (let i = period; i < candles.length; i++) {
            result.push({ time: candles[i].time, value: candles[i].close - candles[i - period].close });
        }
        return result;
    }

    function roc(candles, period = 9) {
        if (candles.length <= period) return [];
        const result = [];
        for (let i = period; i < candles.length; i++) {
            const prev = candles[i - period].close;
            result.push({ time: candles[i].time, value: prev !== 0 ? ((candles[i].close - prev) / prev) * 100 : 0 });
        }
        return result;
    }

    function cci(candles, period = 20) {
        if (candles.length < period) return [];
        const tps = candles.map(c => (c.high + c.low + c.close) / 3);
        const result = [];
        for (let i = period - 1; i < candles.length; i++) {
            const slice = tps.slice(i - period + 1, i + 1);
            const mean = slice.reduce((s, v) => s + v, 0) / period;
            const meanDev = slice.reduce((s, v) => s + Math.abs(v - mean), 0) / period;
            result.push({ time: candles[i].time, value: meanDev ? (tps[i] - mean) / (0.015 * meanDev) : 0 });
        }
        return result;
    }

    function stochastic(candles, kPeriod = 14, dPeriod = 3, smooth = 3) {
        if (candles.length < kPeriod + smooth + dPeriod) return { kLine: [], dLine: [] };
        const rawK = [];
        for (let i = kPeriod - 1; i < candles.length; i++) {
            const slice = candles.slice(i - kPeriod + 1, i + 1);
            const high = Math.max(...slice.map(c => c.high));
            const low = Math.min(...slice.map(c => c.low));
            rawK.push({ time: candles[i].time, value: high !== low ? ((candles[i].close - low) / (high - low)) * 100 : 50 });
        }
        const kValues = sma(rawK.map(item => ({ time: item.time, close: item.value })), smooth);
        const dValues = sma(kValues.map(item => ({ time: item.time, close: item.value })), dPeriod);
        return { kLine: kValues, dLine: dValues };
    }

    function obv(candles) {
        if (!candles || candles.length === 0) return [];
        const result = [{ time: candles[0].time, value: candles[0].volume || 0 }];
        let current = candles[0].volume || 0;
        for (let i = 1; i < candles.length; i++) {
            if (candles[i].close > candles[i - 1].close) current += candles[i].volume || 0;
            else if (candles[i].close < candles[i - 1].close) current -= candles[i].volume || 0;
            result.push({ time: candles[i].time, value: current });
        }
        return result;
    }

    function adx(candles, period = 14) {
        if (candles.length < period * 2) return { adxLine: [], plusDI: [], minusDI: [] };
        const tr = [], plusDM = [], minusDM = [];
        for (let i = 1; i < candles.length; i++) {
            const upMove = candles[i].high - candles[i - 1].high;
            const downMove = candles[i - 1].low - candles[i].low;
            plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
            minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
            tr.push(Math.max(
                candles[i].high - candles[i].low,
                Math.abs(candles[i].high - candles[i - 1].close),
                Math.abs(candles[i].low - candles[i - 1].close)
            ));
        }

        let trSm = tr.slice(0, period).reduce((s, v) => s + v, 0);
        let plusSm = plusDM.slice(0, period).reduce((s, v) => s + v, 0);
        let minusSm = minusDM.slice(0, period).reduce((s, v) => s + v, 0);
        const dx = [], plusDI = [], minusDI = [];

        for (let i = period; i < tr.length; i++) {
            trSm = trSm - trSm / period + tr[i];
            plusSm = plusSm - plusSm / period + plusDM[i];
            minusSm = minusSm - minusSm / period + minusDM[i];
            const plus = trSm ? 100 * (plusSm / trSm) : 0;
            const minus = trSm ? 100 * (minusSm / trSm) : 0;
            const value = (plus + minus) ? 100 * Math.abs(plus - minus) / (plus + minus) : 0;
            const t = candles[i + 1].time;
            plusDI.push({ time: t, value: plus });
            minusDI.push({ time: t, value: minus });
            dx.push({ time: t, value });
        }

        const adxLine = sma(dx.map(item => ({ time: item.time, close: item.value })), period);
        return { adxLine, plusDI, minusDI };
    }

    // ─────────────────────────────────────────────
    // ATR — Average True Range (Helper)
    // ─────────────────────────────────────────────
    function atr(candles, period = 200) {
        if (candles.length === 0) return [];
        const result = [];
        let sumTR = 0;
        let prevClose = candles[0].close;
        for (let i = 0; i < candles.length; i++) {
            const c = candles[i];
            const tr = i === 0 ? (c.high - c.low) : Math.max(
                c.high - c.low,
                Math.abs(c.high - prevClose),
                Math.abs(c.low - prevClose)
            );
            prevClose = c.close;
            
            if (i < period) {
                sumTR += tr;
                if (i === period - 1) {
                    result.push({ time: c.time, value: sumTR / period });
                } else {
                    result.push({ time: c.time, value: tr }); // seed values
                }
            } else {
                const prevAtr = result[i - 1].value;
                const currentAtr = (prevAtr * (period - 1) + tr) / period;
                result.push({ time: c.time, value: currentAtr });
            }
        }
        return result;
    }

    // ─────────────────────────────────────────────
    // Supertrend
    // ─────────────────────────────────────────────
    function supertrend(candles, period = 10, multiplier = 3) {
        const atrVals = atr(candles, period);
        if (!atrVals || atrVals.length === 0) return { line: [], direction: [] };
        const atrMap = new Map(atrVals.map(item => [item.time, item.value]));
        const line = [], direction = [];
        let finalUpper = null, finalLower = null, trend = 1;

        for (let i = 1; i < candles.length; i++) {
            const c = candles[i];
            const prev = candles[i - 1];
            const atrValue = atrMap.get(c.time);
            if (atrValue == null) continue;
            const hl2 = (c.high + c.low) / 2;
            const basicUpper = hl2 + multiplier * atrValue;
            const basicLower = hl2 - multiplier * atrValue;

            finalUpper = finalUpper == null || basicUpper < finalUpper || prev.close > finalUpper ? basicUpper : finalUpper;
            finalLower = finalLower == null || basicLower > finalLower || prev.close < finalLower ? basicLower : finalLower;

            if (trend === -1 && c.close > finalUpper) trend = 1;
            else if (trend === 1 && c.close < finalLower) trend = -1;

            const value = trend === 1 ? finalLower : finalUpper;
            line.push({ time: c.time, value, color: trend === 1 ? '#089981' : '#F23645' });
            direction.push({ time: c.time, value: trend });
        }
        return { line, direction };
    }

    // ─────────────────────────────────────────────
    // Volume Indicator (Helper)
    // ─────────────────────────────────────────────
    function volume(candles) {
        if (!candles || candles.length === 0) return [];
        return candles.map(c => {
            const isBullish = c.close >= c.open;
            return {
                time: c.time,
                value: c.volume || 0,
                color: isBullish ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)'
            };
        });
    }

    // ─────────────────────────────────────────────
    // SMC — Smart Money Concepts [LuxAlgo]
    // ─────────────────────────────────────────────
    function smc(candles, settings = {}) {
        // Default settings matching LuxAlgo Pine script
        const cfg = {
            mode: 'Historical',
            style: 'Colored',
            showTrend: false,
            showInternals: true,
            showInternalBull: 'All',
            showInternalBear: 'All',
            internalFilterConfluence: false,
            internalStructureSize: 'Tiny',
            showStructure: true,
            showSwingBull: 'All',
            showSwingBear: 'All',
            showSwings: false,
            swingsLength: 50,
            showHighLowSwings: true,
            showInternalOrderBlocks: true,
            internalOrderBlocksSize: 5,
            showSwingOrderBlocks: false,
            swingOrderBlocksSize: 5,
            orderBlockFilter: 'Atr',
            orderBlockMitigation: 'High/Low',
            showEqualHighsLows: true,
            equalHighsLowsLength: 3,
            equalHighsLowsThreshold: 0.1,
            showFairValueGaps: false,
            fairValueGapsThreshold: true,
            fairValueGapsExtend: 1,
            showPremiumDiscountZones: false,
            ...settings
        };

        if (candles.length < Math.min(candles.length, 10)) return null;

        // Ensure swingsLength is valid and bounded by candle length
        const swingsLength = Math.max(2, Math.min(cfg.swingsLength, candles.length - 2));

        // Precompute ATR
        const atrVals = atr(candles, 200);
        
        // Volatility measure (ATR or Cumulative Mean Range)
        const trs = [];
        let prevClose = candles[0].close;
        let cumTr = 0;
        for (let i = 0; i < candles.length; i++) {
            const c = candles[i];
            const tr = i === 0 ? (c.high - c.low) : Math.max(
                c.high - c.low,
                Math.abs(c.high - prevClose),
                Math.abs(c.low - prevClose)
            );
            prevClose = c.close;
            cumTr += tr;
            trs.push({ tr, cumMean: cumTr / (i + 1) });
        }

        // Color theme
        const isMono = cfg.style === 'Monochrome';
        const GREEN = isMono ? '#b2b5be' : '#089981';
        const RED = isMono ? '#5d606b' : '#F23645';

        // State variables
        let swingHigh = { currentLevel: null, lastLevel: null, crossed: false, barTime: null, barIndex: null };
        let swingLow = { currentLevel: null, lastLevel: null, crossed: false, barTime: null, barIndex: null };
        
        let internalHigh = { currentLevel: null, lastLevel: null, crossed: false, barTime: null, barIndex: null };
        let internalLow = { currentLevel: null, lastLevel: null, crossed: false, barTime: null, barIndex: null };

        let equalHigh = { currentLevel: null, lastLevel: null, crossed: false, barTime: null, barIndex: null };
        let equalLow = { currentLevel: null, lastLevel: null, crossed: false, barTime: null, barIndex: null };

        let swingTrend = 0; // BULLISH = 1, BEARISH = -1
        let internalTrend = 0;

        let trailing = { top: null, bottom: null, barTime: null, barIndex: null, lastTopTime: null, lastBottomTime: null };

        // Output arrays/objects
        const swingHighsLows = []; 
        const equalHighsLows = []; 
        const breakouts = []; 
        const activeSwingOBs = [];
        const activeInternalOBs = [];
        const activeFvgs = [];

        // State machine leg states
        let swingLeg = 0;
        let prevSwingLeg = 0;
        let internalLeg = 0;
        let prevInternalLeg = 0;
        let equalLeg = 0;
        let prevEqualLeg = 0;

        // FVG state variables
        let cumBodyDiff = 0;

        // Parse candles one by one to simulate historical state machine exactly
        for (let i = 0; i < candles.length; i++) {
            const c = candles[i];
            const t = c.time;

            // Volatility measures at bar i
            const atrVal = atrVals[i] ? atrVals[i].value : (c.high - c.low);
            const volMeasure = cfg.orderBlockFilter === 'Atr' ? atrVal : trs[i].cumMean;
            const highVol = (c.high - c.low) >= (2 * volMeasure);
            const parsedHigh = highVol ? c.low : c.high;
            const parsedLow = highVol ? c.high : c.low;

            // ─────────────────────────────────────────────
            // 1. SWING PIVOTS (swingsLength)
            // ─────────────────────────────────────────────
            if (i >= swingsLength) {
                const targetIdx = i - swingsLength;
                const targetCandle = candles[targetIdx];
                
                let maxHigh = -Infinity;
                let minLow = Infinity;
                for (let j = targetIdx + 1; j <= i; j++) {
                    if (candles[j].high > maxHigh) maxHigh = candles[j].high;
                    if (candles[j].low < minLow) minLow = candles[j].low;
                }

                const newLegHigh = targetCandle.high > maxHigh;
                const newLegLow = targetCandle.low < minLow;

                if (newLegHigh) {
                    swingLeg = 0; // BEARISH
                } else if (newLegLow) {
                    swingLeg = 1; // BULLISH
                }

                if (swingLeg !== prevSwingLeg) {
                    const isBull = swingLeg === 1; // swingLow confirmed
                    if (isBull) {
                        swingLow.lastLevel = swingLow.currentLevel;
                        swingLow.currentLevel = targetCandle.low;
                        swingLow.crossed = false;
                        swingLow.barTime = targetCandle.time;
                        swingLow.barIndex = targetIdx;

                        trailing.bottom = swingLow.currentLevel;
                        trailing.barTime = swingLow.barTime;
                        trailing.barIndex = swingLow.barIndex;
                        trailing.lastBottomTime = swingLow.barTime;

                        if (cfg.showSwings) {
                            const label = swingLow.currentLevel < swingLow.lastLevel ? 'LL' : 'HL';
                            swingHighsLows.push({
                                time: targetCandle.time,
                                price: swingLow.currentLevel,
                                label,
                                position: 'belowBar',
                                color: GREEN
                            });
                        }
                    } else {
                        swingHigh.lastLevel = swingHigh.currentLevel;
                        swingHigh.currentLevel = targetCandle.high;
                        swingHigh.crossed = false;
                        swingHigh.barTime = targetCandle.time;
                        swingHigh.barIndex = targetIdx;

                        trailing.top = swingHigh.currentLevel;
                        trailing.barTime = swingHigh.barTime;
                        trailing.barIndex = swingHigh.barIndex;
                        trailing.lastTopTime = swingHigh.barTime;

                        if (cfg.showSwings) {
                            const label = swingHigh.currentLevel > swingHigh.lastLevel ? 'HH' : 'LH';
                            swingHighsLows.push({
                                time: targetCandle.time,
                                price: swingHigh.currentLevel,
                                label,
                                position: 'aboveBar',
                                color: RED
                            });
                        }
                    }
                    prevSwingLeg = swingLeg;
                }
            }

            // ─────────────────────────────────────────────
            // 2. INTERNAL PIVOTS (Size 5)
            // ─────────────────────────────────────────────
            const intSize = 5;
            if (i >= intSize) {
                const targetIdx = i - intSize;
                const targetCandle = candles[targetIdx];

                let maxHigh = -Infinity;
                let minLow = Infinity;
                for (let j = targetIdx + 1; j <= i; j++) {
                    if (candles[j].high > maxHigh) maxHigh = candles[j].high;
                    if (candles[j].low < minLow) minLow = candles[j].low;
                }

                const newLegHigh = targetCandle.high > maxHigh;
                const newLegLow = targetCandle.low < minLow;

                if (newLegHigh) {
                    internalLeg = 0;
                } else if (newLegLow) {
                    internalLeg = 1;
                }

                if (internalLeg !== prevInternalLeg) {
                    const isBull = internalLeg === 1;
                    if (isBull) {
                        internalLow.lastLevel = internalLow.currentLevel;
                        internalLow.currentLevel = targetCandle.low;
                        internalLow.crossed = false;
                        internalLow.barTime = targetCandle.time;
                        internalLow.barIndex = targetIdx;
                    } else {
                        internalHigh.lastLevel = internalHigh.currentLevel;
                        internalHigh.currentLevel = targetCandle.high;
                        internalHigh.crossed = false;
                        internalHigh.barTime = targetCandle.time;
                        internalHigh.barIndex = targetIdx;
                    }
                    prevInternalLeg = internalLeg;
                }
            }

            // ─────────────────────────────────────────────
            // 3. EQUAL HIGHS/LOWS (equalHighsLowsLength)
            // ─────────────────────────────────────────────
            if (cfg.showEqualHighsLows) {
                const eqSize = cfg.equalHighsLowsLength;
                if (i >= eqSize) {
                    const targetIdx = i - eqSize;
                    const targetCandle = candles[targetIdx];

                    let maxHigh = -Infinity;
                    let minLow = Infinity;
                    for (let j = targetIdx + 1; j <= i; j++) {
                        if (candles[j].high > maxHigh) maxHigh = candles[j].high;
                        if (candles[j].low < minLow) minLow = candles[j].low;
                    }

                    const newLegHigh = targetCandle.high > maxHigh;
                    const newLegLow = targetCandle.low < minLow;

                    if (newLegHigh) {
                        equalLeg = 0;
                    } else if (newLegLow) {
                        equalLeg = 1;
                    }

                    if (equalLeg !== prevEqualLeg) {
                        const isBull = equalLeg === 1;
                        if (isBull) {
                            if (equalLow.currentLevel !== null && Math.abs(equalLow.currentLevel - targetCandle.low) < cfg.equalHighsLowsThreshold * atrVal) {
                                equalHighsLows.push({
                                    type: 'EQL',
                                    start: { time: equalLow.barTime, price: equalLow.currentLevel },
                                    end: { time: targetCandle.time, price: targetCandle.low },
                                    color: GREEN
                                });
                            }
                            equalLow.lastLevel = equalLow.currentLevel;
                            equalLow.currentLevel = targetCandle.low;
                            equalLow.crossed = false;
                            equalLow.barTime = targetCandle.time;
                            equalLow.barIndex = targetIdx;
                        } else {
                            if (equalHigh.currentLevel !== null && Math.abs(equalHigh.currentLevel - targetCandle.high) < cfg.equalHighsLowsThreshold * atrVal) {
                                equalHighsLows.push({
                                    type: 'EQH',
                                    start: { time: equalHigh.barTime, price: equalHigh.currentLevel },
                                    end: { time: targetCandle.time, price: targetCandle.high },
                                    color: RED
                                });
                            }
                            equalHigh.lastLevel = equalHigh.currentLevel;
                            equalHigh.currentLevel = targetCandle.high;
                            equalHigh.crossed = false;
                            equalHigh.barTime = targetCandle.time;
                            equalHigh.barIndex = targetIdx;
                        }
                        prevEqualLeg = equalLeg;
                    }
                }
            }

            // ─────────────────────────────────────────────
            // 4. BREAKOUTS & STRUCTURE (BOS/CHoCH)
            // ─────────────────────────────────────────────
            let bullishBar = true;
            let bearishBar = true;
            if (cfg.internalFilterConfluence) {
                bullishBar = (c.high - Math.max(c.close, c.open)) > Math.min(c.close, c.open) - c.low;
                bearishBar = (c.high - Math.max(c.close, c.open)) < Math.min(c.close, c.open) - c.low;
            }

            // A. Internal Structure
            if (cfg.showInternals && internalHigh.currentLevel !== null && internalLow.currentLevel !== null) {
                if (c.close > internalHigh.currentLevel && !internalHigh.crossed && (internalHigh.currentLevel !== swingHigh.currentLevel && bullishBar)) {
                    const tag = internalTrend === -1 ? 'CHoCH' : 'BOS';
                    internalHigh.crossed = true;
                    internalTrend = 1;

                    const showBullType = cfg.showInternalBull;
                    if (showBullType === 'All' || (showBullType === 'BOS' && tag === 'BOS') || (showBullType === 'CHoCH' && tag === 'CHoCH')) {
                        breakouts.push({
                            type: 'internal',
                            direction: 'bull',
                            tag,
                            start: { time: internalHigh.barTime, price: internalHigh.currentLevel },
                            end: { time: t, price: internalHigh.currentLevel },
                            color: GREEN
                        });
                    }

                    if (cfg.showInternalOrderBlocks) {
                        let minIdx = internalHigh.barIndex;
                        let minL = Infinity;
                        for (let j = internalHigh.barIndex; j <= i; j++) {
                            const lowVal = highVol ? candles[j].high : candles[j].low;
                            if (lowVal < minL) {
                                minL = lowVal;
                                minIdx = j;
                            }
                        }
                        activeInternalOBs.unshift({
                            high: highVol ? candles[minIdx].low : candles[minIdx].high,
                            low: minL,
                            time: candles[minIdx].time,
                            bias: 1
                        });
                        if (activeInternalOBs.length > 100) activeInternalOBs.pop();
                    }
                }

                if (c.close < internalLow.currentLevel && !internalLow.crossed && (internalLow.currentLevel !== swingLow.currentLevel && bearishBar)) {
                    const tag = internalTrend === 1 ? 'CHoCH' : 'BOS';
                    internalLow.crossed = true;
                    internalTrend = -1;

                    const showBearType = cfg.showInternalBear;
                    if (showBearType === 'All' || (showBearType === 'BOS' && tag === 'BOS') || (showBearType === 'CHoCH' && tag === 'CHoCH')) {
                        breakouts.push({
                            type: 'internal',
                            direction: 'bear',
                            tag,
                            start: { time: internalLow.barTime, price: internalLow.currentLevel },
                            end: { time: t, price: internalLow.currentLevel },
                            color: RED
                        });
                    }

                    if (cfg.showInternalOrderBlocks) {
                        let maxIdx = internalLow.barIndex;
                        let maxH = -Infinity;
                        for (let j = internalLow.barIndex; j <= i; j++) {
                            const highVal = highVol ? candles[j].low : candles[j].high;
                            if (highVal > maxH) {
                                maxH = highVal;
                                maxIdx = j;
                            }
                        }
                        activeInternalOBs.unshift({
                            high: maxH,
                            low: highVol ? candles[maxIdx].high : candles[maxIdx].low,
                            time: candles[maxIdx].time,
                            bias: -1
                        });
                        if (activeInternalOBs.length > 100) activeInternalOBs.pop();
                    }
                }
            }

            // B. Swing Structure
            if (cfg.showStructure && swingHigh.currentLevel !== null && swingLow.currentLevel !== null) {
                if (c.close > swingHigh.currentLevel && !swingHigh.crossed) {
                    const tag = swingTrend === -1 ? 'CHoCH' : 'BOS';
                    swingHigh.crossed = true;
                    swingTrend = 1;

                    const showBullType = cfg.showSwingBull;
                    if (showBullType === 'All' || (showBullType === 'BOS' && tag === 'BOS') || (showBullType === 'CHoCH' && tag === 'CHoCH')) {
                        breakouts.push({
                            type: 'swing',
                            direction: 'bull',
                            tag,
                            start: { time: swingHigh.barTime, price: swingHigh.currentLevel },
                            end: { time: t, price: swingHigh.currentLevel },
                            color: GREEN
                        });
                    }

                    if (cfg.showSwingOrderBlocks) {
                        let minIdx = swingHigh.barIndex;
                        let minL = Infinity;
                        for (let j = swingHigh.barIndex; j <= i; j++) {
                            const lowVal = highVol ? candles[j].high : candles[j].low;
                            if (lowVal < minL) {
                                minL = lowVal;
                                minIdx = j;
                            }
                        }
                        activeSwingOBs.unshift({
                            high: highVol ? candles[minIdx].low : candles[minIdx].high,
                            low: minL,
                            time: candles[minIdx].time,
                            bias: 1
                        });
                        if (activeSwingOBs.length > 100) activeSwingOBs.pop();
                    }
                }

                if (c.close < swingLow.currentLevel && !swingLow.crossed) {
                    const tag = swingTrend === 1 ? 'CHoCH' : 'BOS';
                    swingLow.crossed = true;
                    swingTrend = -1;

                    const showBearType = cfg.showSwingBear;
                    if (showBearType === 'All' || (showBearType === 'BOS' && tag === 'BOS') || (showBearType === 'CHoCH' && tag === 'CHoCH')) {
                        breakouts.push({
                            type: 'swing',
                            direction: 'bear',
                            tag,
                            start: { time: swingLow.barTime, price: swingLow.currentLevel },
                            end: { time: t, price: swingLow.currentLevel },
                            color: RED
                        });
                    }

                    if (cfg.showSwingOrderBlocks) {
                        let maxIdx = swingLow.barIndex;
                        let maxH = -Infinity;
                        for (let j = swingLow.barIndex; j <= i; j++) {
                            const highVal = highVol ? candles[j].low : candles[j].high;
                            if (highVal > maxH) {
                                maxH = highVal;
                                maxIdx = j;
                            }
                        }
                        activeSwingOBs.unshift({
                            high: maxH,
                            low: highVol ? candles[maxIdx].high : candles[maxIdx].low,
                            time: candles[maxIdx].time,
                            bias: -1
                        });
                        if (activeSwingOBs.length > 100) activeSwingOBs.pop();
                    }
                }
            }

            // ─────────────────────────────────────────────
            // 5. MITIGATION OF ORDER BLOCKS
            // ─────────────────────────────────────────────
            const mitigationClose = cfg.orderBlockMitigation === 'Close';
            const bearishMitSrc = mitigationClose ? c.close : c.high;
            const bullishMitSrc = mitigationClose ? c.close : c.low;

            for (let k = activeSwingOBs.length - 1; k >= 0; k--) {
                const ob = activeSwingOBs[k];
                if (ob.bias === -1 && bearishMitSrc > ob.high) {
                    activeSwingOBs.splice(k, 1);
                } else if (ob.bias === 1 && bullishMitSrc < ob.low) {
                    activeSwingOBs.splice(k, 1);
                }
            }

            for (let k = activeInternalOBs.length - 1; k >= 0; k--) {
                const ob = activeInternalOBs[k];
                if (ob.bias === -1 && bearishMitSrc > ob.high) {
                    activeInternalOBs.splice(k, 1);
                } else if (ob.bias === 1 && bullishMitSrc < ob.low) {
                    activeInternalOBs.splice(k, 1);
                }
            }

            // ─────────────────────────────────────────────
            // 6. FAIR VALUE GAPS (FVG)
            // ─────────────────────────────────────────────
            if (cfg.showFairValueGaps && i >= 2) {
                const c0 = candles[i - 2];
                const c1 = candles[i - 1];
                const c2 = candles[i];

                const barDeltaPercent = (c1.close - c1.open) / c1.open;
                cumBodyDiff += Math.abs(barDeltaPercent);
                const threshold = cfg.fairValueGapsThreshold ? (cumBodyDiff / (i + 1) * 2) : 0;

                const bullFVG = c2.low > c0.high && c1.close > c0.high && barDeltaPercent > threshold;
                const bearFVG = c2.high < c0.low && c1.close < c0.low && -barDeltaPercent > threshold;

                if (bullFVG) {
                    activeFvgs.unshift({
                        top: c2.low,
                        bottom: c0.high,
                        time: c1.time,
                        bias: 1
                    });
                }
                if (bearFVG) {
                    activeFvgs.unshift({
                        top: c0.low,
                        bottom: c2.high,
                        time: c1.time,
                        bias: -1
                    });
                }

                for (let k = activeFvgs.length - 1; k >= 0; k--) {
                    const fvg = activeFvgs[k];
                    if (fvg.bias === 1 && c.low < fvg.bottom) {
                        activeFvgs.splice(k, 1);
                    } else if (fvg.bias === -1 && c.high > fvg.top) {
                        activeFvgs.splice(k, 1);
                    }
                }
            }

            // ─────────────────────────────────────────────
            // 7. UPDATE TRAILING SWING EXTREMES
            // ─────────────────────────────────────────────
            if (cfg.showHighLowSwings || cfg.showPremiumDiscountZones) {
                if (trailing.top !== null) {
                    if (c.high > trailing.top) {
                        trailing.top = c.high;
                        trailing.lastTopTime = t;
                    }
                } else {
                    trailing.top = c.high;
                    trailing.lastTopTime = t;
                    trailing.barTime = t;
                }
                if (trailing.bottom !== null) {
                    if (c.low < trailing.bottom) {
                        trailing.bottom = c.low;
                        trailing.lastBottomTime = t;
                    }
                } else {
                    trailing.bottom = c.low;
                    trailing.lastBottomTime = t;
                    trailing.barTime = t;
                }
            }
        }

        let finalBreakouts = breakouts;
        if (cfg.mode === 'Present' && breakouts.length > 0) {
            const latest = {};
            for (const b of breakouts) {
                const k = `${b.type}_${b.direction}`;
                if (!latest[k] || b.start.time > latest[k].start.time) {
                    latest[k] = b;
                }
            }
            finalBreakouts = Object.values(latest);
        }

        const finalSwingOBs = activeSwingOBs.slice(0, cfg.swingOrderBlocksSize);
        const finalInternalOBs = activeInternalOBs.slice(0, cfg.internalOrderBlocksSize);

        return {
            swingHighsLows,
            equalHighsLows,
            breakouts: finalBreakouts,
            swingOBs: cfg.showSwingOrderBlocks ? finalSwingOBs : [],
            internalOBs: cfg.showInternalOrderBlocks ? finalInternalOBs : [],
            fvgs: activeFvgs,
            trailing: (cfg.showHighLowSwings || cfg.showPremiumDiscountZones) ? {
                top: trailing.top,
                bottom: trailing.bottom,
                lastTopTime: trailing.lastTopTime,
                lastBottomTime: trailing.lastBottomTime,
                barTime: trailing.barTime,
                swingTrendBias: swingTrend
            } : null,
            settings: cfg
        };
    }

    return {
        sma, ema, wma, hma, bollingerBands, vwap, ichimoku,
        rsi, macd, momentum, roc, cci, stochastic, obv, adx,
        volume, atr, supertrend, smc
    };
})();
