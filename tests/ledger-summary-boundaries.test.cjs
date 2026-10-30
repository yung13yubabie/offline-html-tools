const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function loadParser(file) {
  const html = fs.readFileSync(file, 'utf8');
  const helpers = html.slice(html.indexOf('  const tidy ='), html.indexOf('  const MODES ='));
  const parser = html.slice(html.indexOf('  function parseMoney('), html.indexOf('  function selectFile('));
  const ctx = vm.createContext({setTimeout: fn => { fn(); return 0; }});
  vm.runInContext(helpers + parser + '\nthis.parse = parseSheets;', ctx);
  return ctx.parse;
}
function permutations(xs) {
  return xs.length ? xs.flatMap((x,i) => permutations(xs.filter((_,j)=>i!==j)).map(t=>[x,...t])) : [[]];
}
async function run() {
  const fixed = loadParser(path.join(root, 'apps/ledger-analyzer.html'));
  const parse = (fn, headers, values) => fn([{name:'合成測試',rows:[headers,values]}],[]);
  const bugHeaders = ['日期','摘要','傳票號碼','借方','貸方'];
  const bugValues = ['114-01-05','相同摘要','000123',100,0];
  assert.equal((await parse(fixed,bugHeaders,bugValues)).entries[0].summary,'相同摘要');
  let cases=1;
  const values = {'日期':'114-01-05','摘要':'相同摘要','傳票號碼':'000123','借方':100,'貸方':0,'科目':'合成費用'};
  for (const headers of permutations(Object.keys(values))) {
    const out = (await parse(fixed,headers,headers.map(h=>values[h]))).entries[0];
    assert.equal(out.summary,'相同摘要',headers.join(','));
    assert.equal(out.voucher,'000123'); assert.equal(out.debit,10000); assert.equal(out.credit,0);
    assert.equal(out.item,'合成費用'); cases++;
  }
  for (const tail of ['傳票號碼','日期','借方','貸方','科目','未識別欄位']) {
    const headers=['日期','摘要','','',tail,'借方','貸方'];
    const row=['114-01-05','摘要前段','中段','尾段',values[tail]??'不要收入摘要',100,0];
    const out=(await parse(fixed,headers,row)).entries[0];
    assert.equal(out.summary,'摘要前段 中段 尾段');cases++;
  }
  const last=(await parse(fixed,['日期','借方','貸方','摘要'],['114-01-05',100,0,'末欄摘要','不要推測為延伸'])).entries[0];
  assert.equal(last.summary,'末欄摘要'); cases++;
  console.log(`PASS ${cases} fixed fixtures; public app only; no original source required; all 720 recognized-header permutations passed.`);
}
run().catch(e=>{console.error(e);process.exitCode=1;});
