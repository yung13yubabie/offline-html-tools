// UI-only regression: generated numeral markup must retain the original wording.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(path.join(__dirname,'../apps/accounting-calculator.html'),'utf8');
for(const [,script] of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script);
const ctx={};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('const CN_NUM='),source.indexOf('const taxDefs=')),ctx);
for(const value of [0,1,10,100,1000,10001,12957,2457,999999999,-1234,12.9]){
 const markup=ctx.upperMarkup(value);assert.equal(markup.replace(/<[^>]+>/g,''),ctx.chineseUpper(value));
 for(const [,kind,glyph] of markup.matchAll(/class="cn-(digit|unit)">([^<]+)</g))assert.equal(kind,'零壹貳參肆伍陸柒捌玖'.includes(glyph)?'digit':'unit');
}
assert.equal(ctx.enterLabel('down'),'下一筆同一欄位');assert.equal(ctx.enterLabel('right'),'下一筆的預設欄位');
assert(!source.includes('↵→'));assert(!source.includes('↵↓'));assert(!source.includes('資料直接內嵌於此 HTML'));
assert(source.includes('提醒：計算內容重新整理後會清空。'));assert(source.includes('115.01.01 生效'));
assert(source.includes('沿用本類設定：${enterLabel(categoryEnterDefault[def.id])}'));
assert(source.includes('<details class="cost-note">'));assert(source.includes('class="upper-guide"'));
console.log(JSON.stringify({passed:true,scope:'inline script syntax, numeral presentation parity, explicit labels; not browser layout'}));
