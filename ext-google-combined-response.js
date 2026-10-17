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
  // Desktop Google uses classic pagination; a separate frame engine below handles Mac.
  if (/\bMacintosh\b/i.test(navigator.userAgent) && !/\b(iPhone|iPad|iPod|Mobile)\b/i.test(navigator.userAgent) && navigator.maxTouchPoints <= 1) return;
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
    var macInjection = '<script id="surge-google-mac-infinite-v5">' + String.raw`/* Surge Mac Google continuous scrolling, isolated same-origin frame engine.
 * Do NOT move Google result DOM nodes. Each additional page runs its own
 * scripts in a same-origin iframe, preserving thumbnail/video initialization.
 */
(function () {
  'use strict';
  if (window.top !== window.self || window.__surgeMacGoogleFrames) return;
  if (!/\bMacintosh\b/i.test(navigator.userAgent) || /\b(iPhone|iPad|iPod|Mobile)\b/i.test(navigator.userAgent)) return;
  if (navigator.maxTouchPoints > 1) return; // iPadOS desktop UA: keep working mobile V4.
  if (location.pathname !== '/search') return;
  var searchUrl = new URL(location.href);
  var query = searchUrl.searchParams.get('q');
  if (!query) return;
  if (searchUrl.searchParams.get('tbm') === 'isch' || ['2', '50'].indexOf(searchUrl.searchParams.get('udm')) !== -1) return;
  window.__surgeMacGoogleFrames = true;

  var MAX_PAGES = 12;
  var PRELOAD_DISTANCE = 1900;
  var pages = 0;
  var busy = false;
  var stopped = false;
  var queued = false;
  var lastUrl = location.href;
  var nextUrl = null;
  var host = null;
  var originalNext = null;
  var scrollArmed = false;
  var seen = Object.create(null);
  seen[new URL(location.href).href] = true;

  function sameSearch(u) {
    try {
      if (u.origin !== searchUrl.origin || u.pathname !== '/search' || u.searchParams.get('q') !== query) return false;
      var modes = ['tbm','udm','tbs','as_q','as_sitesearch'];
      for (var i=0; i<modes.length; i++) if ((u.searchParams.get(modes[i]) || '') !== (searchUrl.searchParams.get(modes[i]) || '')) return false;
      return true;
    } catch (_) { return false; }
  }
  function startOf(url) { return Math.max(0,parseInt(new URL(url).searchParams.get('start') || '0',10) || 0); }
  function nextPage(doc, curUrl) {
    var curr = startOf(curUrl), best = null, bestStart = Infinity;
    // Google desktop's native paging controls: keep the nearest next page.
    var sels = ['#pnnext','a[aria-label="Next page"]','a[aria-label="下一页"]','a[rel="next"]','#nav a[href*="start="]','#foot a[href*="start="]','a[href*="start="]'];
    for (var s=0;s<sels.length;s++) {
      var candidates = doc.querySelectorAll(sels[s]);
      for (var i=0;i<candidates.length;i++) {
        var a=candidates[i], u;
        try { u = new URL(a.getAttribute('href'),curUrl); } catch (_) { continue; }
        if (!sameSearch(u)) continue;
        var index=startOf(u.href);
        if (index > curr && index < bestStart && !seen[u.href]) { best=u.href;bestStart=index; }
      }
      if (best) break;
    }
    return best;
  }
  function makeHost() {
    if (host) return true;
    var search = document.querySelector('#search');
    if (!search || !search.parentNode) return false;
    host = document.createElement('div');
    host.id = 'surge-google-mac-infinite';
    host.style.cssText = 'display:block;clear:both;position:relative;width:100%;min-height:0;margin:0;padding:0;border:0;';
    search.parentNode.insertBefore(host, search.nextSibling);
    return true;
  }
  function softEnd() {
    stopped=true;
    busy=false;
    // Keep the normal Google pagination working if frames are blocked.
    // Never preventDefault on desktop's own Next link.
  }
  function isolateFrame(doc, frame) {
    var search = doc.querySelector('#search');
    if (!search || !search.parentElement) return false;
    // Hide everything except the live result subtree, while retaining its own
    // scripts, event handlers, and browser-native image lazy loading.
    var branch=search;
    while (branch && branch.parentElement) {
      var parent=branch.parentElement;
      for (var i=0;i<parent.children.length;i++) {
        var node=parent.children[i];
        if (node!==branch && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') node.style.setProperty('display','none','important');
      }
      if (parent===doc.body) break;
      branch=parent;
    }
    doc.documentElement.style.setProperty('overflow','hidden','important');
    doc.documentElement.style.setProperty('height','auto','important');
    doc.body.style.setProperty('overflow','hidden','important');
    doc.body.style.setProperty('height','auto','important');
    doc.body.style.setProperty('min-height','0','important');
    doc.body.style.setProperty('margin','0','important');
    doc.body.style.setProperty('padding','0','important');
    function measure() {
      if (!frame.isConnected || !search.isConnected) return;
      var rect=search.getBoundingClientRect();
      var h=Math.max(100,Math.ceil(rect.bottom + (doc.defaultView.scrollY || 0) + 26));
      h=Math.min(h,26000);
      frame.style.height=h+'px';
    }
    measure();
    if (typeof doc.defaultView.ResizeObserver === 'function') {
      var observer = new doc.defaultView.ResizeObserver(measure);
      observer.observe(search);
      frame.addEventListener('load',function(){observer.disconnect();},{once:true});
    }
    // Google result links should navigate the main Safari tab, not inside the
    // embedded page. Keep native interactive buttons/scripts untouched.
    doc.addEventListener('click',function (ev) {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      var a=ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (!a) return;
      var url;
      try { url=new URL(a.href); } catch (_) { return; }
      if (!/^https?:$/.test(url.protocol)) return;
      if (a.target === '_blank') return;
      ev.preventDefault();
      window.location.assign(url.href);
    },true);
    return true;
  }
  function appendPage(url) {
    if (!url || busy || stopped || !makeHost() || pages>=MAX_PAGES) return;
    busy=true;
    seen[url]=true;
    var slot=document.createElement('div');
    slot.className='surge-google-continuous-page';
    slot.style.cssText='display:block;position:relative;min-height:140px;width:100%;border:0;';
    var frame=document.createElement('iframe');
    frame.title='Google 搜索结果，第 '+(pages+2)+' 页';
    frame.setAttribute('loading','eager');
    frame.setAttribute('scrolling','no');
    // Prevent embedded Google navigation from replacing the main tab.
    frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
    frame.style.cssText='width:100%;height:140px;display:block;border:0;overflow:hidden;visibility:hidden;';
    slot.appendChild(frame);
    host.appendChild(slot);
    var completed=false;
    var timeout=setTimeout(function(){finish(false);},17000);
    function finish(ok, foundNext) {
      if (completed) return;
      completed=true;
      clearTimeout(timeout);
      busy=false;
      if (!ok) { slot.remove();softEnd();return; }
      frame.style.visibility='visible';
      slot.style.minHeight='0';
      pages++;
      lastUrl=url;
      nextUrl=foundNext;
      if (originalNext && foundNext) originalNext.href=foundNext;
      if (!foundNext || pages>=MAX_PAGES) { softEnd(); return; }
      schedule();
    }
    frame.addEventListener('load',function(){
      try {
        var doc=frame.contentDocument;
        if (!doc || !doc.body || !doc.querySelector('#search')) return finish(false);
        var u=new URL(frame.contentWindow.location.href);
        if (!sameSearch(u)) return finish(false);
        var foundNext=nextPage(doc,u.href);
        if (!isolateFrame(doc,frame)) return finish(false);
        // Let Google settle layout and start lazy thumbnails naturally.
        setTimeout(function(){finish(true,foundNext);},140);
      } catch (_) {finish(false);}
    },{once:true});
    frame.src=url;
  }
  function run() {
    queued=false;
    if (!scrollArmed || busy || stopped || !nextUrl || pages>=MAX_PAGES) return;
    // Measure the BOTTOM of the last page. Measuring the host's TOP would
    // repeatedly fetch all pages immediately after the first scroll.
    var tail = host && host.lastElementChild ? host.lastElementChild : host;
    if (!tail) return;
    if (tail.getBoundingClientRect().bottom - innerHeight < PRELOAD_DISTANCE) appendPage(nextUrl);
  }
  function schedule() { if (!queued) {queued=true;requestAnimationFrame(run);} }
  function init() {
    if (!document.body) return;
    nextUrl=nextPage(document,location.href);
    originalNext=document.querySelector('#pnnext') || document.querySelector('a[rel="next"]');
    if (!nextUrl || !makeHost()) return;
    ['wheel','touchmove','pointerdown'].forEach(function(t){addEventListener(t,function(){scrollArmed=true;schedule();},{passive:true});});
    addEventListener('keydown',function(e){if(['ArrowDown','PageDown','End',' ','Space'].indexOf(e.key)>=0){scrollArmed=true;schedule();}},{passive:true});
    addEventListener('scroll',schedule,{passive:true});
    addEventListener('resize',schedule,{passive:true});
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
` + '</script>';
    var modified = body.replace(/<\/body\s*>/i, injection + '\n' + macInjection + '\n</body>');
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
