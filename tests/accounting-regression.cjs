// Synthetic tests against functions extracted from the delivered single-file app.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../apps/accounting-calculator.html'),'utf8');
function extract(name){const start=source.indexOf('function '+name+'(');assert(start>=0,name);let i=source.indexOf('{',start),depth=1,quote=null,escape=false;for(let j=i+1;j<source.length;j++){const c=source[j];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;continue}if(c==='"'||c==="'"||c==='`'){quote=c;continue}if(c==='{')depth++;if(c==='}'&&--depth===0)return source.slice(start,j+1)}throw Error(name)}
const ctx={};vm.createContext(ctx);for(const n of ['tokenize','evaluateExpression','healthBillAmounts','validEmployerPensionRate'])vm.runInContext(extract(n),ctx);
let count=0;function eq(a,b){assert.deepStrictEqual(a,b);count++}
for(const [expr,value] of [['2+3*4',14],['(2+3)*4',20],['10-3-2',5],['24/4/2',3],['-2*3+4',-2],['2*-3',-6],['-(2+3)*4',-20],['2+3*4-8/2',10],['100+10%',110],['100-10%',90],['200*10%',20],['10%',.1],['100+10%*2',100.2]])eq(ctx.evaluateExpression(expr),value);
for(const expr of ['1/0','2+','(2+3','2x3']){assert.throws(()=>ctx.evaluateExpression(expr));count++}
eq(ctx.healthBillAmounts('18,915','').company,null);eq(ctx.healthBillAmounts('18,915','10,589').company,10589);eq(ctx.healthBillAmounts('18,915','10,589').employee,8326);
for(const [t,e] of [['10','11'],['-1','0'],['10','bad'],['','0'],['Infinity','0']])eq(ctx.healthBillAmounts(t,e).company,null);
eq(ctx.healthBillAmounts('0','0').company,0);eq(ctx.healthBillAmounts('10.50','4.25').employee,6.25);
for(const x of ['0','5.9','','bad','Infinity','-1'])eq(ctx.validEmployerPensionRate(x),false);for(const x of ['6','6.5','10'])eq(ctx.validEmployerPensionRate(x),true);
// Verify the unchanged monthly NHI expressions against official examples, independently expected values.
assert(source.includes('round0(health.amount*.0517*.30)'));assert(source.includes('perPerson*(1+dependents)'));assert(source.includes('round0(health.amount*.0517*.60*1.56)'));
eq(Math.round(53000*.0517*.30)*3,2466);eq(Math.round(53000*.0517*.60*1.56),2565);eq(Math.round(29500*.0517*.30),458);eq(Math.round(29500*.0517*.60*1.56),1428);
assert(!source.includes('ratio:60/90'));assert(!source.includes('66.6667%'));assert(source.includes('pensionRateValid?fmt(pensionCompany):"—"'));
console.log(JSON.stringify({passed:count,scope:'function-level synthetic arithmetic and insurance tests; not browser UI'}));
