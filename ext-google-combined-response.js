/* Surge Google Search - smoother native pagination (2026-10-15).
 * Prefetches through Google native More results; no HTML cloning or cleanup scripts.
 * Plain numbered pages retain real next-page navigation for media stability.
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
  var searchURL = new URL(location.href);
  var query = searchURL.searchParams.get('q');
  if (!query) return;
  // Image Search and AI mode manage their own loading UI; leave them alone.
  if (searchURL.searchParams.get('tbm') === 'isch' ||
      searchURL.searchParams.get('udm') === '2' ||
      searchURL.searchParams.get('udm') === '50') return;
  window.__surgeGoogleNativePaging = true;

  // Smooth native pagination: load Google's own next batch ahead of the viewport.
  // Never clone Google HTML. That previously broke thumbnail initialization.
  var gestureSeen = false;
  var scrollingDown = false;
  var scrollBaseline = window.scrollY || document.documentElement.scrollTop || 0;
  var lastActionTime = 0;
  var lastClickScrollY = -10000;
  var loading = false;
  var loadingTimeout = null;
  var loadingObserver = null;
  var stopped = false;
  var navigationStarted = false;
  var MAX_CLICKS = 16;
  var clicks = 0;
  var scheduled = null;
  var retryAfter = 0;

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    if (element.closest('[hidden], [aria-hidden="true"]')) return false;
    var style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' &&
           element.getClientRects().length > 0;
  }
  function isMoreResultsText(element) {
    var text = (element.textContent || '').replace(/\s+/g, ' ').trim();
    return text.length < 65 && /^(?:More results|Show more results|Show more|更多结果|更多搜索结果|显示更多结果|查看更多结果|更多結果|更多搜尋結果|顯示更多結果|查看更多結果)(?:\s*[›»→])?$/i.test(text);
  }
  function isNativeMore(el) {
    if (!isVisible(el) || !isMoreResultsText(el)) return false;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
    // An actual 'next page' anchor navigates rather than extending results.
    if (el.tagName === 'A' && el.getAttribute('href')) {
      try {
        var next = new URL(el.getAttribute('href'), location.href);
        if (next.pathname === '/search' && next.searchParams.has('start')) return false;
      } catch (e) { }
    }
    return true;
  }
  function findNativeMore() {
    var selectors = [
      '#botstuff button', '#botstuff [role="button"]', '#botstuff a',
      '#foot button', '#foot [role="button"]', '#foot a',
      '#nav button', '#nav [role="button"]', '#nav a',
      'nav[aria-label*="分页"] button', 'nav[aria-label*="Page"] button',
      '[role="navigation"] button', 'main button', 'main [role="button"]'
    ];
    var candidates = document.querySelectorAll(selectors.join(','));
    for (var i = 0; i < candidates.length; i++) {
      if (isNativeMore(candidates[i])) return candidates[i];
    }
    // Fallback only for a visible pagination control well below the search results.
    var fallback = document.querySelectorAll('button, [role="button"], a');
    for (var k = 0; k < fallback.length && k < 900; k++) {
      var el = fallback[k];
      if (!isNativeMore(el)) continue;
      var at = el.getBoundingClientRect().top + (window.scrollY || 0);
      if (at > document.documentElement.scrollHeight * 0.45) return el;
    }
    return null;
  }
  function goodNextLink(link, requireStep) {
    if (!link || !link.href) return null;
    try {
      var u = new URL(link.href, location.href);
      if (u.origin !== location.origin || u.pathname !== '/search' ||
          u.searchParams.get('q') !== query) return null;
      var now = Number(searchURL.searchParams.get('start')) || 0;
      var next = Number(u.searchParams.get('start'));
      if (u.searchParams.has('start') && (!Number.isFinite(next) || next <= now)) return null;
      if (requireStep && !u.searchParams.has('start')) return null;
      if (u.href === location.href) return null;
      return u.href;
    } catch (e) { return null; }
  }
  function findNextLink() {
    var direct = document.querySelectorAll(
      'a#pnnext, a[rel="next"], a[aria-label="Next page"], a[aria-label="下一页"], a[aria-label="下一頁"]');
    for (var i = 0; i < direct.length; i++) {
      var found = goodNextLink(direct[i], false);
      if (found && isVisible(direct[i])) return found;
    }
    var pages = document.querySelectorAll(
      '#botstuff a[href*="start="], #foot a[href*="start="], #nav a[href*="start="], ' +
      '[role="navigation"] a[href*="start="]');
    var bestURL = null;
    var bestStart = Infinity;
    for (var j = 0; j < pages.length; j++) {
      var href = goodNextLink(pages[j], true);
      if (!href || !isVisible(pages[j])) continue;
      var s = Number(new URL(href).searchParams.get('start'));
      if (s < bestStart) { bestStart = s; bestURL = href; }
    }
    return bestURL; // Never invent a page number that might lead to an empty page.
  }
  function scheduleCheck() {
    if (scheduled !== null) return;
    // Throttle DOM scans: don't rescan hundreds of pagination controls on every pixel.
    scheduled = window.setTimeout(function () {
      scheduled = null;
      check();
    }, 120);
  }
  function releaseLoading() {
    if (loadingObserver) { loadingObserver.disconnect(); loadingObserver = null; }
    if (loadingTimeout) { window.clearTimeout(loadingTimeout); loadingTimeout = null; }
    loading = false;
    scheduleCheck();
  }
  function activate(more, y) {
    if (loading || stopped || navigationStarted || Date.now() < retryAfter) return;
    if (clicks >= MAX_CLICKS) return;
    var now = Date.now();
    if (now - lastActionTime < 550) return;
    if (clicks && y - lastClickScrollY < 140) return;
    lastActionTime = now;
    lastClickScrollY = y;
    clicks++;
    loading = true;
    var oldHeight = document.documentElement.scrollHeight;
    var oldButton = more;
    var resultRoot = document.querySelector('#rso, #search');
    var resultCount = resultRoot ? resultRoot.querySelectorAll('.MjjYud, .g').length : 0;
    function resultsAdded() {
      if (!oldButton.isConnected) return true;
      if (resultRoot && resultRoot.querySelectorAll('.MjjYud, .g').length > resultCount) return true;
      return document.documentElement.scrollHeight > oldHeight + 260;
    }
    if (typeof MutationObserver !== 'undefined') {
      var pending = false;
      loadingObserver = new MutationObserver(function () {
        if (pending) return;
        pending = true;
        window.requestAnimationFrame(function () {
          pending = false;
          if (loading && resultsAdded()) releaseLoading();
        });
      });
      loadingObserver.observe(document.body, {childList: true, subtree: true});
    }
    try {
      // Let Google itself create all dynamic cards, images and video thumbnails.
      more.click();
    } catch (e) {
      console.log('[Google smooth pagination] Native click failed:', String(e));
      retryAfter = Date.now() + 2400;
      releaseLoading();
      return;
    }
    if (resultsAdded()) { releaseLoading(); return; }
    loadingTimeout = window.setTimeout(function () {
      if (!resultsAdded()) {
        // No redirect here: a slow native request must not suddenly refresh the page.
        retryAfter = Date.now() + 3500;
        clicks = Math.max(0, clicks - 1);
      }
      releaseLoading();
    }, 6500);
  }
  function check() {
    if (!gestureSeen || !scrollingDown || loading || stopped || navigationStarted) return;
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    if (y < 60) return;
    var more = findNativeMore();
    if (more) {
      // Load up to roughly three screenfuls ahead, measured from Google's own button.
      var gap = more.getBoundingClientRect().top - window.innerHeight;
      var lead = Math.max(1900, Math.min(3100, window.innerHeight * 2.8));
      if (gap <= lead) activate(more, y);
      return;
    }
    // Ordinary numbered pages cannot be appended without cloning Google HTML.
    // Preserve stable images: only auto-navigate if actually near a real next-page link.
    var remaining = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - y - window.innerHeight;
    if (remaining > Math.max(250, window.innerHeight * 0.4)) return;
    var nextURL = findNextLink();
    if (nextURL) { navigationStarted = true; window.location.assign(nextURL); }
  }
  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    if (gestureSeen && y > scrollBaseline + 7) scrollingDown = true;
    scrollBaseline = y;
    if (scrollingDown) scheduleCheck();
  }
  function install() {
    if (!document.body) return;
    // Requiring genuine motion avoids loops on Safari restored scroll position.
    window.addEventListener('touchstart', function () { gestureSeen = true; }, { passive: true });
    window.addEventListener('touchmove', function () { gestureSeen = true; }, { passive: true });
    window.addEventListener('wheel', function () { gestureSeen = true; }, { passive: true });
    window.addEventListener('keydown', function (e) {
      if (/^(ArrowDown|PageDown|End| |Space)$/.test(e.key)) gestureSeen = true;
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('touchend', function () { if (scrollingDown) scheduleCheck(); }, { passive: true });
    window.addEventListener('resize', scheduleCheck, { passive: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else { install(); }
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
