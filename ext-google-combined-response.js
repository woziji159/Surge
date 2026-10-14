/*
 * Google search response chain for Surge. Pagination locale and loading fix 2026-10-14.
 * Exactly one final $done; a failed stage preserves the preceding response.
 * Cleanup: limbopro/Adblock4limbo, Adguard/Adblock4limbo.js (MIT).
 * Pagination: native Google More results or automatic next-page navigation; no HTML cloning.
 * See THIRD-PARTY-NOTICES.md and the accompanying license files.
 * Original combined work GPL-3.0; existing license and MIT component notices retained.
 */
const surgeFinalDone = $done;
let surgeState = Object.assign({}, $response);
let surgePatch = {};
function surgeStatus() {
  // Surge supplies a numeric $response.status. Never infer success from a missing statusCode.
  return Number(surgeState.status);
}
function surgeHTML() {
  const headers = surgeState.headers || {};
  const name = Object.keys(headers).find(key => key.toLowerCase() === 'content-type');
  return name && /text\/html/i.test(headers[name]) && typeof surgeState.body === 'string';
}
function surgeApply(result) {
  if (!result || typeof result !== 'object') return;
  const next = {};
  // Only documented Surge response-result fields leave the chain.
  for (const key of ['status', 'headers', 'body', 'abort']) {
    if (Object.prototype.hasOwnProperty.call(result, key)) next[key] = result[key];
  }
  if (Object.prototype.hasOwnProperty.call(next, 'status')) next.status = Number(next.status);
  Object.assign(surgeState, next);
  Object.assign(surgePatch, next);
}
function surgeRun(label, handler, timeout) {
  return new Promise(resolve => {
    let finished = false;
    const timer = setTimeout(() => finish(null, 'timeout'), timeout);
    function finish(value, error) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (error) console.log('[Surge Google ' + label + '] ' + error);
      else surgeApply(value);
      resolve();
    }
    try {
      const result = handler(surgeState, value => finish(value));
      if (result && typeof result.catch === 'function') result.catch(e => finish(null, String(e)));
    } catch (e) { finish(null, String(e)); }
  });
}
function surgeCleanup($response, $done) {
// limbopro stage derived from 2026-10-12 snapshot; browser assets use the author origin.
/**
 * Adblock4limbo - Web Ad Removal Script
 * Author: limbopro
 * Documentation: https://limbopro.com/archives/12904.html
 * Contact: https://t.me/limboprobot
 * Telegram Group: https://t.me/Adblock4limbo
 * FAQ: https://t.me/Adblock4limbo/21
 * Github: https://github.com/limbopro/Adblock4limbo
 */
/**
 * QuantumultX Configuration:
 *
 * [rewrite_local]
 * ^https?:\/\/www\.example\.com(?!(.*(cdn-cgi|(\.(js|css|jpg|jpeg|png|webp|gif|zip|woff|woff2|m3u8|mp4|mov|m4v|avi|mkv|flv|rmvb|wmv|rm|asf|asx|mp3|json|ico|otf|ttf))))).* url script-response-body https://limbopro.com/Adguard/Adblock4limbo.js
 *
 * [mitm]
 * hostname = www.example.com
 */
/**
 * Modifies request headers to spoof User-Agent
 * var requestHeaders = $request.headers;
 * requestHeaders['User-Agent'] = 'Mozilla/6.0 (iPhone 15; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/116.0.5845.118 Mobile/15E148 Safari/604.1';
 */

/**
 * Adblock4limbo - Web Ad Removal Script (Enhanced with Domain-Specific CSS Injection)
 * Author: limbopro
 * ... (其他注释不变) ...
 */
//const CSS_URL = "https://limbopro.com/CSS/Adblock4limbo.user.css";
const privacyGate_style = `
<head>
<style id="privacy-gate">
    /* 初始强制黑屏 */
    html.locked body {
        visibility: hidden !important;
        background: #000 !important;
    }
</style>
`
const privacyGate_script = `
<script>
    (function() {
        const isOn = localStorage.getItem('nsfw_status') === 'on';
        const isLocked = localStorage.getItem('is_locked') === 'true';
        const hasPwd = !!localStorage.getItem('privateProtect');
        // 只有在“开启了保护”且“处于锁定状态或没设密码”时，才保持黑屏
        if (isOn && (isLocked || !hasPwd)) {
            document.documentElement.classList.add('locked');
        } else {
            // 否则立即移除样式，显示正常页面
            var gate = document.getElementById('privacy-gate');
            if (gate) gate.remove();
        }
    })();
</script>
</body>
`

const JS_URL = "https://limbopro.com/Adguard/Adblock4limbo.user.js";
const fc_JS_URL = "https://limbopro.com/Adguard/Adblock4limbo.function.js";
const fd_JS_URL = "https://limbopro.com/Adguard/elementBlocker.user.js";
const autoAdDetector_JS_URL = "https://limbopro.com/Adguard/autoAdDetector.js"; // 新增插入 autoAdDetector.js
// 基础注入内容
// const TITLE_INJECTION_BASE = `<link rel="stylesheet" href="${CSS_URL}" type="text/css" />
// 不再默认加载全局 Adgurad基础过滤器（CSS） 如需去导航-工具箱开启
const TITLE_INJECTION_BASE = `
<script type="text/javascript" defer src="${autoAdDetector_JS_URL}"></script>
<script type="text/javascript" defer src="${JS_URL}"></script>
<script type="text/javascript" defer src="${fc_JS_URL}"></script>
<script type="text/javascript" defer src="${fd_JS_URL}"></script>
`;
// const BODY_INJECTION_BASE = `<link rel="stylesheet" href="${CSS_URL}" type="text/css" />
// 不再默认加载全局 Adgurad基础过滤器（CSS） 如需去导航-工具箱开启
const BODY_INJECTION_BASE = `
<script type="text/javascript" defer src="${autoAdDetector_JS_URL}"></script>
<script type="text/javascript" defer src="${JS_URL}"></script>
<script type="text/javascript" defer src="${fc_JS_URL}"></script>
<script type="text/javascript" defer src="${fd_JS_URL}"></script>
</body>
`;
// 正则表达式 (不变)
const TARGET_SITES_REGEX = /(missav|iyf|netflav|hitomi|supjav|njav|javday|91porna|lk1\.supremejav\.com|turbovidhls\.com|trailerhg\.xyz|turbovidhls\.com|turboplayers\.xyz|javggvideo\.xyz|turtleviplay\.xyz|findjav\.com|stbturbo\.xyz|emturbovid\.com)/i;
const JAVBUS_REGEX = /(javbus)/i;
const DMM_REGEX = /dmm\.co/i;
const MDSP_REGEX = /d1skbu98kuldnf\.cloudfront\.net/i;
const HUARENLIVE_REGEX = /(huaren|huavod)\.(live|top)\/player\/ec\.php/i;
// const TITLE_REGEX = /<head>/i;
const TITLE_REGEX = /<head\b[^>]*>/i;
const BODY_REGEX = /<\/body>/i;
const WINDOW_OPEN_REGEX = /window\.open\s*\(/g;

// ===========================================
// 用户提供的 getRootDomain 函数
// ===========================================
/**
 * 提取主域名 (Root Domain)，考虑复杂的公共后缀 (如 co.uk)。
 * @param {string} hostname - 完整的 Hostname (e.g., www.bbc.co.uk)
 * @returns {string} - 主域名 (e.g., bbc.co.uk)
 */
function getRootDomain(hostname) {
    if (!hostname) return '';
    // 1. 预处理：移除 www. 前缀
    let siteName = hostname.toLowerCase();
    if (siteName.startsWith('www.')) {
        siteName = siteName.substring(4);
    }
    // 额外移除常见的移动端前缀 m. / mobile.
    if (siteName.startsWith('m.')) {
        siteName = siteName.substring(2);
    }
    if (siteName.startsWith('mobile.')) {
        siteName = siteName.substring(7);
    }

    // 2. 将域名分解成段 (Label)
    let parts = siteName.split('.');
    // 3. 定义常见的复杂公共后缀 (Public Suffix List - PSL 的简化版)
    const complexTLDs = [
        'co.uk', 'com.cn', 'co.jp', 'com.au', 'com.hk', 'com.tw',
        'nom.co', 'com.br', 'gov.cn', 'ac.jp', 'org.uk'
    ];

    // 4. 检查是否匹配复杂的公共后缀
    if (parts.length > 2) {
        // 检查最后两段是否是一个复杂的 TLD (e.g. "co.uk")
        const lastTwo = parts.slice(-2).join('.');

        if (complexTLDs.includes(lastTwo)) {
            // 如果是复杂的 TLD，我们取最后三段作为主域名
            return parts.slice(-3).join('.');
        }
    }
    // 5. 默认行为 (简单 TLD，如 .com)
    // 取最后两段作为主域名
    return parts.slice(-2).join('.');
}


// 主处理函数
function main() {
    try {
        const url = $request.url;
        const headers = $response.headers;
        let body = $response.body;

        // 1. 必须是 text/html 才处理
        const contentType = headers['Content-Type'] || headers['content-type'] || '';
        if (!contentType.includes('text/html')) {
            $done({});
            return;
        }
        // 2. 确保 body 是字符串
        if (typeof body !== 'string') {
            try {
                // Surge 有时返回 Buffer，尝试转码
                body = body.toString('utf8');
            } catch (e) {
                console.log("Failed to decode body");
                $done({});
                return;
            }
        }

        let modified = false;
        let newBody = body;


        // --- 动态 CSS 注入逻辑 (使用纯字符串和正则提取 hostname) ---
        let hostname = '';
        // 提取 hostname: 匹配 (http:// 或 https://) 之后，到第一个 / 或 : 之前的字符串
        // (?:https?:\/\/)? : 匹配可选的 http:// 或 https://
        // ([^:\/\n?]+) : 捕获组，匹配非 : / ? 字符
        const hostnameMatch = url.match(/^(?:https?:\/\/)?([^:\/\n?]+)/im);
        if (hostnameMatch && hostnameMatch.length > 1) {
            hostname = hostnameMatch[1];
        }
        // 3. 使用 getRootDomain 函数获取主域名
        const domain = getRootDomain(hostname);
        let domainCSS_Injection = '';
        let domainCSS_Injection_byHand = '';
        // 检查域名是否有效（包含 .）
        if (domain && domain.includes('.') && !/^google[.]/i.test(domain)) {
            const domainCSS_URL = `https://limbopro.com/CSS/${domain}.css`;
            domainCSS_Injection = `<link rel="stylesheet" href="${domainCSS_URL}" type="text/css" />\n`;
            const domainCSS_URLbyHand = `https://limbopro.com/CSS/limbopro.${domain}.css`;
            domainCSS_Injection_byHand = `<link rel="stylesheet" href="${domainCSS_URLbyHand}" type="text/css" />\n`;
            console.log(`[Adblock4limbo] Injecting domain-specific CSS: ${domainCSS_URL}`);
        } else if (/^google[.]/i.test(domain)) {
            console.log('[Adblock4limbo] Google cleanup uses official browser scripts; optional domain CSS skipped.');
        } else if (hostname) {
            console.log(`[Adblock4limbo] Ignored non-standard hostname or IP: ${hostname}`);
        }
        // 动态组合最终的注入内容
        const FINAL_TITLE_INJECTION = `<head>\n${TITLE_INJECTION_BASE}${domainCSS_Injection}${domainCSS_Injection_byHand}`;
        const FINAL_BODY_INJECTION = `\n${domainCSS_Injection}${domainCSS_Injection_byHand}${BODY_INJECTION_BASE}`;
        // --- 动态 CSS 注入逻辑结束 ---

        // 4. URL 匹配逻辑 (不变)
        const isTargetSite = TARGET_SITES_REGEX.test(url);
        const isJavbus = JAVBUS_REGEX.test(url);
        const isDMM = DMM_REGEX.test(url);
        const isMDSP = MDSP_REGEX.test(url);
        const isHuarenlive = HUARENLIVE_REGEX.test(url);
        if (isTargetSite) {
            if (TITLE_REGEX.test(newBody)) {
                newBody = newBody.replace(TITLE_REGEX, FINAL_TITLE_INJECTION);
                modified = true;
            }
            newBody = newBody.replace(WINDOW_OPEN_REGEX, 'function block_open(');
            modified = true;

        } else if (isJavbus || isDMM || isMDSP) {
            if (BODY_REGEX.test(newBody)) {
                newBody = newBody.replace(TITLE_REGEX, privacyGate_style) // 插入样式
                newBody = newBody.replace(BODY_REGEX, privacyGate_script) // 插入脚本

                newBody = newBody.replace(BODY_REGEX, FINAL_BODY_INJECTION);
                modified = true;
            }

        } else if (isHuarenlive) {
            newBody = newBody
                .replace(/"time":\s*"20"/g, '"time":"0"')
                .replace(/"img":\s*"[^"]*"/g, '"img":""');
            modified = true;
        } else {
            if (TITLE_REGEX.test(newBody)) {

                newBody = newBody.replace(TITLE_REGEX, privacyGate_style) // 插入样式
                newBody = newBody.replace(BODY_REGEX, privacyGate_script) // 插入脚本

                newBody = newBody.replace(TITLE_REGEX, FINAL_TITLE_INJECTION);
                modified = true;
            }
        }

        // 5. 如果没有修改，直接返回
        if (!modified) {
            $done({});
            return;
        }
        // 6. 修改响应头 (不变)
        const newHeaders = { ...headers };
        newHeaders["Cross-Origin-Embedder-Policy"] = "unsafe-none";
        newHeaders["Cross-Origin-Opener-Policy"] = "unsafe-none";
        newHeaders["Cross-Origin-Resource-Policy"] = "cross-origin";
        delete newHeaders["Content-Security-Policy"];
        delete newHeaders["content-security-policy"];
        delete newHeaders["X-Frame-Options"];
        delete newHeaders["x-frame-options"];
        delete newHeaders["Referrer-Policy"];

        // 7. 返回修改后的响应
        $done({
            headers: newHeaders,
            body: newBody
        });

    } catch (error) {
        console.log(`Adblock4limbo Error: ${error.message}`);
        $done({});
    }
}

// 执行
main();

}
/*
 * Google automatic pagination for Safari + Surge (native locale-aware edition).
 * No fetch/DOMParser, cloned Google HTML, iframe, or preloading.
 * Native "More results" is clicked when available; otherwise use the real next-page URL.
 * Keep surgeCleanup (Adblock4limbo) untouched.
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

// Defer only Google search's Adblock4limbo network assets until AFTER browser 'load'.
// This keeps the original cleanup logic, but avoids making Safari wait on four external scripts.
function surgeDeferGoogleCleanupAssets() {
  if (typeof surgeState.body !== 'string') return;
  const urls = [
    'https://limbopro.com/Adguard/autoAdDetector.js',
    'https://limbopro.com/Adguard/Adblock4limbo.user.js',
    'https://limbopro.com/Adguard/Adblock4limbo.function.js',
    'https://limbopro.com/Adguard/elementBlocker.user.js'
  ];
  const re = /<script\b[^>]*\bsrc=["']https:\/\/limbopro\.com\/Adguard\/(?:autoAdDetector|Adblock4limbo\.user|Adblock4limbo\.function|elementBlocker\.user)\.js["'][^>]*>\s*<\/script>\s*/gi;
  let body = surgeState.body;
  const matches = body.match(re);
  if (!matches || matches.length === 0 || !/<\/head\s*>/i.test(body)) return;
  body = body.replace(re, '');
  const loader = `<script id="surge-google-postload-cleanup">(function () {
    var urls = ${JSON.stringify(urls)};
    function begin() {
      if (window.__surgeGoogleCleanupLoaded) return;
      window.__surgeGoogleCleanupLoaded = true;
      var i = 0;
      function next() {
        if (i >= urls.length) return;
        var e = document.createElement('script');
        e.src = urls[i++];
        e.onload = next;
        e.onerror = next;
        (document.head || document.documentElement).appendChild(e);
      }
      next();
    }
    if (document.readyState === 'complete') window.setTimeout(begin, 50);
    else window.addEventListener('load', function () { window.setTimeout(begin, 50); }, { once: true });
  })();</script>`;
  body = body.replace(/<\/head\s*>/i, loader + '\n</head>');
  surgeState.body = body;
  surgePatch.body = body;
}
(async () => {
  if (surgeStatus() !== 200 || !surgeHTML()) return;
  // If both .conf and .sgmodule are enabled, do not inject a second identical chain.
  if (/id=["']surge-google-native-pagination["']/.test(surgeState.body)) return;
  await surgeRun('web cleanup', surgeCleanup, 2000);
  if (/\/search(?:\?|$)/.test($request.url) && /<html|<head/i.test(surgeState.body)) {
    surgeDeferGoogleCleanupAssets();
    await surgeRun('endless results', surgeEndless, 1500);
  }
})().catch(e => console.log('[Surge Google chain] ' + e)).finally(() => surgeFinalDone(surgePatch));
