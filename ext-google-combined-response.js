/*
 * Google / Bing / Baidu search enhancement for Surge — 20261014-2.
 * Google keeps ownership of results, thumbnails and page initialization.
 * No HTML cloning, CAPTCHA retry, request replay or policy switching.
 * Adblock4limbo browser assets: Copyright (c) 2022 毒奶博主, MIT.
 * Original combined work GPL-3.0; see THIRD-PARTY-NOTICES.md.
 */

function surgeGoogleCleanupLoader() {
  'use strict';
  if (window.top !== window.self || window.__surgeGoogleCleanup) return;
  window.__surgeGoogleCleanup = '20261014-2';
  function load() {
    // Dynamic ordered scripts do not hold up DOMContentLoaded. Starting inside
    // that event still lets the author's scripts register their window.load hooks.
    var sources = [
      'https://limbopro.com/Adguard/Adblock4limbo.user.js',
      'https://limbopro.com/Adguard/Adblock4limbo.function.js',
      'https://limbopro.com/Adguard/elementBlocker.user.js'
    ];
    // autoAdDetector.js currently has an illegal top-level return when used as
    // a classic script. It was already unable to execute; do not request it.
    sources.forEach(function (src) {
      if (Array.from(document.scripts).some(function (script) { return script.src === src; })) return;
      var script = document.createElement('script');
      script.async = false;
      script.src = src;
      script.dataset.surgeGoogle = '20261014-2';
      script.onerror = function () { console.warn('[Surge Google] Cleanup asset unavailable:', src); };
      document.head.appendChild(script);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load, { once: true });
  } else { load(); }
}

function surgeGoogleNativePagination() {
  'use strict';
  if (window.top !== window.self || window.__surgeGoogleNativePaging) return;
  var initialURL = new URL(location.href);
  var provider = /(^|\.)google\./.test(location.hostname) ? 'google' :
    /^(?:www|cn)\.bing\.com$/.test(location.hostname) ? 'bing' :
    /^(?:www|m)\.baidu\.com$/.test(location.hostname) ? 'baidu' : '';
  var searchPath = provider === 'baidu' ? /^\/(?:s|from[^/]+(?:\/[^/]+)*\/s)$/ : /^\/search$/;
  if (!provider || !searchPath.test(location.pathname)) return;
  function queryOf(url) {
    return provider === 'baidu' ? (url.searchParams.get('wd') || url.searchParams.get('word') || '') : (url.searchParams.get('q') || '');
  }
  if (!queryOf(initialURL)) return;
  // Image Search and AI mode already have their own loading lifecycle.
  if (provider === 'google' && (initialURL.searchParams.get('tbm') === 'isch' ||
      /^(2|50)$/.test(initialURL.searchParams.get('udm') || ''))) return;
  window.__surgeGoogleNativePaging = '20261014-2';
  var contextKeys = provider === 'google' ? ['tbm', 'udm', 'tbs', 'safe', 'lr', 'cr'] :
    provider === 'bing' ? ['filters'] : [];
  var pageKey = provider === 'bing' ? 'first' : provider === 'baidu' ? 'pn' : 'start';
  var lastY = window.scrollY || 0;
  var userScrolled = false;
  var ready = document.readyState !== 'loading';
  var loading = false;
  var navigating = false;
  var paused = false;
  var clicks = 0;
  var lastAction = 0;
  var framePending = false;
  var observer = null;
  var deadline = null;
  var settleTimer = null;
  var oldControl = null;
  var oldHeight = 0;
  var oldResultCount = 0;

  function sameSearch(url) {
    var allowedOrigin = provider === 'baidu' ? /^https:\/\/(?:www|m)\.baidu\.com$/.test(url.origin) :
      provider === 'bing' ? /^https:\/\/(?:www|cn)\.bing\.com$/.test(url.origin) : url.origin === initialURL.origin;
    return allowedOrigin && searchPath.test(url.pathname) && queryOf(url) === queryOf(initialURL) &&
      contextKeys.every(function (key) {
        return (url.searchParams.get(key) || '') === (initialURL.searchParams.get(key) || '');
      });
  }
  function visible(element) {
    if (!element || !element.isConnected || element.closest('[hidden], [aria-hidden="true"]')) return false;
    var style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  }
  function moreText(element) {
    var label = element.getAttribute('aria-label') || element.textContent || '';
    label = label.replace(/\s+/g, ' ').trim();
    return label.length < 90 && /^(?:More results|Show more results|更多(?:搜索|搜尋|搜寻)?(?:结果|結果)|(?:显示|顯示|查看)更多(?:搜索|搜尋)?(?:结果|結果))(?:\s*\(?\d+\)?(?:\s*(?:results|条|條))?)?(?:\s*[›»→])?$/i.test(label);
  }
  function nativeMore() {
    var candidates = document.querySelectorAll(
      '#botstuff button, #botstuff [role="button"], #botstuff a, ' +
      '#foot button, #foot [role="button"], #foot a, ' +
      '#nav button, #nav [role="button"], #nav a, ' +
      'nav[aria-label*="分页"] button, nav[aria-label*="分頁"] button, ' +
      'nav[aria-label*="Page"] button, [role="navigation"] button');
    for (var i = 0; i < candidates.length; i++) {
      var element = candidates[i];
      if (!visible(element) || element.disabled || element.getAttribute('aria-disabled') === 'true' || !moreText(element)) continue;
      // A real link is normal pagination, not an AJAX button.
      var href = element.getAttribute('href');
      if (href && href !== '#' && !/^javascript:/i.test(href)) continue;
      return element;
    }
    return null;
  }
  function nextLink() {
    var links = document.querySelectorAll(
      'a#pnnext, a[rel="next"], a[aria-label="Next page"], a[aria-label="下一页"], a[aria-label="下一頁"], ' +
      '#botstuff a[href*="start="], #foot a[href*="start="], #nav a[href*="start="], ' +
      '[role="navigation"] a[href*="start="], ' +
      'a.sb_pagN, #b_results .b_pag a[href*="first="], ' +
      'a.new-nextpage, a.new-nextpage-only, a.new-pagenav-right, .new-pagenav a[href*="pn="], #page a.n, #page a[href*="pn="]');
    var currentStart = Number(new URL(location.href).searchParams.get(pageKey)) || (provider === 'bing' ? 1 : 0);
    var best = null;
    var bestStart = Infinity;
    for (var i = 0; i < links.length; i++) {
      if (!visible(links[i])) continue;
      try {
        var url = new URL(links[i].href, location.href);
        var start = Number(url.searchParams.get(pageKey));
        if (!sameSearch(url) || !url.searchParams.has(pageKey) || !Number.isSafeInteger(start) || start <= currentStart) continue;
        if (start < bestStart) { best = url.href; bestStart = start; }
      } catch (_) { /* Leave unrecognized navigation to Google. */ }
    }
    return best;
  }
  function pageHeight() {
    return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  }
  function atBottom(margin) {
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    return y >= 90 && y + window.innerHeight >= pageHeight() - margin;
  }
  function resultCount() {
    return document.querySelectorAll('#rso h3, #search h3').length;
  }
  function stopWatching() {
    if (observer) observer.disconnect();
    observer = null;
    window.clearTimeout(deadline);
    window.clearTimeout(settleTimer);
  }
  function completed() {
    stopWatching();
    loading = false;
    // A slow successful native load is not a permanent failure. Recheck once;
    // all new results and images remain Google's original, initialized nodes.
    window.setTimeout(schedule, Math.max(300, lastAction + 1200 - Date.now()));
  }
  function watchProgress() {
    if (!loading) return;
    var changed = resultCount() > oldResultCount || pageHeight() > oldHeight + 60;
    if (!changed) return;
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(completed, 300);
  }
  function activate() {
    if (!ready || !userScrolled || loading || paused || navigating || clicks >= 16 || !atBottom(Math.max(600, window.innerHeight))) return;
    if (!sameSearch(new URL(location.href))) return;
    if (Date.now() - lastAction < 1200) return;
    var more = nativeMore();
    if (more) {
      lastAction = Date.now();
      clicks++;
      loading = true;
      oldControl = more;
      oldHeight = pageHeight();
      oldResultCount = resultCount();
      observer = new MutationObserver(watchProgress);
      observer.observe(document.getElementById('main') || document.body, { childList: true, subtree: true });
      deadline = window.setTimeout(function () {
        stopWatching();
        loading = false;
        paused = true; // No repeated clicks/retries on a failed or blocked page.
      }, 15000);
      try { oldControl.click(); } catch (_) { stopWatching(); loading = false; paused = true; }
      return;
    }
    // A native append can start a screen early; full navigation must wait for
    // the actual bottom so the final visible results are not skipped.
    if (!atBottom(48)) return;
    var next = nextLink();
    if (next) {
      navigating = true;
      // Full navigation intentionally preserves Google's complete initialization,
      // including video thumbnails carried in its inline scripts.
      window.location.assign(next);
    }
  }
  function schedule() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(function () { framePending = false; activate(); });
  }
  function gesture() {
    userScrolled = true;
    paused = false; // Only a new user gesture may retry a timed-out control.
    schedule();
  }
  window.addEventListener('touchstart', gesture, { passive: true });
  window.addEventListener('wheel', gesture, { passive: true });
  window.addEventListener('keydown', function (event) {
    if (/^(ArrowDown|PageDown|End| |Space)$/.test(event.key)) gesture();
  });
  window.addEventListener('scroll', function () {
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    if (y > lastY + 1) schedule();
    lastY = y;
  }, { passive: true });
  window.addEventListener('pagehide', stopWatching, { once: true });
  if (!ready) document.addEventListener('DOMContentLoaded', function () { ready = true; schedule(); }, { once: true });
}

// All response-side operations are synchronous string edits. No WebView-only
// clearTimeout, DOM, URL, HTTP client or policy API is needed in Surge's JSC engine.
var surgeGooglePatch = {};
try {
  var headers = $response.headers || {};
  var contentType = Object.keys(headers).find(function (key) { return key.toLowerCase() === 'content-type'; });
  var html = $response.body;
  var requestURL = $request.url || '';
  var googleDocument = /^https:\/\/www\.google\.(?:com|cat|[a-z]{2}|(?:com|co)\.[a-z]{2})\/(?:search(?:\?|$)|(?:\?|$))/.test(requestURL);
  var otherSearch = /^https:\/\/(?:www|cn)\.bing\.com\/search(?:\?|$)/.test(requestURL) ||
    /^https:\/\/(?:www|m)\.baidu\.com\/(?:s|from[^/?]+(?:\/[^/?]+)*\/s)(?:\?|$)/.test(requestURL);
  if (Number($response.status) === 200 && (googleDocument || otherSearch) &&
      (!$request.method || $request.method === 'GET') &&
      contentType && /text\/html/i.test(headers[contentType]) && typeof html === 'string' &&
      /<head\b[^>]*>/i.test(html) && /<\/body\s*>/i.test(html) &&
      !/id=["']surge-google-cleanup-loader["']/.test(html)) {
    var loader = '<script id="surge-google-cleanup-loader" data-version="20261014-2">(' + surgeGoogleCleanupLoader.toString() + ')();</script>';
    html = html.replace(/<head\b[^>]*>/i, function (head) { return head + '\n' + loader; });
    if (/\/search(?:\?|$)/.test(requestURL) || otherSearch) {
      var pagination = '<script id="surge-google-native-pagination" data-version="20261014-2">(' + surgeGoogleNativePagination.toString() + ')();</script>';
      html = html.replace(/<\/body\s*>/i, function (end) { return pagination + '\n' + end; });
    }
    var updatedHeaders = Object.assign({}, headers);
    Object.keys(updatedHeaders).forEach(function (key) {
      if (/^content-security-policy(?:-report-only)?$/i.test(key)) delete updatedHeaders[key];
    });
    surgeGooglePatch = { body: html, headers: updatedHeaders };
  }
} catch (error) { console.log('[Surge Google 20261014-2] ' + error); }
$done(surgeGooglePatch);
