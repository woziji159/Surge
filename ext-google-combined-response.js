/* Surge Google Search - pagination only, no cleanup stage.
 * Native Google More results / next page logic copied from the working version.
 * No additional CSS/JS and no Google content cleanup.
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

  var userScrolled = false;
  var lastActionTime = 0;
  var loading = false;
  var loadingTimeout = null;
  var loadingObserver = null;
  var stopped = false;
  var navigationStarted = false;
  var MAX_CLICKS = 16;
  var clicks = 0;

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
  // Only scan Google pagination regions to avoid clicking unrelated "more" controls.
  function findNativeMore() {
    var selectors = [
      '#botstuff button', '#botstuff [role="button"]', '#botstuff a',
      '#foot button', '#foot [role="button"]', '#foot a',
      '#nav button', '#nav [role="button"]', '#nav a',
      'nav[aria-label*="分页"] button', 'nav[aria-label*="Page"] button',
      '[role="navigation"] button', '#botstuff [role="button"]', 'main button', 'main [role="button"]'
    ];
    var candidates = document.querySelectorAll(selectors.join(','));
    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      if (isVisible(candidate) && isMoreResultsText(candidate)) return candidate;
    }
    // Google sometimes moves its pagination outside #botstuff/#foot.
    // Only consider short visible controls in the lower half of the document.
    var fallback = document.querySelectorAll('button, [role="button"], a');
    for (var k = 0; k < fallback.length && k < 900; k++) {
      var el = fallback[k];
      if (!isVisible(el) || !isMoreResultsText(el)) continue;
      var box = el.getBoundingClientRect();
      var at = box.top + (window.scrollY || document.documentElement.scrollTop || 0);
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
      'a#pnnext, a[rel="next"], a[aria-label="Next page"], a[aria-label="下一页"], a[aria-label="下一頁"], ' +
      'a[aria-label="More results"], a[aria-label="更多结果"], a[aria-label="更多結果"]');
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
    if (bestURL) return bestURL;
    // Last resort: Google's mobile layout occasionally omits visible pagination anchors.
    // Only navigate when an ordinary result list exists, and cap the synthetic page number.
    var start = Number(searchURL.searchParams.get('start')) || 0;
    var results = document.querySelectorAll('#search .MjjYud, #rso .MjjYud, #search .g, #rso .g');
    if (results.length >= 5 && start >= 0 && start < 90 && start % 10 === 0) {
      var fallbackURL = new URL(location.href);
      fallbackURL.searchParams.set('start', String(start + 10));
      return fallbackURL.href;
    }
    return null;
  }
  function activate() {
    if (loading || stopped || navigationStarted) return;
    var now = Date.now();
    if (now - lastActionTime < 1400) return;
    lastActionTime = now;
    var more = findNativeMore();
    if (more && clicks < MAX_CLICKS) {
      clicks++;
      userScrolled = false; // Require another user gesture before auto-loading again.
      loading = true;
      var oldHeight = document.documentElement.scrollHeight;
      var oldMore = more;
      function releaseLoading() {
        if (loadingObserver) { loadingObserver.disconnect(); loadingObserver = null; }
        if (loadingTimeout) { window.clearTimeout(loadingTimeout); loadingTimeout = null; }
        loading = false;
      }
      function resultsAdded() {
        // A new native result block usually increases page height or replaces the button.
        return document.documentElement.scrollHeight > oldHeight + 100 ||
          !oldMore.isConnected;
      }
      // Watch only during a native click. End the wait once Google appends results.
      // This does not fetch, copy, or run scripts inside Google's result cards.
      if (typeof MutationObserver !== 'undefined') {
        loadingObserver = new MutationObserver(function () {
          if (resultsAdded()) releaseLoading();
        });
        loadingObserver.observe(document.body, { childList: true, subtree: true });
      }
      try {
        // Keep Google's own initialization for images and video thumbnails.
        more.click();
      } catch (e) { releaseLoading(); return; }
      // Fallback for slow requests or Google layouts that do not append immediately.
      loadingTimeout = window.setTimeout(function () {
        if (!resultsAdded() && oldMore.isConnected && isVisible(oldMore)) {
          // Native click failed; fall back to the next page only when a link exists.
          var nextURL = findNextLink();
          if (nextURL) { navigationStarted = true; window.location.assign(nextURL); }
          else stopped = true;
        }
        releaseLoading();
      }, 3800);
      return;
    }
    // Google's traditional pagination does a normal navigation: media initialize normally.
    var nextURL = findNextLink();
    if (!nextURL) return;
    navigationStarted = true;
    window.location.assign(nextURL);
  }
  function onScroll() {
    if (!userScrolled) return;
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    if (y < 70) return;
    var maxHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    // Trigger ~1.4 screen heights before the bottom (not only the last 300px).
    // Avoid Safari's small/rounded scroll deltas dropping the trigger entirely.
    var advance = Math.max(950, Math.min(1600, Math.round(window.innerHeight * 1.4)));
    if (y + window.innerHeight >= maxHeight - advance) activate();
  }
  function install() {
    if (!document.body) return;
    // Prevent automatic next-page loops caused by restored scroll positions.
    window.addEventListener('touchstart', function () { userScrolled = true; }, { passive: true });
    window.addEventListener('touchmove', function () { userScrolled = true; }, { passive: true });
    window.addEventListener('wheel', function () { userScrolled = true; }, { passive: true });
    window.addEventListener('keydown', function (e) {
      if (/^(ArrowDown|PageDown|End| |Space)$/.test(e.key)) userScrolled = true;
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    // iOS can finish a short inertial swipe without a final scroll event.
    window.addEventListener('touchend', function () {
      if (userScrolled) window.requestAnimationFrame(onScroll);
    }, { passive: true });
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
