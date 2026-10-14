const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const path = require('path');
const base = __dirname;
const config = fs.readFileSync(path.join(base,'search.confpart'),'utf8');
const code = fs.readFileSync(path.join(base,'ext-google-combined-response.js'),'utf8');
const rules = config.split('[URL Rewrite]')[1].split('[Script]')[0].split('\n').filter(l=>l && !l.startsWith('#')).map(l=>{
 const m=l.match(/^(\S+) (.+) (302)$/); assert(m,l); return {pattern:new RegExp(m[1]),target:m[2]};
});
function rewrite(url) { const rule=rules.find(r=>r.pattern.test(url)); return rule ? url.replace(rule.pattern,rule.target) : url; }
let miniTests=0;
let shortcutTests=0;
const miniNames=[];
for (const rule of rules.slice(0,16)) {
 // Read each encoded alias from the (alias|alias) group.
 const group=rule.pattern.source.match(/\(([^()]+)\)\(&\.\*\)\?\$$/)[1];
 for (const alias of group.split('|')) {
  miniNames.push(decodeURIComponent(alias));
  for (const separator of ['+','%20']) for(const extra of ['','&t=iphone','&t=iphone&ia=web']) {
   const actual=rewrite('https://duckduckgo.com/?q=x'+separator+alias+extra);
   assert.equal(actual,rule.target);
   assert(!actual.includes('t=iphone'));
   miniTests++;
  }
 }
}
const metadata=JSON.parse(fs.readFileSync(path.join(base,'search-metadata.json'),'utf8'));
for (const [key,target] of Object.entries(metadata.search_shortcuts)) {
 for (const separator of ['+','%20']) for (const position of ['prefix','suffix']) for (const extra of ['','&t=iphone','&t=iphone&ia=web']) {
  const query='hello'+separator+'world';
  const input=position==='prefix' ? key+separator+query : query+separator+key;
  const actual=rewrite('https://duckduckgo.com/?q='+input+extra);
  assert.equal(actual,target.replaceAll('$1',query),key+' '+input+extra);
  assert(!actual.includes('t=iphone'));
  shortcutTests++;
 }
}
assert.equal(rewrite('https://duckduckgo.com/?q=%E5%A4%A9%E6%B0%94&t=iphone'),'https://www.google.com/search?q=%E5%A4%A9%E6%B0%94');
assert.equal(rewrite('https://duckduckgo.com/?q=hello+world'),'https://www.google.com/search?q=hello+world');
assert.equal(rewrite('https://www.google.cn/search?q=hello&t=iphone'),'https://www.google.com/search?q=hello&t=iphone');
assert.equal(rewrite('http://g.cn/'),'https://www.google.com/');
assert.equal(rewrite('https://google.cn'),'https://www.google.com');
assert.equal(rewrite('https://google.cn.evil.example/search?q=test'),'https://google.cn.evil.example/search?q=test');
assert.equal(rewrite('https://duckduckgoXcom/?q=test&t=iphone'),'https://duckduckgoXcom/?q=test&t=iphone');
for(const cc of ['cn','hk','tw','us','jp','kr','tr','sg']) assert(rewrite('https://duckduckgo.com/?q='+cc).startsWith('https://itunes.apple.com/'));
assert(!code.includes('woziji159/Quantunmult'));
assert(!code.includes('surgeState.statusCode'));
new vm.Script(code);
const html='<!doctype html><html><head><title>Search</title></head><body><main id="center_col"><div id="rso">Results</div></main></body></html>';
async function run(label,response,{url='https://www.google.com/search?q=example',policies=['test-proxy'],httpResponse={status:200,headers:{'Content-Type':'text/html'}},httpBody=html,httpError=null,stall=false,scaleTimeout=false}={}) {
 let doneCount=0, requests=0, apiCalls=0;
 const calls=[];
 const result=await new Promise((resolve,reject)=>{
  const guard=setTimeout(()=>reject(Error(label+' did not finish')),10000);
  const callback=(request,cb)=>{
   requests++;calls.push(request);
   if(!stall) setTimeout(()=>cb(httpError,httpResponse,httpBody),0);
  };
  const context={
   $request:{url,method:'GET',headers:{'User-Agent':'Safari'}},$response:response,
   $environment:{'surge-version':'5.9.0'},$persistentStore:{read:()=>null,write:()=>true},
   $httpAPI:(method,uri,data,cb)=>{apiCalls++;cb({proxies:policies,'policy-groups':[]});},
   $httpClient:Object.fromEntries(['get','post','put','delete','head','options','patch'].map(m=>[m,callback])),
   $done:patch=>{doneCount++;clearTimeout(guard);resolve(patch);},
   console:{log:()=>{}},setTimeout:(fn,ms)=>setTimeout(fn,scaleTimeout?Math.min(ms,20):ms),clearTimeout,
  };
  vm.runInNewContext(code,context,{timeout:2000});
 });
 // Let any queued completion callbacks run; each chain must finish exactly once.
 await new Promise(r=>setTimeout(r,30));
 assert.equal(doneCount,1,label);
 return {result,requests,apiCalls,calls};
}
(async()=>{
 const scenarios=[];
 const ok=await run('200 HTML',{status:200,headers:{'Content-Type':'text/html','Content-Security-Policy':"script-src 'none'"},body:html});
 assert.equal(ok.requests,0);assert.equal(ok.apiCalls,0);
 assert(ok.result.body.includes('https://limbopro.com/Adguard/Adblock4limbo.user.js'));
 assert(ok.result.body.includes('Endless Google'));
 assert(!ok.result.body.includes('https://limbopro.com/CSS/google.com.css'));
 assert(!ok.result.body.includes('https://limbopro.com/CSS/limbopro.google.com.css'));
 assert.equal(ok.result.headers['Content-Security-Policy'],undefined);
 const inline=[...ok.result.body.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 for(const script of inline)new vm.Script(script);
 scenarios.push('200 HTML: cleanup + pagination; no CAPTCHA API/network calls; injected JavaScript parses');
 const recovered=await run('429 recovery',{status:429,headers:{'Content-Type':'text/html'},body:'<html><head></head><body>CAPTCHA</body></html>'});
 assert.equal(recovered.result.status,200);assert(recovered.result.body.includes('Endless Google'));assert(recovered.result.body.includes('Adblock4limbo.user.js'));assert.equal(recovered.calls[0].policy,'test-proxy');
 scenarios.push('429 to 200: Surge policy retry + cleanup + pagination; numeric status 200');
 const failed=await run('429 stays blocked',{status:429,headers:{'Content-Type':'text/html'},body:html},{httpResponse:{status:429,headers:{'Content-Type':'text/html'}},httpBody:html});
 assert.equal(JSON.stringify(failed.result),'{}');scenarios.push('429 remains 429: unchanged response; no cleanup or pagination injected');
 const conflict=await run('429 legacy statusCode conflict',{status:429,statusCode:200,headers:{'Content-Type':'text/html'},body:html},{httpResponse:{status:429,headers:{'Content-Type':'text/html'}},httpBody:html});
 assert.equal(JSON.stringify(conflict.result),'{}');scenarios.push('Surge status 429 overrides legacy statusCode 200; no false successful HTML injection');
 const empty=await run('empty policies',{status:429,headers:{'Content-Type':'text/html'},body:html},{policies:[]});
 assert.equal(JSON.stringify(empty.result),'{}');scenarios.push('No available policies: unchanged response');
 const json=await run('200 JSON',{status:200,headers:{'Content-Type':'application/json'},body:'{"ok":true}'});
 assert.equal(JSON.stringify(json.result),'{}');scenarios.push('200 JSON: unchanged response');
 const missing=await run('missing status',{headers:{'Content-Type':'text/html'},body:html},{policies:[]});
 assert.equal(JSON.stringify(missing.result),'{}');scenarios.push('Missing Surge status: never assumes success');
 const home=await run('homepage',{status:200,headers:{'content-type':'text/html; charset=UTF-8'},body:html},{url:'https://www.google.com/'});
 assert(home.result.body.includes('Adblock4limbo.user.js'));assert(!home.result.body.includes('Endless Google'));scenarios.push('Google homepage: cleanup only');
 const timeout=await run('CAPTCHA timeout',{status:429,headers:{'Content-Type':'text/html'},body:html},{stall:true,scaleTimeout:true});
 assert.equal(JSON.stringify(timeout.result),'{}');scenarios.push('CAPTCHA timeout: unchanged response; one final completion');
 const bytes=await run('no body',{status:200,headers:{'Content-Type':'text/html'}});
 assert.equal(JSON.stringify(bytes.result),'{}');scenarios.push('Missing body: unchanged response');
 const nonHtml=await run('retry JSON',{status:503,headers:{'Content-Type':'text/html'},body:html},{httpResponse:{status:200,headers:{'Content-Type':'application/json'}},httpBody:'{"recovered":true}'});
 assert.equal(nonHtml.result.status,200);assert.equal(nonHtml.result.body,'{"recovered":true}');scenarios.push('503 to JSON 200: preserves retry response without HTML injection');
 const report={date:'2026-10-14',passed:true,rewriteRules:rules.length,miniapps:16,miniappAliases:miniNames.length,miniappCases:miniTests,shortcutKeywords:Object.keys(metadata.search_shortcuts).length,shortcutCases:shortcutTests,otherRewriteCases:15,responseScenarios:scenarios,limitations:['Node VM 模拟 Surge API；未在真实 iPhone Surge 内执行网络重写。','自动翻页验证注入和脚本语法；未验证 Google 当前页面 DOM 与滚动行为。','微信短链保持原目标；没有逐个启动微信小程序。']};
 fs.writeFileSync(path.join(base,'test-results.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
