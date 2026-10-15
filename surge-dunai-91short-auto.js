/* Surge: 毒奶 91short 定制版 v3，仅处理 HTML，保留原生工具箱 */
(function () {
  'use strict';
  try {
    var u = new URL($request.url);
    if (u.protocol !== 'https:' || u.hostname !== 'cn8.x-91short.com') return $done({});
    if (/\.(?:json|js|css|jpg|jpeg|png|webp|gif|svg|ico|woff2?|ttf|mp4|m4s|mp3|m3u8|ts|pdf|zip)(?:$|\?)/i.test(u.pathname) || /(?:\/api\/|home_recommend_list|\/cdn-cgi\/|\/verify|\/captcha)/i.test(u.pathname)) return $done({});
    var headers = $response.headers || {};
    var contentKey = Object.keys(headers).find(function (k) { return k.toLowerCase() === 'content-type'; });
    if (!contentKey || !/text\/html/i.test(headers[contentKey])) return $done({});
    var body = $response.body;
    if (typeof body !== 'string' || !/<head\b[^>]*>/i.test(body)) return $done({});
    if (/您的域名并未添加白名单导致无法访问/.test(body)) return $done({});
    if (/id=["']limbo-91-custom-v3["']/.test(body)) return $done({});
    var base = 'https://raw.githubusercontent.com/woziji159/Surge/main/';
    var customFn = base + 'limbo-function-auto.js?v=20261015-3';
    var customElement = base + 'limbo-elementBlocker-auto.js?v=20261015-3';
    var guard = `<script id="limbo-91-custom-v3">
(function () {
  'use strict';
  if (window.__limbo91PopupGuard) return;
  window.__limbo91PopupGuard = true;
  var originalOpen = window.open;
  var adDomains = /(?:^|\.)(?:doubleclick\.net|googlesyndication\.com|adsterra\.com|wpadmngr\.com|twinrdengine\.com)$/i;
  var recentGesture = 0;
  document.addEventListener('pointerdown', function(e) { if(e.isTrusted) recentGesture = Date.now(); }, true);
  document.addEventListener('keydown', function(e) { if(e.isTrusted) recentGesture = Date.now(); }, true);
  window.open = function (url) {
    var target;
    try { target = new URL(String(url||''), location.href); } catch (e) { return originalOpen.apply(this,arguments); }
    var crossSite = target.origin !== location.origin;
    // Known ad domains or unsolicited cross-site popups only.
    if (adDomains.test(target.hostname) || (crossSite && Date.now() - recentGesture > 1200)) return null;
    return originalOpen.apply(this,arguments);
  };
})();
</script>`;
    var injection = [
      guard,
      '<script defer src="https://limbopro.com/Adguard/autoAdDetector.js"></script>',
      '<script defer src="https://limbopro.com/Adguard/Adblock4limbo.user.js"></script>',
      '<script defer src="' + customFn + '"></script>',
      '<script defer src="' + customElement + '"></script>',
      '<script defer src="https://limbopro.com/Adguard/isAgent.js"></script>',
      '<link rel="stylesheet" href="https://limbopro.com/CSS/x-91short.com.css">',
      '<link rel="stylesheet" href="https://limbopro.com/CSS/limbopro.x-91short.com.css">'
    ].join('\n');
    body = body.replace(/<head\b[^>]*>/i, function(tag) { return tag + '\n' + injection + '\n'; });
    var h = Object.assign({}, headers);
    Object.keys(h).forEach(function(k) {
      if (/^(?:content-length|content-security-policy|content-security-policy-report-only)$/i.test(k)) delete h[k];
    });
    return $done({body:body, headers:h});
  } catch (e) {
    console.log('[limbo-91-v3] ' + e.message);
    $done({});
  }
})();
