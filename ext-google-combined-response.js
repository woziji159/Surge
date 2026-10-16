/* Surge Google Search - scrolling pagination only, no cleanup stage.
 * Prefer Google native More-results loading; use fetch + DOM append for legacy next-page links.
 * Never navigate automatically; retain original page and existing thumbnails.
 */
function surgeEndless($response, $done) {
  const body = $response.body;
  if (typeof body !== 'string' || !/<\/body\s*>/i.test(body) ||
      /id=["']surge-google-native-pagination["']/.test(body)) {
    $done({});
    return;
  }
  const injection = String.raw`<script id="surge-google-native-pagination">
(function () {
  'use strict';
  if (window.top !== window.self || window.__surgeGoogleNativePaging) return;
  if (location.pathname !== '/search') return;
  var initialURL = new URL(location.href);
  var query = initialURL.searchParams.get('q');
  if (!query) return;
  // Google Images and AI Mode use incompatible pagination; leave them native.
  if (initialURL.searchParams.get('tbm') === 'isch' ||
      initialURL.searchParams.get('udm') === '2' ||
      initialURL.searchParams.get('udm') === '50') return;
  window.__surgeGoogleNativePaging = true;

  var pageURL = initialURL.href;
  var userScrolled = false;
  var loading = false;
  var stopped = false;
  var lastAction = 0;
  var nativeCount = 0;
  var appendedPages = 0;
  var nativeObserver = null;
  var nativeTimer = null;
  var errorLink = null;
  var MAX_PAGES = 16;
  var MAX_NATIVE = 16;
  var seen = Object.create(null);
  var seenContent = Object.create(null);

  function visible(el) {
    if (!el || !el.isConnected || el.closest('[hidden], [aria-hidden="true"]')) return false;
    var cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0;
  }
  function moreText(el) {
    var s = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return s.length < 65 && /^(More results|Show more results|Show more|更多结果|更多搜索结果|显示更多结果|查看更多结果|更多結果|更多搜尋結果|顯示更多結果|查看更多結果)(?:\s*[›»→])?$/i.test(s);
  }
  function findNativeMore() {
    var nodes = document.querySelectorAll('#botstuff button,#botstuff [role="button"],#foot button,#foot [role="button"],#nav button,#nav [role="button"],main button,main [role="button"]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      // Clicking an <a> that reads "More results" performs a full page navigation.
      if (el.closest('a[href]') || el.closest('form[action]') || !visible(el) || !moreText(el)) continue;
      return el;
    }
    // Some layouts place the native button outside Google's usual containers.
    var fallback = document.querySelectorAll('button,[role="button"]');
    for (var j = 0; j < fallback.length && j < 350; j++) {
      var option = fallback[j];
      if (option.closest('a[href]') || option.closest('form[action]') || !visible(option) || !moreText(option)) continue;
      var rect = option.getBoundingClientRect();
      if (rect.top + window.scrollY > document.documentElement.scrollHeight * 0.45) return option;
    }
    return null;
  }
  function validNext(anchor, baseURL, stepRequired) {
    if (!anchor || !anchor.href) return null;
    try {
      var current = new URL(baseURL);
      var next = new URL(anchor.getAttribute('href'), current);
      if (next.origin !== initialURL.origin || next.pathname !== '/search' ||
          next.searchParams.get('q') !== query) return null;
      // Never cross from web to images / news / videos, etc.
      for (var p of ['tbm','udm','tbs']) {
        if ((next.searchParams.get(p) || '') !== (initialURL.searchParams.get(p) || '')) return null;
      }
      var before = Number(current.searchParams.get('start')) || 0;
      var after = Number(next.searchParams.get('start'));
      if (!next.searchParams.has('start') || !Number.isFinite(after) || after <= before) return null;
      if (stepRequired && after - before > 100) return null;
      if (next.href === current.href || seen[next.href]) return null;
      return next.href;
    } catch (_) { return null; }
  }
  function findNextLink(doc, baseURL) {
    var links = doc.querySelectorAll('a#pnnext,a[rel="next"],a[aria-label="Next page"],a[aria-label="下一页"],a[aria-label="下一頁"],#botstuff a[href*="start="],#foot a[href*="start="],#nav a[href*="start="],[role="navigation"] a[href*="start="]');
    var best = null;
    var minStart = Infinity;
    for (var i = 0; i < links.length; i++) {
      var url = validNext(links[i], baseURL, true);
      if (!url) continue;
      var start = Number(new URL(url).searchParams.get('start'));
      if (start < minStart) { minStart = start; best = url; }
    }
    if (best) return best;
    // Some Google layouts hide pagination anchors; attempt the next 10 results.
    var current = new URL(baseURL);
    var startNow = Number(current.searchParams.get('start')) || 0;
    var results = doc.querySelectorAll('#rso > div,#search .MjjYud,#search .g');
    if (results.length >= 4 && startNow >= 0 && startNow < 150 && startNow % 10 === 0) {
      current.searchParams.set('start', String(startNow + 10));
      if (!seen[current.href]) return current.href;
    }
    return null;
  }
  function normalizeImages(root) {
    var images = root.querySelectorAll('img');
    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      var source = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
      var hasSource = img.getAttribute('src');
      // Only initialize a missing src; do not overwrite Google's own thumbnails.
      if (!hasSource && source && /^(https?:|\/\/|data:image\/)/i.test(source)) img.setAttribute('src', source);
      if (!img.getAttribute('srcset') && img.getAttribute('data-srcset')) img.setAttribute('srcset', img.getAttribute('data-srcset'));
    }
  }
  function showError(nextURL) {
    // In failure cases allow manual navigation; never force a full-page redirect.
    var node = document.getElementById('surge-google-page-notice');
    if (!node) {
      node = document.createElement('div');
      node.id = 'surge-google-page-notice';
      node.style.cssText = 'margin:20px 0;padding:12px 8px;text-align:center;font-size:14px;color:#666';
      (document.querySelector('#rso') || document.querySelector('#search') || document.body).appendChild(node);
    }
    node.textContent = '暂时无法继续加载搜索结果。 ';
    if (nextURL) {
      var a = document.createElement('a');
      a.href = nextURL;
      a.textContent = '手动打开下一页';
      a.style.cssText = 'color:#1a73e8;text-decoration:underline';
      node.appendChild(a);
    }
    errorLink = node;
  }
  function clearError() { if (errorLink) { errorLink.remove(); errorLink = null; } }
  function appendNext(doc, url) {
    var source = doc.querySelector('#rso');
    var target = document.querySelector('#rso');
    if (!source || !target) {
      source = doc.querySelector('#search');
      target = document.querySelector('#search');
    }
    if (!source || !target || !source.children.length) return false;
    var headlines = source.querySelectorAll('h3');
    var fingerprint = Array.prototype.slice.call(headlines,0,4).map(function (h) { return (h.textContent || '').trim(); }).join('|');
    if (fingerprint && seenContent[fingerprint]) return false;
    var section = document.createElement('div');
    section.className = 'surge-google-appended-page';
    section.setAttribute('data-surge-page', String(appendedPages + 1));
    // Parsed document scripts must stay inert. Keep result DOM and original thumbnails.
    var count = 0;
    for (var i = 0; i < source.children.length; i++) {
      var el = source.children[i];
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/i.test(el.tagName)) continue;
      var clone = document.importNode(el, true);
      clone.querySelectorAll('script,style,noscript,template').forEach(function (item) { item.remove(); });
      // Avoid IDs on extra pages shadowing primary Google's DOM APIs.
      var ids = clone.querySelectorAll('[id]');
      for (var j = 0; j < ids.length; j++) ids[j].removeAttribute('id');
      clone.removeAttribute('id');
      normalizeImages(clone);
      section.appendChild(clone);
      count++;
    }
    if (!count || section.textContent.trim().length < 12) return false;
    target.appendChild(section);
    appendedPages++;
    if (fingerprint) seenContent[fingerprint] = true;
    pageURL = url;
    clearError();
    return true;
  }
  function fetchAppend(url) {
    if (!url || loading || stopped || appendedPages >= MAX_PAGES) return;
    loading = true;
    userScrolled = false;
    seen[url] = true;
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    fetch(url, { credentials:'same-origin', redirect:'follow', signal:ctl ? ctl.signal : undefined })
      .then(function (response) {
        if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || 'text/html') ||
            new URL(response.url).origin !== initialURL.origin || new URL(response.url).pathname !== '/search') throw Error('Invalid page');
        return response.text();
      })
      .then(function (html) {
        if (/<title[^>]*>\s*(?:sorry|unusual traffic|验证码)/i.test(html)) throw Error('Verification page');
        var doc = new DOMParser().parseFromString(html, 'text/html');
        if (!appendNext(doc, url)) throw Error('No appendable results');
        var next = findNextLink(doc, url);
        if (!next) stopped = true;
        // Never navigate; next gesture will trigger another fetch.
      })
      .catch(function () {
        // Only a user tap can navigate on failure.
        delete seen[url];
        showError(url);
        stopped = true;
      })
      .finally(function () { clearTimeout(timer); loading = false; });
  }
  function nativeLoad(button) {
    loading = true;
    userScrolled = false;
    nativeCount++;
    var oldHeight = document.documentElement.scrollHeight;
    var oldCount = document.querySelectorAll('#rso > *,#search .MjjYud').length;
    var oldButton = button;
    var done = false;
    function loaded() {
      var newCount = document.querySelectorAll('#rso > *,#search .MjjYud').length;
      return newCount > oldCount || document.documentElement.scrollHeight > oldHeight + 150 || !oldButton.isConnected;
    }
    function release() {
      if (done) return;
      done = true;
      if (nativeObserver) { nativeObserver.disconnect(); nativeObserver = null; }
      if (nativeTimer) { clearTimeout(nativeTimer); nativeTimer = null; }
      loading = false;
    }
    if (typeof MutationObserver !== 'undefined') {
      nativeObserver = new MutationObserver(function () { if (loaded()) release(); });
      nativeObserver.observe(document.body, {subtree:true,childList:true});
    }
    try { button.click(); } catch (_) { release(); return; }
    // Give the native fetch enough time to finish on slow mobile networks.
    nativeTimer = setTimeout(function () {
      if (loaded()) { release(); return; }
      release();
      var next = findNextLink(document, pageURL);
      if (next) fetchAppend(next);
      else { stopped = true; showError(null); }
    }, 12000);
  }
  function activate() {
    if (loading || stopped || nativeCount + appendedPages >= MAX_PAGES) return;
    if (Date.now() - lastAction < 1400) return;
    lastAction = Date.now();
    // The first page uses Google's own native behavior, when it is a real button.
    // After DOM-append begins, always fetch+append; never use the original page's button.
    var more = appendedPages === 0 && nativeCount < MAX_NATIVE ? findNativeMore() : null;
    if (more) { nativeLoad(more); return; }
    var next = findNextLink(document, pageURL);
    if (!next) { stopped = true; return; }
    fetchAppend(next);
  }
  function onScroll() {
    if (!userScrolled || loading || stopped || nativeCount + appendedPages >= MAX_PAGES) return;
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    if (y < 70) return;
    var h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    var distance = Math.max(950, Math.min(1600, Math.round(innerHeight * 1.4)));
    if (y + innerHeight >= h - distance) activate();
  }
  function install() {
    if (!document.body) return;
    var original = document.querySelector('#rso');
    if (original) {
      var heads = original.querySelectorAll('h3');
      var first = Array.prototype.slice.call(heads,0,4).map(function (h) { return (h.textContent || '').trim(); }).join('|');
      if (first) seenContent[first] = true;
    }
    for (var ev of ['touchstart','touchmove','wheel']) {
      window.addEventListener(ev, function () { userScrolled = true; }, {passive:true});
    }
    window.addEventListener('keydown', function (e) { if (/^(ArrowDown|PageDown|End| |Space)$/.test(e.key)) userScrolled = true; });
    window.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('touchend', function () { if (userScrolled) requestAnimationFrame(onScroll); }, {passive:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
</script>`;
  $done({ body: body.replace(/<\/body\s*>/i, injection + '\n</body>') });
}

(function main() {
  try {
    if (Number($response.status) !== 200 || typeof $response.body !== 'string') { $done({}); return; }
    var req = new URL($request.url);
    if (!/^www\.google\.[a-z.]+$/i.test(req.hostname) || req.pathname !== '/search' ||
        !req.searchParams.has('q')) { $done({}); return; }
    var headers = $response.headers || {};
    var contentType = Object.entries(headers).find(function (entry) { return entry[0].toLowerCase() === 'content-type'; });
    if (contentType && !/text\/html/i.test(String(contentType[1]))) { $done({}); return; }
    if (!/<\/body\s*>/i.test($response.body) ||
        /id=["']surge-google-native-pagination["']/.test($response.body)) { $done({}); return; }
    surgeEndless($response, function (result) {
      if (!result || typeof result.body !== 'string' || result.body === $response.body) { $done({}); return; }
      var patchedHeaders = Object.assign({}, headers);
      // Remove only restrictions that would block the inline pagination script.
      Object.keys(patchedHeaders).forEach(function (key) {
        if (/^(?:content-security-policy|content-length)$/i.test(key)) delete patchedHeaders[key];
      });
      $done({body:result.body, headers:patchedHeaders});
    });
  } catch (error) {
    console.log('[Surge Google pagination] ' + error.message);
    $done({});
  }
})();
