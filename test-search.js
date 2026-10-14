'use strict';

const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const path = require('path');
const base = __dirname;
const code = fs.readFileSync(path.join(base, 'ext-google-combined-response.js'), 'utf8');
const config = fs.readFileSync(path.join(base, 'safari-search.sgmodule'), 'utf8');
const metadata = JSON.parse(fs.readFileSync(path.join(base, 'search-metadata.json'), 'utf8'));

function checkRewrites() {
  const section = config.split('[URL Rewrite]')[1].split(/\n\[/)[0];
  const rules = section.split('\n').map(line => line.trim())
    .filter(line => line && !line.startsWith('#')).map(line => {
      const match = line.match(/^(\S+) (.+) (302)$/);
      assert(match, line);
      return { pattern: new RegExp(match[1]), target: match[2] };
    });
  function rewrite(url) {
    const rule = rules.find(item => item.pattern.test(url));
    return rule ? url.replace(rule.pattern, rule.target) : url;
  }
  let miniappCases = 0;
  let shortcutCases = 0;
  let otherRewriteCases = 0;
  const miniNames = [];
  for (const rule of rules.slice(0, 16)) {
    const aliases = rule.pattern.source.match(/\(([^()]+)\)\(&\.\*\)\?\$$/);
    assert(aliases, 'Miniapp rule has its expected alias group');
    for (const alias of aliases[1].split('|')) {
      miniNames.push(decodeURIComponent(alias));
      for (const separator of ['+', '%20']) {
        for (const extra of ['', '&t=iphone', '&t=iphone&ia=web']) {
          const actual = rewrite('https://duckduckgo.com/?q=x' + separator + alias + extra);
          assert.equal(actual, rule.target);
          assert(!actual.includes('t=iphone'));
          miniappCases++;
        }
      }
    }
  }
  for (const [key, target] of Object.entries(metadata.search_shortcuts)) {
    for (const separator of ['+', '%20']) {
      for (const position of ['prefix', 'suffix']) {
        for (const extra of ['', '&t=iphone', '&t=iphone&ia=web']) {
          const query = 'hello' + separator + 'world';
          const input = position === 'prefix' ? key + separator + query : query + separator + key;
          const actual = rewrite('https://duckduckgo.com/?q=' + input + extra);
          assert.equal(actual, target.replaceAll('$1', query), key + ' ' + input + extra);
          assert(!actual.includes('t=iphone'));
          shortcutCases++;
        }
      }
    }
  }
  const cases = [
    ['https://duckduckgo.com/?q=%E5%A4%A9%E6%B0%94&t=iphone', 'https://www.google.com/search?q=%E5%A4%A9%E6%B0%94'],
    ['https://duckduckgo.com/?q=hello+world', 'https://www.google.com/search?q=hello+world'],
    ['https://www.google.cn/search?q=hello&t=iphone', 'https://www.google.com/search?q=hello&t=iphone'],
    ['http://g.cn/', 'https://www.google.com/'],
    ['https://google.cn', 'https://www.google.com'],
    ['https://google.cn.evil.example/search?q=test', 'https://google.cn.evil.example/search?q=test'],
    ['https://duckduckgoXcom/?q=test&t=iphone', 'https://duckduckgoXcom/?q=test&t=iphone'],
  ];
  for (const [input, output] of cases) {
    assert.equal(rewrite(input), output);
    otherRewriteCases++;
  }
  for (const country of ['cn', 'hk', 'tw', 'us', 'jp', 'kr', 'tr', 'sg']) {
    assert(rewrite('https://duckduckgo.com/?q=' + country).startsWith('https://itunes.apple.com/'));
    otherRewriteCases++;
  }
  return {
    rewriteRules: rules.length, miniapps: 16, miniappAliases: miniNames.length,
    miniappCases, shortcutKeywords: Object.keys(metadata.search_shortcuts).length,
    shortcutCases, otherRewriteCases,
  };
}

// The response stage runs in Surge JavaScriptCore. Timers and browser APIs are
// deliberately unavailable; only injected script text may refer to them.
function runResponse(response, url = 'https://www.google.com/search?q=example') {
  let doneCount = 0;
  let patch;
  const forbiddenAccess = [];
  const context = {
    $request: { url, method: 'GET', headers: { 'User-Agent': 'Safari' } },
    $response: response,
    $done: value => { doneCount++; patch = value; },
    console: { log() {}, warn() {}, error() {} },
  };
  for (const name of ['$httpClient', '$httpAPI', '$persistentStore', 'setTimeout', 'clearTimeout',
    'setInterval', 'fetch', 'window', 'document', 'DOMParser', 'XMLHttpRequest']) {
    Object.defineProperty(context, name, {
      get() { forbiddenAccess.push(name); throw new Error('Response stage must not access ' + name); },
    });
  }
  vm.runInNewContext(code, context, { timeout: 2000 });
  assert.equal(doneCount, 1, 'Response stage must finish synchronously exactly once');
  assert.deepEqual(forbiddenAccess, [], 'Response stage used an unavailable API');
  return JSON.parse(JSON.stringify(patch));
}

function checkResponses() {
  new vm.Script(code);
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDAAAAABJRU5ErkJggg==';
  const nativeImage = '<img id="dimg_native" class="google-thumb" width="160" height="90" style="object-fit:cover;border-radius:8px" data-src="https://example.test/video.jpg" src="' + png + '">';
  const nativeInitializer = '<script nonce="original-google" id="google-original">window.googleImageInitialization = true; document.addEventListener("DOMContentLoaded", function () { document.getElementById("dimg_native").dataset.nativeReady = "true"; });</script>';
  const html = '<!doctype html><html><head><title>Search</title></head><body><main id="center_col"><div id="rso">' + nativeImage + '</div></main>' + nativeInitializer + '</body></html>';
  const scenarios = [];
  const ok = runResponse({ status: 200, headers: { 'Content-Type': 'text/html', 'Content-Security-Policy': "script-src 'none'" }, body: html });
  assert(ok.body.includes('id="surge-google-cleanup-loader"'), 'Cleanup loader is injected');
  assert(ok.body.includes('id="surge-google-native-pagination"'), 'Native pagination is injected');
  assert(ok.body.includes(nativeImage), 'Existing thumbnail attributes and styles remain byte-for-byte intact');
  assert(ok.body.includes(nativeInitializer), 'Google initialization script remains byte-for-byte intact');
  assert(!ok.body.includes('https://limbopro.com/Adguard/autoAdDetector.js'), 'Do not load the upstream asset containing an illegal top-level return');
  const scripts = [...ok.body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  const injected = scripts.filter(match => /id=["']surge-google-/.test(match[1]));
  assert.equal(injected.length, 2, 'Both injected scripts are found even when script tags have attributes');
  for (const match of injected) new vm.Script(match[2]);
  for (const name of ['Adblock4limbo.user.js', 'Adblock4limbo.function.js', 'elementBlocker.user.js']) {
    assert(ok.body.includes('https://limbopro.com/Adguard/' + name));
  }
  assert(!ok.body.includes('https://limbopro.com/CSS/google.com.css'));
  assert(!ok.body.includes('https://limbopro.com/CSS/limbopro.google.com.css'));
  assert(!Object.keys(ok.headers || {}).some(name => name.toLowerCase() === 'content-security-policy'));
  scenarios.push('200 HTML: synchronous JSC response, cleanup and native pagination, original image markup/initialization retained, both injected scripts parse');

  const unchanged = [
    ['403 HTML', { status: 403, headers: { 'Content-Type': 'text/html' }, body: html }],
    ['429 HTML', { status: 429, headers: { 'Content-Type': 'text/html' }, body: html }],
    ['503 HTML', { status: 503, headers: { 'Content-Type': 'text/html' }, body: html }],
    ['302 redirect', { status: 302, headers: { 'Content-Type': 'text/html', Location: '/sorry/' }, body: html }],
    ['429 with conflicting legacy statusCode', { status: 429, statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: html }],
    ['200 JSON', { status: 200, headers: { 'Content-Type': 'application/json' }, body: '{"ok":true}' }],
    ['missing status', { headers: { 'Content-Type': 'text/html' }, body: html }],
    ['missing body', { status: 200, headers: { 'Content-Type': 'text/html' } }],
    ['HTML fragment', { status: 200, headers: { 'Content-Type': 'text/html' }, body: '<div id="rso">Partial result</div>' }],
  ];
  for (const [name, response] of unchanged) {
    assert.deepEqual(runResponse(response), {}, name + ': original response is preserved');
    scenarios.push(name + ': unchanged, zero retry/network/policy/timer API access, one synchronous completion');
  }
  const home = runResponse({ status: 200, headers: { 'content-type': 'text/html; charset=UTF-8' }, body: html }, 'https://www.google.com/');
  assert(home.body.includes('id="surge-google-cleanup-loader"'));
  assert(!home.body.includes('id="surge-google-native-pagination"'));
  scenarios.push('Google homepage: cleanup loader only');
  const repeat = runResponse({ status: 200, headers: ok.headers, body: ok.body });
  const repeatedBody = repeat.body === undefined ? ok.body : repeat.body;
  for (const id of ['surge-google-cleanup-loader', 'surge-google-native-pagination']) {
    assert.equal((repeatedBody.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, id + ' stays unique');
  }
  scenarios.push('Repeated processing: no duplicate injected loaders');
  return scenarios;
}

async function main() {
  const report = {
    date: '2026-10-14', passed: true, ...checkRewrites(), responseScenarios: checkResponses(),
    limitations: ['响应阶段在 Node VM 中模拟 Surge JavaScriptCore API；没有在真实 iPhone Surge 中运行。', '微信短链保持原目标；未逐个启动微信小程序。'],
  };
  if (process.argv.includes('--browser')) {
    const { runBrowserTests } = require('./test-google-browser.js');
    report.browser = await runBrowserTests();
    report.limitations.push('浏览器验证使用受控 Google／百度／必应页面和外部脚本夹具，不代表真实 Google 当前服务端页面或用户本机规则。');
  } else {
    report.limitations.push('本次未运行浏览器夹具；使用 --browser 可运行浏览器行为验证。');
  }
  fs.writeFileSync(path.join(base, 'test-results.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

module.exports = { runResponse, checkRewrites, checkResponses };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
