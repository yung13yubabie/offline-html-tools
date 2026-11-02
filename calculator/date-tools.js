/* Gregorian date-only calculations, independent of the browser time zone. */
function createDateToolsEngine() {
  'use strict';
  const DAY_MS = 86400000, MAX_OFFSET = 100000;

  function parseDate(value) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) throw new Error('請填入日期。');
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) throw new Error('日期請使用 YYYY-MM-DD 格式。');
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    if (year < 1 || year > 9999) throw new Error('年份須介於 0001 至 9999。');
    // Date.UTC treats years 0–99 as 1900–1999. setUTCFullYear preserves the actual year.
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new Error('這個日期不存在，請檢查月份、天數及閏年。');
    }
    return date.getTime() / DAY_MS;
  }
  const MIN_DAY = parseDate('0001-01-01'), MAX_DAY = parseDate('9999-12-31');
  function checkedDay(day) {
    if (!Number.isSafeInteger(day) || day < MIN_DAY || day > MAX_DAY) throw new Error('計算後日期超出 0001-01-01 至 9999-12-31 的範圍。');
    return day;
  }
  function formatDate(day) {
    const date = new Date(checkedDay(day) * DAY_MS);
    return String(date.getUTCFullYear()).padStart(4, '0') + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0');
  }
  function weekday(day) {return ((checkedDay(day) + 4) % 7 + 7) % 7;}
  function isBusinessDay(day) {const index = weekday(day);return index !== 0 && index !== 6;}
  function checkMode(mode) {if (mode !== 'calendar' && mode !== 'business') throw new Error('請選擇日曆天或排除週末。');}
  function readDate(label, value) {
    try {return parseDate(value);} catch (error) {throw new Error(label + '：' + error.message);}
  }
  function parseOffset(value) {
    const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
    if (!text) throw new Error('請填入要加減的天數。');
    if (!/^[+-]?\d+$/.test(text)) throw new Error('加減天數須為整數，例如 30、-7 或 0。');
    const amount = Number(text);
    if (!Number.isSafeInteger(amount) || Math.abs(amount) > MAX_OFFSET) throw new Error('加減天數須介於 -100,000 至 100,000。');
    return amount === 0 ? 0 : amount;
  }
  function difference(options) {
    const {start, end, mode = 'calendar', includeStart = false} = options || {};
    checkMode(mode);
    if (typeof includeStart !== 'boolean') throw new Error('是否包含起日須為勾選狀態。');
    const first = readDate('起始日期', start), last = readDate('結束日期', end);
    const direction = last < first ? -1 : 1, length = Math.abs(last - first);
    let count = length;
    if (mode === 'business') {
      // Any consecutive seven-day block contains five weekdays, in either direction.
      const weeks = Math.floor(length / 7);
      count = weeks * 5;
      for (let i = 1; i <= length % 7; i++) if (isBusinessDay(first + direction * (weeks * 7 + i))) count++;
    }
    if (includeStart && (mode === 'calendar' || isBusinessDay(first))) count++;
    const calendarCount = length + (includeStart ? 1 : 0);
    return {
      start:formatDate(first), end:formatDate(last), mode, includeStart,
      direction, days:count ? direction * count : 0,
      calendarDays:calendarCount ? direction * calendarCount : 0,
      excludedWeekendDays:mode === 'business' ? calendarCount - count : 0
    };
  }
  function shift(options) {
    const {start, amount, mode = 'calendar'} = options || {};
    checkMode(mode);
    const first = readDate('起始日期', start), offset = parseOffset(amount);
    const direction = offset < 0 ? -1 : 1;
    let day = first;
    if (mode === 'calendar') day = checkedDay(first + offset);
    else {
      let remaining = Math.abs(offset);
      // A weekend start does not itself count as a workday. Zero always preserves it.
      while (remaining && !isBusinessDay(day)) {
        day = checkedDay(day + direction);
        if (isBusinessDay(day)) remaining--;
      }
      if (remaining) {
        const weeks = Math.floor(remaining / 5);
        day = checkedDay(day + direction * weeks * 7);
        remaining %= 5;
        while (remaining) {
          day = checkedDay(day + direction);
          if (isBusinessDay(day)) remaining--;
        }
      }
    }
    return {
      start:formatDate(first), date:formatDate(day), amount:offset, mode,
      weekday:weekday(day), calendarDays:day - first,
      excludedWeekendDays:mode === 'business' ? Math.abs(day - first) - Math.abs(offset) : 0
    };
  }
  return Object.freeze({MIN_DAY, MAX_DAY, MAX_OFFSET, parseDate, formatDate, weekday, isBusinessDay, parseOffset, difference, shift});
}
const DateToolsEngine = createDateToolsEngine();
if (typeof module !== 'undefined' && module.exports) module.exports = {createDateToolsEngine, DateToolsEngine};
