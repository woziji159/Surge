/*
 * Surge — 毒奶站点增强 v21.5（加载提速版）
 * v21.5 只优化加载速度，不改去广告规则：
 *   1) 毒奶原版脚本 Adblock4limbo.user.js 排到最前并提高下载优先级（开关 TOOLBOX_FIRST）；
 *   2) 反馈补救不再固定等 4.5 秒：毒奶导航按钮一出现就检查（保留 4.5 秒兜底，补载前防重复）；
 *   3) 提示隐藏器不再每次 DOM 变化都整页逐元素扫描。
 *   v21.4 的统一扫描器 / 播放器保护 / 两个恶意拦截开关 / AdGuard CSS 等代码原样保留，未改动。
 * v21.4（91short 积极屏蔽可疑元素、仅保护已确认播放器）：统一扫描器 / 无 150 总量上限 / 撤回暂停 / 收紧链接误判
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

    // v21.5: 远程脚本加载顺序开关。
    // true  = 毒奶原版脚本（导航/工具箱）最先执行并提高下载优先级，AdDetector 排第二；
    // false = 恢复 v21.4 的顺序（AdDetector 最先）。如发现去广告表现变差，改成 false 即可对比。
    var TOOLBOX_FIRST = true;

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

    // v21.4: User-selected aggressive 91short policy: auto-block all v12.6 suspicious candidates,
    // except the two verified player elements and the ancestors necessary to display them.
    // Other domains remain in base-only mode; manual controls and undo remain available.
    var unifiedScanner = String.raw`<script id="limbo-native-autoblock-v21">
(function(){
  'use strict';
  if(window.__limboNativeAutoV21)return;
  var site91=/(?:^|[.-])91short(?:[.-]|$)/i.test(location.hostname);
  var state=window.__limboNativeAutoV21={
    version:'v21.4',mode:site91?'91short-aggressive-player-only':'base-only',ready:false,paused:false,busy:false,
    scans:0,nativeBlocked:0,lastCandidates:0,lastSelected:0,protectedSkipped:0,ambiguousSkipped:0,
    restoredMedia:0,removedLegacyRules:0,lastError:'',
    scan:function(){schedule('manual');},
    pause:function(){pause('manual');},
    resume:function(){state.paused=false;state.pausedReason='';schedule('resume');},
    status:function(){return {
      version:state.version,mode:state.mode,ready:state.ready,paused:state.paused,
      pausedReason:state.pausedReason||'',busy:state.busy,scans:state.scans,
      nativeBlocked:state.nativeBlocked,lastCandidates:state.lastCandidates,
      lastSelected:state.lastSelected,protectedSkipped:state.protectedSkipped,
      ambiguousSkipped:state.ambiguousSkipped,restoredMedia:state.restoredMedia,
      removedLegacyRules:state.removedLegacyRules,lastError:state.lastError,
      nativeFlags:{
        hijack:read('hijackDefuser')==='1',popup:read('windowhijackDefuser')==='1',
        hijackFunction:typeof window.addEventListener_defuserV2==='function',
        popupFunction:typeof window.window_open_defuser==='function'
      }
    };}
  };
  window.__limboUnifiedV17=state; // suppress legacy duplicate scanner
  function read(key){try{return localStorage.getItem(key);}catch(_){return null;}}
  function write(key,value){try{localStorage.setItem(key,value);}catch(e){state.lastError='Storage: '+e.message;}}
  write('hijackDefuser','1');
  write('windowhijackDefuser','1');
  write('ad_detector_ui_open','false');
  var key='ad_detector_blocked_'+location.hostname;
  var backupKey='limbo91_v213_removed_rules_'+location.hostname;
  var obviousMedia=/(?:#playbox(?![\w-])|[.#]in-video(?![\w-])|[.#]player-box(?:-main)?(?![\w-])|[.#]player-wrapper(?![\w-]))/i;
  function backupRules(items){
    if(!items.length)return;
    try{
      var existing=JSON.parse(read(backupKey)||'[]');
      if(!Array.isArray(existing))existing=[];
      items.forEach(function(r){existing.push(r);});
      write(backupKey,JSON.stringify(existing.slice(-300)));
      state.removedLegacyRules+=items.length;
    }catch(e){state.lastError='Backup: '+e.message;}
  }
  function obviousBad(r){
    return !!(r && obviousMedia.test(String(r.selector||'')+' '+String(r.classAndId||'')+' '+String(r.xpath||'')));
  }
  // Must run in <head>, before remote AdDetector initializes and restores saved CSS/XPath rules.
  if(site91){
    try{
      var raw=read(key),saved=JSON.parse(raw||'[]');
      if(Array.isArray(saved)){
        var removed=saved.filter(obviousBad);
        if(removed.length){backupRules(removed);write(key,JSON.stringify(saved.filter(function(r){return !obviousBad(r);})));}
      }
    }catch(e){state.lastError='Early cleanup: '+e.message;}
  }
  var d=null,timer=null,lastRun=0,started=false,queued=false;
  var adHosts=/(?:^|\.)(?:doubleclick\.net|googlesyndication\.com|googleadservices\.com|adsterra\.com|wpadmngr\.com|twinrdengine\.com|tsyndicate\.com|magsrv\.com|jads\.co|popads\.net|onclickads\.net)$/i;
  var explicitAd='ins.adsbygoogle,.adsbygoogle,[data-ad-client],[data-ad-slot],.popup-ad,.floating-ad,.ad-banner,[class*="popunder"],[id*="popunder"]';
  var marker91='.msop100,img[data-id^="ad"],img[class*="imgad"]';
  function pause(reason){state.paused=true;state.pausedReason=reason;if(timer){clearTimeout(timer);timer=null;}queued=false;}
  function url(raw){try{return new URL(raw,location.href);}catch(_){return null;}}
  function outbound(u){
    if(!u || !/^https?:$/.test(u.protocol))return false;
    var h=location.hostname.toLowerCase(),dest=u.hostname.toLowerCase();
    return dest!==h && !dest.endsWith('.'+h) && !h.endsWith('.'+dest);
  }
  function hostAd(raw){var u=url(raw);return !!(u&&adHosts.test(u.hostname));}
  function player(){return document.querySelector('iframe#playbox.in-video,iframe#playbox');}
  function protectedNodes(){
    if(!site91)return [];
    // Protect only verified 91short video player targets and their structural ancestors.
    // A parent that contains the player must stay visible; descendants are NOT automatically exempt.
    var nodes=[],seen=new Set();
    var roots=document.querySelectorAll('iframe#playbox.in-video,.player-box');
    for(var i=0;i<roots.length;i++){
      var n=roots[i];
      while(n && n.nodeType===1 && n!==document.documentElement){
        if(!seen.has(n)){seen.add(n);nodes.push(n);}
        n=n.parentElement;
      }
    }
    return nodes;
  }
  function isProtected(el){
    if(!site91 || !el || el.nodeType!==1)return false;
    // Exclude only the two confirmed player selectors and elements that contain them.
    // Other candidate images/video cards can be auto-blocked by design in this aggressive mode.
    try{
      if(el.matches('iframe#playbox.in-video,.player-box'))return true;
      var roots=document.querySelectorAll('iframe#playbox.in-video,.player-box');
      for(var i=0;i<roots.length;i++)if(el.contains(roots[i]))return true;
      return false;
    }catch(_){return false;}
  }
  function ruleMatchesMedia(r,nodes){
    if(!r||!nodes.length)return false;
    if(obviousBad(r))return true;
    if(r.selector){
      try{if(nodes.some(function(e){return e.matches(r.selector);} ))return true;}catch(_){}
    }
    if(r.xpath){
      try{
        var found=document.evaluate(r.xpath,document,null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,null);
        for(var j=0;j<found.snapshotLength && j<120;j++){
          var target=found.snapshotItem(j);if(nodes.some(function(e){return e===target;}))return true;
        }
      }catch(_){}
    }
    var p=player();
    if(p && r.tagName==='iframe' && r.size && r.size!=='0x0px'){
      var rect=p.getBoundingClientRect();
      var size=Math.round(rect.width)+'x'+Math.round(rect.height)+'px';
      if(size===r.size)return true;
    }
    return false;
  }
  function removeBlockEvents(el){
    var record=el.__adEventBlocker;
    if(record&&record.events&&record.blocker){
      record.events.forEach(function(type){try{el.removeEventListener(type,record.blocker,true);}catch(_){} });
      try{delete el.__adEventBlockerInstalled;delete el.__adEventBlocker;}catch(_){}
    }
  }
  function restoreMedia(detector){
    if(!site91)return;
    var nodes=protectedNodes();if(!nodes.length)return;
    if(detector && Array.isArray(detector.blockedRules)){
      var removed=detector.blockedRules.filter(function(r){return ruleMatchesMedia(r,nodes);});
      if(removed.length){
        backupRules(removed);
        detector.blockedRules=detector.blockedRules.filter(function(r){return !ruleMatchesMedia(r,nodes);});
        try{detector.saveBlockedRules();}catch(e){state.lastError='Save cleaned rules: '+e.message;}
      }
    }
    nodes.forEach(function(el){
      var marked=el.dataset.overlayBlocked==='true'||el.dataset.adBlockedXpath==='true'||!!el.__adEventBlockerInstalled;
      if(!marked)return;
      if(detector && typeof detector.removeExtraHideStyle==='function'){
        try{detector.removeExtraHideStyle(el);}catch(_){}
      }
      delete el.dataset.overlayBlocked;delete el.dataset.adBlockedXpath;
      removeBlockEvents(el);
      var s=el.style;
      if(s.getPropertyValue('display')==='none')s.removeProperty('display');
      var computed=getComputedStyle(el);
      if(computed.display==='none')s.setProperty('display','block','important');
      if(parseFloat(computed.opacity)<0.2)s.setProperty('opacity','1','important');
      if(computed.visibility==='hidden')s.setProperty('visibility','visible','important');
      if(computed.pointerEvents==='none')s.setProperty('pointer-events','auto','important');
      var id=el.getAttribute('data-ad-detector-id');
      if(detector && id && detector.detectedAds){
        var meta=detector.detectedAds.get(id);if(meta)meta.isBlocked=false;
        if(detector.evaluatedNodes)detector.evaluatedNodes.delete(el);
      }
      state.restoredMedia++;
    });
  }
  function safeSelector(detector,el){
    if(isProtected(el))return false;
    try{
      var selector=detector.generateSpecificSelector(el);
      if(selector && protectedNodes().some(function(n){return n.matches(selector);} ))return false;
    }catch(_){return false;}
    return true;
  }
  // Deliberately aggressive site policy: if original v12.6 registered it as suspicious,
  // block it unless doing so would hide the known player or match its structural ancestors.
  function eligibleCandidate(detector,meta){
    var el=meta&&meta.element;
    return !!(el&&el.isConnected&&!meta.isBlocked&&!isProtected(el)&&safeSelector(detector,el));
  }
  function hookNative(detector){
    if(detector.__limboNativeHookedV214)return;
    detector.__limboNativeHookedV214=true;
    ['undo','resetAll'].forEach(function(name){
      if(typeof detector[name]!=='function')return;
      var original=detector[name];
      detector[name]=function(){pause(name);return original.apply(this,arguments);};
    });
    if(site91){
      ['hideSingleElement','applyExtraHideStyle','installEventBlocker'].forEach(function(name){
        if(typeof detector[name]!=='function')return;
        var original=detector[name];
        detector[name]=function(el){if(isProtected(el))return;return original.apply(this,arguments);};
      });
      if(typeof detector.neutralizeSingleInternal==='function'){
        var originalBlock=detector.neutralizeSingleInternal;
        detector.neutralizeSingleInternal=function(id){
          var meta=this.detectedAds.get(id);
          if(meta&&(!safeSelector(this,meta.element)||isProtected(meta.element)))return;
          return originalBlock.apply(this,arguments);
        };
      }
      restoreMedia(detector);
    }
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
      d=candidate;hookNative(d);state.ready=true;return d;
    }catch(e){state.lastError='Native init: '+e.message;return null;}
  }
  async function run(){
    timer=null;if(state.paused||state.busy)return;
    var detector=findNative();if(!detector)return;
    state.busy=true;lastRun=Date.now();
    try{
      if(site91)restoreMedia(detector);
      detector.scan();state.scans++;
      if(site91)restoreMedia(detector);
      var all=detector.detectedAds,selected=new Map();
      var candidates=0,protectedSkipped=0,ambiguous=0;
      all.forEach(function(meta,id){
        if(!meta||!meta.element||!meta.element.isConnected||meta.isBlocked)return;
        candidates++;
        if(isProtected(meta.element))protectedSkipped++;
        else if(site91&&eligibleCandidate(detector,meta))selected.set(id,meta);
        else ambiguous++;
      });
      state.lastCandidates=candidates;state.lastSelected=selected.size;
      state.protectedSkipped=protectedSkipped;state.ambiguousSkipped=ambiguous;
      if(site91&&selected.size){
        // Let v12.6 cleanAll use its original history/rule engine, but ONLY on eligible elements.
        // A separate guard protects the player against broad selectors even during manual calls.
        var progress=detector.showTopProgress;
        var nativeMap=detector.detectedAds;
        var result;
        try{
          detector.detectedAds=selected;
          if(typeof progress==='function')detector.showTopProgress=function(){return {update:function(){},finish:function(){}};};
          result=await Promise.resolve(detector.cleanAll());
        }finally{
          detector.detectedAds=nativeMap;
          if(typeof progress==='function')detector.showTopProgress=progress;
        }
        if(typeof result==='number')state.nativeBlocked+=result;
        restoreMedia(detector);
        if(detector.isUIVisible&&typeof detector.updateUI==='function')detector.updateUI();
      }
      state.lastError='';
    }catch(e){state.lastError='Native aggressive block: '+(e&&e.message||String(e));console.warn('[limbo-v21.4]',state.lastError);}
    finally{state.busy=false;if(queued&&!state.paused){queued=false;schedule('follow-up');}}
  }
  function schedule(reason){
    if(state.paused)return;
    if(state.busy){queued=true;return;}
    if(timer)return;
    timer=setTimeout(run,Math.max(500,1800-(Date.now()-lastRun)));
  }
  function onDOM(items){
    if(state.paused)return;
    for(var i=0;i<items.length;i++){
      var m=items[i];
      if(m.type!=='childList'||!m.addedNodes||!m.addedNodes.length)continue;
      for(var j=0;j<m.addedNodes.length;j++){
        var el=m.addedNodes[j];
        if(el.nodeType===1&&!el.closest('#ad-detector-host,#dh_pageContainer,#dh_buttonContainer') &&
          !el.matches('#ad-detector-dynamic-css-rules,#anti-ad-fixed-dynamic-style,#ad-detector-top-progress')){
          schedule('new-dom');return;
        }
      }
    }
  }
  function boot(){
    if(started||!document.body)return;started=true;
    new MutationObserver(onDOM).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('pageshow',function(){schedule('pageshow');});
    window.addEventListener('popstate',function(){schedule('popstate');});
    document.addEventListener('scroll',function(){schedule('scroll');},{passive:true});
    var tries=0,wait=setInterval(function(){
      if(findNative()){
        clearInterval(wait);schedule('native-ready');
        setTimeout(function(){schedule('late-images');},1600);
      }else if(++tries>=240){clearInterval(wait);state.lastError='Native AdDetector did not load in 120 seconds';}
    },500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
</script>`;

    // v15: 仅隐藏这两种诊断性提示；保留原作者脚本和可疑广告检测按钮。
    // v21.5: 每次先用一次 body.innerText 判断这两条提示是否真的显示在页面上，没有就直接返回；
    //        原来每次 DOM 变化都要逐个读取最多 12000 个元素的 innerText（会强制排版），页面越大越卡。
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
  function pageHasHint(){
    try{
      var s=String(document.body.innerText||'').replace(/\s+/g,'');
      return hints.some(function(p){return s.indexOf(p)!==-1;});
    }catch(_){return true;}
  }
  function hide(){
    queued=false;
    if(!document.body)return;
    if(!pageHasHint())return;
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

    // v21.5: 不再固定等 4.5 秒。毒奶导航按钮（#dh_button）一出现，300ms 后检查并按需补载；
    //        导航一直没出现时，仍按原来的 4.5 秒兜底。补载前先确认辅助脚本没被加载过，避免重复。
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
  function hasHelper(){
    return typeof window.alFeedback_showPanel==='function' || !!document.querySelector('script[src*="feedBackLinkMake"]');
  }
  function run(){
    if(hasFeedback() || hasHelper() || document.getElementById('limbo-91-recover-original-feedback-js-v8')) return;
    var s=document.createElement('script');
    s.id='limbo-91-recover-original-feedback-js-v8';
    s.src='https://limbopro.com/Adguard/feedBackLinkMake.user.js';
    s.async=true;
    (document.head || document.documentElement).appendChild(s);
  }
  function arm(){
    var done=false, mo=null;
    function toolboxReady(){ return !!(document.getElementById('dh_button') || document.getElementById('dh_buttonContainer')); }
    function go(){
      if(done) return;
      done=true;
      if(mo){ try{ mo.disconnect(); }catch(e){} }
      setTimeout(run,300);
    }
    if(toolboxReady()){ go(); return; }
    try{
      mo=new MutationObserver(function(){ if(toolboxReady()) go(); });
      mo.observe(document.documentElement,{childList:true,subtree:true});
    }catch(e){}
    setTimeout(go,4500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',arm,{once:true});
  else arm();
})();
</script>`;

    // v21.1: Hide ONLY the original v12.6 Event Listener log floating button.
    // Original viewer is in the light DOM (not Shadow DOM), so this CSS is enough.
    // Preserve logging, the two native interceptors, and the native auto ad blocker.
    var hideEventLogFab = '<style id="limbo-hide-eventlog-fab-v21-1">#event-log-viewer-v3 .ev-fab{display:none !important}</style>';

    // This only runs when Surge has actually intercepted a fresh HTML response.
    // Disable old site-controlled Service Workers; the rule above prevents the site's observed sw-register.js from re-enabling them.
    var swCleanup = String.raw`<script id="limbo-91-serviceworker-cleanup-v21-2">
(function(){
  'use strict';
  try {
    if (!navigator.serviceWorker || typeof navigator.serviceWorker.getRegistrations !== 'function') return;
    navigator.serviceWorker.getRegistrations().then(function(registrations){
      registrations.forEach(function(reg){
        if (reg.scope && reg.scope.indexOf(location.origin + '/') === 0) {
          reg.unregister().then(function(ok){
            if (ok) console.log('[limbo-v21.2] old site Service Worker unregistered:', reg.scope);
          }).catch(function(){});
        }
      });
    }).catch(function(){});
  } catch (_) {}
})();
</script>`;

    // v21.5: defer 脚本按书写顺序依次执行，且都在文档解析完成后、DOMContentLoaded 之前。
    // 原版脚本必须排在 customFn / customElement 之前（后两者会覆盖它的同名函数），
    // 所以只调整 AdDetector 的位置：原来它排在最前，原版导航要等它下载并执行完才能出现。
    var scriptToolbox = '<script defer' + (TOOLBOX_FIRST ? ' fetchpriority="high"' : '') + ' src="https://limbopro.com/Adguard/Adblock4limbo.user.js"></script>';
    var scriptDetector = '<script defer src="https://limbopro.com/Adguard/autoAdDetector.js"></script>';
    var scriptCustomFn = '<script defer src="' + customFn + '"></script>';
    var scriptCustomElement = '<script defer src="' + customElement + '"></script>';
    var scriptAgent = '<script defer src="https://limbopro.com/Adguard/isAgent.js"></script>';
    var remoteScripts = TOOLBOX_FIRST
      ? [scriptToolbox, scriptDetector, scriptCustomFn, scriptCustomElement, scriptAgent]
      : [scriptDetector, scriptToolbox, scriptCustomFn, scriptCustomElement, scriptAgent];

    var injection = [
      '<!-- SURGE-LIMBO-91: v21.5 response-rewrite-injected -->',
      hideEventLogFab,
      swCleanup,
      unifiedScanner,
      adguardNotice,
      guard,
      quietNotices,
      feedbackRecovery
    ].concat(remoteScripts, [
      isOriginal91short ? '<link rel="stylesheet" href="https://limbopro.com/CSS/x-91short.com.css">' : '',
      isOriginal91short ? '<link rel="stylesheet" href="https://limbopro.com/CSS/limbopro.x-91short.com.css">' : ''
    ]).join('\n');
    body = body.replace(/<head\b[^>]*>/i, function (tag) { return tag + '\n' + injection + '\n'; });

    var h = Object.assign({}, headers);
    Object.keys(h).forEach(function (k) {
      if (/^(?:content-length|content-security-policy|content-security-policy-report-only)$/i.test(k)) delete h[k];
    });
    Object.keys(h).forEach(function (k) { if (/^(?:cache-control|pragma|expires)$/i.test(k)) delete h[k]; });
    h['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
    h['Pragma'] = 'no-cache';
    h['Expires'] = '0';
    // Old ETag/Last-Modified validators are no longer valid for the rewritten HTML.
    Object.keys(h).forEach(function (k) { if (/^(?:etag|last-modified)$/i.test(k)) delete h[k]; });
    console.log('[limbo-91-v21.5] HTML 注入成功: ' + hostname + ' / ' + pathname);
    return $done({body:body, headers:h});
  } catch (e) {
    console.log('[limbo-91-v21.5] ' + e.message);
    $done({});
  }
})();
