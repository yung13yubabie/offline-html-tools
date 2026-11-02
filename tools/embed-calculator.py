#!/usr/bin/env python3
"""Inline calculator sources, keeping apps/accounting-calculator.html standalone."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'apps/accounting-calculator.html'

def build(text):
    blocks = [
        ('WORKBENCH_STYLE', (ROOT / 'calculator/workbench.css').read_text(), 'style', '</head>'),
        ('NUMBER_POOL_MARKUP', (ROOT / 'calculator/number-pool.html').read_text(), None, '<section id="taxPanel"'),
        ('NUMBER_POOL_SCRIPT', '\n'.join((ROOT / ('calculator/' + name)).read_text() for name in ['number-pool.js', 'number-pool-ui.js']), 'script', '<!-- OFFLINE_REVIEW_BEGIN -->'),
    ]
    for name, contents, tag, before in blocks:
        start, end = '<!-- ' + name + '_BEGIN -->', '<!-- ' + name + '_END -->'
        body = ('<' + tag + '>\n' + contents.rstrip() + '\n</' + tag + '>') if tag else contents.rstrip()
        replacement = start + '\n' + body + '\n' + end + '\n'
        if start in text:
            text, count = re.subn(re.escape(start) + r'.*?' + re.escape(end) + r'\n?', lambda _: replacement, text, flags=re.S)
            assert count == 1, name
        else:
            assert text.count(before) == 1, name
            text = text.replace(before, replacement + before, 1)
    return text

current = APP.read_text()
updated = build(current)
if '--check' in sys.argv:
    if current != updated:
        sys.exit('Calculator embeds are out of date. Run python3 tools/embed-calculator.py')
    print('Calculator sources match the standalone HTML.')
else:
    APP.write_text(updated)
    print('Updated apps/accounting-calculator.html')
