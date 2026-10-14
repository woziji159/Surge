/*
 * Google search response chain for Surge. Modified 2026-10-14.
 * Exactly one final $done; a failed stage preserves the preceding response.
 * CAPTCHA: NobyDa/Script, Surge/JS/Google_CAPTCHA.js (GPL-3.0).
 * Cleanup: limbopro/Adblock4limbo, Adguard/Adblock4limbo.js (MIT).
 * Pagination: ddgksf2013/Scripts/endlessgoogle.js, based on tumpio/Endless Google (MIT).
 * See THIRD-PARTY-NOTICES.md and the accompanying license files.
 * This combined work is distributed under GPL-3.0, retaining MIT component notices.
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

function surgeCaptcha($response, $done) {
/********************************
Google搜索人机验证解决方案
搜索内容时遇到人机验证立即并发使用多个代理策略、策略组尝试搜索内容，并返回最优结果。

脚本作者：@NobyDa
更新时间：2024/05/19
平台兼容：Surge(iOS4.9.3+/macOS4.2.3+) / QuantumultX(1.0.26+) / Loon(3.1.9[694]+)

可在 BoxJs(低优先级)、Surge模块参数、Loon插件参数中填写筛选的代理策略、策略组的正则表达式。
所有代理策略、策略组至多筛选、使用20个，可在BoxJs中测试匹配的策略，不筛选则表示随机使用。

注意：Surge由于策略架构问题，正则表达式筛选的"代理策略"不包含"外部代理策略"；
QuantumultX、Loon则无此限制，正则表达式可筛选所有"策略组"内的"代理策略"。

*********************************
Surge(iOS 5.9.0+/macOS 5.5.0+) 模块：
https://raw.githubusercontent.com/NobyDa/Script/master/Surge/Module/GoogleCAPTCHA.sgmodule

*********************************
QuantumultX(1.0.26+) 重写资源引用：
https://raw.githubusercontent.com/NobyDa/Script/master/QuantumultX/Snippet/GoogleCAPTCHA.snippet

*********************************
Loon(3.1.9[694]+) 插件：
https://raw.githubusercontent.com/NobyDa/Script/master/Loon/Loon_Google_CAPTCHA.plugin

*********************************
BoxJs 订阅地址：
https://raw.githubusercontent.com/NobyDa/Script/master/NobyDa_BoxJs.json

*********************************/

const $ = new NobyDa_Tools();
$.ret = {};

!(async () => {
    if (($response.status || $response.statusCode) == 200) return;
    const req = JSON.parse(JSON.stringify($request));
    const policy = await $.policy();
    const regexText = (typeof $argument == 'string' && $argument) ||
        $.data.read('GOOGLE_CAPTCHA_REGEX') || // loon plugin args.
        JSON.parse($.data.read('GOOGLE_CAPTCHA') || '{}').Regex || ''; // empty = all
    const selected = [...policy.group, ...policy.proxy]
        .filter((n) => n && new RegExp(regexText).test(n))
        .sort(() => Math.random() - 0.5).slice(0, 20); // prevent too many TCP, filtered to random select up to 20
    console.log(`[INFO]: Use policy ${JSON.stringify(selected, null, 2)}`);
    await Promise.any([
        ...selected.map(
            (i) => new Promise((r, e) => {
                if (req.headers['User-Agent']) req.headers.Cookie = `${Math.random()}`; // prevent set-cookie
                if (req.headers['user-agent']) req.headers.cookie = `${Math.random()}`; // h2
                $.http[req.method.toLowerCase()]({
                    policy: i, node: i, opts: { policy: i }, // policy:surge, node:loon, opts:qx
                    ...req
                }).then((v) => {
                    if (v.status == 200) {
                        r({ policy: i, body: { ...v, status: $.isQuanX ? 'HTTP/1.1 200' : 200 } })
                    } else if (v.status == 429) {
                        e(console.log(`[INFO]: Policy "${i}" need to CAPTCHA`))
                    } else {
                        e(console.log(`[INFO]: Policy "${i}" unknown resp status "${v.status}"`))
                    }
                }).catch((err) => e(console.log(`[ERROR]: ${err}`)))
            })
        )
    ]).then((data) => {
        $.ret = data.body;
        console.log(`[INFO]: Use data from "${data.policy}"`);
    })
})()
    .catch((err) => console.log(`[ERROR]: ${(err && err.message) || err}`))
    .finally(() => $done($.ret));


function NobyDa_Tools() {
    this.isLoon = typeof $loon !== "undefined";
    this.isQuanX = typeof $configuration !== 'undefined';
    this.isSurge = typeof $environment !== 'undefined' && $environment['surge-version'];
    this.isNode = typeof module !== 'undefined' && !!module.exports;
    this.http = Object.fromEntries(
        ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"].map(
            (m) => [m.toLowerCase(), (opts) => {
                if (this.isQuanX) return new Promise((resolve, reject) => {
                    $task.fetch({ method: m, ...opts })
                        .then((r) => resolve({
                            status: r.statusCode, headers: r.headers, body: r.body,
                        }), e => reject(e.error))
                });
                if (this.isSurge || this.isLoon || this.isNode) return new Promise((resolve, reject) => {
                    const request = this.isNode ? require("request") : $httpClient;
                    request[m.toLowerCase()](opts, (e, r, b) => {
                        if (e) reject(e);
                        else resolve({ status: r.status || r.statusCode, headers: r.headers, body: b })
                    })
                });
            }]
        )
    );
    this.policy = () => {
        if (this.isSurge) return new Promise((r) => {
            $httpAPI("GET", "v1/policies", null, (v) => r({
                proxy: v.proxies,
                group: v['policy-groups']
            }))
        });
        if (this.isQuanX) return new Promise((r) => {
            $configuration.sendMessage({
                action: "get_customized_policy"
            }).then(b => r({
                proxy: Object.keys(b.ret)
                    .reduce((t, i) => [...new Set([...t, ...b.ret[i].candidates || []])], [])
                    .filter((v) => !b.ret[v] && !['direct', 'proxy', 'reject'].includes(v)),
                group: Object.keys(b.ret)
            }), () => r({}));
        });
        if (this.isLoon) return new Promise(async (r1) => {
            const config = JSON.parse($config.getConfig());
            const groupData = await Promise.all(config['all_policy_groups'].map((i) => new Promise((r2) => {
                $config.getSubPolicies(i, (b) => { r2(JSON.parse(b || '[]')) })
            })));
            r1({
                proxy: groupData.reduce((t, i) => [...new Set([...t, ...i.filter((v) => {
                    return v.type == 'node' && !config['all_buildin_nodes'].includes(v.name)
                }).map((n) => n.name)])], []),
                group: config['all_policy_groups']
            })
        });
    };
    this.data = Object.fromEntries(['read', 'write'].map(
        (i) => [i, (v1, v2) => {
            if (i === 'write') {
                if (this.isSurge || this.isLoon) return $persistentStore.write(v1, v2);
                if (this.isQuanX) return $prefs.setValueForKey(v1, v2);
            } else if (i === 'read') {
                if (this.isSurge || this.isLoon) return $persistentStore.read(v1);
                if (this.isQuanX) return $prefs.valueForKey(v1);
            }
        }]
    ));
}
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

function surgeEndless($response, $done) {
/*
[rewrite]
http:\/\/www\.google\..* url script-response-body Endless_Google.user.js

[mitm]
www.google.*
 
*/

let body = $response.body

if (/<\/html>|<\/body>/.test(body)) {
  body = body.replace('</body>', `

<script>
const elecJSPack = function(){// ==UserScript==
// @name            Endless Google
// @description     Load more results automatically and endlessly.
// @author          tumpio
// @namespace       tumpio@sci.fi
// @homepageURL     https://openuserjs.org/scripts/tumpio/Endless_Google
// @supportURL      https://github.com/tumpio/gmscripts/issues
// @icon            https://github.com/tumpio/gmscripts/raw/master/Endless_Google/large.png
// @include         http://www.google.*
// @include         https://www.google.*
// @include         https://encrypted.google.*
// @run-at          document-start
// @version         0.0.6
// @license         MIT
// @noframes
// ==/UserScript==

if (location.href.indexOf("tbm=isch") !== -1) // NOTE: Don't run on image search
    return;
if (window.top !== window.self) // NOTE: Do not run on iframes
    return;

const centerElement = "#center_col";
const loadWindowSize = 1.6;
const filtersAll = ["#foot", "#bottomads"];
const filtersCol = filtersAll.concat(["#extrares", "#imagebox_bigimages"]);
let   msg = "";

const css = \`
.page-number {
  position: relative;
  display: flex;
  flex-direction: row-reverse;
  align-items: center;
	margin-bottom: 2em;
	color: #808080;
}
.page-number::before {
  content: "";
  background-color: #ededed;
  height: 1px;
  width: 100%;
  margin: 1em 3em;
}
.endless-msg {
  position:fixed;
  bottom:0;
  left:0;
  padding:5px 10px;
  background: darkred;
  color: white;
  font-size: 11px;
  display: none;
}
.endless-msg.shown {
  display:block;
}
\`;

let pageNumber = 1;
let prevScrollY = 0;
let nextPageLoading = false;

function requestNextPage() {
    nextPageLoading = true;
    let nextPage = new URL(location.href);
    if (!nextPage.searchParams.has("q")) return;

    nextPage.searchParams.set("start", String(pageNumber * 10));
    !msg.classList.contains("shown") && msg.classList.add("shown");
    fetch(nextPage.href)
        .then(response => response.text())
        .then(text => {
            let parser = new DOMParser();
            let htmlDocument = parser.parseFromString(text, "text/html");
            let content = htmlDocument.documentElement.querySelector(centerElement);

            content.id = "col_" + pageNumber;
            filter(content, filtersCol);

            let pageMarker = document.createElement("div");
            pageMarker.textContent = String(pageNumber + 1);
            pageMarker.className = "page-number";

            let col = document.createElement("div");
            col.className = "next-col";
            col.appendChild(pageMarker);
            col.appendChild(content);
            document.querySelector(centerElement).appendChild(col);

            if (!content.querySelector("#rso")) {
                // end of results
                window.removeEventListener("scroll", onScrollDocumentEnd);
                nextPageLoading = false;
                msg.classList.contains("shown") && msg.classList.remove("shown");
                return;
            }

            pageNumber++;
            nextPageLoading = false;
            msg.classList.contains("shown") && msg.classList.remove("shown");
        });
}

function onScrollDocumentEnd() {
    let y = window.scrollY;
    let delta = y - prevScrollY;
    if (!nextPageLoading && delta > 0 && isDocumentEnd(y)) {
        requestNextPage();
    }
    prevScrollY = y;
}

function isDocumentEnd(y) {
    return y + window.innerHeight * loadWindowSize >= document.body.clientHeight;
}

function filter(node, filters) {
    for (let filter of filters) {
        let child = node.querySelector(filter);
        if (child) {
            child.parentNode.removeChild(child);
        }
    }
}

function init() {
    prevScrollY = window.scrollY;
    window.addEventListener("scroll", onScrollDocumentEnd);
    filter(document, filtersAll);
    let style = document.createElement("style");
    style.type = "text/css";
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
    msg = document.createElement("div");
    msg.setAttribute("class", "endless-msg");
    msg.innerText = "       Loading next page...";
    document.body.appendChild(msg);
}

document.addEventListener("DOMContentLoaded", init);
}()</script></body>`)

}
$done({ body })

}

(async () => {
  if (surgeStatus() !== 200) await surgeRun('CAPTCHA', surgeCaptcha, 5500);
  if (surgeStatus() !== 200 || !surgeHTML()) return;
  await surgeRun('web cleanup', surgeCleanup, 2000);
  if (/\/search(?:\?|$)/.test($request.url) && /<html|<head/i.test(surgeState.body)) {
    await surgeRun('endless results', surgeEndless, 1500);
  }
})().catch(e => console.log('[Surge Google chain] ' + e)).finally(() => surgeFinalDone(surgePatch));
