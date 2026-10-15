/*
 * Surge — 毒奶站点增强 v21（检测器加载与双扫描冲突修复）：统一扫描器 / 无 150 总量上限 / 撤回暂停 / 收紧链接误判
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
    if (/SURGE-LIMBO-91:\s*(?:v17|v18|v19|v20|v21)|id=["']limbo-native-autoblock-v21["']/.test(body)) return $done({});

    // GitHub Raw 适合 Surge 的 script-path，但作为网页 <script src> 可能被浏览器以 nosniff 拦截。
    // 这两份定制 JS 仍来自用户自己的仓库，只将网页加载地址换成 JS CDN。
    var isOriginal91short = /(?:^|\.)x-91short\.com$/i.test(hostname);
    var isAny91short = hostname.indexOf('91short') !== -1;
    var base = 'https://cdn.jsdelivr.net/gh/woziji159/Surge@main/';
    var customFn = base + 'limbo-function-auto.js?v=fix19-7ab1517d593a';
    var customElement = base + 'limbo-elementBlocker-auto.js?v=fix19-cea6685a742c';

    // v14: 加载作者实际的远程 CSS，不再点击作者的弹窗按钮。
    // 仅拦截 #loadCSS 的真人点击来手动关闭/开启本页已加载的样式；绝不改写全局 confirm。
    var adguardNotice = String.raw`<script id="limbo-adguard-direct-v14">
(function(){
  'use strict';
  if(window.__limboAdguardV14)return;
  var st=window.__limboAdguardV14={status:'loading',loaded:false,attached:false,manualOff:false,source:'https://limbopro.com/CSS/Adblock4limbo.user.css'};
  var link=document.createElement('link');
  link.id='limbo-adguard-css-v14';link.rel='stylesheet';link.href=st.source;
  st.link=link;
  function updateButton(){
    var label=document.getElementById('loadCSS_status_text');
    var btn=document.getElementById('loadCSS');
    if(!label||!btn)return;
    var wanted=st.status==='on'?'CSS已载入':st.status==='off'?'已关闭':st.status==='error'?'加载失败':'加载中';
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
    st.attached=!!(link.sheet && link.isConnected);
    st.status=st.attached?(st.manualOff?'off':'on'):'error';
    link.disabled=st.manualOff;
    updateButton();
    console.log('[limbo-v14] AdGuard 作者 CSS 已加载:',link.href);
  });
  link.addEventListener('error',function(){
    st.loaded=false;st.attached=false;st.status='error';updateButton();
    console.warn('[limbo-v14] AdGuard 作者 CSS 未能加载:',link.href);
  });
  (document.head||document.documentElement).appendChild(link);
  function ensureAttached(){
    if(link.isConnected)return;
    try{
      (document.head||document.documentElement).appendChild(link);
      st.status=st.loaded?(st.manualOff?'off':'loading'):'loading';
      updateButton();
    }catch(e){st.status='error';st.attachError=String(e);}
  }
  st.snapshot=function(){
    var actual=!!(link.isConnected && link.sheet && !link.disabled);
    return {status:actual?'on':(st.manualOff?'off':st.status==='error'?'error':'not-attached'),
      loaded:st.loaded,attached:!!(link.isConnected && link.sheet),enabled:actual,
      source:st.source,filtersEffect:'not inferred from stylesheet load'};
  };
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
    ensureAttached();updateButton();
    if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
    // Check stale 'loaded' state in case the app replaces <head> during SPA navigation.
    setInterval(function(){ensureAttached();if(st.status==='on'&&!link.isConnected){st.status='loading';updateButton();}},4500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
</script>`;

    // v20: real page-event guard; no synthetic success notifications and no fake original toggles.
    // This is a separately testable local fallback; the author's native switches are untouched.
    var guard = String.raw`<script id="limbo-91-protection-v20">
(function () {
  'use strict';
  if (window.__limboProtectionV20) return;
  var state = window.__limboProtectionV20 = {
    version: 'v20', clickInstalled: false, popupInstalled: false,
    blockedClicks: 0, blockedPopups: 0, lastReason: '', lastURL: '',
    originalSwitchStatus: 'unverified'
  };
  var adHost = /(?:^|\.)(?:doubleclick\.net|googlesyndication\.com|googleadservices\.com|adsterra\.com|wpadmngr\.com|twinrdengine\.com|tsyndicate\.com|magsrv\.com|jads\.co|popads\.net)$/i;
  var toolsUI = '#dh_pageContainer,#dh_buttonContainer,#gemini-main-container,#gemini-AdDetector,[id*="ad-detector" i],[class*="ad-detector" i]';
  var adElement = 'ins.adsbygoogle,[data-ad-client],[data-ad-slot],.msop100,.popup-ad,.floating-ad,.ad-banner,[class*="popunder"],[id*="popunder"],img[data-id^="ad"],img[class*="imgad"]';
  var lastGesture = {time:0, href:'', anchor:null, tool:false, ad:false};
  var originalOpen = window.open;
  function urlOf(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {return new URL(value, location.href);} catch (_) {return null;}
  }
  function sameSite(host) {
    var h = location.hostname.toLowerCase();
    return host === h || host.endsWith('.' + h) || h.endsWith('.' + host);
  }
  function isIPv4(host) {return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);}
  function harmfulURL(url) {return !!(url && /^https?:$/.test(url.protocol) && adHost.test(url.hostname));}
  function originalFeedback(url) {return !!(url && /(?:^|\.)(?:limbopro\.com|github\.com|t\.me)$/.test(url.hostname));}
  function isTool(node) {try {return !!(node && node.closest && node.closest(toolsUI));} catch(_) {return false;}}
  function isMarkedAd(node) {try {return !!(node && node.closest && node.closest(adElement) && !isTool(node));} catch(_) {return false;}}
  function note(reason, url, popup) {
    if (popup) state.blockedPopups++; else state.blockedClicks++;
    state.lastReason = reason;
    state.lastURL = url ? String(url).slice(0,260) : '';
  }
  function getAnchor(node) {return node && node.closest ? node.closest('a[href],area[href]') : null;}
  function recordAndBlock(event, why, url) {
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
    note(why,url,false);
    lastGesture.time=0;
  }
  function inspect(event) {
    var target=event.target;
    if (!target || !target.closest) return;
    if (isTool(target)) {
      if (event.isTrusted && (event.type==='click' || event.type==='touchend')) {
        var toolAnchor=getAnchor(target); var toolURL=toolAnchor ? urlOf(toolAnchor.getAttribute('href')) : null;
        lastGesture={time:Date.now(),href:toolURL ? toolURL.href : '',anchor:toolAnchor,tool:true,ad:false};
      }
      return;
    }
    var anchor=getAnchor(target);
    var url=anchor ? urlOf(anchor.getAttribute('href')) : null;
    var marked=isMarkedAd(target);
    // Known advertising hosts are blocked, whether reached by real or synthetic clicks.
    if (harmfulURL(url)) return recordAndBlock(event,'ad-host',url.href);
    // Only 91short-specific marked ads get IP-link restrictions; don't block ordinary IP links elsewhere.
    if (marked) return recordAndBlock(event,'marked-ad',url && url.href);
    // Synthetic third-party anchor clicks are a common redirect mechanism;
    // allow synthetic first-party application routing, but not synthetic cross-site navigation.
    if (event.type==='click' && !event.isTrusted && url && !sameSite(url.hostname) && !originalFeedback(url))
      return recordAndBlock(event,'synthetic-external-click',url.href);
    // A gesture may authorise window.open only for its matching link or author feedback.
    if (event.isTrusted && (event.type==='click' || event.type==='touchend')) {
      lastGesture = {time:Date.now(), href:url ? url.href : '', anchor:anchor, tool:false, ad:false};
    }
  }
  try {
    ['touchstart','touchend','click'].forEach(function (type) {
      window.addEventListener(type,inspect,{capture:true,passive:false});
    });
    state.clickInstalled=true;
  } catch (e) {state.clickError=String(e);}
  function interceptOpen(url) {
    var u=urlOf(url), age=Date.now()-lastGesture.time;
    var trusted=age>=0 && age<1300;
    var allowExplicit=!!(u && lastGesture.anchor && lastGesture.href && u.href===lastGesture.href);
    var allowFeedback=!!(u && originalFeedback(u) && trusted);
    var allowFirstParty=!!(u && sameSite(u.hostname) && trusted);
    // Don't block a genuine user-requested blank tab, but never authorise a third-party ad URL.
    var allowEmpty=typeof url==='undefined' && trusted;
    if (u && (harmfulURL(u) || isIPv4(u.hostname))) {
      note('known-ad-popup',u.href,true);return null;
    }
    if (!allowEmpty && !allowFeedback && !allowFirstParty && !(trusted && allowExplicit)) {
      note('unauthorised-popup',u && u.href,true);return null;
    }
    return originalOpen.apply(this,arguments);
  }
  interceptOpen.__limboGuardV20=true;
  function installPopup() {
    if (window.open===interceptOpen) {state.popupInstalled=true;return;}
    // If the site replaced window.open, wrap its replacement, without wrapping ourselves.
    if (typeof window.open==='function' && !window.open.__limboGuardV20) originalOpen=window.open;
    try {window.open=interceptOpen;} catch(e){state.popupError=String(e);}
    state.popupInstalled=window.open===interceptOpen;
  }
  installPopup();
  setInterval(function(){if(window.open!==interceptOpen)installPopup();},3000);
  state.snapshot=function(){return {
    click:state.clickInstalled, popup:state.popupInstalled,
    blockedClicks:state.blockedClicks, blockedPopups:state.blockedPopups,
    reason:state.lastReason, url:state.lastURL,
    originalAuthorSwitches:'not checked: these are independent protections'
  };};
})();
</script>`;

    // v17: 一个后台扫描器；分批处理无终身数量上限；统一的暂停/撤回。
    // 只处理明确的广告标记和已知广告主机，避免拦截一般站内链接。
    var unifiedScanner = String.raw`<script id="limbo-native-autoblock-v21">
(function () {
  'use strict';
  if (window.__limboNativeAutoV21) return;
  var state = window.__limboNativeAutoV21 = {
    version:'v21', ready:false, paused:false, busy:false,
    scans:0, nativeBlocked:0, lastCandidates:0, errors:[], lastError:'',
    scan:function(){schedule('manual');},
    pause:function(){pause('manual');},
    resume:function(){state.paused=false;state.pausedReason='';schedule('resume');},
    status:function(){return {
      ready:state.ready, paused:state.paused, pausedReason:state.pausedReason||'',
      busy:state.busy, scans:state.scans, nativeBlocked:state.nativeBlocked,
      lastCandidates:state.lastCandidates, lastError:state.lastError,
      nativeFlags:{
        hijack:read('hijackDefuser')==='1',
        popup:read('windowhijackDefuser')==='1',
        hijackFunction:typeof window.addEventListener_defuserV2==='function',
        popupFunction:typeof window.window_open_defuser==='function'
      }
    };}
  };
  // Compatibility: prevent limbo-elementBlocker-auto.js from starting a second scanner.
  // It is an alias to the native scanner, NOT the independent v17 scanner.
  window.__limboUnifiedV17=state;
  function read(key){try{return localStorage.getItem(key);}catch(_){return null;}}
  function write(key,val){try{localStorage.setItem(key,val);}catch(e){state.lastError='Storage: '+e.message;}}
  // Native AdDetector reads these at SCRIPT INITIALIZATION (not when the menu is clicked).
  write('hijackDefuser','1');
  write('windowhijackDefuser','1');
  // Default to background operation on each page load; manual UI opening still works.
  write('ad_detector_ui_open','false');
  var d=null, timer=null, processing=false, lastRun=0, started=false;
  var queued=false, lastRequest='';
  function pause(reason){
    state.paused=true;state.pausedReason=reason;
    if(timer){clearTimeout(timer);timer=null;}
    queued=false;
  }
  function hookNative(detector){
    if(detector.__limboNativeHookedV21)return;
    detector.__limboNativeHookedV21=true;
    // Undo/reset must suspend EVERY automatic native invocation, not only one queue.
    ['undo','resetAll'].forEach(function(name){
      if(typeof detector[name]!=='function')return;
      var old=detector[name];
      detector[name]=function(){pause(name);return old.apply(this,arguments);};
    });
    // Stored UI preference from a previous run must not cause the panel to auto-open.
    // Only at first connection; never intercept future manual showUI()/toggleUI().
    if(detector.isUIVisible && typeof detector.hideUI==='function'){
      try{detector.hideUI();}catch(e){state.lastError='Hide UI: '+e.message;}
    }
  }
  function findNative(){
    if(d)return d;
    try{
      if(typeof window.getDetector!=='function')return null;
      var candidate=window.getDetector();
      if(!candidate||typeof candidate.scan!=='function'||typeof candidate.cleanAll!=='function')return null;
      d=candidate;hookNative(d);state.ready=true;
      return d;
    }catch(e){state.lastError='Native init: '+e.message;return null;}
  }
  function countCandidates(detector){
    var count=0;
    if(detector.detectedAds && typeof detector.detectedAds.forEach==='function'){
      detector.detectedAds.forEach(function(meta){
        if(meta && meta.element && meta.element.isConnected && !meta.isBlocked)count++;
      });
    }
    return count;
  }
  async function run(){
    timer=null;
    if(state.paused || state.busy)return;
    var detector=findNative();
    if(!detector)return;
    state.busy=true;
    lastRun=Date.now();
    try{
      detector.scan();
      state.scans++;
      var count=countCandidates(detector);
      state.lastCandidates=count;
      if(count){
        // Suppress only the visual progress indicator for BACKGROUND calls.
        // Hand-operated buttons still call the unmodified native UI implementation.
        var progress=detector.showTopProgress;
        var result;
        try{
          if(typeof progress==='function')detector.showTopProgress=function(){return {update:function(){},finish:function(){}};};
          result=detector.cleanAll();
        }finally{
          if(typeof progress==='function')detector.showTopProgress=progress;
        }
        var n=await Promise.resolve(result);
        if(typeof n==='number')state.nativeBlocked+=n;
      }
      state.lastError='';
    }catch(e){
      state.lastError='Native auto-block: '+(e&&e.message||String(e));
      console.warn('[limbo-v21]',state.lastError);
    }finally{
      state.busy=false;
      if(queued && !state.paused){queued=false;schedule('follow-up');}
    }
  }
  function schedule(reason){
    if(state.paused)return;
    lastRequest=reason;
    if(state.busy){queued=true;return;}
    if(timer)return;
    // Rate limiting prevents MutationObserver feedback loops and expensive scans.
    timer=setTimeout(run,Math.max(500,1800-(Date.now()-lastRun)));
  }
  function onDOM(items){
    if(state.paused)return;
    for(var i=0;i<items.length;i++){
      var m=items[i];
      if(m.type==='childList' && m.addedNodes && m.addedNodes.length){
        var found=false;
        for(var j=0;j<m.addedNodes.length;j++){
          var el=m.addedNodes[j];
          if(el.nodeType===1 && !el.closest('#ad-detector-host,#dh_pageContainer,#dh_buttonContainer') &&
             !el.matches('#ad-detector-dynamic-css-rules,#anti-ad-fixed-dynamic-style,#ad-detector-top-progress')){
            found=true;break;
          }
        }
        if(found){schedule('new-dom');return;}
      }
    }
  }
  function boot(){
    if(started || !document.body)return;
    started=true;
    var obs=new MutationObserver(onDOM);
    obs.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('pageshow',function(){schedule('pageshow');});
    window.addEventListener('popstate',function(){schedule('popstate');});
    document.addEventListener('scroll',function(){schedule('scroll');},{passive:true});
    // Remote scripts may appear well after DOMContentLoaded. No need to open their panel.
    var tries=0;
    var wait=setInterval(function(){
      if(findNative()){
        clearInterval(wait);
        schedule('native-ready');
        setTimeout(function(){schedule('late-images');},1600);
      } else if(++tries>=240){clearInterval(wait);state.lastError='Native AdDetector did not load in 120 seconds';}
    },500);
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
      '<!-- SURGE-LIMBO-91: v21 response-rewrite-injected -->',
      unifiedScanner,
      adguardNotice,
      guard,
      quietNotices,
      feedbackRecovery,
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
    console.log('[limbo-91-v21] HTML 注入成功: ' + hostname + ' / ' + pathname);
    return $done({body:body, headers:h});
  } catch (e) {
    console.log('[limbo-91-v21] ' + e.message);
    $done({});
  }
})();
