/* Build bounded linear equations from numeric fields; the existing solver stays unchanged. */
function createMathFormEngine() {
  'use strict';
  const names = Object.freeze(['x','y','z','a','b','c','d','e','f','g']);
  function numeric(input, {allowNegative=true, allowBlank=false} = {}) {
    let text = String(input ?? '').trim().replace(/−/g, '-');
    if (!text) {if (allowBlank) return '0';throw new Error('請填入數字。');}
    if (text.length > 120) throw new Error('數字最多 120 個字元。');
    if (text.includes(',')) {
      if (!/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?(?:[eE][+-]?\d+)?$/.test(text)) throw new Error('千分位格式不正確，請使用 1,234.56。');
      text = text.replace(/,/g,'');
    }
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) throw new Error('請只填數字，不需輸入算式、未知數或 %。');
    if (!allowNegative && text.startsWith('-')) throw new Error('係數請填非負數；正負號從旁邊選單選擇。');
    const value = Number(text);
    if (!Number.isFinite(value) || Math.abs(value) > 1e100) throw new Error('數值過大，請縮小數值。');
    if (value === 0 && /[1-9]/.test(text.split(/[eE]/)[0])) throw new Error('數值過小，請調整單位後再試。');
    // Preserve the supplied decimal/scientific literal, without rounding through Number.
    return text.replace(/^\+/,'');
  }
  function buildLinear({variableCount,rows} = {}) {
    if (!Number.isInteger(variableCount) || variableCount < 1 || variableCount > 10) throw new Error('未知數數量須為 1 至 10。');
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 20) throw new Error('方程式數量須為 1 至 20。');
    const variables = names.slice(0,variableCount);
    const lines = rows.map((row,index) => {
      if (!row || !Array.isArray(row.terms) || row.terms.length !== variableCount) throw new Error('第 ' + (index+1) + ' 條的係數欄位不完整。');
      const terms = row.terms.map((term,column) => {
        if (!term || !['+','-'].includes(term.sign)) throw new Error('第 ' + (index+1) + ' 條 ' + variables[column] + '：請選擇正負號。');
        let value;
        try {value = numeric(term.value,{allowNegative:false,allowBlank:true});}
        catch(error) {throw new Error('第 ' + (index+1) + ' 條 ' + variables[column] + '：' + error.message);}
        return (column ? ' ' + term.sign + ' ' : term.sign === '-' ? '-' : '') + value + '*' + variables[column];
      });
      let constant;
      try {constant = numeric(row.constant);} catch(error) {throw new Error('第 ' + (index+1) + ' 條等號右側：' + error.message);}
      return terms.join('') + ' = ' + constant;
    });
    const text = lines.join('\n');
    if (text.length > 6000) throw new Error('組成的算式超過 6000 字元，請減少條件或縮短數值。');
    return {variables,lines,text};
  }
  return Object.freeze({names,numeric,buildLinear});
}
const MathFormEngine = createMathFormEngine();
if (typeof module !== 'undefined' && module.exports) module.exports = {createMathFormEngine,MathFormEngine};
