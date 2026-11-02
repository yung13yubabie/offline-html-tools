/* Exact, dependency-free number pool. Inline the factory for the app and Blob Worker. */
function createNumberPoolEngine() {
  'use strict';
  const SCALE = 10000;
  const MAX_VALUE = 1000000000 * SCALE;
  const limits = Object.freeze({add:32, subtract:28, mixed:20});

  function parseNumber(input) {
    let text = String(input ?? '').trim().replace(/[０-９]/g, c => String(c.charCodeAt(0)-0xff10)).replace(/−/g, '-');
    if (!text) throw new Error('請填入數字。');
    if (text.length > 80) throw new Error('數字過長。');
    if (/,/.test(text)) {
      if (!/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d{0,4})?$/.test(text)) throw new Error('千分位格式不正確；請使用 1,234.56。');
      text = text.replace(/,/g, '');
    }
    if (/^[+-]?(?:\d+)?\.\d{5,}$/.test(text)) throw new Error('最多支援小數點後 4 位，請先自行確認要使用的精度。');
    if (!/^[+-]?(?:\d+(?:\.\d{0,4})?|\.\d{1,4})$/.test(text)) throw new Error('請輸入一般十進位數字，可含負號與最多 4 位小數。');
    const negative = text[0] === '-';
    const unsigned = text.replace(/^[+-]/, '');
    const [whole, fraction=''] = unsigned.split('.');
    const value = Number(whole || '0') * SCALE + Number(fraction.padEnd(4, '0'));
    if (!Number.isSafeInteger(value) || value > MAX_VALUE) throw new Error('每個數字與目標的絕對值最多為 1,000,000,000。');
    return value === 0 ? 0 : negative ? -value : value;
  }

  function format(value) {
    if (!Number.isSafeInteger(value)) throw new Error('無法顯示不安全的數值。');
    const abs = Math.abs(value), whole = Math.floor(abs / SCALE);
    const fraction = String(abs % SCALE).padStart(4, '0').replace(/0+$/, '');
    return (value < 0 ? '−' : '') + String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? '.'+fraction : '');
  }

  function parseLines(input, delimiter='') {
    const text = String(input ?? '').replace(/^\uFEFF/, '');
    const separator = delimiter === '\\t' ? '\t' : String(delimiter ?? '');
    const items = [], errors = [];
    if (text.length > 200000) return {items, errors:[{line:0,message:'貼上內容最多 200,000 個字元。'}]};
    if (separator.length > 20 || /[\r\n]/.test(separator)) return {items,errors:[{line:0,message:'分隔符號最多 20 個字元，且不能含換行。'}]};
    const lines = text.split(/\r\n|\n|\r/);
    if (lines.length > 1000) return {items,errors:[{line:0,message:'貼上內容最多 1,000 行。'}]};
    lines.forEach((raw, index) => {
      if (!raw.trim()) return;
      const line = index + 1;
      if (raw.length > 2000) {errors.push({line,message:'每行最多 2,000 個字元。'});return;}
      // A number-only row is valid even when a separator has been selected.
      try {items.push({id:'line-'+line,name:'',value:parseNumber(raw),line});return;} catch (wholeError) {
        if (!separator) {errors.push({line,message:wholeError.message});return;}
      }
      let split = raw.indexOf(separator), found = false;
      let message = '找不到有效的「名稱'+separator+'數字」；請確認分隔符號與右側數字。';
      // The earliest valid numeric suffix preserves delimiters inside names, signs and thousands.
      while (split !== -1) {
        try {
          const value = parseNumber(raw.slice(split + separator.length));
          items.push({id:'line-'+line,name:raw.slice(0,split),value,line});found=true;break;
        } catch (error) {message = error.message;}
        split = raw.indexOf(separator, split + separator.length);
      }
      if (!found) errors.push({line,message});
    });
    return {items,errors};
  }

  function enumerate(values, mode) {
    const zero = [{sum:0,count:0,code:0}], one = [];
    let power = 1;
    values.forEach(value => {
      const length = zero.length, oneLength = one.length;
      if (mode === 'subtract') {
        for (let i=0;i<oneLength;i++) {const s=one[i];one.push({sum:s.sum-value,count:s.count+1,code:s.code+2*power});}
        for (let i=0;i<length;i++) {
          const s=zero[i];
          one.push({sum:s.sum+value,count:s.count+1,code:s.code+power});
          zero.push({sum:s.sum-value,count:s.count+1,code:s.code+2*power});
        }
      } else {
        for (let i=0;i<length;i++) {
          const s=zero[i];
          zero.push({sum:s.sum+value,count:s.count+1,code:s.code+power});
          if (mode==='mixed') zero.push({sum:s.sum-value,count:s.count+1,code:s.code+2*power});
        }
      }
      power *= mode==='add' ? 2 : 3;
    });
    return {zero,one};
  }

  function groupStates(states) {
    states.sort((a,b)=>a.sum-b.sum || a.count-b.count || a.code-b.code);
    const groups=[];
    states.forEach((state,index)=>{
      if (!groups.length || groups[groups.length-1].sum!==state.sum) groups.push({sum:state.sum,start:index,end:index+1});
      else groups[groups.length-1].end=index+1;
    });
    return {states,groups};
  }

  function solve(options) {
    if (!options || !Array.isArray(options.items)) throw new Error('請提供數字清單。');
    const {items,target,mode='add',tolerance=Infinity,limit=100} = options;
    if (!Object.hasOwn(limits,mode)) throw new Error('請選擇加法、減法或加減混合模式。');
    if (!items.length) throw new Error('請先加入至少一筆數字。');
    if (items.length > limits[mode]) throw new Error((mode==='add'?'加法':mode==='subtract'?'減法':'加減混合')+'模式最多 '+limits[mode]+' 筆；請先縮小數字池。');
    if (!Number.isSafeInteger(target) || Math.abs(target)>MAX_VALUE) throw new Error('目標數字超出範圍或精度不正確。');
    if (tolerance!==Infinity && (!Number.isSafeInteger(tolerance) || tolerance<0 || tolerance>MAX_VALUE)) throw new Error('容許差額須為 0 至 1,000,000,000；空白可搜尋所有差額。');
    if (!Number.isInteger(limit) || limit<1 || limit>1000) throw new Error('顯示上限須為 1 至 1,000 組。');
    const values=items.map((item,index)=>{
      if (!item || !Number.isSafeInteger(item.value) || Math.abs(item.value)>MAX_VALUE) throw new Error('第 '+(index+1)+' 筆數字超出範圍或精度不正確。');
      return item.value;
    });
    const split=Math.floor(values.length/2), base=mode==='add'?2:3, factor=base**split;
    const left=enumerate(values.slice(0,split),mode),right=enumerate(values.slice(split),mode);
    const streams=mode==='subtract' ? [[left.zero,groupStates(right.one)],[left.one,groupStates(right.zero)]] : [[left.zero,groupStates(right.zero)]];
    const heap=[];
    function compare(a,b){return a.distance-b.distance || a.count-b.count || a.code-b.code;}
    function push(node){let i=heap.length;heap.push(node);while(i){const p=(i-1)>>1;if(compare(heap[p],node)<=0)break;heap[i]=heap[p];i=p;}heap[i]=node;}
    function pop(){const root=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&compare(heap[c+1],heap[c])<0)c++;if(compare(last,heap[c])<=0)break;heap[i]=heap[c];i=c;}heap[i]=last;}return root;}
    function candidate(s, g, direction, member) {
      const group=s.right.groups[g];if(!group)return;
      const r=s.right.states[member ?? group.start],total=s.left.sum+r.sum,distance=Math.abs(total-target);
      if (distance>tolerance)return;
      push({stream:s,group:g,direction,member:member ?? group.start,total,distance,count:s.left.count+r.count,code:s.left.code+r.code*factor});
    }
    streams.forEach(([states,rightData])=>states.forEach(l=>{
      if(!rightData.groups.length)return;
      let low=0,high=rightData.groups.length;const wanted=target-l.sum;
      while(low<high){const middle=(low+high)>>1;if(rightData.groups[middle].sum<wanted)low=middle+1;else high=middle;}
      const stream={left:l,right:rightData};candidate(stream,low,1);candidate(stream,low-1,-1);
    }));
    const solutions=[];let examined=0,truncated=false;
    while(heap.length){
      const n=pop(),g=n.stream.right.groups[n.group];examined++;
      if(n.member===g.start)candidate(n.stream,n.group+n.direction,n.direction);
      if(n.member+1<g.end)candidate(n.stream,n.group,n.direction,n.member+1);
      if(n.count===0)continue;
      if(solutions.length===limit){truncated=true;break;}
      const terms=[];let code=n.code;
      for(let index=0;index<values.length;index++){const digit=code%base;code=Math.floor(code/base);if(digit)terms.push({index,sign:digit===1?1:-1});}
      solutions.push({terms,total:n.total,difference:n.total-target});
    }
    return {solutions,truncated,complete:!truncated,totalMatches:truncated?null:solutions.length,limit,mode,tolerance,examined,poolSize:items.length};
  }
  return Object.freeze({SCALE,MAX_VALUE,limits,parseNumber,parseLines,format,solve});
}
const NumberPoolEngine = createNumberPoolEngine();
if (typeof module !== 'undefined' && module.exports) module.exports = {createNumberPoolEngine,NumberPoolEngine};
