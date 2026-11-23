"""Embed VAT sources into the standalone HTML; never add runtime sibling dependencies."""
from pathlib import Path
import argparse,re
ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'apps/vat-workbench.html'
parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
text=APP.read_text()
css='\n'.join((ROOT/'vat'/name).read_text().strip() for name in ['workbench.css','cases.css','record-lists.css','contracts.css','operations.css','leases.css'])
parts=[(ROOT/'vat'/name).read_text().strip() for name in ['period-features.js','group-payments.js','workbench-ui.js','bulk-work-core.js','bulk-modules-ui.js','bulk-work-ui.js','global-ui.js','pdf-direct-editor.js','accounting-links-core.js','invoice-links.js','payment-links.js','cross-period-transactions.js','cross-period-backup.js','accounting-links-ui.js','cases-core.js','lease-core.js','record-lists.js','cases-ui.js','contracts-core.js','contracts-ui.js','cases-integration.js','operations-ui.js','lease-ui.js']]
assert '</style' not in css.lower()
assert all('</script' not in p.lower() for p in parts)
style='<!-- VAT_WORKSPACE_STYLE_START -->\n<style>\n'+css+'\n</style>\n<!-- VAT_WORKSPACE_STYLE_END -->'
script='/* VAT_WORKSPACE_SCRIPT_START */\n'+'\n\n'.join(parts)+'\n/* VAT_WORKSPACE_SCRIPT_END */'
if '<!-- VAT_WORKSPACE_STYLE_START -->' in text:
 text=re.sub(r'<!-- VAT_WORKSPACE_STYLE_START -->[\s\S]*?<!-- VAT_WORKSPACE_STYLE_END -->',lambda _:style,text,count=1)
else:text=text.replace('</head>',style+'\n</head>',1)
if '/* VAT_WORKSPACE_SCRIPT_START */' in text:
 text=re.sub(r'/\* VAT_WORKSPACE_SCRIPT_START \*/[\s\S]*?/\* VAT_WORKSPACE_SCRIPT_END \*/',lambda _:script,text,count=1)
else:
 assert '\nboot();\n' in text
 text=text.replace('\nboot();\n','\n'+script+'\n\nboot();\n',1)
if args.check:
 if text!=APP.read_text():raise SystemExit('VAT sources differ from standalone HTML. Run python3 tools/embed-vat.py.')
 print('VAT sources match the standalone HTML.')
else:APP.write_text(text);print('VAT sources embedded into the standalone HTML.')
