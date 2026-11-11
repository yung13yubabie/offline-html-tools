const assert=require('node:assert/strict');
module.exports=async function(p,{screenshot}){
 await p.locator('.nav-btn[data-view="work"]').click();await p.locator('.vat-client-facts214').waitFor();
 assert.equal(await p.locator('.vat-client-facts214 dt').count(),4);
 assert.match(await p.locator('.vat-client-facts214').innerText(),/本期地址/);assert.match(await p.locator('.vat-client-facts214').innerText(),/本期記帳費/);assert.match(await p.locator('.vat-client-facts214').innerText(),/客戶庫預設記帳費/);
 assert.equal(await p.locator('.vat-client-heading214 h2').count(),1);
 const contrasts=()=>p.locator('.vat-client-facts214 dd').evaluateAll(es=>{
  const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number),lum=v=>{const a=v.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return a[0]*.2126+a[1]*.7152+a[2]*.0722};
  return es.map(e=>{let node=e,bg;while(node){bg=rgb(getComputedStyle(node).backgroundColor);if(bg.length>=3&&(bg.length<4||bg[3]>=.99))break;node=node.parentElement}const c=lum(rgb(getComputedStyle(e).color)),b=lum(bg);return(Math.max(c,b)+.05)/(Math.min(c,b)+.05)});
 });
 for(const theme of ['light','dark']){
  await p.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme);
  assert((await contrasts()).every(x=>x>=4.5),'Customer facts need readable contrast in '+theme);
  for(const width of [375,768,1024,1440]){
   await p.setViewportSize({width,height:1000});await p.locator('.nav-btn[data-view="work"]').click();
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow '+theme+' '+width);
   const facts=p.locator('.vat-client-facts214 dd');assert(await facts.evaluateAll((es,width)=>es.every(e=>parseFloat(getComputedStyle(e).fontSize)>=(width<600?16:14)),width),'Readable fact values '+width);
   const labels=await p.locator('.vat-client-facts214 dt').allTextContents();assert.equal(new Set(labels).size,4);
   if(width===375||width===1440)await screenshot(p,'vat214-work-'+theme+'-'+width);
  }
 }
 await p.evaluate(()=>document.documentElement.dataset.theme='light');await p.setViewportSize({width:375,height:844});
 for(const view of ['today','calendar','clients','work','accounting','templates','pdf','backup','settings']){
  await p.locator(`.nav-btn[data-view="${view}"]`).click();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No document overflow in '+view);if(view==='clients'||view==='templates')await screenshot(p,'vat214-'+view+'-375');
 }
 await p.emulateMedia({reducedMotion:'reduce'});assert(await p.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches));await p.locator('.nav-btn[data-view="work"]').click();assert(await p.locator('.vat-client-facts214').isVisible());
 await p.emulateMedia({reducedMotion:'no-preference'});await p.setViewportSize({width:1440,height:1000});
};
