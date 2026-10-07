#!/usr/bin/env python3
"""Real-browser acceptance test. Owns and cleans up its local server and browsers."""
# Copyright 2026 adybag14-cyber
# SPDX-License-Identifier: Apache-2.0
import argparse
import functools
import http.server
import json
import os
from pathlib import Path
import subprocess
import threading
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'artifacts'
ARTIFACTS.mkdir(exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument('--url', help='Run against the deployed site instead of starting a local server.')
parser.add_argument('--browser', choices=['chromium', 'firefox', 'webkit'], default='chromium')
parser.add_argument('--headed', action='store_true')
args = parser.parse_args()
checks = []
def check(ok, name):
    if not ok:
        raise AssertionError(name)
    checks.append(name)

def native(text, seed='1', synonyms=True, arrange=True, protect=True):
    binary = next((Path(x) for x in [os.environ.get('SYNOMIZER_BIN', ''), ROOT/'build/synomizer', ROOT/'build/synomizer.exe', ROOT/'build/Release/synomizer.exe'] if x and Path(x).is_file()), None)
    if binary is None:
        raise RuntimeError('Build the C++ CLI, or set SYNOMIZER_BIN.')
    options = [str(binary.resolve()), '--json', '--seed', seed]
    if not synonyms: options.append('--no-synonyms')
    if not arrange: options.append('--no-arrange')
    if not protect: options.append('--vary-quotes')
    run = subprocess.run(options, input=text.encode('utf-8'), capture_output=True, timeout=30, check=True)
    return json.loads(run.stdout)

def settled(page):
    page.wait_for_function("/seed [0-9]+$/.test(document.querySelector('#status').textContent) && !document.querySelector('#output').hasAttribute('aria-busy')", timeout=60000)

def fill(page, text):
    page.locator('#source').fill(text)
    settled(page)
    return page.locator('#output').text_content()

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_): pass

server = None
if args.url:
    base = args.url.rstrip('/')+'/'
else:
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}/site/'

try:
    with sync_playwright() as pw:
        browser = getattr(pw, args.browser).launch(headless=not args.headed)
        context = browser.new_context(viewport={'width':1280,'height':900}, color_scheme='light', accept_downloads=True)
        context.tracing.start(screenshots=True,snapshots=True,sources=True)
        errors, failed, external = [], [], []
        context.on('requestfailed', lambda request: failed.append(request.url))
        context.on('request', lambda request: external.append(request.url) if urlparse(request.url).scheme in ['http','https'] and urlparse(request.url).netloc != urlparse(base).netloc else None)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            response = page.goto(base, wait_until='networkidle')
            check(response.status == 200, 'site is served under a project subpath')
            settled(page)
            original = page.locator('#source').input_value()
            baseline = page.locator('#output').text_content()
            reference = native(original)
            check(baseline == reference['text'], 'initial browser output equals the C++ binary')
            check(baseline != original, 'sample receives a real rewrite')
            check(page.locator('#output mark').count() > 0, 'rewritten text is highlighted')
            check(page.locator('#changes li').count() == len(reference['changes']), 'full sample ledger is rendered')
            check(not page.locator('#banner').is_visible(), 'initial load has no error')
            page.screenshot(path=str(ARTIFACTS/f'{args.browser}-desktop-light.png'), full_page=True)
            for width in [320,375,640,800,1280]:
                page.set_viewport_size({'width':width,'height':900})
                check(page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'no horizontal overflow at {width}px')
                check(page.locator('#source').is_visible() and page.locator('#rewrite').is_visible(), f'editor controls visible at {width}px')
                if width == 375: page.screenshot(path=str(ARTIFACTS/f'{args.browser}-mobile.png'), full_page=True)
            page.emulate_media(color_scheme='dark')
            page.screenshot(path=str(ARTIFACTS/f'{args.browser}-desktop-dark.png'), full_page=True)
            page.emulate_media(color_scheme='light')
            page.locator('#next').click();settled(page)
            check(page.locator('#seed').input_value() == '2', 'next variation increments the seed')
            check(page.locator('#output').text_content() == native(original,'2')['text'], 'variation matches the native seed')
            page.locator('#reset').click();settled(page)
            check(page.locator('#output').text_content() == baseline, 'sample reset is deterministic')
            page.locator('#seed').fill('18446744073709551615');settled(page)
            check(page.locator('#output').text_content() == native(original,'18446744073709551615')['text'], '64-bit seed has no floating-point rounding')
            page.locator('#next').click();settled(page)
            check(page.locator('#seed').input_value() == '0', 'next variation wraps at uint64 maximum')
            page.locator('#seed').fill('12x')
            expect(page.locator('#banner')).to_be_visible()
            check(page.locator('#copy').is_disabled() and page.locator('#download').is_disabled(), 'invalid options cannot export stale text')
            check(page.locator('#output').text_content() == '', 'invalid options clear stale output')
            page.locator('#reset').click();settled(page)
            page.locator('#synonyms').uncheck();page.locator('#arrange').uncheck();settled(page)
            literal='<img src=x onerror="window.synXss=1"> & <script>window.synXss=1</script>\nThe happy child.'
            check(fill(page,literal) == literal, 'both passes off is an exact text roundtrip')
            check(page.locator('#output img, #output script').count() == 0, 'untrusted text does not become HTML')
            check(page.evaluate('window.synXss === undefined'), 'text cannot execute script')
            page.locator('#reset').click();settled(page)
            protected='She said \u201chappy. happy.\u201d Visit https://happy.example/car and happy@example.com. `happy child`'
            result=fill(page,protected)
            for phrase in ['\u201chappy. happy.\u201d','https://happy.example/car','happy@example.com','`happy child`']:
                check(phrase in result, 'protected span: '+phrase)
            check(result == native(protected)['text'], 'protection matches the C++ engine')
            page.locator('#quotes').uncheck();settled(page)
            check('\u201chappy. happy.\u201d' not in page.locator('#output').text_content(), 'quotation changes require explicit opt-in')
            page.locator('#reset').click();settled(page)
            imported='The happy child purchased a car.\nBecause the road was icy, the bus arrived late.'
            page.locator('#file').set_input_files({'name':'sample.txt','mimeType':'text/plain','buffer':imported.encode()})
            settled(page)
            expect(page.locator('#source')).to_have_value(imported)
            check(page.locator('#output').text_content() == native(imported)['text'], 'UTF-8 file import matches native output')
            with page.expect_download() as capture:
                page.locator('#download').click()
            download=capture.value
            out=ARTIFACTS/f'{args.browser}-download.txt';download.save_as(str(out))
            check(out.read_text(encoding='utf-8') == native(imported)['text'], 'downloaded TXT contains only the current rewrite')
            with page.expect_download() as capture:
                page.locator('#download-ledger').click()
            out=ARTIFACTS/f'{args.browser}-ledger.json';capture.value.save_as(str(out));ledger=json.loads(out.read_text(encoding='utf-8'))
            check(ledger['changes'] == native(imported)['changes'] and ledger['source']==imported, 'downloaded JSON contains a complete auditable ledger')
            if args.browser == 'chromium':
                context.grant_permissions(['clipboard-read','clipboard-write'])
                page.locator('#copy').click()
                expect(page.locator('#status')).to_have_text('Copied the rewrite.')
                clipboard = page.evaluate('navigator.clipboard.readText()')
                # Windows clipboard serialises LF as CRLF; preserve every other character.
                check(clipboard.replace('\r\n','\n') == ledger['text'], 'clipboard contains current output with platform line endings')
            page.locator('#file').set_input_files({'name':'bad.txt','mimeType':'text/plain','buffer':bytes([255])})
            expect(page.locator('#banner')).to_contain_text('not valid UTF-8')
            check(page.locator('#download').is_disabled(), 'invalid-encoding files cannot export stale output')
            page.locator('#file').set_input_files({'name':'huge.txt','mimeType':'text/plain','buffer':b'x'*1048577})
            expect(page.locator('#banner')).to_contain_text('1 MiB')
            check(page.locator('#copy').is_disabled(), 'oversized files are rejected before rewriting')
            page.locator('#reset').click();settled(page)
            context.set_offline(True)
            offline='The happy child bought a car.'
            check(fill(page,offline)==native(offline)['text'], 'loaded editor rewrites without a network connection')
            context.set_offline(False)
            long_text='The happy child purchased a car. '*3000
            result=fill(page,long_text)
            check(result==native(long_text)['text'], '18,000-word document matches native output')
            check(page.locator('#changes li').count()==200, 'long change ledgers are bounded in the DOM')
            check('first 200' in page.locator('#ledger-note').text_content(), 'ledger truncation is clearly labelled')
            with page.expect_download() as capture:
                page.locator('#download-ledger').click()
            out=ARTIFACTS/f'{args.browser}-long-ledger.json';capture.value.save_as(str(out))
            check(len(json.loads(out.read_text(encoding='utf-8'))['changes'])>200, 'long ledger export retains all changes')
            # An old in-flight result must not overwrite a newer edit.
            page.locator('#source').fill(long_text+' Extra.')
            page.locator('#rewrite').click()
            final='The careful teacher helped the happy child.'
            check(fill(page,final)==native(final)['text'], 'latest edit wins over an in-flight long rewrite')
            page.locator('#clear').click();settled(page)
            check(page.locator('#source').input_value()=='' and page.locator('#output').text_content()=='', 'clear empties both editors')
            check(page.locator('#copy').is_disabled(), 'empty output cannot be copied')
            page.locator('#reset').click();settled(page)
            check(not errors, 'no uncaught browser errors: '+str(errors))
            check(not failed, 'no failed first-party requests: '+str(failed))
            check(not external, 'no third-party requests: '+str(external))
            # A separate context intentionally fails a resource load, then exercises retry.
            failure=browser.new_context()
            failure.route('**/data/lexicon.tsv',lambda route:route.fulfill(status=503,body='Unavailable'))
            failed_page=failure.new_page();failed_page.goto(base)
            expect(failed_page.locator('#banner')).to_contain_text('Could not load',timeout=30000)
            check(failed_page.locator('#copy').is_disabled(), 'resource failure disables exports')
            expect(failed_page.locator('#retry')).to_be_visible()
            failed_page.locator('#rewrite').click()
            check(failed_page.locator('#retry').is_visible(), 'rewrite does not hide recovery controls after a load failure')
            failure.unroute('**/data/lexicon.tsv')
            failed_page.locator('#retry').click();settled(failed_page)
            check(failed_page.locator('#output').text_content()==baseline, 'resource retry recovers without reloading the page')
            failure.close()
        except Exception:
            page.screenshot(path=str(ARTIFACTS/f'{args.browser}-failure.png'), full_page=True)
            raise
        finally:
            context.tracing.stop(path=str(ARTIFACTS/f'{args.browser}-trace.zip'))
            context.close();browser.close()
    report={'browser':args.browser,'url':base,'checks':len(checks),'passed':checks}
    (ARTIFACTS/f'{args.browser}-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'browser':args.browser,'passed':len(checks),'url':base}))
finally:
    if server:
        server.shutdown();server.server_close()
