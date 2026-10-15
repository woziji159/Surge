/*
 * Surge / Safari: 91short 毒奶无按钮自动增强 v2 (2026-10-15)
 * 仅对 cn8.x-91short.com 的 text/html 主页面响应注入。
 * 保留毒奶现有资源与工具箱；不改 Google 自动翻页、节点和分流。
 * 独立实现保守弹窗拦截/广告扫描/欢迎弹窗隐藏；不声称修改上游内部开关。
 */
(function () {
  'use strict';
  try {
    var u = new URL($request.url);
    if (u.protocol !== 'https:' || u.hostname !== 'cn8.x-91short.com') return $done({});
    if (/(?:^|\/)(?:api|home_recommend_list|cdn-cgi|verify|captcha)(?:[\/?]|$)/i.test(u.pathname) ||
        /\.(?:js|css|json|jpe?g|png|gif|webp|svg|ico|woff2?|ttf|mp4|m4s|mp3|m3u8|ts|pdf|zip)$/i.test(u.pathname)) {
      return $done({});
    }
    var h = $response.headers || {};
    var key = Object.keys(h).find(function (k) { return k.toLowerCase() === 'content-type'; });
    if (!key || !/^text\/html(?:\s*;|\s*$)/i.test(String(h[key]))) return $done({});
    var body = $response.body;
    if (typeof body !== 'string' || !/<head\b[^>]*>/i.test(body)) return $done({});
    if (/您的域名并未添加白名单导致无法访问/.test(body)) return $done({});
    if (/id=["']dn91-guard-v2["']/.test(body)) return $done({});

    // 仅精确匹配广告标识，不按“包含广告”文字粗暴删除正文/播放器。
    var guard = String.raw`<style id="dn91-guard-style">
[data-dn91-hidden="1"] { display: none !important; }
</style>
<script id="dn91-guard-v2">
(function () {
 'use strict';
 if (window.__dn91GuardV2) return;
 window.__dn91GuardV2 = true;
 // 兼容移除上一版多余的悬浮按钮，不添加新按钮。
 var legacy = document.getElementById('dn-surge-toggle');
 if (legacy) legacy.remove();
 var root = location.hostname.toLowerCase();
 var selectors = [
  'ins.adsbygoogle', '[data-ad-slot]',
  '[id^="google_ads"]', '[id^="div-gpt-ad"]',
  'iframe[src*="doubleclick.net"]', 'iframe[src*="googlesyndication.com"]',
  '[class~="advertisement"]', '[class~="ad-banner"]', '[class~="ad-container"]',
  '[class~="popup-ad"]', '[class~="floating-ad"]'
 ].join(',');
 var ignoredTags = /^(HTML|BODY|MAIN|NAV|HEADER|FOOTER|VIDEO|AUDIO|CANVAS|FORM|BUTTON)$/;
 function sameSite(value) {
  if (!value || typeof value !== 'string') return false;
  try {
   var x = new URL(value, location.href);
   return (x.protocol === 'http:' || x.protocol === 'https:') &&
    (x.hostname === root || x.hostname === 'x-91short.com' || x.hostname.endsWith('.x-91short.com'));
  } catch (_) { return false; }
 }
 // 直接在页面中拦截第三方脚本弹窗，而非控制假的按钮。
 var nativeOpen = window.open;
 if (typeof nativeOpen === 'function') {
  window.open = function (url) {
   if (url == null || url === '' || sameSite(String(url))) return nativeOpen.apply(this, arguments);
   // 明确由用户主动点开的普通站外链接允许弹出（例如友情链接）。
   if (window.__dn91ExplicitLink && String(url) === window.__dn91ExplicitLink) return nativeOpen.apply(this, arguments);
   return null;
  };
 }
 window.addEventListener('click', function (e) {
  var a = e.target && e.target.closest && e.target.closest('a[href]');
  window.__dn91ExplicitLink = a ? a.href : null;
  setTimeout(function () { window.__dn91ExplicitLink = null; }, 0);
 }, true);
 // 对明确指向广告网络的点击链接拦截跳转，不阻止正常站外导航。
 var badDomains = /(?:^|\.)(?:doubleclick\.net|googlesyndication\.com|popads\.net|popcash\.net|adsterra\.com)$/i;
 document.addEventListener('click', function (e) {
  var a = e.target && e.target.closest && e.target.closest('a[href]');
  if (!a) return;
  try {
   var x = new URL(a.href);
   if (badDomains.test(x.hostname)) { e.preventDefault(); e.stopImmediatePropagation(); }
  } catch (_) {}
 }, true);
 var tracked = [];
 function hide(el) {
  if (!el || el.nodeType !== 1 || el.hasAttribute('data-dn91-hidden') || ignoredTags.test(el.tagName)) return;
  if (el.closest('#dh_buttonContainer, #dh_pageContainer, #dh_pageWrapper, #dn91-guard-v2')) return;
  el.setAttribute('data-dn91-hidden', '1');
  tracked.push(el);
  if (tracked.length > 300) tracked.shift();
 }
 function scan(node) {
  if (!node || node.nodeType !== 1) return;
  if (node.matches && node.matches(selectors)) hide(node);
  if (node.querySelectorAll) {
   var ad = node.querySelectorAll(selectors);
   for (var i = 0; i < Math.min(ad.length, 80); i++) hide(ad[i]);
  }
 }
 function closeWelcome() {
  // 不禁用导航，只隐藏“该网站已加入毒奶去广告计划”专属提示。
  if (!document.body || !document.createTreeWalker) return;
  var walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  var textNode, found = null, seen = 0;
  while ((textNode = walk.nextNode()) && seen++ < 2500) {
   var s = String(textNode.nodeValue || '').replace(/\s+/g, '');
   if (/该网站已加入毒奶.{0,8}广告计划|本站广告、弹窗等干扰内容已被移除/.test(s)) { found = textNode.parentElement; break; }
  }
  if (!found) return;
  var parent = found, fallback = null;
  for (var i = 0; i < 8 && parent && parent !== document.body; i++, parent = parent.parentElement) {
   var t = (parent.textContent || '').replace(/\s+/g, '');
   if (t.length > 450) break;
   if (!/毒奶.*广告计划/.test(t)) continue;
   // 必须是包含欢迎说明的整个弹窗，不单独隐藏标题，否则可能留下遮罩。
   if (!/本站广告|本网站广告|干扰内容已被移除|即刻享受/.test(t)) continue;
   fallback = parent;
   var options = parent.querySelectorAll('button, [role="button"], [aria-label], [title]');
   for (var j=0; j<options.length; j++) {
    var b=options[j];
    var name=(b.textContent||'').trim() + ' ' + (b.getAttribute('aria-label')||'') + ' ' + (b.getAttribute('title')||'');
    if (/^(\s*[×✕✖xX]\s*)$/.test(name.trim()) || /关闭|close/i.test(name)) { b.click(); return; }
   }
  }
  if (fallback && (fallback.textContent || '').length < 450) fallback.setAttribute('data-dn91-hidden', '1');
 }
 var pending = [], timer = 0;
 function flush() {
  timer = 0;
  var arr = pending.splice(0, 35);
  for (var i=0; i<arr.length; i++) scan(arr[i]);
  closeWelcome();
 }
 function schedule(node) {
  if (node && node.nodeType === 1 && pending.length < 120) pending.push(node);
  if (!timer) timer = setTimeout(flush, 110);
 }
 function init() {
  var oldButton = document.getElementById('dn-surge-toggle');
  if (oldButton) oldButton.remove();
  scan(document.body);
  closeWelcome();
  if (document.documentElement && window.MutationObserver) {
   new MutationObserver(function (changes) {
    for (var i=0; i<changes.length; i++) {
     for (var j=0; j<changes[i].addedNodes.length; j++) {
      schedule(changes[i].addedNodes[j]);
     }
    }
   }).observe(document.documentElement, {childList:true,subtree:true});
  }
  setTimeout(closeWelcome, 700);
  setTimeout(closeWelcome, 2100);
 }
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
 else init();
})();
</script>`;

    // 毒奶资源的加载列表保持上一版本一致；只避免在网页已存在时重复注入。
    var upstream = /<script\b[^>]*src=["'][^"']*Adblock4limbo\.user\.js/i.test(body) ? '' : [
      '<script defer src="https://limbopro.com/Adguard/autoAdDetector.js"></script>',
      '<script defer src="https://limbopro.com/Adguard/Adblock4limbo.user.js"></script>',
      '<script defer src="https://limbopro.com/Adguard/Adblock4limbo.function.js"></script>',
      '<script defer src="https://limbopro.com/Adguard/elementBlocker.user.js"></script>',
      '<script defer src="https://limbopro.com/Adguard/isAgent.js"></script>',
      '<link rel="stylesheet" href="https://limbopro.com/CSS/x-91short.com.css">',
      '<link rel="stylesheet" href="https://limbopro.com/CSS/limbopro.x-91short.com.css">'
    ].join('\n');
    var updated = body.replace(/<head\b[^>]*>/i, function (s) {return s + '\n' + guard + '\n' + upstream;});
    if (updated === body) return $done({});
    var outHeaders = Object.assign({}, h);
    Object.keys(outHeaders).forEach(function (k) {
      // 延续上一版对该站页面的 CSP 处理，避免内联脚本被站点 CSP 阻止。
      if (/^(?:content-length|content-security-policy|content-security-policy-report-only)$/i.test(k)) delete outHeaders[k];
    });
    $done({body:updated,headers:outHeaders});
  } catch (e) {
    console.log('[dn91 v2] ' + (e && e.message));
    $done({});
  }
})();
