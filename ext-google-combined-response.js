/*
 * Surge Google Search — seamless, early-prefetch pagination (2026-10-15 v3)
 * Only Google web search; no Adblock4limbo and no automatic page navigation.
 * Keeps Google's native page intact, appends validated later results below it.
 * Appended Google dynamic widgets may not fully initialize; users can open their native page.
 */
(function () {
  'use strict';
  function finish(result) { $done(result || {}); }
  try {
    if (Number($response.status) !== 200 || typeof $response.body !== 'string') return finish();
    var requestURL = new URL($request.url);
    if (!/^www\.google\.[a-z.]+$/i.test(requestURL.hostname) ||
        requestURL.pathname !== '/search' || !requestURL.searchParams.get('q')) return finish();
    if (['isch', 'vid'].indexOf(requestURL.searchParams.get('tbm')) >= 0 ||
        ['2', '50'].indexOf(requestURL.searchParams.get('udm')) >= 0) return finish();
    var headers = $response.headers || {};
    var contentTypeName = Object.keys(headers).find(function (k) { return k.toLowerCase() === 'content-type'; });
    if (contentTypeName && !/text\/html/i.test(String(headers[contentTypeName]))) return finish();
    var html = $response.body;
    if (!/<\/body\s*>/i.test(html) || /id=["']surge-google-seamless-v3["']/.test(html)) return finish();

    var injected = String.raw`<script id="surge-google-seamless-v3">
(function () {
  'use strict';
  if (window.top !== window.self || window.__surgeGoogleSeamlessV3) return;
  if (location.pathname !== '/search') return;
  var rootURL = new URL(location.href);
  var query = rootURL.searchParams.get('q');
  if (!query || ['isch', 'vid'].indexOf(rootURL.searchParams.get('tbm')) >= 0 ||
      ['2', '50'].indexOf(rootURL.searchParams.get('udm')) >= 0) return;
  window.__surgeGoogleSeamlessV3 = true;

  var MAX_EXTRA_PAGES = 12;
  var PREFETCH_AHEAD = 3500;
  var APPEND_AHEAD = 1700;
  var currentStart = Math.max(0, Number(rootURL.searchParams.get('start')) || 0);
  var step = Math.max(1, Math.min(100, Number(rootURL.searchParams.get('num')) || 10));
  var nextURL = null;
  var prefetched = null;
  var loading = false;
  var ended = false;
  var appendedCount = 0;
  var lastAppendY = -10000;
  var lastPageKey = '';
  var visitedURLs = new Set();
  var nextIsGuess = false;
  var seenPageKeys = new Set();
  var host, sentinel, message;
  var moved = false;
  var ticking = false;
  var requestTimer = 0;
  var failureCount = 0;
  var bootAttempts = 0;

  function getResults(doc) {
    var nodes = ['#rso', '#search #rso', '#center_col #rso', '#center_col .s6JM6d'];
    for (var i = 0; i < nodes.length; i++) {
      var node = doc.querySelector(nodes[i]);
      if (node && (node.querySelector('h3') || node.querySelector('.MjjYud, .g'))) return node;
    }
    // Some Google layouts don't have #rso; only use the main result column if it has real results.
    var center = doc.querySelector('#center_col');
    if (center && center.querySelectorAll('h3').length >= 2) return center;
    return null;
  }
  function candidatePageLink(doc, current) {
    var selected = null;
    var smallest = Infinity;
    var all = doc.querySelectorAll('a[href*="start="], a#pnnext, a[rel="next"], a[aria-label="下一页"], a[aria-label="下一頁"], a[aria-label="Next page"]');
    for (var i = 0; i < all.length; i++) {
      var raw = all[i].getAttribute('href');
      if (!raw) continue;
      try {
        var u = new URL(raw, location.origin);
        var start = Number(u.searchParams.get('start'));
        if (u.origin !== location.origin || u.pathname !== '/search' ||
            u.searchParams.get('q') !== query || !u.searchParams.has('start') ||
            !Number.isFinite(start) || start <= current || start >= smallest) continue;
        smallest = start;
        selected = u.href;
      } catch (e) { /* Ignore malformed page links. */ }
    }
    if (selected && smallest - current <= 100) step = smallest - current;
    return selected;
  }
  function pageURL(start) {
    var u = new URL(rootURL.href);
    u.searchParams.set('start', String(start));
    return u.href;
  }
  function status(text) {
    if (!message) return;
    message.textContent = text || '';
    message.style.display = text ? 'block' : 'none';
  }
  function manualLink(url) {
    if (!host || host.querySelector('.sg-google-manual-link')) return;
    var wrap = document.createElement('div');
    wrap.className = 'sg-google-manual-link';
    var a = document.createElement('a');
    a.href = url;
    a.textContent = '无法自动追加？打开 Google 原生下一页';
    a.rel = 'noopener';
    wrap.appendChild(a);
    host.insertBefore(wrap, sentinel);
  }
  function safeAbsolute(raw, base) {
    if (!raw || /^(javascript:|about:)/i.test(raw)) return '';
    try {
      var u = new URL(raw, base);
      if (/^https?:$/.test(u.protocol) || /^(?:data:image\/|blob:)/i.test(raw)) return u.href;
    } catch (e) { }
    return '';
  }
  function isPlaceholder(src, img) {
    if (!src || /^(?:about:blank|data:image\/gif;base64,R0lGODlhAQAB)/i.test(src)) return true;
    return /^data:image\//i.test(src) &&
      (Number(img.getAttribute('width')) <= 1 && Number(img.getAttribute('width')) > 0 &&
       Number(img.getAttribute('height')) <= 1 && Number(img.getAttribute('height')) > 0);
  }
  function normalizeImage(img, base, priority) {
    var picks = [];
    ['data-src', 'data-iurl', 'data-original-src', 'data-original',
     'data-lazy-src', 'data-deferred-src', 'data-thumb', 'src'].forEach(function (attr) {
      var val = safeAbsolute(img.getAttribute(attr), base);
      if (val && picks.indexOf(val) < 0 && !isPlaceholder(val, img)) picks.push(val);
    });
    var rawSrc = img.getAttribute('src');
    if (isPlaceholder(rawSrc, img) && picks.length) {
      img.removeAttribute('srcset');
      img.setAttribute('src', picks[0]);
    } else if (rawSrc && safeAbsolute(rawSrc, base) && !rawSrc.startsWith('data:')) {
      img.setAttribute('src', safeAbsolute(rawSrc, base));
    }
    var srcset = img.getAttribute('data-srcset') || img.getAttribute('srcset');
    if (srcset && !img.getAttribute('srcset')) img.setAttribute('srcset', srcset);
    img.loading = priority ? 'eager' : 'lazy';
    img.decoding = 'async';
    var tries = 0;
    img.addEventListener('error', function () {
      while (tries < picks.length) {
        var next = picks[tries++];
        if (next !== img.src) { img.removeAttribute('srcset'); img.src = next; break; }
      }
    });
  }
  function fixMedia(fragment, base) {
    Array.prototype.forEach.call(fragment.querySelectorAll('img'), function (img, index) {
      normalizeImage(img, base, index < 12);
    });
    Array.prototype.forEach.call(fragment.querySelectorAll('video'), function (video) {
      if (video.getAttribute('poster')) return;
      var img = safeAbsolute(video.getAttribute('data-poster'), base);
      if (img) video.poster = img;
    });
    Array.prototype.forEach.call(fragment.querySelectorAll('[data-bg], [data-background-image]'), function (elem) {
      var bg = safeAbsolute(elem.getAttribute('data-bg') || elem.getAttribute('data-background-image'), base);
      if (bg && !elem.style.backgroundImage) elem.style.backgroundImage = 'url("' + bg.replace(/"/g, '%22') + '")';
    });
  }
  function getKey(root) {
    var links = root.querySelectorAll('a:has(h3)');
    var vals = [];
    for (var i = 0; i < links.length && vals.length < 12; i++) {
      var s = (links[i].href || '') + ' ' + (links[i].textContent || '').trim();
      if (s) vals.push(s.slice(0, 160));
    }
    if (!vals.length) {
      var headings = root.querySelectorAll('h3');
      for (var j = 0; j < headings.length && vals.length < 12; j++) vals.push(headings[j].textContent.trim());
    }
    return vals.join('|');
  }
  function buildPage(doc, url, start) {
    if (doc.querySelector('form[action*="/sorry/"], input[name="captcha"]')) throw new Error('Google 验证页');
    var result = getResults(doc);
    if (!result || !result.querySelector('h3, .g, .MjjYud')) throw new Error('下一页没有可识别的搜索结果');
    var key = getKey(result);
    if (!key || seenPageKeys.has(key) || key === lastPageKey) throw new Error('下一页结果重复或未加载');
    var container = document.createElement('section');
    container.className = 'sg-google-added-page';
    container.setAttribute('data-start', String(start));
    var copy = document.importNode(result, true);
    if (copy.id) copy.removeAttribute('id');
    Array.prototype.forEach.call(copy.querySelectorAll('[id]'), function (e) { e.removeAttribute('id'); });
    Array.prototype.forEach.call(copy.querySelectorAll('script, noscript'), function (e) { e.remove(); });
    // Keep links working even if Google provides relative URLs in the copied result.
    Array.prototype.forEach.call(copy.querySelectorAll('a[href]'), function (a) {
      var href = safeAbsolute(a.getAttribute('href'), url);
      if (href) a.href = href;
    });
    fixMedia(copy, url);
    container.appendChild(copy);
    return { element: container, key: key, pageStart: start,
             next: candidatePageLink(doc, start) };
  }
  function endWithError(error, href) {
    console.log('[Surge Google seamless] ' + String(error));
    ended = true;
    status('自动加载暂时不可用。');
    manualLink(href);
  }
  function prefetch() {
    if (!nextURL || loading || prefetched || ended || appendedCount >= MAX_EXTRA_PAGES) return;
    var address = nextURL;
    if (visitedURLs.has(address)) { ended = true; return; }
    visitedURLs.add(address);
    loading = true;
    var controller = new AbortController();
    clearTimeout(requestTimer);
    requestTimer = setTimeout(function () { controller.abort(); }, 14000);
    fetch(address, { credentials: 'same-origin', redirect: 'follow', cache: 'no-store', signal: controller.signal })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        var dest = new URL(response.url);
        if (dest.origin !== location.origin || dest.pathname !== '/search' ||
            dest.searchParams.get('q') !== query) throw new Error('Google 重定向到其他页面');
        if ((response.headers.get('content-type') || 'text/html').indexOf('text/html') < 0) throw new Error('非 HTML 页面');
        return response.text().then(function (html) { return { html: html, url: response.url }; });
      }).then(function (r) {
        var doc = new DOMParser().parseFromString(r.html, 'text/html');
        var page = buildPage(doc, r.url, Number(new URL(address).searchParams.get('start')));
        prefetched = page;
        failureCount = 0;
        check();
      }).catch(function (error) {
        if (nextIsGuess && /HTTP 404|HTTP 410/.test(String(error))) {
          ended = true;
          status('');
          return;
        }
        failureCount++;
        // One brief retry covers an intermittent mobile network hiccup.
        if (failureCount < 2 && !ended) {
          visitedURLs.delete(address);
          setTimeout(prefetch, 1700);
        } else { endWithError(error, address); }
      }).finally(function () {
        clearTimeout(requestTimer);
        loading = false;
        if (prefetched) check();
      });
  }
  function gapToTail() {
    return sentinel.getBoundingClientRect().top - window.innerHeight;
  }
  function appendReady() {
    if (!prefetched || !moved || ended || appendedCount >= MAX_EXTRA_PAGES) return;
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    if (y - lastAppendY < 160) return;
    if (gapToTail() > APPEND_AHEAD) return;
    var page = prefetched;
    prefetched = null;
    host.insertBefore(page.element, sentinel);
    seenPageKeys.add(page.key);
    lastPageKey = page.key;
    currentStart = page.pageStart;
    appendedCount++;
    lastAppendY = y;
    nextIsGuess = !page.next;
    nextURL = page.next || pageURL(currentStart + step);
    status('');
    if (appendedCount < MAX_EXTRA_PAGES) setTimeout(prefetch, 300);
  }
  function check() {
    if (!host || ended) return;
    if (prefetched) { appendReady(); return; }
    if (!loading && nextURL && (moved || gapToTail() < PREFETCH_AHEAD)) prefetch();
    if (loading && moved && gapToTail() < 550) status('正在准备下一页…');
  }
  function scrollCheck() {
    if (!moved && (window.scrollY || document.documentElement.scrollTop || 0) > 40) moved = true;
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; check(); });
  }
  function boot() {
    var result = getResults(document);
    if (!result || !result.parentNode) {
      if (++bootAttempts <= 14) setTimeout(boot, 300);
      return;
    }
    host = document.createElement('div');
    host.id = 'sg-google-endless-host';
    result.parentNode.insertBefore(host, result.nextSibling);
    message = document.createElement('div');
    message.className = 'sg-google-status';
    message.setAttribute('role', 'status');
    message.style.display = 'none';
    host.appendChild(message);
    sentinel = document.createElement('div');
    sentinel.className = 'sg-google-sentinel';
    host.appendChild(sentinel);
    var style = document.createElement('style');
    style.textContent = '.sg-google-added-page{padding-top:16px;margin-top:18px;border-top:1px solid #dadce0}' +
      '.sg-google-status,.sg-google-manual-link{font-size:13px;color:#666;padding:8px 0}' +
      '.sg-google-sentinel{height:1px;pointer-events:none}';
    document.head.appendChild(style);
    var ownKey = getKey(result);
    if (ownKey) seenPageKeys.add(ownKey);
    nextURL = candidatePageLink(document, currentStart);
    nextIsGuess = !nextURL;
    if (!nextURL) nextURL = pageURL(currentStart + step);
    window.addEventListener('scroll', scrollCheck, { passive: true });
    window.addEventListener('touchmove', function () { moved = true; scrollCheck(); }, { passive: true });
    window.addEventListener('wheel', function () { moved = true; scrollCheck(); }, { passive: true });
    window.addEventListener('keydown', function (e) {
      if (/^(?:ArrowDown|PageDown|End| )$/.test(e.key)) { moved = true; scrollCheck(); }
    });
    if (typeof IntersectionObserver !== 'undefined') {
      var observer = new IntersectionObserver(check, { rootMargin: PREFETCH_AHEAD + 'px 0px' });
      observer.observe(sentinel);
    }
    // Warm one page asynchronously; do not block search page onload or append until scrolling.
    setTimeout(prefetch, 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
</script>`;
    var patchedHeaders = Object.assign({}, headers);
    Object.keys(patchedHeaders).forEach(function (key) {
      if (/^(?:content-security-policy|content-length)$/i.test(key)) delete patchedHeaders[key];
    });
    finish({ body: html.replace(/<\/body\s*>/i, injected + '\n</body>'), headers: patchedHeaders });
  } catch (error) {
    console.log('[Surge Google seamless] ' + String(error));
    finish();
  }
})();
