"""Run after creating a local esbuild bundle with src/main.tsx as entrypoint.

Requires playwright + Chromium locally. The test uses MOCK responses, not production.
It does not call any live backend or create real user data.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
import os
import base64

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = Path(os.environ.get('REACT_TEST_BUNDLE', '/mnt/data/_react_smoke_dist'))
JS = (BUNDLE / 'main.js').read_text(encoding='utf-8')
CSS = (BUNDLE / 'main.css').read_text(encoding='utf-8')

session = {'data': {'activeRole':'USER','availableRoles':['USER'],'loginId':'tester'}}
request = {'requestId':'fixture-request','symptom':'싱크대 아래에서 물이 새요','status':'OPEN','updatedAt':'2026-11-22T12:00:00+09:00','revision':'req-1','sourceRevision':'source-1','photos':{'confirmedDatePhotos':[],'unknownDatePhotos':[]},'workItems':[{'workItemId':'fixture-work','revision':'work-1','sourceRevision':'source-work-1','status':'OPEN','facts':{'part':'주방','fields':['PLUMBING']},'summary':None,'reviewStatus':'PENDING'}]}

def script():
    """About:blank lacks an origin, so provide a fake base URL and mock fetch."""
    fixture = json.dumps({'auth':session, 'requests':{'data':{'items':[request]}}, 'request':{'data':request}}, ensure_ascii=False)
    return '''<script>
      const originalURL=window.URL;
      window.URL=class URL extends originalURL {constructor(value,base){super(value,base==='null'?'https://fixture.invalid/':base)}};
      const fixture=__FIXTURE__;
      window.fetch=async function(input,options={}) {
        const path=String(input);
        let payload;
        if(path.includes('/auth/me')) payload=fixture.auth;
        else if(path.includes('/requests/fixture-request')) payload=fixture.request;
        else if(path.endsWith('/requests')) payload=fixture.requests;
        else if(path.includes('/public/technicians')) payload={data:{items:[]}};
        else if(path.includes('/reservations')) payload={data:{items:[]}};
        else if(path.includes('/consultations')) payload={data:{items:[]}};
        else if(path.includes('/deletion-jobs')) payload={data:{items:[]}};
        else return new Response(JSON.stringify({message:'해당 테스트 데이터 없음'}),{status:404,headers:{'Content-Type':'application/json'}});
        return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json'}});
      };
    </script>'''.replace('__FIXTURE__',fixture)

def inline_images(page):
    images={}
    for f in (ROOT/'public'/'assets').iterdir():
        if f.suffix.lower() in {'.png','.svg','.jpg','.jpeg','.webp'}:
            mime='image/svg+xml' if f.suffix=='.svg' else ('image/jpeg' if f.suffix in {'.jpg','.jpeg'} else 'image/'+f.suffix[1:])
            images[f.name]=f'data:{mime};base64,'+base64.b64encode(f.read_bytes()).decode()
    page.evaluate('''images=>document.querySelectorAll('img').forEach(el=>{const file=el.getAttribute('src')?.split('/').pop();if(file&&images[file])el.src=images[file]})''',images)

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':900})
    errors=[]
    page.on('pageerror',lambda error: errors.append(str(error)))
    doc='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"/><style>'+CSS+'</style></head><body><div id="app"></div>'+script()+'<script>'+JS+'</script></body></html>'
    page.set_content(doc,wait_until='domcontentloaded')
    page.wait_for_timeout(250)
    assert 'AI 사진 진단 시작' in page.locator('body').inner_text(), 'Home page missing'
    inline_images(page)
    page.screenshot(path=str(BUNDLE/'smoke-home.png'))
    tests=[]
    for tab,expected in [('내 요청','우리 집 수리 내역'),('기사 찾기','수리 전문가'),('예약','방문 일정'),('마이','마이페이지'),('홈','AI 사진 진단 시작')]:
        page.get_by_role('button',name=tab,exact=True).click()
        page.wait_for_timeout(130)
        assert expected in page.locator('body').inner_text(), f'{tab} not rendered'
        tests.append('PASS navigation '+tab)
    page.get_by_role('button',name='기사 찾기',exact=True).click()
    search=page.get_by_role('textbox',name='기사 찾기 검색')
    search.fill('서초구')
    assert search.input_value()=='서초구','Korean input lost focus or text'
    tests.append('PASS Korean search input')
    page.get_by_role('button',name='내 요청',exact=True).click()
    page.wait_for_timeout(150)
    assert '싱크대 아래에서 물이 새요' in page.locator('body').inner_text(), 'API request not rendered'
    tests.append('PASS actual JSX list rendering from fake response')
    assert not errors, f'Uncaught errors: {errors}'
    print('\n'.join(tests))
    print('TOTAL',len(tests),'PASS / Browser fixture only, not live API')
    browser.close()
