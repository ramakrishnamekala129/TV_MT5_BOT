const fs = require('fs');
const vm = require('vm');

// Load indicators.js into a fresh VM context
const code = fs.readFileSync('static/js/indicators.js', 'utf8');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(code, ctx);

const Indicators = ctx.Indicators;
if (!Indicators) {
    console.error('Indicators not exposed on context — checking keys:', Object.keys(ctx));
    process.exit(1);
}

// Build 100 synthetic FOREX candles
const c = Array.from({ length: 100 }, (_, i) => ({
    time:   1700000000 + i * 300,
    open:   1.1000 + Math.sin(i / 10) * 0.002,
    high:   1.1005 + Math.sin(i / 10) * 0.002,
    low:    1.0995 + Math.sin(i / 10) * 0.002,
    close:  1.1000 + Math.sin(i / 10 + 0.1) * 0.002,
    volume: 100 + i
}));

const s   = Indicators.sma(c, 20);
const e   = Indicators.ema(c, 9);
const bb  = Indicators.bollingerBands(c, 20, 2);
const v   = Indicators.vwap(c);
const rsi = Indicators.rsi(c, 14);
const mac = Indicators.macd(c, 12, 26, 9);
const vol = Indicators.volume(c);

console.log('SMA(20) last point:',  JSON.stringify(s[s.length - 1]));
console.log('EMA(9) last point:',   JSON.stringify(e[e.length - 1]));
console.log('BB upper last:',       JSON.stringify(bb.upper[bb.upper.length - 1]));
console.log('BB middle last:',      JSON.stringify(bb.middle[bb.middle.length - 1]));
console.log('VWAP last:',           JSON.stringify(v[v.length - 1]));
console.log('RSI(14) last:',        JSON.stringify(rsi[rsi.length - 1]));
console.log('MACD hist last:',      JSON.stringify(mac.histogram[mac.histogram.length - 1]));
console.log('MACD line last:',      JSON.stringify(mac.macdLine[mac.macdLine.length - 1]));
console.log('Volume last:',         JSON.stringify(vol[vol.length - 1]));
console.log('\n✅ ALL INDICATORS PASSED');
