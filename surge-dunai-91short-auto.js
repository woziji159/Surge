/*
 * Surge: 毒奶增强（仅 cn8.x-91short.com）
 * 把现有 91short 的 Adblock4limbo 响应脚本替换为本文件。
 * 保留 upstream 毒奶原有外部 JS/CSS，额外添加本站自动防弹窗和保守广告扫描。
 * 不处理 Google，不处理 API/JSON/下载，不修改分流策略。
 * 独立定点适配，不是 limbopro 官方修改版。
 */
(function () {
  'use strict';
  try {
    var requestURL = new URL($request.url);
    if (requestURL.protocol !== 'https:' || requestURL.hostname !== 'cn8.x-91short.com') return $done({});
    var excluded = /\.(?:json|js|css|jpg|jpeg|png|webp|gif|svg|ico|woff2?|ttf|mp4|m4s|mp3|m3u8|ts|pdf|zip)(?:$|\?)/i;
    if (excluded.test(requestURL.pathname) || /(?:\/api\/|home_recommend_list|\/cdn-cgi\/|\/verify|\/captcha)/i.test(requestURL.pathname)) return $done({});
    var headers = $response.headers || {};
    var ctKey = Object.keys(headers).find(function (key) { return key.toLowerCase() === 'content-type'; });
    if (!ctKey || !/\btext\/html\b/i.test(headers[ctKey])) return $done({});
    if (typeof $response.body !== 'string' || !/<head\b[^>]*>/i.test($response.body)) return $done({});
    if (/您的域名并未添加白名单导致无法访问/.test($response.body)) {
      console.log('[毒奶增强] 站点返回域名白名单错误，跳过修改。该问题需解决线路/服务器访问。');
      return $done({});
    }
    var body = $response.body;
    if (/id=["']dn-surge-site-enhancer["']/.test(body)) return $done({});
    // 已有毒奶注入时只加入自定义辅助脚本，避免重复加载上游资源。
    var hasUpstream = /<script\b[^>]*src=["'][^"']*Adblock4limbo\.user\.js/i.test(body);
    var upstream = hasUpstream ? '' : [
      '<script defer src="https://limbopro.com/Adguard/autoAdDetector.js"></script>',
      '<script defer src="https://limbopro.com/Adguard/Adblock4limbo.user.js"></script>',
      '<script defer src="https://limbopro.com/Adguard/Adblock4limbo.function.js"></script>',
      '<script defer src="https://limbopro.com/Adguard/elementBlocker.user.js"></script>',
      '<script defer src="https://limbopro.com/Adguard/isAgent.js"></script>',
      '<link rel="stylesheet" href="https://limbopro.com/CSS/x-91short.com.css">',
      '<link rel="stylesheet" href="https://limbopro.com/CSS/limbopro.x-91short.com.css">'
    ].join('\n');
    var helper = String.raw`<script id="dn-surge-site-enhancer">
(function () {
  'use strict';
  if (window.__dnSurge91SiteGuard) return;
  window.__dnSurge91SiteGuard = true;
  var KEY = 'dn_surge_91_auto_disabled_v1';
  var disabled = false;
  try { disabled = localStorage.getItem(KEY) === '1'; } catch (e) {}
  var nativeOpen = window.open;
  var blocked = 0;
  var hidden = [];
  var nativeWarned = false;
  function isTrustedDestination(value) {
    if (typeof value !== 'string' || !value) return false;
    try { var url = new URL(value, location.href);
      return url.protocol === 'https:' && (url.hostname === 'x-91short.com' || url.hostname.endsWith('.x-91short.com'));
    } catch (e) { return false; }
  }
  // 只针对脚本调用的跨站新窗口；合法站内页面仍可打开。并非全类型跳转拦截。
  window.open = function (url) {
    if (disabled || isTrustedDestination(url)) return nativeOpen.apply(this, arguments);
    blocked++;
    return null;
  };
  var MARK = 'data-dn-surge-autohidden';
  var selectors = [
    'ins.adsbygoogle', '[data-ad-slot]', '[id^="google_ads"]',
    '.advertisement', '.adsbox', '.ad-container', '.ad-banner',
    '.popup-ad', '.floating-ad',
    'iframe[src*="doubleclick.net"]', 'iframe[src*="googlesyndication.com"]'
  ].join(',');
  function hideOne(el) {
    if (disabled || !(el instanceof Element) || el.hasAttribute(MARK)) return;
    if (el.matches('html,body,main,nav,header,footer,video,audio,canvas,form,input,button')) return;
    if (el.closest('#dh_buttonContainer, #dh_buttonMain')) return;
    var oldDisplay = el.style.getPropertyValue('display');
    var oldPriority = el.style.getPropertyPriority('display');
    hidden.push([el,oldDisplay,oldPriority]);
    el.setAttribute(MARK, '1');
    el.style.setProperty('display', 'none', 'important');
  }
  function scan(node) {
    if (disabled || !(node instanceof Element)) return;
    try {
      if (node.matches(selectors)) hideOne(node);
      var matches = node.querySelectorAll(selectors);
      for (var i=0; i<Math.min(matches.length,80); i++) hideOne(matches[i]);
    } catch (e) {}
  }
  function closeWelcome() {
    // 只定位毒奶自己的“已加入去广告计划”弹窗，不处理网站自己的信息弹窗。
    var candidates = document.querySelectorAll('h1,h2,h3,p,strong,span');
    for (var i = 0; i < Math.min(candidates.length, 500); i++) {
      var text = (candidates[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (!/(?:该网站已加入毒奶.*广告计划|本网站广告、弹窗等干扰内容已被移除)/.test(text)) continue;
      var p = candidates[i];
      for (var depth=0; depth<5 && p && p !== document.body; depth++, p=p.parentElement) {
        if (!p || p === document.documentElement) break;
        var close = p.querySelector('button[aria-label*="关闭"],button[aria-label*="Close"],button[title*="关闭"],button[title*="Close"],.modal-close,.close');
        if (close) { close.click(); return; }
        var txt = (p.innerText || '').trim();
        if (txt.length>20 && txt.length<320 && /毒奶/.test(txt) && /广告计划/.test(txt)) {
          p.style.setProperty('display', 'none', 'important');
          return;
        }
      }
    }
  }
  function refresh() { scan(document.body); closeWelcome(); }
  var queued = false;
  var observer = new MutationObserver(function (changes) {
    if (disabled || queued) return;
    queued = true;
    setTimeout(function () {
      queued = false;
      var processed = 0;
      for (var i=0; i<changes.length && processed<35; i++) {
        for (var j=0; j<changes[i].addedNodes.length && processed<35; j++) {
          var node = changes[i].addedNodes[j];
          if (node.nodeType === 1) { scan(node); processed++; }
        }
      }
      closeWelcome();
    }, 140);
  });
  function makeToggle() {
    if (!document.body || document.getElementById('dn-surge-toggle')) return;
    var btn = document.createElement('button');
    btn.id = 'dn-surge-toggle';
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', '毒奶自动拦截开关');
    btn.textContent = disabled ? '🛡️关闭' : '🛡️开启';
    btn.style.cssText = 'position:fixed;left:6px;bottom:14%;z-index:2147483000;opacity:.6;font:11px sans-serif;padding:3px 5px;border-radius:6px;background:#243447;color:white;border:1px solid #7a8;';
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      disabled = !disabled;
      try { localStorage.setItem(KEY, disabled ? '1' : '0'); } catch (e) {}
      if (disabled) {
        for (var i=0; i<hidden.length; i++) {
          var entry = hidden[i];
          entry[0].style.removeProperty('display');
          if (entry[1]) entry[0].style.setProperty('display', entry[1], entry[2]);
          entry[0].removeAttribute(MARK);
        }
        hidden = [];
      } else { refresh(); }
      btn.textContent = disabled ? '🛡️关闭' : '🛡️开启';
    });
    document.body.appendChild(btn);
  }
  function init() {
    makeToggle(); refresh();
    if (document.body) observer.observe(document.body, {childList:true,subtree:true});
    // 兼容晚加载的毒奶提示，最多再补查几次，不使用常驻高频计时器。
    setTimeout(closeWelcome, 1200);
    setTimeout(closeWelcome, 3500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
</script>`;
    var old = body;
    body = body.replace(/<head\b[^>]*>/i, function (matched) { return matched + '\n' + helper + '\n' + upstream; });
    if (body === old) return $done({});
    var nextHeaders = Object.assign({}, headers);
    for (var key in nextHeaders) if (/^(?:content-security-policy|content-security-policy-report-only)$/i.test(key)) delete nextHeaders[key];
    // Surge may update Content-Length automatically after rewriting; remove stale length to avoid mismatch.
    for (var key2 in nextHeaders) if (/^content-length$/i.test(key2)) delete nextHeaders[key2];
    return $done({ body: body, headers: nextHeaders });
  } catch (e) {
    console.log('[毒奶增强] ' + e.message);
    $done({});
  }
})();
