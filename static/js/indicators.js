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
    // Volume bars — color-coded bullish/bearish
    // ─────────────────────────────────────────────
    function volume(candles) {
        return candles.map(c => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? 'rgba(0,230,118,0.5)' : 'rgba(255,23,68,0.5)'
        }));
    }

    return { sma, ema, bollingerBands, vwap, rsi, macd, volume };
})();
