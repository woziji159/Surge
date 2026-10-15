/*
  Surge / 百度手机版安全翻页 2026-10-15-safe3
  修复原则：永不伪造 pn 翻页地址；不抓取、不拼接结果 HTML；
  仅在百度网页自身出现可见且可验证的「加载更多 / 下一页」控制时点击。
  百度搜索结果页不再注入毒奶的通用 CSS/JS，避免正常结果被误隐藏。
  仅修改百度搜索结果主 HTML；其他站点及 Bing/Google 不受影响。
*/
const PAGINATION = String.raw`(function () {
  'use strict';
  if (window.__surgeBaiduSafePagination3) return;
  window.__surgeBaiduSafePagination3 = true;

  var loc = new URL(location.href);
  if (!/^(?:www|m)\.baidu\.com$/i.test(loc.hostname) || loc.pathname !== '/s') return;
  if (!loc.searchParams.has('wd') && !loc.searchParams.has('word')) return;

  var armed = false, busy = false, lastClick = 0, tick = 0;
  var key = loc.searchParams.has('wd') ? 'wd' : 'word';
  var btnText = /^(?:加载更多|載入更多|更多结果|更多結果|查看更多结果|查看更多結果|显示更多|顯示更多|下一页|下一頁|下页|下一步|Next(?: page)?|Load more|Show more)(?:\s*[›»→])?$/i;

  function isVisible(element) {
    if (!element || !element.getBoundingClientRect) return false;
    var box = element.getBoundingClientRect();
    var css = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && css.display !== 'none' && css.visibility !== 'hidden';
  }
  function label(node) {
    return (node.getAttribute('aria-label') || node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function safeNextLink(anchor) {
    try {
      var u = new URL(anchor.href, location.href);
      if (!/^https:$/.test(u.protocol) || !/^(www|m)\.baidu\.com$/.test(u.hostname) || u.pathname !== '/s') return false;
      if (u.searchParams.get(key) !== loc.searchParams.get(key)) return false;
      var current = Number(loc.searchParams.get('pn') || 0);
      var next = Number(u.searchParams.get('pn'));
      return Number.isFinite(current) && Number.isFinite(next) && next > current && next <= current + 50;
    } catch (e) { return false; }
  }
  function findNativeNext() {
    var nodes = document.querySelectorAll(
      '#page a, #page button, #page [role="button"], ' +
      '.pagination a, .pagination button, .pager a, .pager button, ' +
      '.page-container a, .page-container button, ' +
      '.load-more, .loadmore, [data-testid="load-more"], [class*="load-more"]'
    );
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!isVisible(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
      if (!btnText.test(label(el))) continue;
      if (el.closest('[role="dialog"], form')) continue;
      if (el.tagName === 'A' && !safeNextLink(el)) continue;
      return el;
    }
    return null;
  }
  function hasResults() {
    return document.querySelectorAll('#content_left .c-result, #content_left .c-container, ' +
      '#content_left .result, #results .result, #results .c-result, .c-result').length >= 3;
  }
  function maybeLoad() {
    if (!armed || busy || Date.now() - lastClick < 5000) return;
    if (!hasResults()) return;
    if (scrollY < 120 || document.documentElement.scrollHeight < innerHeight + 550) return;
    var remaining = document.documentElement.scrollHeight - scrollY - innerHeight;
    if (remaining > 500) return;
    var el = findNativeNext();
    if (!el) return; // 关键：无按钮时不伪造 ?pn= 也不自动跳页。
    busy = true;
    lastClick = Date.now();
    try { el.click(); } catch (e) { busy = false; return; }
    armed = false;
    setTimeout(function () {busy = false;}, 4800);
  }
  function onScroll() {
    if (tick) return;
    tick = setTimeout(function () { tick = 0; maybeLoad(); }, 150);
  }
  function arm() {armed = true; onScroll();}
  function init() {
    window.addEventListener('touchmove', arm, {passive:true});
    window.addEventListener('wheel', arm, {passive:true});
    window.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('touchend', onScroll, {passive:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();`;

function main() {
  try {
    const req = new URL($request.url);
    if (!/^(www|m)\.baidu\.com$/i.test(req.hostname) || req.pathname !== '/s' ||
        (!req.searchParams.has('wd') && !req.searchParams.has('word'))) {
      $done({}); return;
    }
    const headers = $response.headers || {};
    const contentType = String(Object.entries(headers).find(([k]) => k.toLowerCase() === 'content-type')?.[1] || '').toLowerCase();
    if (!contentType.includes('text/html') || typeof $response.body !== 'string') {
      $done({}); return;
    }
    const body = $response.body;
    if (!/<\/body\s*>/i.test(body) || body.includes('__surgeBaiduSafePagination3')) {
      $done({}); return;
    }
    // 只在文档末尾增加一段本地逻辑。不注入第三方 CSS、广告净化 JS，也不重写内容容器。
    const newBody = body.replace(/<\/body\s*>/i, '<script id="surge-baidu-safe3">' + PAGINATION + '</script></body>');
    const outHeaders = { ...headers };
    // 原响应脚本会去掉 CSP。这里只为了允许内联翻页脚本执行；其他安全响应头不改。
    for (const h of Object.keys(outHeaders)) {
      if (h.toLowerCase() === 'content-security-policy' || h.toLowerCase() === 'content-length') delete outHeaders[h];
    }
    $done({body:newBody,headers:outHeaders});
  } catch (error) {
    console.log('[Baidu safe pagination] ' + error.message);
    $done({});
  }
}
main();
