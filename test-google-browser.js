const assert = require('assert/strict');
const { runResponse } = require('./test-search.js');
const fs = require('fs');
function playwrightRuntime() {
  try { return require('playwright'); } catch (_) {
    return require('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  }
}
const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDAAAAABJRU5ErkJggg==';
const imageURL = 'data:image/png;base64,' + pixel;
function html(content, script = '') {
  return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fixture</title><style>body{margin:0}main{min-height:2400px}a,button{display:block;height:44px}</style></head><body><main id="main"><div id="search"><div id="rso"><h3>Result</h3><img id="original-thumb" width="16" height="16"></div></div></main>' + content + '<script>window.fixtureDCL=false;document.addEventListener("DOMContentLoaded",function(){window.fixtureDCL=true;document.getElementById("original-thumb").src=' + JSON.stringify(imageURL) + ';});' + script + '</script></body></html>';
}
function patch(body, url) {
  return runResponse({status:200, headers:{'Content-Type':'text/html'}, body}, url).body || body;
}
async function runBrowserTests() {
  const browser = await playwrightRuntime().webkit.launch({headless:true});
  const cases = [];
  async function fixture(url, source, {assetDelay=0, nextSource} = {}) {
    const context = await browser.newContext({viewport:{width:390,height:700},isMobile:true,hasTouch:true});
    const requested = [];
    const page = await context.newPage();
    await page.route('**/*', async route => {
      const req = route.request(); const u = req.url(); requested.push(u);
      if (u.startsWith('https://limbopro.com/')) {
        if(assetDelay) await new Promise(resolve=>setTimeout(resolve,assetDelay));
        const name = u.split('/').pop();
        return route.fulfill({contentType:'text/javascript',body:'window.cleanupOrder=(window.cleanupOrder||[]);window.cleanupOrder.push('+JSON.stringify(name)+');window.addEventListener("load",function(){window.cleanupLoadHooks=(window.cleanupLoadHooks||0)+1;});'}).catch(()=>{});
      }
      if (req.isNavigationRequest()) {
        const document = u === url ? source : (nextSource || html('<p>Next page complete</p>'));
        return route.fulfill({contentType:'text/html',body:patch(document,u)});
      }
      return route.abort();
    });
    await page.goto(url,{waitUntil:'domcontentloaded'});
    return {page,context,requested};
  }
  async function scroll(page, y, gesture=true) {
    await page.evaluate(({y,gesture})=>{
      if(gesture)window.dispatchEvent(new Event('touchstart'));
      window.scrollTo(0,y);
    },{y,gesture});
  }
  async function bottom(page,gesture=true) {await scroll(page,await page.evaluate(()=>document.documentElement.scrollHeight),gesture);}
  try {
    {
      const f = await fixture('https://www.google.com/search?q=fixture',html(''),{assetDelay:1500});
      assert(await f.page.evaluate(()=>window.fixtureDCL));
      assert.equal(await f.page.evaluate(()=>window.cleanupOrder),undefined,'Google DOMContentLoaded proceeds before cleanup scripts finish');
      assert.equal(await f.page.locator('#original-thumb').getAttribute('src'),imageURL);
      await f.page.waitForFunction(()=>document.getElementById('original-thumb').naturalWidth > 0);
      await f.page.waitForLoadState('load');
      assert.deepEqual(await f.page.evaluate(()=>window.cleanupOrder),['Adblock4limbo.user.js','Adblock4limbo.function.js','elementBlocker.user.js']);
      assert.equal(await f.page.evaluate(()=>window.cleanupLoadHooks),3,'Original cleanup window.load hooks remain active');
      assert(!f.requested.some(u=>u.includes('autoAdDetector')));
      cases.push('Google DOMContentLoaded/image initializer runs before delayed cleanup; cleanup order and load hooks retained');
      await f.context.close();
    }
    {
      const content='<div id="botstuff"><button id="more">顯示更多搜尋結果</button></div>';
      const script='window.nativeClicks=0;document.getElementById("more").onclick=function(){window.nativeClicks++;setTimeout(function(){document.getElementById("rso").insertAdjacentHTML("beforeend",\'<h3>Native next result</h3><img id="next-thumb" src="'+imageURL+'">\');document.getElementById("main").style.minHeight="4800px";},4500);};';
      const f=await fixture('https://www.google.com/search?q=fixture',html(content,script));
      await bottom(f.page,false);
      await f.page.waitForTimeout(100);
      assert.equal(await f.page.evaluate(()=>window.nativeClicks),0,'Restored scrolling cannot automatically click');
      await scroll(f.page,1300);
      await f.page.waitForFunction(()=>window.nativeClicks===1);
      await f.page.waitForTimeout(4000);
      assert.equal(await f.page.evaluate(()=>window.nativeClicks),1,'No duplicate click while a >3.8 second request is pending');
      await f.page.waitForSelector('#next-thumb');
      assert.equal(await f.page.locator('#next-thumb').getAttribute('src'),imageURL);
      await f.page.waitForTimeout(700);
      await bottom(f.page);
      await f.page.waitForFunction(()=>window.nativeClicks===2);
      cases.push('Traditional Chinese native More loads one screen early, single-flight; 4.5s response and native video thumbnail survive; paging continues');
      await f.context.close();
    }
    const providers=[
      {label:'Google',url:'https://www.google.com/search?q=fixture',link:'<a id="pnnext" href="/search?q=fixture&start=10">Next page</a>',expected:'https://www.google.com/search?q=fixture&start=10'},
      {label:'Bing',url:'https://cn.bing.com/search?q=fixture',link:'<div id="b_results"><div class="b_pag"><a href="/search?q=fixture&first=1">1</a><a class="sb_pagN" href="https://www.bing.com/search?q=fixture&first=11">下一页</a></div></div>',expected:'https://www.bing.com/search?q=fixture&first=11'},
      {label:'Baidu mobile next link observed in public HTML',url:'https://www.baidu.com/s?wd=fixture',link:'<a class="new-nextpage-only" href="https://m.baidu.com/from=844b/ssid=0/s?pn=10&word=fixture&sa=np">&nbsp;</a>',expected:'https://m.baidu.com/from=844b/ssid=0/s?pn=10&word=fixture&sa=np'}
    ];
    for(const test of providers){
      const f=await fixture(test.url,html(test.link));
      await scroll(f.page,1300);
      await f.page.waitForTimeout(150);
      assert.equal(f.page.url(),test.url,'Full navigation must not skip the last screen');
      await bottom(f.page);
      await f.page.waitForURL(test.expected,{waitUntil:'domcontentloaded'});
      assert.equal(await f.page.locator('#original-thumb').getAttribute('src'),imageURL,'Destination original initializer executes');
      cases.push(test.label+': navigates only at actual bottom and initializes destination thumbnails');
      await f.context.close();
    }
    {
      const f=await fixture('https://www.google.com/search?q=fixture&udm=7',html('<a id="pnnext" href="/search?q=fixture&start=10&udm=2">Next page</a>'));
      await bottom(f.page);await f.page.waitForTimeout(200);
      assert.equal(f.page.url(),'https://www.google.com/search?q=fixture&udm=7','Do not cross Google search modes');
      cases.push('Rejects mismatched search mode; no navigation/retry');await f.context.close();
    }
    {
      const f=await fixture('https://www.google.com/search?q=fixture&udm=2',html('<a id="pnnext" href="/search?q=fixture&start=10&udm=2">Next page</a>'));
      assert.equal(await f.page.evaluate(()=>window.__surgeGoogleNativePaging),undefined);
      cases.push('Image Search stays under native Google control');await f.context.close();
    }
    return {engine:'Playwright WebKit',passed:true,cases};
  } finally {await browser.close();}
}
module.exports={runBrowserTests};
if(require.main===module)runBrowserTests().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e);process.exitCode=1;});
