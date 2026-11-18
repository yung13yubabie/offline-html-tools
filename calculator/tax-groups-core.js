/* Exact standalone multi-row tax arithmetic; the existing invoice workspace is unchanged. */
function createTaxGroupsCore19() {
  'use strict';
  const MAX_CENTS = 99999999999999n;
  const RATE_SCALE = 1000000n; // A 5% rate is represented as 50,000 / 1,000,000.
  const MAX_ROWS = 1000;
  function normalized(raw) {
    if (raw == null) return '';
    if (typeof raw !== 'string' && typeof raw !== 'number') throw new Error('請填入數字。');
    return String(raw).normalize('NFKC').trim().replace(/−/g, '-');
  }
  function parseAmount(raw) {
    let text = normalized(raw);
    if (!text) return null;
    if (text.length > 80) throw new Error('金額過長。');
    if (!/^[+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?|\.\d{1,2})$/.test(text)) {
      throw new Error('金額須為數字，最多 2 位小數；千分位請填 1,000.00。');
    }
    const negative = text[0] === '-';
    text = text.replace(/^[+-]/, '').replace(/,/g, '');
    const [whole, fraction = ''] = text.split('.');
    const value = BigInt(whole || '0') * 100n + BigInt(fraction.padEnd(2, '0'));
    if (value > MAX_CENTS) throw new Error('每筆金額絕對值最多 999,999,999,999.99。');
    return negative && value ? -value : value;
  }
  function parseRate(raw) {
    const text = normalized(raw);
    if (!text) throw new Error('請填入稅率。');
    if (text.length > 30 || !/^\+?(?:\d+(?:\.\d{0,4})?|\.\d{1,4})$/.test(text)) throw new Error('稅率請填 0 至 100，最多 4 位小數，不需輸入 %。');
    const [whole, fraction = ''] = text.replace(/^\+/, '').split('.');
    const value = BigInt(whole || '0') * 10000n + BigInt(fraction.padEnd(4, '0'));
    if (value > RATE_SCALE) throw new Error('稅率請填 0 至 100。');
    return value;
  }
  function readOptions(options = {}) {
    const {mode = 'gross', rate = '5', precision = 'yuan'} = options;
    if (mode !== 'gross' && mode !== 'net') throw new Error('請選擇含稅或未稅輸入。');
    if (precision !== 'yuan' && precision !== 'cent') throw new Error('請選擇稅額取整元或小數 2 位。');
    return {mode, rateUnits:parseRate(rate), precision};
  }
  function divideRounded(numerator, denominator) {
    // Symmetric half-away-from-zero, including negative credit adjustments.
    const negative = numerator < 0n, absolute = negative ? -numerator : numerator;
    let value = absolute / denominator;
    if ((absolute % denominator) * 2n >= denominator) value++;
    return negative && value ? -value : value;
  }
  function calculateParsed(amountCents, {mode, rateUnits, precision}) {
    if (amountCents === null) return null;
    const step = precision === 'yuan' ? 100n : 1n;
    const denominator = (mode === 'gross' ? RATE_SCALE + rateUnits : RATE_SCALE) * step;
    const taxCents = divideRounded(amountCents * rateUnits, denominator) * step;
    const netCents = mode === 'net' ? amountCents : amountCents - taxCents;
    const grossCents = mode === 'gross' ? amountCents : amountCents + taxCents;
    return {amountCents, netCents, taxCents, grossCents};
  }
  function calculate(options = {}) {
    const settings = readOptions(options);
    return calculateParsed(parseAmount(options.amount), settings);
  }
  function summarize(rows, options = {}) {
    if (!Array.isArray(rows) || rows.length > MAX_ROWS) throw new Error('清單最多 ' + MAX_ROWS + ' 筆。');
    const settings = readOptions(options);
    const totals = {netCents:0n, taxCents:0n, grossCents:0n};
    let validCount = 0, blankCount = 0, invalidCount = 0;
    const results = rows.map((raw, index) => {
      try {
        const amounts = calculateParsed(parseAmount(raw), settings);
        if (!amounts) {blankCount++;return {index, status:'blank'};}
        validCount++;
        for (const field of ['netCents','taxCents','grossCents']) totals[field] += amounts[field];
        return {index, status:'valid', ...amounts};
      } catch (error) {invalidCount++;return {index, status:'error', error:error.message};}
    });
    return {rows:results, totals, validCount, blankCount, invalidCount, complete:invalidCount === 0};
  }
  function format(cents) {
    if (typeof cents !== 'bigint') throw new Error('金額格式錯誤。');
    const absolute = cents < 0n ? -cents : cents;
    return (cents < 0n ? '−' : '') + (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + (absolute % 100n).toString().padStart(2, '0');
  }
  return Object.freeze({MAX_CENTS, MAX_ROWS, RATE_SCALE, parseAmount, parseRate, calculate, summarize, format});
}
if (typeof module !== 'undefined' && module.exports) module.exports = {createTaxGroupsCore19};
