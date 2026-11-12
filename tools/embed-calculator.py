#!/usr/bin/env python3
"""Inline calculator sources, keeping apps/accounting-calculator.html standalone."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'apps/accounting-calculator.html'

def build(text):
    blocks = [
        ('MATH_FORMS_STYLE', (ROOT / 'calculator/math-forms.css').read_text(), 'style', '</head>'),
        ('MATH_FORMS_MARKUP', (ROOT / 'calculator/math-forms.html').read_text(), None, '<!-- GUIDED_MATH_ANCHOR -->'),
        ('MATH_FORMS_SCRIPT', '\n'.join((ROOT / ('calculator/' + name)).read_text() for name in ['math-form-core.js', 'math-forms-ui.js']), 'script', '<!-- OFFLINE_REVIEW_BEGIN -->'),
        ('WORKBENCH_STYLE', (ROOT / 'calculator/workbench.css').read_text(), 'style', '</head>'),
        ('DATE_TOOLS_STYLE', (ROOT / 'calculator/date-tools.css').read_text(), 'style', '</head>'),
        ('NUMBER_POOL_MARKUP', (ROOT / 'calculator/number-pool.html').read_text(), None, '<section id="taxPanel"'),
        ('DATE_TOOLS_MARKUP', (ROOT / 'calculator/date-tools.html').read_text(), None, '<section id="taxPanel"'),
        ('NUMBER_POOL_SCRIPT', '\n'.join((ROOT / ('calculator/' + name)).read_text() for name in ['number-pool.js', 'number-pool-ui.js']), 'script', '<!-- OFFLINE_REVIEW_BEGIN -->'),
        ('DATE_TOOLS_SCRIPT', '\n'.join((ROOT / ('calculator/' + name)).read_text() for name in ['date-tools.js', 'date-tools-ui.js']), 'script', '<!-- OFFLINE_REVIEW_BEGIN -->'),
    ]
    blocks += [('TAX_WORKSPACE_STYLE', (ROOT / 'calculator/tax-workspace.css').read_text(), 'style', '</head>')]
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
    text = re.sub(r'<!-- TAX_WORKSPACE_SCRIPT_BEGIN -->[\s\S]*?<!-- TAX_WORKSPACE_SCRIPT_END -->\n?', '', text)
    start, end = '/* TAX_WORKSPACE_SCRIPT_BEGIN */', '/* TAX_WORKSPACE_SCRIPT_END */'
    contents = '\n'.join((ROOT / ('calculator/' + name)).read_text().strip() for name in ['tax-workspace-core.js', 'tax-workspace-ui.js', 'session-ui.js'])
    assert '</script' not in contents.lower()
    script = start + '\n' + contents + '\n' + end
    if start in text:
        text = re.sub(re.escape(start) + r'[\s\S]*?' + re.escape(end), lambda _: script, text, count=1)
    else:
        assert text.count('/* TAX_WORKSPACE_ANCHOR */') == 1
        text = text.replace('/* TAX_WORKSPACE_ANCHOR */', script + '\n/* TAX_WORKSPACE_ANCHOR */', 1)
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
