/* Surge: Google Mac-only mobile search page experiment.
 * Only modifies the User-Agent of top-level HTML GET /search?q=...
 * requested by macOS Safari / other Macintosh browsers.
 * iPhone and other requests are left alone.
 * This requests Google's mobile SERP, so the existing v4 script can
 * operate on Google's native mobile "More results" control if available.
 * It cannot guarantee Google will serve or maintain that control.
 */
(function () {
  try {
    if (!$request || String($request.method || '').toUpperCase() !== 'GET') { $done({}); return; }
    var url = new URL($request.url);
    if (!/^www\.google\.[a-z.]+$/i.test(url.hostname) || url.pathname !== '/search' || !url.searchParams.get('q')) {
      $done({}); return;
    }
    var headers = Object.assign({}, $request.headers || {});
    function headerKey(name) {
      var keys = Object.keys(headers);
      for (var i = 0; i < keys.length; i++) if (keys[i].toLowerCase() === name.toLowerCase()) return keys[i];
      return null;
    }
    var uaKey = headerKey('User-Agent');
    if (!uaKey) { $done({}); return; }
    var ua = String(headers[uaKey]);
    if (!/\bMacintosh\b/i.test(ua) || /\b(iPhone|iPad|iPod|Mobile)\b/i.test(ua)) { $done({}); return; }
    var acceptKey = headerKey('Accept');
    if (acceptKey && !/text\/html|application\/xhtml\+xml/i.test(String(headers[acceptKey]))) {
      $done({}); return;
    }
    var destKey = headerKey('Sec-Fetch-Dest');
    if (destKey && !/^(?:document|iframe)$/i.test(String(headers[destKey]))) { $done({}); return; }
    var modeKey = headerKey('Sec-Fetch-Mode');
    if (modeKey && String(headers[modeKey]).toLowerCase() !== 'navigate') { $done({}); return; }
    headers[uaKey] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    $done({headers: headers});
  } catch (_) { $done({}); }
})();
