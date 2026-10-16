/* Surge Google Search - media-safe continuous scroll v3.
 * Prefer Google's native More results and its media hydration.
 * For traditional pagination, prefetch and append only fully static result thumbnails.
 * If a following page needs Google's private JavaScript for media, show a manual next link
 * rather than broken image/video covers. No automatic full-page navigation.
 */
(function () {
  try {
    if (Number($response.status) !== 200 || typeof $response.body !== 'string') { $done({}); return; }
    var req = new URL($request.url);
    if (!/^www\.google\.[a-z.]+$/i.test(req.hostname) || req.pathname !== '/search' ||
        !req.searchParams.has('q')) { $done({}); return; }
    var headers = $response.headers || {};
    var contentType = Object.entries(headers).find(function (entry) { return entry[0].toLowerCase() === 'content-type'; });
    if (contentType && !/text\/html/i.test(String(contentType[1]))) { $done({}); return; }
    var body = $response.body;
    if (!/<\/body\s*>/i.test(body) || /id=["']surge-google-media-safe-v3["']/.test(body)) { $done({}); return; }
    var injection = '<script id="surge-google-media-safe-v3">' + String.raw`(function () {
  'use strict';
  if (window.top !== window.self || window.__surgeGoogleMediaSafe) return;
  if (location.pathname !== '/search') return;
  var initial = new URL(location.href);
  var query = initial.searchParams.get('q');
  if (!query) return;
  // Keep Images, AI Mode and other special search displays under Google's control.
  if (initial.searchParams.get('tbm') === 'isch' ||
      initial.searchParams.get('udm') === '2' ||
      initial.searchParams.get('udm') === '50') return;
  window.__surgeGoogleMediaSafe = true;

  var currentURL = initial.href;
  var visited = Object.create(null);
  visited[currentURL] = true;
  var fingerprints = Object.create(null);
  var nativeLoads = 0;
  var appended = 0;
  var busy = false;
  var stopped = false;
  var userInteracted = false;
  var lastAction = 0;
  var cached = null;
  var pending = null;
  var upcomingURL = null;
  var notice = null;
  var rafPending = false;
  var MAX_PAGES = 12;

  function visible(el) {
    if (!el || !el.isConnected || el.closest('[hidden], [aria-hidden="true"]')) return false;
    var st = getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && el.getClientRects().length > 0;
  }
  function moreText(el) {
    var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return t.length < 65 && /^(?:More results|Show more results|Show more|更多结果|更多搜索结果|显示更多结果|查看更多结果|更多結果|更多搜尋結果|顯示更多結果|查看更多結果)(?:\s*[›»→])?$/i.test(t);
  }
  function nativeButton() {
    var nodes = document.querySelectorAll('#botstuff button,#botstuff [role="button"],#foot button,#foot [role="button"],#nav button,#nav [role="button"],main button,main [role="button"]');
    for (var i=0; i<nodes.length; i++) {
      if (!nodes[i].closest('a[href],form[action]') && visible(nodes[i]) && moreText(nodes[i])) return nodes[i];
    }
    var fallback = document.querySelectorAll('button,[role="button"]');
    for (var j=0; j<Math.min(fallback.length,350); j++) {
      var x = fallback[j];
      if (x.closest('a[href],form[action]') || !visible(x) || !moreText(x)) continue;
      if (x.getBoundingClientRect().top + (scrollY || 0) > document.documentElement.scrollHeight * .45) return x;
    }
    return null;
  }
  function resolveNext(a, base) {
    if (!a || !a.getAttribute('href')) return null;
    try {
      var curr = new URL(base);
      var next = new URL(a.getAttribute('href'),curr);
      if (next.origin !== initial.origin || next.pathname !== '/search' || next.searchParams.get('q') !== query) return null;
      for (var i=0,keys=['tbm','udm','tbs']; i<keys.length; i++) {
        var key = keys[i];
        if ((next.searchParams.get(key)||'') !== (initial.searchParams.get(key)||'')) return null;
      }
      var before = Number(curr.searchParams.get('start')) || 0;
      var after = Number(next.searchParams.get('start'));
      if (!next.searchParams.has('start') || !Number.isFinite(after) || after <= before || after - before > 100 || visited[next.href]) return null;
      return next.href;
    } catch (_) { return null; }
  }
  function nextLink(doc, base) {
    var anchors = doc.querySelectorAll('a#pnnext,a[rel="next"],a[aria-label="Next page"],a[aria-label="下一页"],a[aria-label="下一頁"],#botstuff a[href*="start="],#foot a[href*="start="],#nav a[href*="start="],[role="navigation"] a[href*="start="]');
    var best = null, min = Infinity;
    for (var i=0; i<anchors.length; i++) {
      var u=resolveNext(anchors[i],base);
      if (!u) continue;
      var start=Number(new URL(u).searchParams.get('start'));
      if (start<min) {best=u;min=start;}
    }
    return best; // No invented start=+10 URLs: Google may not serve those pages.
  }
  function showNext(url, reason) {
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'surge-google-safe-next';
      notice.style.cssText = 'margin:18px auto;padding:12px;text-align:center;font-size:14px;line-height:1.6;color:#666;max-width:660px';
      (document.querySelector('#rso') || document.querySelector('#search') || document.body).appendChild(notice);
    }
    notice.textContent = reason || '此页无法安全连续加载。';
    if (url) {
      var a=document.createElement('a');
      a.href=url;
      a.textContent='正常打开下一页（确保图片、视频封面加载）';
      a.style.cssText='display:block;color:#1a73e8;text-decoration:underline;padding-top:5px';
      notice.appendChild(a);
    }
  }
  function clearNotice() { if (notice) {notice.remove();notice=null;} }
  function fingerprint(root) {
    return Array.prototype.slice.call(root.querySelectorAll('h3'),0,4).map(function(h){return (h.textContent||'').trim();}).join('|');
  }
  function emptyOrPlaceholder(src) {
    if (!src) return true;
    // Google's 1-pixel placeholder is not a thumbnail; its initialization script
    // will not run if another page is parsed with DOMParser.
    if (/^data:image\/(?:gif|png);base64,/i.test(src) && src.length < 220) return true;
    return false;
  }
  function usableImageSrc(src) {
    return /^(?:https?:\/\/|\/\/|data:image\/(?:jpeg|jpg|png|webp|avif);base64,)/i.test(src || '');
  }
  function staticMediaSafe(root) {
    // If a thumbnail requires per-page JS hydration, do not copy broken cards.
    // Leave users the original Google next-page link in that case.
    var imgs=root.querySelectorAll('img');
    for (var i=0; i<imgs.length; i++) {
      var im=imgs[i];
      var w=Number(im.getAttribute('width')) || 0;
      var h=Number(im.getAttribute('height')) || 0;
      if (w>0 && h>0 && w<=3 && h<=3) continue; // tracking pixel
      var src=im.getAttribute('src') || '';
      var ss=im.getAttribute('srcset') || im.getAttribute('data-srcset') || '';
      var lazy=im.getAttribute('data-src') || im.getAttribute('data-lazy-src') || '';
      if ((!src || emptyOrPlaceholder(src)) && usableImageSrc(lazy)) im.setAttribute('src',lazy);
      else if (ss && !im.getAttribute('srcset')) im.setAttribute('srcset',ss);
      src=im.getAttribute('src') || '';
      if ((!ss || !/https?:|data:image\//i.test(ss)) && emptyOrPlaceholder(src)) return false;
      if (src && !emptyOrPlaceholder(src) && !usableImageSrc(src) && !ss) return false;
      im.loading='lazy';
      im.decoding='async';
    }
    var videos=root.querySelectorAll('video');
    for (var j=0; j<videos.length; j++) {
      var poster=videos[j].getAttribute('poster');
      if (poster && emptyOrPlaceholder(poster)) return false;
    }
    return true;
  }
  function getResults(doc) {
    var el=doc.querySelector('#rso');
    if (el && el.children.length) return el;
    return null; // Do not copy entire #search (menus/scripts/layout can break).
  }
  function prepare(doc,url) {
    var source=getResults(doc), target=getResults(document);
    if (!source || !target || !source.querySelector('h3')) throw Error('Result list unavailable');
    var fp=fingerprint(source);
    if (fp && fingerprints[fp]) throw Error('Duplicate result page');
    var section=document.createElement('div');
    section.className='surge-google-page-extension';
    section.setAttribute('data-google-page',String(appended+1));
    for (var i=0; i<source.children.length; i++) {
      var item=source.children[i];
      if (/^(?:SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/i.test(item.tagName)) continue;
      var clone=document.importNode(item,true);
      clone.querySelectorAll('script,noscript,template').forEach(function(el){el.remove();});
      // Drop duplicate IDs only; keep styling and all valid image/video URLs.
      clone.removeAttribute('id');
      clone.querySelectorAll('[id]').forEach(function(el){el.removeAttribute('id');});
      section.appendChild(clone);
    }
    if (!section.querySelector('h3') || !staticMediaSafe(section)) throw Error('Media requires Google page scripts');
    return {node:section,fp:fp,url:url,next:nextLink(doc,url)};
  }
  function prefetch(url) {
    if (!url || pending || cached || stopped || nativeButton()) return;
    var ctl=typeof AbortController === 'function' ? new AbortController() : null;
    var timer=setTimeout(function(){if(ctl)ctl.abort();},12000);
    pending=fetch(url,{credentials:'same-origin',redirect:'follow',signal:ctl?ctl.signal:undefined})
      .then(function(resp){
        if (!resp.ok || !/text\/html/i.test(resp.headers.get('content-type') || '') ||
            new URL(resp.url).origin !== initial.origin || new URL(resp.url).pathname !== '/search') throw Error('Non-search page');
        return resp.text();
      })
      .then(function(html){
        if (/(?:unusual traffic|automated queries|验证码)/i.test(html.slice(0,3000))) throw Error('Verification required');
        var doc=new DOMParser().parseFromString(html,'text/html');
        return prepare(doc,url);
      })
      .then(function(info){cached=info;})
      .catch(function(err){
        stopped=true;
        showNext(url,'后续搜索结果的媒体需要 Google 原生脚本，已停止不安全的拼接。');
        console.log('[Surge Google] '+err.message);
      })
      .finally(function(){clearTimeout(timer);pending=null; if (!stopped) scheduleCheck();});
  }
  function appendCached() {
    if (!cached || busy || stopped) return;
    var info=cached;cached=null;
    var target=getResults(document);
    if (!target) return;
    busy=true;
    target.appendChild(info.node);
    visited[info.url]=true;
    if (info.fp) fingerprints[info.fp]=true;
    currentURL=info.url;
    upcomingURL=info.next;
    appended++;
    clearNotice();
    busy=false;
    if (!info.next || appended+nativeLoads >= MAX_PAGES) stopped=true;
    // Don't immediately chain more pages: let the reader keep scrolling.
  }
  function nativeLoad(button) {
    if (busy || stopped) return;
    busy=true;
    userInteracted=false;
    nativeLoads++;
    var done=false, observer=null, timer=null;
    var height=document.documentElement.scrollHeight;
    var count=document.querySelectorAll('#rso h3').length;
    var originalButton=button;
    function doneLoading(success) {
      if(done)return;
      done=true;
      if(observer)observer.disconnect();
      if(timer)clearTimeout(timer);
      busy=false;
      if (success) upcomingURL=nextLink(document,currentURL);
      if (!success) {
        stopped=true;
        showNext(nextLink(document,currentURL),'Google 原生加载未成功；为避免图片、视频封面损坏，不强行拼接。');
      }
    }
    function added() {
      return document.querySelectorAll('#rso h3').length>count ||
        document.documentElement.scrollHeight>height+160 || !originalButton.isConnected;
    }
    if (typeof MutationObserver==='function') {
      observer=new MutationObserver(function(){if(added())doneLoading(true);});
      observer.observe(document.querySelector('#search')||document.body,{subtree:true,childList:true});
    }
    try {button.click();}catch(_){doneLoading(false);return;}
    timer=setTimeout(function(){doneLoading(added());},14000);
  }
  function checks() {
    rafPending=false;
    if (!userInteracted || stopped || busy || appended+nativeLoads>=MAX_PAGES) return;
    var cooldown=400-(Date.now()-lastAction);
    if (cooldown>0) {setTimeout(scheduleCheck,cooldown+20);return;}
    var y=scrollY || document.documentElement.scrollTop || 0;
    if(y<60)return;
    var height=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight);
    var remaining=height-(y+innerHeight);
    var warmDist=Math.max(1800,Math.min(3600,innerHeight*3.3));
    var appendDist=Math.max(800,Math.min(1500,innerHeight*1.3));
    if(remaining>warmDist)return;
    var more=nativeButton();
    if(more && remaining<appendDist){
      lastAction=Date.now();
      nativeLoad(more);
      return;
    }
    if(more)return;
    if(cached && remaining<appendDist){
      lastAction=Date.now();
      appendCached();
      return;
    }
    if(!pending && !cached && upcomingURL)prefetch(upcomingURL);
  }
  function scheduleCheck(){if(!rafPending){rafPending=true;requestAnimationFrame(checks);}}
  function install() {
    if(!document.body)return;
    var root=getResults(document);
    if(root){var fp=fingerprint(root);if(fp)fingerprints[fp]=true;}
    upcomingURL=nextLink(document,currentURL);
    ['touchstart','touchmove','wheel'].forEach(function(name){window.addEventListener(name,function(){userInteracted=true;scheduleCheck();},{passive:true});});
    window.addEventListener('keydown',function(e){if(/^(?:ArrowDown|PageDown|End| |Space)$/.test(e.key)){userInteracted=true;scheduleCheck();}});
    window.addEventListener('scroll',scheduleCheck,{passive:true});
    window.addEventListener('touchend',scheduleCheck,{passive:true});
    window.addEventListener('resize',scheduleCheck,{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();` + '</script>';
    var modified = body.replace(/<\/body\s*>/i, injection + '\n</body>');
    var out = Object.assign({}, headers);
    Object.keys(out).forEach(function (key) {
      if (/^(?:content-security-policy|content-length)$/i.test(key)) delete out[key];
    });
    $done({ body: modified, headers: out });
  } catch (error) {
    console.log('[Surge Google media-safe] ' + error.message);
    $done({});
  }
})();
