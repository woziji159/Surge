/* Surge Google Search - native-only smooth scroll v4.
 * Native Google More-results clicks, with early activation and support for wrapped links.
 * NEVER fetch/clone another Google SERP into the DOM, preserving Google media scripts.
 * If native loading cannot be triggered, leave the original button available.
 */
(function () {
  try {
    if (Number($response.status) !== 200 || typeof $response.body !== 'string') { $done({}); return; }
    var req = new URL($request.url);
    if (!/^www\.google\.[a-z.]+$/i.test(req.hostname) || req.pathname !== '/search' ||
        !req.searchParams.has('q')) { $done({}); return; }
    var headers = $response.headers || {};
    var contentType = Object.entries(headers).find(function (entry) { return entry[0].toLowerCase() === 'content-type'; });
    if (contentType && !/text\/html/i.test(String(contentType[1]))) { $done({}); return; }
    var body = $response.body;
    if (!/<\/body\s*>/i.test(body) || /id=["']surge-google-native-scroll-v4["']/.test(body)) { $done({}); return; }
    var injection = '<script id="surge-google-native-scroll-v4">' + String.raw`(function () {
  'use strict';
  if (window.top !== window.self || window.__surgeGoogleNativeScrollV4) return;
  if (location.pathname !== '/search') return;
  var initial = new URL(location.href);
  var term = initial.searchParams.get('q');
  if (!term) return;
  // Other Google result views do not necessarily use the ordinary More-results flow.
  if (initial.searchParams.get('tbm') === 'isch' ||
      initial.searchParams.get('udm') === '2' ||
      initial.searchParams.get('udm') === '50') return;
  window.__surgeGoogleNativeScrollV4 = true;

  var sawGesture = false;
  var running = false;
  var scheduled = false;
  var attemptCount = 0;
  var maxAttempts = 18;
  var previousClickAt = 0;
  var failedButtons = typeof WeakSet === 'function' ? new WeakSet() : null;
  var observing = null;
  var fallbackTimer = null;

  function isVisible(el) {
    if (!el || !el.isConnected || el.closest('[hidden],[aria-hidden="true"]')) return false;
    var c = getComputedStyle(el);
    return c.display !== 'none' && c.visibility !== 'hidden' && el.getClientRects().length > 0;
  }
  function looksLikeMore(el) {
    // Test a short, exact accessible label first to avoid grabbing article snippets.
    var t = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
    return t.length < 60 && /^(?:more(?: search)? results|show more(?: search)? results|show more|更多搜索结果|更多結果|更多搜尋結果|更多结果|显示更多结果|顯示更多結果|查看更多结果|查看更多結果)(?:\s*[⌄⌃›»↓→])?$/i.test(t);
  }
  function isSameQueryAnchor(a) {
    if (!a || !a.hasAttribute('href')) return false;
    try {
      var to = new URL(a.getAttribute('href'), location.href);
      if (to.origin !== initial.origin || to.pathname !== '/search' || to.searchParams.get('q') !== term) return false;
      for (var i = 0, keys = ['tbm', 'udm', 'tbs']; i < keys.length; i++) {
        if ((to.searchParams.get(keys[i]) || '') !== (initial.searchParams.get(keys[i]) || '')) return false;
      }
      var start = Number(to.searchParams.get('start'));
      return to.searchParams.has('start') && Number.isFinite(start) && start >= 0;
    } catch (_) { return false; }
  }
  function eligible(el) {
    if (!el || (failedButtons && failedButtons.has(el)) || !isVisible(el) || !looksLikeMore(el)) return false;
    var anchor = el.closest('a[href]');
    if (anchor) return isSameQueryAnchor(anchor);
    return !el.closest('form[action]');
  }
  function findMore() {
    var scopes = document.querySelectorAll('#botstuff,#foot,#nav,[role="navigation"],#search,main');
    for (var s = 0; s < scopes.length; s++) {
      var nodes = scopes[s].querySelectorAll('button,[role="button"],a[href]');
      // Search backward: Google's pagination is usually the last such control.
      for (var i = nodes.length - 1; i >= 0; i--) {
        if (eligible(nodes[i])) return nodes[i];
      }
    }
    var all = document.querySelectorAll('button,[role="button"],a[href]');
    for (var j = all.length - 1; j >= Math.max(0, all.length - 420); j--) {
      if (eligible(all[j])) return all[j];
    }
    return null;
  }
  function countResults() {
    var root = document.querySelector('#rso') || document.querySelector('#search');
    return root ? root.querySelectorAll('h3').length : 0;
  }
  function heightNow() {
    return Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  }
  function stopObserving() {
    if (observing) observing.disconnect();
    if (fallbackTimer) clearTimeout(fallbackTimer);
    observing = null;
    fallbackTimer = null;
  }
  function nativeClick(button) {
    if (running || attemptCount >= maxAttempts) return;
    running = true;
    attemptCount++;
    previousClickAt = Date.now();
    var oldCount = countResults();
    var oldHeight = heightNow();
    var completed = false;
    function newResults() {
      return countResults() > oldCount || heightNow() > oldHeight + 190;
    }
    function finish(success) {
      if (completed) return;
      completed = true;
      stopObserving();
      running = false;
      if (!success && failedButtons) failedButtons.add(button);
      // Do not synthesize pages or insert warning blocks: Google must initialize
      // its own image thumbnails, video posters and search UI.
      if (success) setTimeout(queue, 700);
    }
    if (typeof MutationObserver === 'function') {
      observing = new MutationObserver(function () { if (newResults()) finish(true); });
      observing.observe(document.querySelector('#search') || document.body, {subtree:true,childList:true});
    }
    try {
      var anchor = button.closest('a[href]');
      if (anchor) {
        // Let Google's registered click listeners run while preventing a plain
        // href click from triggering full-page navigation. If it has no AJAX
        // listener, the original More results control remains usable by hand.
        var cancelDefault = function (event) { event.preventDefault(); };
        anchor.addEventListener('click', cancelDefault);
        try { button.click(); } finally { anchor.removeEventListener('click', cancelDefault); }
      } else {
        button.click();
      }
    } catch (err) {
      console.log('[Surge Google native scroll] ' + err.message);
      finish(false);
      return;
    }
    if (newResults()) { finish(true); return; }
    fallbackTimer = setTimeout(function () { finish(newResults()); }, 12500);
  }
  function check() {
    scheduled = false;
    if (!sawGesture || running || attemptCount >= maxAttempts || Date.now() - previousClickAt < 1150) return;
    var pos = scrollY || document.documentElement.scrollTop || 0;
    if (pos < 75) return;
    var more = findMore();
    if (!more) return; // Don't fetch/clone other pages; Google scripts own media.
    var distance = more.getBoundingClientRect().top - innerHeight;
    // Trigger ahead of the button, NOT relative to the footer height.
    if (distance < Math.max(1000, Math.min(2200, innerHeight * 2.1))) nativeClick(more);
  }
  function queue() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(check);
  }
  function start() {
    if (!document.body) return;
    ['touchstart','touchmove','wheel','pointerdown'].forEach(function (eventName) {
      window.addEventListener(eventName, function () { sawGesture = true; queue(); }, {passive: true});
    });
    window.addEventListener('keydown', function (ev) {
      if (/^(?:ArrowDown|PageDown|End| |Space)$/.test(ev.key)) {sawGesture = true; queue();}
    });
    window.addEventListener('scroll',queue,{passive:true});
    window.addEventListener('resize',queue,{passive:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
` + '</script>';
    var modified = body.replace(/<\/body\s*>/i, injection + '\n</body>');
    var out = Object.assign({}, headers);
    Object.keys(out).forEach(function (key) {
      if (/^(?:content-security-policy|content-length)$/i.test(key)) delete out[key];
    });
    $done({ body: modified, headers: out });
  } catch (error) {
    console.log('[Surge Google native-only] ' + error.message);
    $done({});
  }
})();
