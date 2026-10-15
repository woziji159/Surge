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
    var domain = /^(?:[a-z0-9.-]*91short[a-z0-9.-]*)$/i; // LIMBO_SITES_HOST_PATTERN (auto-generated)
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
    var isAny91short = hostname.indexOf('91short') !== -1;
    var base = 'https://cdn.jsdelivr.net/gh/woziji159/Surge@main/';
    var customFn = base + 'limbo-function-auto.js?v=20261015-repair5';
    var customElement = base + 'limbo-elementBlocker-auto.js?v=20261015-repair5';

    // v14: 加载作者实际的远程 CSS，不再点击作者的弹窗按钮。
    // 仅拦截 #loadCSS 的真人点击来手动关闭/开启本页已加载的样式；绝不改写全局 confirm。
    var adguardNotice = String.raw`<script id="limbo-adguard-direct-v14">
(function(){
  'use strict';
  if(window.__limboAdguardV14)return;
  var st=window.__limboAdguardV14={status:'loading',loaded:false,manualOff:false,source:'https://limbopro.com/CSS/Adblock4limbo.user.css'};
  var link=document.createElement('link');
  link.id='limbo-adguard-css-v14';link.rel='stylesheet';link.href=st.source;
  st.link=link;
  function updateButton(){
    var label=document.getElementById('loadCSS_status_text');
    var btn=document.getElementById('loadCSS');
    if(!label||!btn)return;
    var wanted=st.status==='on'?'已开启':st.status==='off'?'已关闭':st.status==='error'?'加载失败':'加载中';
    if(label.textContent!==wanted)label.textContent=wanted;
    btn.setAttribute('data-limbo-adguard-status-v14',st.status);
    btn.setAttribute('aria-pressed',st.status==='on'?'true':'false');
  }
  function setEnabled(on){
    link.disabled=!on;
    st.status=on&&st.loaded?'on':'off';
    st.manualOff=!on;
    updateButton();
  }
  link.addEventListener('load',function(){
    st.loaded=true;
    st.status=st.manualOff?'off':'on';
    link.disabled=st.manualOff;
    updateButton();
    console.log('[limbo-v14] AdGuard 作者 CSS 已加载:',link.href);
  });
  link.addEventListener('error',function(){
    st.loaded=false;st.status='error';updateButton();
    console.warn('[limbo-v14] AdGuard 作者 CSS 未能加载:',link.href);
  });
  (document.head||document.documentElement).appendChild(link);
  document.addEventListener('click',function(e){
    var t=e.target&&e.target.closest&&e.target.closest('#loadCSS');
    if(!t||!e.isTrusted)return;
    // 原版 onclick 调用 toggleAdGuardFilter() 会触发原生确认弹窗；
    // 本页手动开关改为启/停已经下载的同一份作者 CSS。仅限这个按钮。
    e.preventDefault();e.stopImmediatePropagation();
    if(st.loaded)setEnabled(st.status!=='on');
    else if(st.status==='error'){
      st.status='loading';st.manualOff=false;link.href=st.source+(st.source.indexOf('?')===-1?'?':'&')+'retry='+Date.now();
    }
  },true);
  var observer=new MutationObserver(function(records){
    for(var i=0;i<records.length;i++){
      var r=records[i];
      if(r.type==='childList'&&r.addedNodes.length) {updateButton();return;}
    }
  });
  function start(){
    updateButton();
    if(document.body)observer.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
</script>`;

    // v15: 只做静默的实际点击拦截，不创建任何“已开启”通知；不接管原版工具箱。
    var guard = String.raw`<script id="limbo-91-protection-v15">
(function(){
  'use strict';
  if(window.__limbo91ProtectionV15)return;
  var st=window.__limbo91ProtectionV15={version:'v15',clickRedirect:'on',popup:'pending',blockedClicks:0,blockedPopups:0};
  var knownAd=/(?:^|\.)(?:doubleclick\.net|googlesyndication\.com|adsterra\.com|wpadmngr\.com|twinrdengine\.com|tsyndicate\.com|magsrv\.com|jads\.co)$/i;
  var feedback=/(?:^|\.)(?:limbopro\.com|github\.com|t\.me)$/i;
  var adMarkers='.msop100,.popup-ad,.floating-ad,.ad-banner,.popunder,[class*="popunder"],[id*="popunder"],a:has(> img[data-id^="ad"]),img[data-id^="ad"],img[class*="imgad"],[data-ad-slot],[data-ad-client]';
  var lastTrusted=0,lastSafeTarget=null;
  function ip(host){return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);}
  function site(host){return host===location.hostname || host.endsWith('.'+location.hostname) || location.hostname.endsWith('.'+host);}
  function dest(url){try{return new URL(String(url),location.href);}catch(_){return null;}}
  function suspicious(u){return !!u&&(/^https?:$/.test(u.protocol))&&(ip(u.hostname)||knownAd.test(u.hostname));}
  function mark(el){
    if(!el||!el.closest)return false;
    var found=el.closest(adMarkers);
    // Only blocks obvious ad markers, not parent video cards.
    return !!found;
  }
  function inspectTarget(e){
    if(e.defaultPrevented)return;
    var el=e.target;
    if(!el||!el.closest)return;
    var anchor=el.closest('a[href],area[href]');
    var suspiciousAd=mark(el);
    var uri=anchor?dest(anchor.getAttribute('href')):null;
    var badHref=suspicious(uri);
    var externalPopup=!!(anchor && uri && anchor.target==='_blank' && !site(uri.hostname) && !feedback.test(uri.hostname));
    if(suspiciousAd || badHref || externalPopup){
      if(e.cancelable)e.preventDefault();
      e.stopImmediatePropagation();
      st.blockedClicks++;
      if(e.isTrusted)lastSafeTarget=null;
      console.debug('[limbo-v15] 已拦截广告点击');
      return;
    }
    if(e.isTrusted){
      lastTrusted=Date.now();
      lastSafeTarget=anchor;
    }
  }
  // Capture before most site listeners; also handles ad overlays implemented as DIV/IMG.
  window.addEventListener('click',inspectTarget,true);
  // Capture the initial touch to prevent ads listening to touchstart instead of click.
  window.addEventListener('touchstart',function(e){
    if(mark(e.target)){
      if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();st.blockedClicks++;
    }
  },{capture:true,passive:false});
  var priorOpen=window.open;
  function guardedOpen(url){
    var target=dest(url);
    var accepted=target && (/^https?:$/.test(target.protocol)) &&
      !suspicious(target) &&
      // Legitimate feedback links are allowed only immediately after a real user click.
      ((feedback.test(target.hostname) && Date.now()-lastTrusted<2500) ||
       (site(target.hostname) && Date.now()-lastTrusted<2500 && lastSafeTarget));
    if(!accepted){st.blockedPopups++;console.debug('[limbo-v15] 已拦截弹窗');return null;}
    return priorOpen.apply(this,arguments);
  }
  guardedOpen.__limboV15=true;
  function install(){
    if(window.open!==guardedOpen){
      priorOpen=window.open;
      // Avoid circular wrappers if another script reinstalls a previous wrapper.
      if(priorOpen===guardedOpen)return;
      window.open=guardedOpen;
    }
    st.popup=window.open===guardedOpen?'on':'unverified';
  }
  install();setInterval(install,2500);
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
  state.scan=scan; state.schedule=schedule;
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
  state.scan=run;
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

    // v15: 后台扫描独立运行，绝不点击/隐藏/覆盖原作者的 v12.6 检测面板。
    var autoControls = String.raw`<script id="limbo-background-coordinator-v15">
(function(){
  'use strict';
  if (!/^(?:[a-z0-9.-]*91short[a-z0-9.-]*)$/i.test(location.hostname)) return; // LIMBO_SITES_CONTROL_PATTERN (auto-generated)
  if(window.__limbo91AutoV9)return;
  var st=window.__limbo91AutoV9={version:'v15',started:true,paused:false,backgroundRuns:0};
  var timer=0;
  function run(){
    timer=0;
    if(st.paused)return;
    st.backgroundRuns++;
    var main=window.__limbo91AutoBlockV8;
    if(main && main.enabled && typeof main.scan==='function')main.scan();
    var gen=window.__limboGenericAutoV11;
    if(gen && !gen.paused && typeof gen.scan==='function')gen.scan();
  }
  function schedule(){if(timer||st.paused)return;timer=setTimeout(run,700);}
  function boot(){
    run();setTimeout(run,1500);setTimeout(run,4000);
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('pageshow',schedule);
    window.addEventListener('popstate',schedule);
    if(typeof MutationObserver==='function')new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',function(e){
      if(!e.isTrusted)return;
      var t=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');
      var s=t?(t.innerText||t.textContent||'').replace(/\s+/g,'').trim():'';
      if(/^(?:撤回|一键重置)$/.test(s))st.paused=true;
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
</script>`;

    // v15: 仅隐藏这两种诊断性提示；保留原作者脚本和可疑广告检测按钮。
    var quietNotices = String.raw`<script id="limbo-quiet-diagnostic-v15">
(function(){
  'use strict';
  if(window.__limboQuietV15)return;
  window.__limboQuietV15=true;
  var hints=['若扫描结果不及预期','页面诊断完成'];
  var queued=false;
  function matches(text){
    var s=String(text||'').replace(/\s+/g,'');
    if(!s||s.length>125)return false;
    return hints.some(function(p){return s.indexOf(p)!==-1;});
  }
  function hide(){
    queued=false;
    if(!document.body)return;
    var list=document.body.querySelectorAll('div,span,p,strong,small');
    for(var i=0;i<list.length&&i<12000;i++){
      var el=list[i];
      if(!el.isConnected || !matches(el.innerText||el.textContent))continue;
      // Never hide the original toolbox, feedback button, or detector panel.
      if(el.closest('#dh_pageContainer,#dh_buttonContainer,[id*="Detector"],[class*="AdDetector"],#gemini-AdDetector'))continue;
      var target=el;
      for(var j=0;j<4 && target.parentElement && target.parentElement!==document.body;j++){
        var p=target.parentElement;
        if(p.querySelectorAll('*').length>18 || String(p.innerText||p.textContent).length>140)break;
        target=p;
        var style=getComputedStyle(target);
        if(style.position==='fixed'||style.position==='sticky')break;
      }
      if(target!==document.body && !target.hasAttribute('data-limbo-quiet-v15')){
        target.setAttribute('data-limbo-quiet-v15','');
        target.style.setProperty('display','none','important');
      }
    }
  }
  function schedule(){if(queued)return;queued=true;setTimeout(hide,80);}
  function boot(){schedule();if(window.MutationObserver)new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
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
      '<!-- SURGE-LIMBO-91: v15 response-rewrite-injected -->',
      adguardNotice,
      guard,
      quietNotices,
      isAny91short ? passiveScan : genericScan,
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
