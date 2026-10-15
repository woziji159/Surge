/*
 * Surge — 91short 毒奶定制脚本：自动高风险扫描修复 v7 (2026-10-15)
 * 原始仓库: https://github.com/woziji159/Surge
 * 保留原版导航、反馈、元素屏蔽器及原生撤销功能；不新增悬浮按钮。
 * 仅用于 Surge [Script] http-response 的 HTML 响应，不是直接网页用户脚本。
 */
(function () {
  'use strict';
  try {
    var match = /^https:\/\/([^\/?#]+)(\/[^?#]*)?/i.exec(String($request.url || ''));
    var hostname = match ? match[1].toLowerCase().split(':')[0] : '';
    var pathname = match && match[2] ? match[2] : '/';
    var domain = /^(?:[a-z0-9-]+\.)*x-91short\.com$/i;
    if (!match || !domain.test(hostname)) return $done({});
    if (/\.(?:json|js|css|jpg|jpeg|png|webp|gif|svg|ico|woff2?|ttf|mp4|m4s|mp3|m3u8|ts|pdf|zip)(?:$|\?)/i.test(pathname) ||
        /(?:\/api(?:\/|$)|home_recommend_list|\/cdn-cgi\/|\/verify|\/captcha)/i.test(pathname)) return $done({});

    var headers = $response.headers || {};
    var contentKey = Object.keys(headers).find(function (k) { return k.toLowerCase() === 'content-type'; });
    if (contentKey && !/\b(?:text\/html|application\/xhtml\+xml)\b/i.test(String(headers[contentKey]))) return $done({});
    var body = $response.body;
    if (typeof body !== 'string' || !/<head\b[^>]*>/i.test(body)) return $done({});
    if (/您的域名并未添加白名单导致无法访问/.test(body)) return $done({});
    if (/id=["']limbo-91-custom-v7["']/.test(body)) return $done({});

    // GitHub Raw 适合 Surge 的 script-path，但作为网页 <script src> 可能被浏览器以 nosniff 拦截。
    // 这两份定制 JS 仍来自用户自己的仓库，只将网页加载地址换成 JS CDN。
    var base = 'https://cdn.jsdelivr.net/gh/woziji159/Surge@main/';
    var customFn = base + 'limbo-function-auto.js?v=20261015-repair5';
    var customElement = base + 'limbo-elementBlocker-auto.js?v=20261015-repair5';

    // 保留原版仅针对陌生弹窗和已知广告域名的拦截；不创建或移除工具箱按钮。
    var guard = `<script id="limbo-91-custom-v7">
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
    // 高风险元素自动扫描与屏蔽（独立于原手动 v12.6 扫描器）：
    // 原 v5 仅识别固定 class，且当旧扫描器设置 __limboPassiveAdScanActive 时会完全跳过。
    // 本版本不会让工具面板自动弹出，也不模仿或改写手动扫描器的内部接口。
    var passiveScan = `<script id="limbo-91-passive-v7">
(function () {
  'use strict';
  if (window.__limbo91AutoBlockV7) return;
  window.__limbo91AutoBlockV7 = true;

  var enabled = true;
  var hidden = [];
  var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
  var mutationTimer = 0;
  var periodicTimer = 0;
  var observer = null;
  var scanned = 0;
  var MAX_BLOCKS = 60;
  var selectors = [
    'a[href]', 'iframe[src]', '[onclick]', 'ins.adsbygoogle',
    '[data-ad-client]', '[data-ad-slot]',
    '.popup-ad', '.floating-ad', '.ad-banner', '.advertisement-banner',
    '[id^="google_ads"]', '[class*="popunder"]', '[id*="popunder"]'
  ].join(',');
  var adHost = /(?:^|\\.)(?:doubleclick\\.net|googlesyndication\\.com|adsterra\\.com|wpadmngr\\.com|twinrdengine\\.com)$/i;
  var adLabel = /(?:^|[ _-])(?:ads?|advert(?:isement)?|sponsored|popunder|popup-ad|floating-ad|ad-banner)(?:$|[ _-])/i;
  var protectedSel = [
    '#dh_pageContainer', '#gemini-main-container', '#limbo-ad-notice',
    '[id*="feedback" i]', '[class*="feedback" i]',
    '[id*="ad-detector" i]', '[class*="ad-detector" i]',
    '[id*="limbo" i]', '[class*="limbo" i]',
    'header','nav','main > nav','form','video','audio'
  ].join(',');

  function blockedUi(el) {
    try { return Boolean(el.closest(protectedSel)); } catch(e) { return false; }
  }
  function getHost(url) {
    try { return new URL(url, location.href).hostname.toLowerCase(); } catch(e) { return ''; }
  }
  function hasPic(el) {
    try { return !!(el.matches('img') || el.querySelector('img,picture,svg,canvas') || (el.getAttribute('style') || '').indexOf('background-image') >= 0); }
    catch(e) { return false; }
  }
  function isNumericHost(host) { return /^(?:\\d{1,3}\\.){3}\\d{1,3}$/.test(host); }
  function score(el) {
    if (!el || !el.matches || blockedUi(el)) return 0;
    if (!el.isConnected || hidden.length >= MAX_BLOCKS) return 0;
    var name = el.nodeName.toLowerCase();
    if (name === 'html' || name === 'body' || name === 'head' || name === 'script' || name === 'style') return 0;
    if (el.hasAttribute('data-limbo-91-auto7')) return 0;
    var classId = String(el.className && typeof el.className === 'string' ? el.className : '') + ' ' + (el.id || '');
    var s = adLabel.test(classId) ? 65 : 0;
    if (el.hasAttribute('data-ad-client') || el.hasAttribute('data-ad-slot') || el.matches('ins.adsbygoogle')) s += 65;
    var href = el.getAttribute('href') || el.getAttribute('src') || '';
    var host = getHost(href);
    if (host && adHost.test(host)) s += 75;
    if (host && host !== location.hostname.toLowerCase()) {
      if (isNumericHost(host)) s += 35;
      else if (host !== '' && !adHost.test(host)) s += 12;
    }
    if (String(el.getAttribute('target') || '').toLowerCase() === '_blank') s += 15;
    var onClick = String(el.getAttribute('onclick') || '');
    if (/window\\.open|location\\.(?:href|assign|replace)/i.test(onClick)) s += 15;
    if (hasPic(el)) s += 10;
    // 普通站外链接 / 正常视频缩略图不会仅凭图片、target=_blank 就被删除。
    return s;
  }
  function targetFor(el) {
    var node = el;
    if (el.nodeName.toLowerCase() === 'a') {
      var p = el.parentElement;
      // 只向上提升一级非常小的纯广告卡片，不允许隐藏页面/视频列表容器。
      if (p && p !== document.body && !blockedUi(p) && p.children.length <= 2) {
        var rect = p.getBoundingClientRect();
        if (rect.height > 0 && rect.height < 500 && rect.width < innerWidth * 1.01 &&
            (p.innerText || '').trim().length < 80) node = p;
      }
    }
    return node;
  }
  function hide(el, pts) {
    if (!enabled || hidden.length >= MAX_BLOCKS) return;
    var target = targetFor(el);
    if (!target || blockedUi(target) || target.hasAttribute('data-limbo-91-auto7')) return;
    if (!target.isConnected || /^(?:html|body|head|main|header|nav|footer|video|audio|form)$/i.test(target.nodeName)) return;
    var rect = target.getBoundingClientRect();
    if (rect.height < 1 || rect.width < 1 || rect.height > Math.max(700, innerHeight * 0.85)) return;
    hidden.push({el:target, display:target.style.getPropertyValue('display'), priority:target.style.getPropertyPriority('display')});
    target.setAttribute('data-limbo-91-auto7', String(pts));
    target.style.setProperty('display', 'none', 'important');
    console.log('[limbo-91-v7] auto-hide high-risk element (' + pts + '): ' + target.nodeName);
  }
  function scanElement(el) {
    if (!enabled || !el || el.nodeType !== 1) return;
    if (seen && seen.has(el)) return;
    scanned++;
    var pts = score(el);
    if (pts >= 60) hide(el, pts);
    if (seen) seen.add(el);
  }
  function scanAll() {
    if (!enabled || !document.body || document.hidden) return;
    try {
      if (seen) seen = new WeakSet(); // 动态更新链接或属性后可重新评分
      var els = document.body.querySelectorAll(selectors);
      for (var i = 0; i < Math.min(els.length, 2500) && hidden.length < MAX_BLOCKS; i++) scanElement(els[i]);
    } catch(e) { console.log('[limbo-91-v7] scan error: ' + e.message); }
  }
  function scheduleScan() {
    if (!enabled || mutationTimer) return;
    mutationTimer = setTimeout(function () { mutationTimer = 0; scanAll(); }, 300);
  }
  function restoreAll() {
    enabled = false; // 避免用户点击撤回后立刻又被定时扫描屏蔽
    if (observer) observer.disconnect();
    if (periodicTimer) clearInterval(periodicTimer);
    clearTimeout(mutationTimer);
    for (var i = hidden.length - 1; i >= 0; i--) {
      var v = hidden[i];
      if (!v.el || !v.el.isConnected) continue;
      v.el.style.removeProperty('display');
      if (v.display) v.el.style.setProperty('display', v.display, v.priority);
      v.el.removeAttribute('data-limbo-91-auto7');
    }
    console.log('[limbo-91-v7] undo automatic blocks: ' + hidden.length);
    hidden.length = 0;
  }
  window.surge91UndoAutoHidden = restoreAll;
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('button,[role="button"],a') : null;
    if (!btn) return;
    var label = (btn.innerText || btn.textContent || '').replace(/\\s+/g,'').trim();
    if (label === '撤回' || label === '↩️撤回' || label === '↩撤回' || label === '一键重置') {
      // 撤回原面板动作交给原脚本，稍后只恢复 v7 自己隐藏的元素。
      setTimeout(restoreAll, 0);
    }
  }, true);
  function start() {
    if (!document.body) return;
    scanAll();
    setTimeout(scanAll, 1200);
    setTimeout(scanAll, 3000);
    setTimeout(scanAll, 6000);
    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(scheduleScan);
      observer.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['href','src','class','id','target','onclick']});
    }
    periodicTimer = setInterval(scanAll, 5000);
    console.log('[limbo-91-v7] automatic high-risk scan started');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
</script>`;

    var feedbackRecovery = `<script id="limbo-91-feedback-recovery-v7">
(function(){
  'use strict';
  function hasFeedback(){
    var els = document.querySelectorAll('[id*="feedback" i], [class*="feedback" i], a[href*="limbopro.com/feedback"], a[href*="limbopro.com/6.html"]');
    for(var i=0;i<els.length;i++){
      var el=els[i];
      if(!el || el.getBoundingClientRect().width<1) continue;
      var p=el; while(p && p!==document.body){ if(getComputedStyle(p).position==='fixed') return true; p=p.parentElement; }
    }
    return false;
  }
  function run(){
    if(hasFeedback() || document.getElementById('limbo-91-recover-original-feedback-js-v7')) return;
    var s=document.createElement('script');
    s.id='limbo-91-recover-original-feedback-js-v7';
    s.src='https://limbopro.com/Adguard/feedBackLinkMake.user.js';
    s.async=true;
    (document.head || document.documentElement).appendChild(s);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(run,4500);},{once:true});
  else setTimeout(run,4500);
})();
</script>`;

    var injection = [
      '<!-- SURGE-LIMBO-91: v7 response-rewrite-injected -->',
      guard,
      passiveScan,
      feedbackRecovery,
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
    console.log('[limbo-91-v7] HTML 注入成功: ' + hostname + ' / ' + pathname);
    return $done({body:body, headers:h});
  } catch (e) {
    console.log('[limbo-91-v7] ' + e.message);
    $done({});
  }
})();
