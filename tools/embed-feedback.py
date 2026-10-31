"""Embed the reviewed feedback module. Standalone apps have no sibling runtime dependency."""
from pathlib import Path
from html.parser import HTMLParser
import re, json, runpy
ROOT=Path(__file__).resolve().parents[1]
_maps=runpy.run_path(str(ROOT/'feedback/static-block-map.py'))
ID_NAMES=_maps['ID_NAMES']; CLASS_NAMES=_maps['CLASS_NAMES']
NAMES={'view-today':'今日工作','view-calendar':'日曆記事','calendarDrawer':'日曆記事詳情','view-clients':'客戶資料','view-work':'本期工作','view-accounting':'帳款管理','view-templates':'通知模板','view-pdf':'列印與 PDF','view-backup':'資料備份與還原','view-settings':'設定','generalPanel':'一般計算','taxPanel':'稅務計算','insurancePanel':'勞健保與勞退','summary':'分類帳總覽','offset':'沖銷配對','search':'摘要查詢','years':'年度比較','duplicates':'重複檢查','outputSection':'報表匯出','datasetStats':'資料統計','pagePane':'PDF 頁面','searchForm':'查詢條件','navigation':'工具切換'}
KINDS={'header':'頂端操作','nav':'功能選單','aside':'側邊工具','main':'主要工作區','section':'功能區塊','form':'輸入表單','footer':'版本資訊'}
VERSIONS={'vat-workbench':'2.11.1-review.1','ledger-analyzer':'4.4.1-review.1','accounting-calculator':'1.2.0','pdf-workbench':'0.12.2-review.1'}
class Tags(HTMLParser):
 def __init__(self, text, app):
  super().__init__(convert_charrefs=False);self.text=text;self.app=app;self.insertions=[];self.n=0;self.class_counts={}
  self.starts=[0]
  for m in re.finditer('\n',text):self.starts.append(m.end())
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  extra=None
  if tag=='div':
   extra=ID_NAMES.get(self.app,{}).get(a.get('id'))
   for cls in a.get('class','').split():
    choices=CLASS_NAMES.get(self.app,{}).get(cls)
    if choices:
     occurrence=self.class_counts.get(cls,0);self.class_counts[cls]=occurrence+1
     if not extra and occurrence<len(choices):extra=choices[occurrence];extra_id=cls+'-'+str(occurrence+1)
   if not extra:return
  elif tag=='dialog':
   extra=ID_NAMES.get(self.app,{}).get(a.get('id')) or '操作視窗'
  elif tag not in KINDS:return
  if 'data-review-id' in a:return
  self.n+=1
  identifier=a.get('id') or (extra_id if tag=='div' else tag+'-'+str(self.n))
  name=extra or NAMES.get(identifier, KINDS[tag]+' '+str(self.n))
  pos=self.starts[self.getpos()[0]-1]+self.getpos()[1]
  raw=self.get_starttag_text(); end=pos+len(raw)-1
  self.insertions.append((end,' data-review-id="'+self.app+'-'+identifier+'" data-review-name="'+name+'"'))
module=(ROOT/'feedback/offline-review.js').read_text()
assert '</script' not in module.lower()
for app, version in VERSIONS.items():
 p=ROOT/'apps'/f'{app}.html'; text=p.read_text()
 text=re.sub(r'\n*<!-- OFFLINE_REVIEW_BEGIN -->.*?<!-- OFFLINE_REVIEW_END -->\n?', '\n', text,flags=re.S)
 parser=Tags(text,app);parser.feed(text)
 for pos, val in reversed(parser.insertions):text=text[:pos]+val+text[pos:]
 config=json.dumps({'appId':app,'appVersion':version},ensure_ascii=False)
 snippet='\n<!-- OFFLINE_REVIEW_BEGIN -->\n<script>window.OFFLINE_REVIEW_CONFIG='+config+';</script>\n<script>\n'+module+'\n</script>\n<!-- OFFLINE_REVIEW_END -->\n'
 matches=list(re.finditer(r'</body>',text,re.I))
 end=matches[-1].start() if matches else -1
 assert end>=0 and re.fullmatch(r'</body>\s*</html>\s*', text[end:],flags=re.I)
 text=text[:end]+snippet+text[end:]
 p.write_text(text)
 print(app, 'embedded;',len(parser.insertions),'new block IDs')
