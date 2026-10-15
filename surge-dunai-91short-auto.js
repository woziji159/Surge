/*
 * Surge — 91short 毒奶定制脚本：原文件原位修复 v4 (2026-10-15)
 * 原始仓库: https://github.com/woziji159/Surge
 * 保留原版导航、反馈、元素屏蔽器及原生撤销功能；不新增悬浮按钮。
 * 仅用于 Surge [Script] http-response 的 HTML 响应，不是直接网页用户脚本。
 */
(function () {
  'use strict';
  try {
    var u = new URL($request.url);
    var domain = /^(?:[a-z0-9-]+\.)*x-91short\.com$/i;
    if (u.protocol !== 'https:' || !domain.test(u.hostname)) return $done({});
    if (/\.(?:json|js|css|jpg|jpeg|png|webp|gif|svg|ico|woff2?|ttf|mp4|m4s|mp3|m3u8|ts|pdf|zip)(?:$|\?)/i.test(u.pathname) ||
        /(?:\/api(?:\/|$)|home_recommend_list|\/cdn-cgi\/|\/verify|\/captcha)/i.test(u.pathname)) return $done({});

    var headers = $response.headers || {};
    var contentKey = Object.keys(headers).find(function (k) { return k.toLowerCase() === 'content-type'; });
    if (!contentKey || !/\b(?:text\/html|application\/xhtml\+xml)\b/i.test(String(headers[contentKey]))) return $done({});
    var body = $response.body;
    if (typeof body !== 'string' || !/<head\b[^>]*>/i.test(body)) return $done({});
    if (/您的域名并未添加白名单导致无法访问/.test(body)) return $done({});
    if (/id=["']limbo-91-custom-v4["']/.test(body)) return $done({});

    // GitHub Raw 适合 Surge 的 script-path，但作为网页 <script src> 可能被浏览器以 nosniff 拦截。
    // 这两份定制 JS 仍来自用户自己的仓库，只将网页加载地址换成 JS CDN。
    var base = 'https://cdn.jsdelivr.net/gh/woziji159/Surge@main/';
    var customFn = base + 'limbo-function-auto.js?v=20261015-repair4';
    var customElement = base + 'limbo-elementBlocker-auto.js?v=20261015-repair4';

    // 保留原版仅针对陌生弹窗和已知广告域名的拦截；不创建或移除工具箱按钮。
    var guard = `<script id="limbo-91-custom-v4">
(function () {
  'use strict';
  if (window.__limbo91PopupGuard) return;
  window.__limbo91PopupGuard = true;
  var originalOpen = window.open;
  var adDomains = /(?:^|\.)(?:doubleclick\.net|googlesyndication\.com|adsterra\.com|wpadmngr\.com|twinrdengine\.com)$/i;
  var recentGesture = 0;
  document.addEventListener('pointerdown', function(e) { if (e.isTrusted) recentGesture = Date.now(); }, true);
  document.addEventListener('keydown', function(e) { if (e.isTrusted) recentGesture = Date.now(); }, true);
  window.open = function (url) {
    var target;
    try { target = new URL(String(url || ''), location.href); }
    catch (e) { return originalOpen.apply(this, arguments); }
    var crossSite = target.origin !== location.origin;
    if (adDomains.test(target.hostname) || (crossSite && Date.now() - recentGesture > 1200)) return null;
    return originalOpen.apply(this, arguments);
  };
  // Hide only the three repetitive status banners, without disabling the hooks or scan.
  function hideStatusBanners() {
    if (!document.body) return;
    var boxes = document.querySelectorAll('body > div, body > aside, body > section');
    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      var txt = (box.innerText || box.textContent || '').trim();
      if (txt.length > 360 || !/(?:拦截恶意点击跳转|拦截点击弹窗广告|该网站已加入毒奶去广告计划)/.test(txt)) continue;
      var style = getComputedStyle(box);
      if (style.position !== 'fixed' || box.getBoundingClientRect().top > 400) continue;
      box.style.setProperty('display', 'none', 'important');
    }
  }
  function watchStatusBanners() {
    hideStatusBanners();
    var delay = null;
    var watcher = new MutationObserver(function () {
      if (delay) return;
      delay = setTimeout(function () { delay = null; hideStatusBanners(); }, 150);
    });
    watcher.observe(document.body, {childList:true,subtree:true});
    setTimeout(function () { watcher.disconnect(); clearTimeout(delay); }, 20000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchStatusBanners, {once:true});
  else if (document.body) watchStatusBanners();
})();
</script>`;

    // 兜底扫描：原仓库的 limbo-elementBlocker-auto.js 只对 cn8.x-91short.com 启动
    // startLimboPassiveAdScan()。其它 x-91short.com 子域名额外使用这段安静的扫描，
    // 不弹 v12.6 面板，也不添加浮窗；原本的「反馈/导航」由 limbo-function-auto.js 创建。
    var passiveScan = `<script id="limbo-91-passive-v4">
(function () {
  'use strict';
  var selectors = [
    'ins.adsbygoogle', '[data-ad-client]', '[data-ad-slot]',
    'iframe[src*="doubleclick.net"]', 'iframe[src*="googlesyndication.com"]',
    'iframe[src*="popunder"]', 'iframe[src*="adsterra"]',
    '.popup-ad', '.floating-ad', '.ad-banner', '.advertisement-banner',
    '[id="google_ads"]', '[id^="google_ads_"]'
  ].join(',');
  function start() {
    if (window.__limbo91FallbackActive || window.__limboPassiveAdScanActive || !document.body) return;
    window.__limbo91FallbackActive = true;
    var hidden = [];
    var timer = null;
    function hide(el) {
      if (!(el instanceof HTMLElement) || el.hasAttribute('data-limbo-91-hidden')) return;
      if (el.closest('#dh_pageContainer,#gemini-main-container,#limbo-ad-notice,#limbo-91-custom-v4')) return;
      if (el.matches('body,main,header,footer,nav,video,audio,form,button')) return;
      hidden.push({el:el, value:el.style.getPropertyValue('display'), priority:el.style.getPropertyPriority('display')});
      el.setAttribute('data-limbo-91-hidden', '1');
      el.style.setProperty('display','none','important');
    }
    function scan(root) {
      if (!root || root.nodeType !== 1) return;
      try {
        if (root.matches(selectors)) hide(root);
        var nodes = root.querySelectorAll(selectors);
        for (var i = 0; i < Math.min(nodes.length, 200); i++) hide(nodes[i]);
      } catch (e) {}
    }
    function scanAll() { if (!document.hidden && document.body) scan(document.body); }
    var observer = new MutationObserver(function (records) {
      if (timer) return;
      timer = setTimeout(function () {
        timer = null;
        var count = 0;
        for (var i = 0; i < records.length && count < 80; i++) {
          for (var j = 0; j < records[i].addedNodes.length && count < 80; j++) {
            var n = records[i].addedNodes[j];
            if (n.nodeType === 1) { scan(n); count++; }
          }
        }
      }, 250);
    });
    scanAll();
    observer.observe(document.body, {childList:true, subtree:true});
    var periodic = setInterval(scanAll, 10000);
    window.surge91UndoAutoHidden = function () {
      observer.disconnect(); clearInterval(periodic); clearTimeout(timer);
      for (var i = 0; i < hidden.length; i++) {
        var item = hidden[i];
        if (!item.el.isConnected) continue;
        item.el.style.removeProperty('display');
        if (item.value) item.el.style.setProperty('display', item.value, item.priority);
        item.el.removeAttribute('data-limbo-91-hidden');
      }
      window.__limbo91FallbackActive = false;
    };
  }
  // Give the original blocker a chance to initialize first; start fallback only if needed.
  window.addEventListener('load', start, {once:true});
  if (document.readyState !== 'loading') setTimeout(start, 2500);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 2500); }, {once:true});
})();
</script>`;

    var injection = [
      guard,
      passiveScan,
      '<script defer src="https://limbopro.com/Adguard/autoAdDetector.js"></script>',
      '<script defer src="https://limbopro.com/Adguard/Adblock4limbo.user.js"></script>',
      '<script defer src="' + customFn + '"></script>',
      '<script defer src="' + customElement + '"></script>',
      '<script defer src="https://limbopro.com/Adguard/isAgent.js"></script>',
      '<link rel="stylesheet" href="https://limbopro.com/CSS/x-91short.com.css">',
      '<link rel="stylesheet" href="https://limbopro.com/CSS/limbopro.x-91short.com.css">'
    ].join('\n');
    body = body.replace(/<head\b[^>]*>/i, function (tag) { return tag + '\n' + injection + '\n'; });

    var h = Object.assign({}, headers);
    Object.keys(h).forEach(function (k) {
      if (/^(?:content-length|content-security-policy|content-security-policy-report-only)$/i.test(k)) delete h[k];
    });
    return $done({body:body, headers:h});
  } catch (e) {
    console.log('[limbo-91-v4] ' + e.message);
    $done({});
  }
})();
