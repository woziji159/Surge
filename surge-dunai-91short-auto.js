/*
 * Surge — 91short 毒奶定制脚本：v9 保持 + 电影页路径/SPA 修复 v10 (2026-10-15)
 * 原始仓库: https://github.com/woziji159/Surge
 * 保留原版导航、反馈、元素屏蔽器及原生撤销功能；不新增悬浮按钮。
 * 仅用于 Surge [Script] http-response 的 HTML 响应，不是直接网页用户脚本。
 */
(function () {
  'use strict';
  try {
    var match = /^https:\/\/([^\/?#]+)(\/[^?#]*)?/i.exec(String($request.url || ''));
    var hostname = match ? match[1].toLowerCase().split(':')[0] : '';
    var pathname = match && match[2] ? match[2] : '/';
    var domain = /^(?:[a-z0-9-]+\.)*(?:x\-91short\.com)$/i; // LIMBO_SITES_HOST_PATTERN (auto-generated)
    if (!match || !domain.test(hostname)) return $done({});
    if (/\.(?:json|js|css|jpg|jpeg|png|webp|gif|svg|ico|woff2?|ttf|mp4|m4s|mp3|m3u8|ts|pdf|zip)(?:$|\?)/i.test(pathname) ||
        /(?:\/api(?:\/|$)|^\/home_recommend_list(?:\/|$)|\/cdn-cgi\/|\/verify|\/captcha)/i.test(pathname)) return $done({});

    var headers = $response.headers || {};
    var contentKey = Object.keys(headers).find(function (k) { return k.toLowerCase() === 'content-type'; });
    if (contentKey && !/\b(?:text\/html|application\/xhtml\+xml)\b/i.test(String(headers[contentKey]))) return $done({});
    var body = $response.body;
    if (typeof body !== 'string' || !/<head\b[^>]*>/i.test(body)) return $done({});
    if (/您的域名并未添加白名单导致无法访问/.test(body)) return $done({});
    if (/id=["']limbo-91-custom-v8["']/.test(body)) return $done({});

    // GitHub Raw 适合 Surge 的 script-path，但作为网页 <script src> 可能被浏览器以 nosniff 拦截。
    // 这两份定制 JS 仍来自用户自己的仓库，只将网页加载地址换成 JS CDN。
    var isOriginal91short = /(?:^|\.)x-91short\.com$/i.test(hostname);
    var base = 'https://cdn.jsdelivr.net/gh/woziji159/Surge@main/';
    var customFn = base + 'limbo-function-auto.js?v=20261015-repair5';
    var customElement = base + 'limbo-elementBlocker-auto.js?v=20261015-repair5';

    // 保留原版仅针对陌生弹窗和已知广告域名的拦截；不创建或移除工具箱按钮。
    var guard = `<script id="limbo-91-custom-v8">
(function () {
  'use strict';
  if (window.__limbo91PopupGuard) return;
  window.__limbo91PopupGuard = true;
  var originalOpen = window.open;
  var adDomains = /(?:^|\.)(?:doubleclick\.net|googlesyndication\.com|adsterra\.com|wpadmngr\.com|twinrdengine\.com)$/i;
  var recentGesture = 0;
  document.addEventListener('pointerdown', function(e) { if (e.isTrusted) recentGesture = Date.now(); }, true);
  document.addEventListener('keydown', function(e) { if (e.isTrusted) recentGesture = Date.now(); }, true);
  window.open = function (url) {
    var target;
    try { target = new URL(String(url || ''), location.href); }
    catch (e) { return originalOpen.apply(this, arguments); }
    var crossSite = target.origin !== location.origin;
    if (adDomains.test(target.hostname) || (crossSite && Date.now() - recentGesture > 1200)) return null;
    return originalOpen.apply(this, arguments);
  };
  // Hide only the three repetitive status banners, without disabling the hooks or scan.
  function hideStatusBanners() {
    if (!document.body) return;
    var boxes = document.querySelectorAll('body > div, body > aside, body > section');
    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      var txt = (box.innerText || box.textContent || '').trim();
      if (txt.length > 360 || !/(?:拦截恶意点击跳转|拦截点击弹窗广告|该网站已加入毒奶去广告计划)/.test(txt)) continue;
      var style = getComputedStyle(box);
      if (style.position !== 'fixed' || box.getBoundingClientRect().top > 400) continue;
      box.style.setProperty('display', 'none', 'important');
    }
  }
  function watchStatusBanners() {
    hideStatusBanners();
    var delay = null;
    var watcher = new MutationObserver(function () {
      if (delay) return;
      delay = setTimeout(function () { delay = null; hideStatusBanners(); }, 150);
    });
    watcher.observe(document.body, {childList:true,subtree:true});
    setTimeout(function () { watcher.disconnect(); clearTimeout(delay); }, 20000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchStatusBanners, {once:true});
  else if (document.body) watchStatusBanners();
})();
</script>`;

    // v8 针对 2026-10-15 用户提供的真实 91short 首页 HTML：
    // .msop100 -> imgad31/imgad32/imgad33/imgad35、data-id=adNN、跨站外链；
    // 直接 CSS 可即时隐藏，JS 在 DOM 动态更新时二次确认并同步支持“撤回”。
    // 不调用 v12.6 的内部私有 API，也不弹面板或新建反馈按钮。
    var passiveScan = `<style id="limbo-91-autoblock-css-v8">
/* 基于用户实际网页 HTML 的确定性广告结构，独立于扫描器评分逻辑 */
html:not([data-limbo91-autoblock-off]) body div.msop100,
html:not([data-limbo91-autoblock-off]) body a:has(> img[data-id^="ad"][class*="imgad"]),
html:not([data-limbo91-autoblock-off]) body img[data-id^="ad"][class*="imgad"],
html:not([data-limbo91-autoblock-off]) body .nav-menu-item > a[title="领彩金"],
html:not([data-limbo91-autoblock-off]) body #tablist > a[href^="https://"] {
  display: none !important;
}
</style>
<script id="limbo-91-autoblock-v8">
(function () {
  'use strict';
  if (window.__limbo91AutoBlockV8) return;
  var state = window.__limbo91AutoBlockV8 = {started:false, scans:0, autoHidden:0, enabled:true, version:'v8'};
  var changed = [];
  var tracker = typeof WeakSet === 'function' ? new WeakSet() : null;
  var observer = null, timer = 0, periodic = 0;
  var maximum = 150;
  var cssAdContainer = '.msop100';
  var candidates = [
    '.msop100',
    'a[href]',
    'img[data-id^="ad"]',
    'img[class*="imgad"]',
    'iframe[src]',
    '[data-ad-client]', '[data-ad-slot]',
    '.popup-ad', '.floating-ad', '.ad-banner',
    '[class*="popunder"]', '[id*="popunder"]'
  ].join(',');
  var knownAdHosts = /(?:^|\\.)(?:doubleclick\\.net|googlesyndication\\.com|adsterra\\.com|wpadmngr\\.com|twinrdengine\\.com)$/i;
  var protectedSelectors = '[id*="feedback" i],[class*="feedback" i],[id*="ad-detector" i],[class*="ad-detector" i],[id*="limbo" i],[class*="limbo" i]';
  function protect(node) {
    try {return !!node.closest(protectedSelectors);} catch (_) {return false;}
  }
  function urlHost(raw) {
    try {return new URL(raw, location.href).hostname.toLowerCase();} catch (_) {return '';}
  }
  function isIPv4(s) {return /^(?:\\d{1,3}\\.){3}\\d{1,3}$/.test(s);}
  function adImage(node) {
    if (!node || !node.querySelector) return false;
    return !!node.querySelector('img[data-id^="ad"],img[class*="imgad"]');
  }
  function qualifiedLink(a) {
    var host = urlHost(a.getAttribute('href') || '');
    if (!host || host === location.hostname.toLowerCase()) return false;
    if (knownAdHosts.test(host)) return true;
    if (adImage(a)) return true;
    var visibleImage = !!a.querySelector('img,picture,svg');
    var extImage = a.getAttribute('target') === '_blank' && visibleImage;
    // 当前网页的视频卡片链接位于站内；外站图片+新窗口是已验证的广告形态。
    if (extImage && (isIPv4(host) || !/(?:^|\\.)x-91short\\.com$/.test(host))) return true;
    return false;
  }
  function classify(el) {
    if (protect(el)) return null;
    var tag = (el.tagName || '').toUpperCase();
    if (tag === 'DIV' && el.matches(cssAdContainer) && adImage(el)) return {node:el, why:'homepage-ad-container'};
    if (tag === 'IMG') {
      var id = el.getAttribute('data-id') || '';
      var cn = typeof el.className === 'string' ? el.className : '';
      if (/^ad\\d+$/i.test(id) || /(?:^|\\s)imgad\\d+(?:\\s|$)/i.test(cn)) {
        var anchor = el.closest('a');
        if (anchor && !protect(anchor)) return {node:anchor, why:'known-ad-image'};
        return {node:el, why:'known-ad-image'};
      }
    }
    if (tag === 'A' && qualifiedLink(el)) return {node:el, why:'external-image-ad-link'};
    if (tag === 'IFRAME' && knownAdHosts.test(urlHost(el.getAttribute('src') || ''))) return {node:el, why:'known-ad-host'};
    if (el.matches('[data-ad-client],[data-ad-slot],.popup-ad,.floating-ad,.ad-banner,[class*="popunder"],[id*="popunder"]')) return {node:el, why:'explicit-ad-marker'};
    return null;
  }
  function hide(el, why) {
    if (!el || protect(el) || !el.isConnected || changed.length >= maximum) return;
    if (el.hasAttribute('data-limbo91-hidden-v8')) return;
    var tag = (el.tagName || '').toUpperCase();
    if (/^(?:HTML|BODY|HEAD|MAIN|NAV|HEADER|VIDEO|AUDIO|FORM)$/.test(tag)) return;
    var inline = el.style;
    if (!inline) return;
    changed.push({node:el,value:inline.getPropertyValue('display'),priority:inline.getPropertyPriority('display')});
    el.setAttribute('data-limbo91-hidden-v8', why);
    inline.setProperty('display','none','important');
    state.autoHidden++;
  }
  function scan() {
    if (!state.enabled || !document.body) return;
    state.scans++;
    try {
      var nodes = document.body.querySelectorAll(candidates);
      for (var i = 0; i < nodes.length && i < 3000 && changed.length < maximum; i++) {
        var el = nodes[i];
        if (tracker && tracker.has(el)) continue;
        // CSS 已先隐藏已知横幅；这里仍追踪并记录 DOM 变化后的新广告。
        var found = classify(el);
        if (found) hide(found.node, found.why);
        if (tracker) tracker.add(el);
      }
    } catch (e) { console.warn('[limbo-91-v8] scan error', e); }
  }
  function schedule() {
    if (!state.enabled || timer) return;
    timer = setTimeout(function(){timer=0;tracker = typeof WeakSet==='function'?new WeakSet():null;scan();}, 250);
  }
  function undo() {
    if (!state.enabled) return;
    state.enabled = false;
    document.documentElement.setAttribute('data-limbo91-autoblock-off','');
    if (observer) observer.disconnect();
    if (periodic) clearInterval(periodic);
    if (timer) clearTimeout(timer);
    for (var i=changed.length-1; i>=0; i--) {
      var item = changed[i];
      if (!item.node || !item.node.style) continue;
      item.node.style.removeProperty('display');
      if (item.value) item.node.style.setProperty('display',item.value,item.priority);
      item.node.removeAttribute('data-limbo91-hidden-v8');
    }
    changed.length=0;
    console.log('[limbo-91-v8] auto blocked elements restored');
  }
  window.surge91UndoAutoHidden = undo;
  document.addEventListener('click',function(e){
    var btn=e.target && e.target.closest ? e.target.closest('button,[role="button"],a,input[type="button"]') : null;
    if (!btn) return;
    var label=(btn.innerText||btn.textContent||btn.getAttribute('value')||'').replace(/\\s+/g,'').trim();
    if (/^(?:↩️?|↩)?撤回$/.test(label) || label==='一键重置') setTimeout(undo,0);
  },true);
  function start() {
    if (state.started || !document.body) return;
    state.started=true;
    scan();
    setTimeout(scan,500);
    setTimeout(scan,1800);
    setTimeout(scan,4200);
    if (typeof MutationObserver==='function') {
      observer = new MutationObserver(schedule);
      observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['href','src','class','data-id','target','onclick']});
    }
    periodic=setInterval(function(){tracker=null;scan();},5000);
    console.log('[limbo-91-v8] automatic scanning active');
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
</script>`;

    // New sites: conservative first-party fallback detection; 91short retains the proven v8 logic.
    var genericScan = String.raw`<script id="limbo-generic-auto-scan-v11">
(function(){
  'use strict';
  if(window.__limboGenericAutoV11)return;
  var state=window.__limboGenericAutoV11={scanCount:0,hiddenCount:0,paused:false};
  var selectors='ins.adsbygoogle,[data-ad-client],[data-ad-slot],iframe[src*="doubleclick.net"],iframe[src*="googlesyndication.com"],.adsbygoogle';
  var scheduled=0, changed=[];
  function run(){
    scheduled=0;
    if(state.paused || (window.__limbo91AutoV9 && window.__limbo91AutoV9.paused)) return;
    state.scanCount++;
    var nodes=document.querySelectorAll(selectors);
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i]; if(el.dataset.limboGenericHidden)continue;
      if(el.closest('[id*="limbo" i],[class*="limbo" i]')) continue;
      changed.push({el:el,display:el.style.getPropertyValue('display'),priority:el.style.getPropertyPriority('display')});
      el.dataset.limboGenericHidden='1';
      el.style.setProperty('display','none','important'); state.hiddenCount++;
    }
  }
  function undo(){
    state.paused=true;
    for(var i=0;i<changed.length;i++){
      var item=changed[i], el=item.el;
      if(!el || !el.style)continue;
      if(item.display)el.style.setProperty('display',item.display,item.priority);
      else el.style.removeProperty('display');
      delete el.dataset.limboGenericHidden;
    }
    changed=[];
  }
  function schedule(){if(scheduled || state.paused)return; scheduled=setTimeout(run,600);}
  function init(){
    run();
    if(window.MutationObserver)new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('scroll',schedule,{passive:true});
    document.addEventListener('click',function(e){
      var t=e.target && e.target.closest && e.target.closest('button,[role="button"],a');
      var label=t && (t.innerText||t.textContent||'').trim();
      if(label && /^(?:撤回|一键重置)$/.test(label))setTimeout(undo,0);
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
</script>`;

    var autoControls = String.raw`<script id="limbo-91-original-controls-autorun-v9">
/* 91short 自动调用原有扫描面板的交互控制器，运行于网页，不新增 UI。 */
(function () {
  'use strict';
  if (!/^(?:[a-z0-9-]+\.)*(?:x\-91short\.com)$/i.test(location.hostname)) return; // LIMBO_SITES_CONTROL_PATTERN (auto-generated)
  if (window.__limbo91AutoV9) return;
  var state = window.__limbo91AutoV9 = {
    version: 'v9', started: false, busy: false, paused: false,
    scanClicks: 0, blockClicks: 0, adguardClicks: 0, protectionClicks: 0,
    lastRun: 0, attempts: 0, lastResult: '', lastError: ''
  };
  var stopped = false, scheduled = 0, rerun = false, openedPanel = false;
  var adguardTouched = false, toggleTouched = {};
  var minRunGap = 2500;
  var panelHidden = null, manualOpenUntil = 0;
  function log(msg) { state.lastResult = msg; console.log('[limbo-91-v9]', msg); }
  function norm(value) {
    return String(value || '').replace(/[\s\u200b-\u200d\ufeff]/g, '').trim().toLowerCase();
  }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // 搜寻原面板的可点击文本；保留用户脚本自身的 click 监听器。
  function docRoots() {
    var roots = [document], seen = new Set(), index = 0;
    while (index < roots.length && roots.length < 30) {
      var root = roots[index++];
      if (seen.has(root)) continue;
      seen.add(root);
      var all;
      try { all = root.querySelectorAll('*'); } catch (_) { continue; }
      for (var i = 0; i < all.length && i < 9000; i++) {
        var el = all[i];
        if (el.shadowRoot && roots.indexOf(el.shadowRoot) === -1) roots.push(el.shadowRoot);
        if (el.tagName === 'IFRAME') {
          try {
            if (el.contentDocument && el.contentDocument.body) roots.push(el.contentDocument);
          } catch (_) { /* 跨域 iframe 不可操作 */ }
        }
      }
    }
    return roots;
  }
  function actionable(el) {
    if (!el || el.nodeType !== 1) return null;
    var tag = el.tagName || '';
    if (/^(BUTTON|A|INPUT|LABEL|SUMMARY)$/.test(tag)) return el;
    if (el.hasAttribute('onclick') || el.hasAttribute('role') && /button|switch|menuitem/.test(el.getAttribute('role')) || el.hasAttribute('tabindex')) return el;
    for (var up = 0, p = el.parentElement; p && up < 4; up++, p = p.parentElement) {
      tag = p.tagName || '';
      if (/^(BUTTON|A|INPUT|LABEL|SUMMARY)$/.test(tag)) return p;
      if (p.hasAttribute('onclick') || p.getAttribute('role') === 'button') return p;
    }
    // 部分第三方脚本把 click 绑定在 div 上，子元素的 click 会冒泡。
    return el;
  }
  function visible(el) {
    if (!el || !el.isConnected) return false;
    try {
      var style = (el.ownerDocument.defaultView || window).getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
    } catch (_) { return true; }
  }
  function pick(keys, opts) {
    opts = opts || {};
    var candidates = [];
    var roots = docRoots();
    for (var r = 0; r < roots.length; r++) {
      var root = roots[r], nodes;
      try { nodes = root.querySelectorAll('button,a,input,[role="button"],[role="switch"],[onclick],[tabindex],label,div,span'); }
      catch (_) { continue; }
      for (var i = 0; i < nodes.length && i < 10000; i++) {
        var el = nodes[i];
        if (!visible(el)) continue;
        var tag = el.tagName || '';
        var text = norm((tag === 'INPUT' ? el.value : el.innerText || el.textContent) || el.getAttribute('aria-label') || el.getAttribute('title'));
        if (!text || text.length > (opts.maxLen || 48)) continue;
        for (var k = 0; k < keys.length; k++) {
          if (text === keys[k] || (opts.contains && text.indexOf(keys[k]) !== -1)) {
            var button = actionable(el);
            if (button && visible(button)) candidates.push({el:button, text:text, rank:(text===keys[k]?0:10)+text.length});
            break;
          }
        }
      }
    }
    candidates.sort(function (a,b) { return a.rank-b.rank; });
    return candidates.length ? candidates[0] : null;
  }
  function clickHit(hit, label) {
    if (!hit || !hit.el) return false;
    try { hit.el.click(); log('已点击 '+label); return true; }
    catch (e) {state.lastError = label+': '+e.message; return false;}
  }
  function disabledText(text) {
    return /默认关闭|未开启|已关闭|已停用|未启用|关闭中|\boff\b/.test(text);
  }
  function ensureSwitches() {
    if (!adguardTouched) {
      var ad = pick(['adguard过滤器','adguardfilter'], {contains:true, maxLen:65});
      var adState = ad ? norm(ad.el.innerText || ad.el.textContent || ad.text) : '';
      if (ad && disabledText(adState)) {
        adguardTouched = clickHit(ad, 'AdGuard 过滤器');
        if (adguardTouched) state.adguardClicks++;
      } else if (ad && /已开启|已启用|开启中|\bon\b/.test(adState)) {
        adguardTouched = true;
      }
    }
    var switches = ['拦截恶意点击跳转', '拦截点击弹窗广告'];
    switches.forEach(function (name) {
      if (toggleTouched[name]) return;
      var toggle = pick([name], {contains:true, maxLen:75});
      if (!toggle) return;
      var text = norm(toggle.el.innerText || toggle.el.textContent || toggle.text);
      var checked = toggle.el.getAttribute('aria-checked');
      if (checked === 'false' || disabledText(text)) {
        toggleTouched[name] = clickHit(toggle, name);
        if (toggleTouched[name]) state.protectionClicks++;
      } else if (checked === 'true' || /已开启|已启用/.test(text)) {
        toggleTouched[name] = true;
      }
      // 状态未知不盲点绿色按钮，以免把已经启用的开关关掉。
    });
  }
  function findScanner() { return pick(['重新扫描'], {contains:true, maxLen:32}); }
  async function ensureScanner() {
    var btn = findScanner();
    if (btn) return btn;
    var open = pick(['可疑广告元素扫描'], {contains:true, maxLen:45});
    if (!open) {
      var box = pick(['工具箱','工具箱//'], {contains:true, maxLen:16});
      if (box) { clickHit(box, '工具箱'); await delay(500); }
      open = pick(['可疑广告元素扫描'], {contains:true, maxLen:45});
    }
    if (open && clickHit(open, '可疑广告元素扫描')) {
      openedPanel = true;
      await delay(600);
      return findScanner();
    }
    return null;
  }
  function getPanelRoot(scanButton) {
    if (!scanButton) return null;
    var e = scanButton, depth = 0;
    while (e && depth++ < 12 && e !== document.body) {
      if (e.nodeType !== 1) break;
      var txt = norm(e.innerText || '');
      if (txt.length < 2500 && txt.indexOf('重新扫描')!==-1 &&
          txt.indexOf('一键屏蔽')!==-1 && txt.indexOf('v12.6')!==-1) {
        var style = getComputedStyle(e);
        if (style.position === 'fixed' || style.position === 'absolute') return e;
      }
      e = e.parentElement;
    }
    return null;
  }
  function restorePanel() {
    if (!panelHidden) return;
    var el = panelHidden.el;
    if (el && el.isConnected) {
      el.style.transform = panelHidden.transform;
      el.style.pointerEvents = panelHidden.pointerEvents;
    }
    panelHidden = null;
  }
  function hidePanel(scanButton) {
    if (!openedPanel || Date.now() < manualOpenUntil) return;
    var panel = getPanelRoot(scanButton);
    if (!panel) return;
    if (panelHidden && panelHidden.el === panel) return;
    restorePanel();
    panelHidden = {el:panel, transform:panel.style.transform, pointerEvents:panel.style.pointerEvents};
    panel.style.transform = 'translateX(-300vw)';
    panel.style.pointerEvents = 'none';
  }
  function countUnprocessed() {
    var roots=docRoots();
    for (var i=0; i<roots.length; i++) {
      var nodes = roots[i].querySelectorAll('div,span,button,strong');
      for(var j=0;j<nodes.length && j<7000;j++) {
        var txt=norm(nodes[j].innerText || nodes[j].textContent || '');
        if(txt.length > 35) continue;
        var m=txt.match(/^(\d+)未处理\/?共(\d+)/);
        if(m) return Number(m[1]);
      }
    }
    return null;
  }
  async function scanAndBlock() {
    var scan = await ensureScanner();
    if (!scan) { log('原扫描按钮未出现（等待网页工具箱完成加载）'); return false; }
    if (state.paused) return false;
    if (!clickHit(scan, '重新扫描')) return false;
    state.scanClicks++;
    await delay(950);
    if (state.paused) return false;
    var block = pick(['一键屏蔽'], {contains:true, maxLen:32});
    if (!block) { log('原一键屏蔽按钮未出现'); return false; }
    var count = countUnprocessed();
    if (count === 0) { log('扫描完成：0 条未处理'); hidePanel(scan.el); return true; }
    if (clickHit(block, '一键屏蔽')) {
      state.blockClicks++;
      await delay(350);
      log('已调用原版重新扫描和一键屏蔽' + (count===null?'':'；待处理 '+count+' 条'));
      hidePanel(scan.el);
      return true;
    }
    return false;
  }
  async function work() {
    if (state.paused || stopped) return;
    if (state.busy) { rerun=true; return; }
    var now=Date.now();
    if (now - state.lastRun < minRunGap) return;
    state.lastRun=now; state.busy=true; state.attempts++;
    try {
      ensureSwitches();
      await scanAndBlock();
    } catch (e) { state.lastError=String(e.message || e); console.warn('[limbo-91-v9]',e); }
    finally {
      state.busy=false;
      if (rerun) { rerun=false; schedule(1400); }
    }
  }
  function schedule(ms) {
    if (state.paused || stopped) return;
    clearTimeout(scheduled);
    scheduled=setTimeout(function(){ scheduled=0; work(); }, ms || 650);
  }
  function boot() {
    if (state.started || !document.body) return;
    state.started=true;
    log('原版功能自动化已启动（等待面板加载）');
    schedule(1800);
    setTimeout(function(){schedule(0);}, 5000);
    setTimeout(function(){schedule(0);}, 10000);
    window.addEventListener('scroll',function(){schedule(900);},{passive:true,capture:true});
    // /film/home_recommend_list 页面内路由切换：不需要重新注入或手动点扫描按钮。
    // Safari 中 SPA 通过 pushState 改地址时通常不触发 popstate，轻量轮询做兜底。
    var lastRoute = location.href;
    function onRouteChange() {
      if (state.paused) return;
      if (location.href !== lastRoute) {
        lastRoute = location.href;
        // 页面换路由时重新识别原开关，避免把旧面板的状态误当作新面板。
        adguardTouched = false;
        toggleTouched = {};
        schedule(650);
      }
    }
    window.addEventListener('popstate', function () { onRouteChange(); schedule(900); });
    window.addEventListener('hashchange', function () { onRouteChange(); schedule(900); });
    window.addEventListener('pageshow', function () { schedule(900); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) schedule(900); });
    setInterval(onRouteChange, 1200);
    // 无限下拉和 SPA 异步追加卡片时触发，不因扫描面板自己的更新形成重入循环。
    if (typeof MutationObserver === 'function') {
      var observer = new MutationObserver(function (records) {
        for (var i=0;i<records.length;i++) {
          var r=records[i];
          if (r.type!=='childList') continue;
          for(var j=0;j<r.addedNodes.length;j++) {
            var el=r.addedNodes[j];
            if(el.nodeType!==1) continue;
            var text=(el.className && typeof el.className==='string')?el.className:'';
            if (/ad|video|list|card|msop/i.test(text) || el.matches && el.matches('img,a,iframe') || el.querySelector && el.querySelector('img,a[href],video')) { schedule(1000); return; }
          }
        }
      });
      observer.observe(document.body,{childList:true,subtree:true});
    }
    // 每次页面重新打开重新自动开启；手动撤回后暂停本页自动屏蔽，直到刷新。
    document.addEventListener('click',function(event){
      if(!event.isTrusted) return;
      var b=event.target && event.target.closest && event.target.closest('button,a,[role="button"],div,span');
      if(!b) return;
      var s=norm(b.innerText || b.textContent);
      if (s.indexOf('可疑广告元素扫描') !== -1 && s.length < 28) {
        manualOpenUntil = Date.now() + 30000;
        restorePanel();
      }
      if (s.length <= 16 && (/^撤回$/.test(s) || /^一键重置$/.test(s))) {
        state.paused=true;
        restorePanel();
        clearTimeout(scheduled);
        log('用户手动撤回，本页暂停自动屏蔽（刷新后恢复）');
      }
    },true);
    setInterval(function(){ if (!state.paused && Date.now()-state.lastRun > 6500) schedule(100); },7000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();

</script>`;

    var feedbackRecovery = `<script id="limbo-91-feedback-recovery-v8">
(function(){
  'use strict';
  function hasFeedback(){
    var els = document.querySelectorAll('[id*="feedback" i], [class*="feedback" i], a[href*="limbopro.com/feedback"], a[href*="limbopro.com/6.html"]');
    for(var i=0;i<els.length;i++){
      var el=els[i];
      if(!el || el.getBoundingClientRect().width<1) continue;
      var p=el; while(p && p!==document.body){ if(getComputedStyle(p).position==='fixed') return true; p=p.parentElement; }
    }
    return false;
  }
  function run(){
    if(hasFeedback() || document.getElementById('limbo-91-recover-original-feedback-js-v8')) return;
    var s=document.createElement('script');
    s.id='limbo-91-recover-original-feedback-js-v8';
    s.src='https://limbopro.com/Adguard/feedBackLinkMake.user.js';
    s.async=true;
    (document.head || document.documentElement).appendChild(s);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(run,4500);},{once:true});
  else setTimeout(run,4500);
})();
</script>`;

    var injection = [
      '<!-- SURGE-LIMBO-91: v8 response-rewrite-injected -->',
      guard,
      isOriginal91short ? passiveScan : genericScan,
      feedbackRecovery,
      autoControls,
      '<script defer src="https://limbopro.com/Adguard/autoAdDetector.js"></script>',
      '<script defer src="https://limbopro.com/Adguard/Adblock4limbo.user.js"></script>',
      '<script defer src="' + customFn + '"></script>',
      '<script defer src="' + customElement + '"></script>',
      '<script defer src="https://limbopro.com/Adguard/isAgent.js"></script>',
      isOriginal91short ? '<link rel="stylesheet" href="https://limbopro.com/CSS/x-91short.com.css">' : '',
      isOriginal91short ? '<link rel="stylesheet" href="https://limbopro.com/CSS/limbopro.x-91short.com.css">' : ''
    ].join('\n');
    body = body.replace(/<head\b[^>]*>/i, function (tag) { return tag + '\n' + injection + '\n'; });

    var h = Object.assign({}, headers);
    Object.keys(h).forEach(function (k) {
      if (/^(?:content-length|content-security-policy|content-security-policy-report-only)$/i.test(k)) delete h[k];
    });
    console.log('[limbo-91-v8] HTML 注入成功: ' + hostname + ' / ' + pathname);
    return $done({body:body, headers:h});
  } catch (e) {
    console.log('[limbo-91-v8] ' + e.message);
    $done({});
  }
})();
