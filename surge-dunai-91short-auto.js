/*
 * Surge — 毒奶站点增强 v19（检测器加载与双扫描冲突修复）：统一扫描器 / 无 150 总量上限 / 撤回暂停 / 收紧链接误判
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
    if (/SURGE-LIMBO-91:\s*(?:v17|v18|v19)|id=["']limbo-unified-autoscan-v17["']/.test(body)) return $done({});

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
  st.snapshot=function(){return {status:st.status,loaded:st.loaded,attached:!!(link.sheet && link.isConnected),enabled:!link.disabled,source:st.source,filtersEffect:'not inferred from stylesheet load'};};
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

    // v18: 局部拦截器，实际注册事件；不伪造毒奶原版开关状态或弹出提示。
    var guard = String.raw`<script id="limbo-91-protection-v18">
(function(){
  'use strict';
  if (window.__limboProtectionV18) return;
  var st=window.__limboProtectionV18={
    version:'v18', captureInstalled:false, popupInstalled:false,
    blockedClicks:0,blockedPopups:0,allowedNavigations:0,
    lastReason:'',lastBlockedURL:'', type:'local protection (not original author toggles)'
  };
  var known=/(?:^|\.)(?:doubleclick\.net|googlesyndication\.com|googleadservices\.com|adsterra\.com|wpadmngr\.com|twinrdengine\.com|tsyndicate\.com|magsrv\.com|jads\.co|popads\.net)$/i;
  var feedback=/(?:^|\.)(?:limbopro\.com|github\.com|t\.me)$/i;
  var adNodes='[data-ad-client],[data-ad-slot],ins.adsbygoogle,.adsbygoogle,.msop100,.popup-ad,.floating-ad,.ad-banner,.popunder,[class*="popunder"],[id*="popunder"],img[data-id^="ad"],img[class^="imgad"],a:has(> img[data-id^="ad"])';
  var lastGesture={time:0,href:'',anchor:null,kind:''};
  function targetURL(s){try{return new URL(String(s||''),location.href);}catch(_){return null;}}
  function firstParty(host){var h=location.hostname.toLowerCase();return host===h||host.endsWith('.'+h)||h.endsWith('.'+host);}
  function ip(host){return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);}
  function danger(u){return !!u && /^https?:$/.test(u.protocol) && (known.test(u.hostname)||ip(u.hostname));}
  function isTool(el){return !!(el&&el.closest&&el.closest('#dh_pageContainer,#dh_buttonContainer,[id*="ad-detector" i],[class*="ad-detector" i],[id*="limbo" i],[class*="limbo" i]'));}
  function adNode(el){
    if(!el||!el.closest||isTool(el))return false;
    try{return !!el.closest(adNodes);}catch(_){return false;}
  }
  function recordBlock(why,url,popup){
    st.lastReason=why;st.lastBlockedURL=String(url||'').slice(0,350);
    if(popup)st.blockedPopups++;else st.blockedClicks++;
    // No popups, fake confirmations, or noisy console logs.
  }
  function resolveAnchor(el){return el&&el.closest?el.closest('a[href],area[href]'):null;}
  function handleUserEvent(e){
    var el=e.target;if(!el||!el.closest||isTool(el))return;
    var a=resolveAnchor(el), u=a?targetURL(a.getAttribute('href')):null;
    var bad=adNode(el)||danger(u);
    if(bad){
      if(e.cancelable)e.preventDefault();
      e.stopImmediatePropagation();
      recordBlock(adNode(el)?'marked-ad-click':'known-ad-destination',u&&u.href,false);
      lastGesture={time:0,href:'',anchor:null,kind:''};
      return;
    }
    // Only trusted gestures can authorise new windows, not script-generated clicks.
    if(e.isTrusted){
      lastGesture={time:Date.now(),href:u?u.href:'',anchor:a,kind:e.type};
      st.allowedNavigations++;
    }
  }
  function add(type){
    window.addEventListener(type,handleUserEvent,{capture:true,passive:false});
  }
  try{
    add('touchstart');add('touchend');add('click');
    st.captureInstalled=true;
  }catch(e){st.captureError=String(e);}
  var nextOpen=window.open;
  function interceptOpen(url){
    var u=targetURL(url),age=Date.now()-lastGesture.time;
    // A user-requested blank tab with no URL is allowed only following a gesture.
    var hasGesture=age>=0&&age<1300;
    var explicitSameAnchor=!!(u && lastGesture.href && u.href===lastGesture.href);
    var ownSite=!!(u && firstParty(u.hostname));
    var isFeedback=!!(u && feedback.test(u.hostname));
    var safe=!!u && /^https?:$/.test(u.protocol) && !danger(u) &&
      hasGesture && (explicitSameAnchor || isFeedback || (ownSite && !!lastGesture.anchor));
    if(!safe){recordBlock('unexpected-popup',u&&u.href,true);return null;}
    return nextOpen.apply(this,arguments);
  }
  interceptOpen.__limboProtectionV18=true;
  function installPopup(){
    if(window.open!==interceptOpen){
      // Avoid recursive wrapping when someone copies this wrapper back.
      if(window.open!==nextOpen && window.open && !window.open.__limboProtectionV18)
        nextOpen=window.open;
      try{window.open=interceptOpen;}catch(e){st.popupError=String(e);}
    }
    st.popupInstalled=window.open===interceptOpen;
  }
  installPopup();
  // Only re-install if another page script actually replaces window.open.
  setInterval(function(){if(window.open!==interceptOpen)installPopup();},2500);
  st.snapshot=function(){return {
    click:st.captureInstalled,popup:st.popupInstalled,
    blockedClicks:st.blockedClicks,blockedPopups:st.blockedPopups,
    lastReason:st.lastReason,lastBlockedURL:st.lastBlockedURL,
    originalAuthorSwitches:'not verified'
  };};
})();
</script>`;

    // v17: 一个后台扫描器；分批处理无终身数量上限；统一的暂停/撤回。
    // 只处理明确的广告标记和已知广告主机，避免拦截一般站内链接。
    var unifiedScanner = String.raw`<script id="limbo-unified-autoscan-v17">
(function(){
  'use strict';
  if (window.__limboUnifiedV17) return;
  var host = location.hostname.toLowerCase();
  var is91 = host.indexOf('91short') !== -1;
  var known = /(?:^|\.)(?:doubleclick\.net|googlesyndication\.com|adsterra\.com|wpadmngr\.com|twinrdengine\.com|magsrv\.com|jads\.co)$/i;
  var ui = '[id*="feedback" i],[class*="feedback" i],[id*="ad-detector" i],[class*="ad-detector" i],[id*="limbo" i],[class*="limbo" i],#dh_pageContainer,#dh_buttonContainer';
  var selector = 'ins.adsbygoogle,.adsbygoogle,[data-ad-client],[data-ad-slot],iframe[src],.popup-ad,.floating-ad,.ad-banner,[class*="popunder"],[id*="popunder"]' +
    (is91 ? ',.msop100,img[data-id^="ad"],img[class*="imgad"],a[href]' : '');
  var pending = [], inQueue = new Set(), hidden = new Map();
  var running = false, observer = null, scheduleHandle = 0;
  var state = window.__limboUnifiedV17 = {
    version: 'v17', paused: false, scanned: 0, hidden: 0,
    scan: rescan, undo: undo, pause: undo, resume: resume,
    status: function(){return {paused:state.paused,scanned:state.scanned,hiddenCount:hidden.size,queued:pending.length};}
  };
  function isTool(el){try{return !!el.closest(ui);}catch(_){return false;}}
  function urlHost(raw){try{return new URL(raw,location.href).hostname.toLowerCase();}catch(_){return '';}}
  function firstParty(h){return h && (h===host || h.endsWith('.'+host) || host.endsWith('.'+h));}
  function explicitImage(el){
    if (!el || el.tagName!=='IMG')return false;
    var id=el.getAttribute('data-id')||'';
    var cls=typeof el.className==='string'?el.className:'';
    return /^ad\d+$/i.test(id) || /(?:^|\s)imgad\d+(?:\s|$)/i.test(cls);
  }
  function hasAdImage(el){return !!(el && el.querySelector && el.querySelector('img[data-id^="ad"],img[class*="imgad"]'));}
  function suspect(el){
    if (!(el instanceof Element) || isTool(el) || el.closest('nav,header,footer,form,[role="navigation"]')) return null;
    var t=el.tagName;
    if (t==='A') {
      // Never hide normal internal links or generic external image links.
      var dest=urlHost(el.getAttribute('href')||'');
      if(!dest || firstParty(dest))return null;
      return known.test(dest) ? el : (is91 && hasAdImage(el) ? el : null);
    }
    if (t==='IFRAME')return known.test(urlHost(el.getAttribute('src')||'')) ? el : null;
    if (is91 && t==='DIV' && el.matches('.msop100') && hasAdImage(el))return el;
    if (is91 && explicitImage(el)) {
      var a=el.closest('a[href]');
      var dh=a?urlHost(a.getAttribute('href')||''):'';
      return a && dh && !firstParty(dh) ? a : el;
    }
    if (el.matches('[data-ad-client],[data-ad-slot],ins.adsbygoogle,.adsbygoogle'))return el;
    if (is91 && el.matches('.popup-ad,.floating-ad,.ad-banner,[class*="popunder"],[id*="popunder"]'))return el;
    return null;
  }
  function hide(el){
    if (!el || !el.isConnected || hidden.has(el) || isTool(el))return;
    // Containers for video cards, menus, and forms must never be hidden wholesale.
    if (/^(?:HTML|BODY|HEAD|MAIN|NAV|HEADER|FOOTER|VIDEO|AUDIO|FORM)$/.test(el.tagName))return;
    var css=el.style;if(!css)return;
    hidden.set(el,{display:css.getPropertyValue('display'),priority:css.getPropertyPriority('display')});
    el.setAttribute('data-limbo-unified-hidden-v17','');
    css.setProperty('display','none','important');
    state.hidden++;
  }
  function put(el){
    if (!el || !(el instanceof Element) || inQueue.has(el) || state.paused) return;
    inQueue.add(el);pending.push(el);
  }
  function collect(root){
    if (state.paused || !root || !(root instanceof Element))return;
    if (root.matches(selector))put(root);
    var list=root.querySelectorAll(selector);
    for (var i=0;i<list.length;i++)put(list[i]);
    pump();
  }
  function pump(){
    if (running || state.paused || !pending.length) return;
    running=true;
    function chunk(){
      if (state.paused){running=false;pending.length=0;inQueue.clear();return;}
      // At most 100 elements per turn, but no total lifetime cap.
      var n=0;
      while(n++<100 && pending.length){
        var el=pending.shift();inQueue.delete(el);
        if (!el || !el.isConnected)continue;
        state.scanned++;
        try{var found=suspect(el);if(found)hide(found);}catch(e){console.warn('[limbo-v17] classify failed',e);}
      }
      if(pending.length)setTimeout(chunk,16);else running=false;
    }
    setTimeout(chunk,0);
  }
  function rescan(){if(!state.paused && document.body)collect(document.body);}
  function undo(){
    if(state.paused)return;
    state.paused=true;
    pending.length=0;inQueue.clear();
    if(scheduleHandle)clearTimeout(scheduleHandle);
    hidden.forEach(function(old,el){
      if(!el || !el.style)return;
      if(old.display)el.style.setProperty('display',old.display,old.priority);
      else el.style.removeProperty('display');
      el.removeAttribute('data-limbo-unified-hidden-v17');
    });
    hidden.clear();
    // Best-effort pause for older v8/v11 scripts if already present from another injector.
    if(window.__limbo91AutoBlockV8){window.__limbo91AutoBlockV8.enabled=false;}
    if(window.__limboGenericAutoV11){window.__limboGenericAutoV11.paused=true;}
    if(window.__limbo91AutoV9){window.__limbo91AutoV9.paused=true;}
    if(typeof window.limboPassiveAdScanUndo==='function'){
      try{window.limboPassiveAdScanUndo();}catch(e){console.warn('[limbo-v17] legacy undo failed',e);}
    }
  }
  function resume(){if(!state.paused)return;state.paused=false;rescan();}
  function schedule(){
    if(state.paused || scheduleHandle)return;
    scheduleHandle=setTimeout(function(){scheduleHandle=0;rescan();},500);
  }
  function start(){
    if(!document.body)return;
    rescan();setTimeout(rescan,1100);
    if(window.MutationObserver){
      observer=new MutationObserver(function(items){
        if(state.paused)return;
        for(var i=0;i<items.length;i++){
          var rec=items[i];
          if(rec.type==='attributes')put(rec.target);
          else for(var j=0;j<rec.addedNodes.length;j++)collect(rec.addedNodes[j]);
        }
        pump();
      });
      observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src','href','class','data-id','data-ad-client','data-ad-slot']});
    }
    window.addEventListener('pageshow',schedule);
    window.addEventListener('popstate',schedule);
    // Scroll itself does not rescan the entire document; lazy content is caught by DOM observer.
    document.addEventListener('click',function(e){
      if(!e.isTrusted)return;
      var btn=e.target && e.target.closest && e.target.closest('button,[role="button"],a,input[type="button"]');
      if(!btn)return;
      var label=(btn.innerText||btn.textContent||btn.value||'').replace(/\s+/g,'').trim();
      if(/^(?:↩️?|↩)?撤回$/.test(label)||label==='一键重置')setTimeout(undo,0);
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
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
      '<!-- SURGE-LIMBO-91: v19 response-rewrite-injected -->',
      adguardNotice,
      guard,
      quietNotices,
      unifiedScanner,
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
    console.log('[limbo-91-v18] HTML 注入成功: ' + hostname + ' / ' + pathname);
    return $done({body:body, headers:h});
  } catch (e) {
    console.log('[limbo-91-v18] ' + e.message);
    $done({});
  }
})();
