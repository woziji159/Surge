/**
 * Surge BING Native Pagination + Adblock4limbo integration, 2026-10-15
 * Original Adblock4limbo baseline is copied from user's existing repository
 * official-limbo.js. The unchanged core still injects its existing CSS/JS.
 * Site-side only clicks native More or navigates to a page URL; never fetches
 * and splices raw HTML into live search pages.
 * To update the Adblock4limbo core, rebase this integration on its next version.
 */
const SEARCH_PAGE_JS = "(function () {\n  'use strict';\n  if (window.__surgeNativeSearchNextV1) return;\n  window.__surgeNativeSearchNextV1 = true;\n\n  var engine = 'bing';\n  var host = location.hostname.toLowerCase();\n  var baseURL;\n  try { baseURL = new URL(location.href); } catch (_) { return; }\n  var isBaidu = engine === 'baidu';\n  if (isBaidu) {\n    if (!/^(www|m)\\.baidu\\.com$/.test(host) || baseURL.pathname !== '/s') return;\n    if (!baseURL.searchParams.has('wd') && !baseURL.searchParams.has('word')) return;\n  } else {\n    if (!/^(www|cn)\\.bing\\.com$/.test(host) || baseURL.pathname !== '/search') return;\n    if (!baseURL.searchParams.has('q')) return;\n  }\n\n  var armed = false;\n  var busy = false;\n  var usedFallback = false;\n  var lastTriggeredAt = 0;\n  var scrollTimer = 0;\n  var stopTimer = 0;\n  var watchTimer = 0;\n  var observer = null;\n\n  function pageOffset(url) {\n    return Number(url.searchParams.get(isBaidu ? 'pn' : 'first') || (isBaidu ? 0 : 1));\n  }\n  function isValidNext(href) {\n    try {\n      var u = new URL(href, location.href);\n      if (u.origin !== baseURL.origin || u.pathname !== baseURL.pathname) return false;\n      var key = isBaidu ? (baseURL.searchParams.has('wd') ? 'wd' : 'word') : 'q';\n      if ((u.searchParams.get(key) || '') !== (baseURL.searchParams.get(key) || '')) return false;\n      return pageOffset(u) > pageOffset(baseURL);\n    } catch (_) { return false; }\n  }\n  function visible(el) {\n    if (!el || !el.getBoundingClientRect) return false;\n    var r = el.getBoundingClientRect();\n    var style = getComputedStyle(el);\n    return r.width > 0 && r.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';\n  }\n  function cleanText(el) {\n    return ((el && (el.innerText || el.textContent || el.getAttribute('aria-label') || el.title)) || '')\n      .replace(/[\\s\\u00a0]+/g, ' ').trim();\n  }\n  function nextText(text) {\n    return /^(?:下一[页頁]|下页|下一步|更多(?:结果|結果|搜索结果|搜尋結果)|加载更多|載入更多|顯示更多|显示更多|查看更多|Next(?: page)?|More results|Show more|Load more|›|»|→)(?:\\s*[›»→])?$/i.test(text);\n  }\n  function nativeMore() {\n    var sel = isBaidu\n      ? '#page button, #page [role=button], #page a, .page-container button, .page-container a, button[aria-label], a[aria-label]'\n      : '#b_results .b_pag button, #b_results .b_pag [role=button], .b_pag button, button[aria-label], a[aria-label]';\n    var nodes = document.querySelectorAll(sel);\n    for (var i = 0; i < nodes.length; i++) {\n      var e = nodes[i];\n      if (!visible(e) || e.hasAttribute('disabled') || e.getAttribute('aria-disabled') === 'true') continue;\n      if (!nextText(cleanText(e))) continue;\n      if (e.tagName === 'A' && e.href && isValidNext(e.href)) continue;\n      if (e.closest('form') || e.closest('[role=dialog]')) continue;\n      return e;\n    }\n    return null;\n  }\n  function nextLink() {\n    var sel = isBaidu\n      ? '#page a.n, #page a.next, #page a, a.new-nextpage, a[rel=next], a[aria-label*=\"下一\"]'\n      : '#b_results li.b_pag a.sb_pagN, .b_pag a.sb_pagN, .b_pag a, a[rel=next], a[aria-label*=\"Next\"]';\n    var nodes = document.querySelectorAll(sel);\n    for (var i = 0; i < nodes.length; i++) {\n      var a = nodes[i];\n      if (!a.href || !isValidNext(a.href) || !visible(a)) continue;\n      if (a.matches('a.sb_pagN, a[rel=next], a.new-nextpage')) return a;\n      if (nextText(cleanText(a))) return a;\n      if (a.getAttribute('aria-label') && nextText(a.getAttribute('aria-label'))) return a;\n    }\n    return null;\n  }\n  function fallbackHref() {\n    if (usedFallback) return null;\n    if (isBaidu && !document.querySelector('#content_left, #page, .c-result, #results')) return null;\n    if (!isBaidu && !document.querySelector('#b_results, .b_results')) return null;\n    var u = new URL(baseURL.href);\n    if (isBaidu) {\n      var rn = Number(u.searchParams.get('rn') || 10);\n      if (!Number.isFinite(rn) || rn < 1 || rn > 50) rn = 10;\n      u.searchParams.set('pn', String(Math.max(0, pageOffset(u)) + rn));\n    } else {\n      u.searchParams.set('first', String(Math.max(1, pageOffset(u)) + 10));\n    }\n    return u.href;\n  }\n  function resultCount() {\n    return document.querySelectorAll(isBaidu\n      ? '#content_left .result, #content_left .c-container, .c-result'\n      : '#b_results > li.b_algo, #b_results > li.b_ans').length;\n  }\n  function setIdleAfterMore(oldCount, oldHeight) {\n    var count = resultCount();\n    var height = document.documentElement.scrollHeight;\n    if (count > oldCount + 1 || height > oldHeight + 420) {\n      clearInterval(watchTimer);\n      clearTimeout(stopTimer);\n      busy = false;\n      // The next gesture must originate below newly loaded content.\n      armed = false;\n    }\n  }\n  function turnPage() {\n    if (!armed || busy || Date.now() - lastTriggeredAt < 1700) return;\n    var remain = document.documentElement.scrollHeight - (scrollY + innerHeight);\n    var threshold = Math.min(1500, Math.max(850, innerHeight * 1.2));\n    if (remain > threshold) return;\n    if (scrollY < 90) return;\n\n    var button = nativeMore();\n    var next = nextLink();\n    var href = next ? next.href : fallbackHref();\n    if (!button && !href) return;\n    busy = true;\n    lastTriggeredAt = Date.now();\n    if (button) {\n      var oldCount = resultCount();\n      var oldHeight = document.documentElement.scrollHeight;\n      try { button.click(); } catch (_) { busy = false; return; }\n      watchTimer = setInterval(function () { setIdleAfterMore(oldCount, oldHeight); }, 650);\n      stopTimer = setTimeout(function () {clearInterval(watchTimer); busy = true; }, 5500);\n    } else {\n      usedFallback = !next;\n      location.assign(href);\n    }\n  }\n  function queue() {\n    if (scrollTimer) return;\n    scrollTimer = setTimeout(function () {scrollTimer = 0; turnPage();}, 130);\n  }\n  function onUserScroll() {\n    armed = true;\n    queue();\n  }\n  function init() {\n    window.addEventListener('touchmove', onUserScroll, {passive: true});\n    window.addEventListener('wheel', onUserScroll, {passive: true});\n    // Keyboard / accessibility or programmatic inertial scroll after a genuine gesture\n    window.addEventListener('scroll', queue, {passive: true});\n    window.addEventListener('touchend', queue, {passive: true});\n  }\n  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});\n  else init();\n})();";

// The same native-pagination code is injected after the upstream detox injection.
function addSearchPagination(html) {
  if (typeof html !== 'string' || html.indexOf('surge-search-native-next-v1') >= 0) return html;
  var tag = '<script id="surge-search-native-next-v1">' + SEARCH_PAGE_JS + '</script>';
  if (/<\/body\s*>/i.test(html)) return html.replace(/<\/body\s*>/i, tag + '</body>');
  if (/<\/head\s*>/i.test(html)) return html.replace(/<\/head\s*>/i, tag + '</head>');
  return html;
}

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
const agent_JS_URL = "https://limbopro.com/Adguard/isAgent.js"; // 无实意
const autoAdDetector_JS_URL = "https://limbopro.com/Adguard/autoAdDetector.js"; // 新增插入 autoAdDetector.js

// 基础注入内容
// const TITLE_INJECTION_BASE = `<link rel="stylesheet" href="${CSS_URL}" type="text/css" />
// 不再默认加载全局 Adgurad基础过滤器（CSS） 如需去导航-工具箱开启
const TITLE_INJECTION_BASE = `
<script type="text/javascript" defer src="${autoAdDetector_JS_URL}"></script>
<script type="text/javascript" defer src="${JS_URL}"></script>
<script type="text/javascript" defer src="${fc_JS_URL}"></script>
<script type="text/javascript" defer src="${fd_JS_URL}"></script>
<script type="text/javascript" defer src="${agent_JS_URL}"></script>
`;

// const BODY_INJECTION_BASE = `<link rel="stylesheet" href="${CSS_URL}" type="text/css" />
// 不再默认加载全局 Adgurad基础过滤器（CSS） 如需去导航-工具箱开启
const BODY_INJECTION_BASE = `
<script type="text/javascript" defer src="${autoAdDetector_JS_URL}"></script>
<script type="text/javascript" defer src="${JS_URL}">
<script type="text/javascript" defer src="${fc_JS_URL}"></script>
<script type="text/javascript" defer src="${fd_JS_URL}"></script>
<script type="text/javascript" defer src="${agent_JS_URL}"></script>
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
        // 检查最后两段是否是一个复杂的 TLD (e.g., "co.uk")
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
        if (domain && domain.includes('.')) {
            const domainCSS_URL = `https://limbopro.com/CSS/${domain}.css`;
            domainCSS_Injection = `<link rel="stylesheet" href="${domainCSS_URL}" type="text/css" />\n`;
            const domainCSS_URLbyHand = `https://limbopro.com/CSS/limbopro.${domain}.css`;
            domainCSS_Injection_byHand = `<link rel="stylesheet" href="${domainCSS_URLbyHand}" type="text/css" />\n`;
            console.log(`[Adblock4limbo] Injecting domain-specific CSS: ${domainCSS_URL}`);
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

        // 仅对搜索结果页注入原生翻页（不对静态资源或其他站点生效）
        const paginatedBody = addSearchPagination(newBody);
        if (paginatedBody !== newBody) { newBody = paginatedBody; modified = true; }

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