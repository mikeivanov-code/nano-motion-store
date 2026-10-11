// Official bootstrap, hosted as a same-origin script for a static CSP.
(function (w, d, s, u) {
  if (w.oaiq) return;
  var q = function () { q.q.push(arguments); };
  q.q = []; w.oaiq = q;
  var js = d.createElement(s); js.async = true; js.src = u;
  js.onload = () => { window.nanoPixelLoaded = true; };
  js.onerror = () => { window.nanoPixelFailed = true; };
  var f = d.getElementsByTagName(s)[0]; f.parentNode.insertBefore(js, f);
})(window, document, 'script', 'https://bzrcdn.openai.com/sdk/oaiq.min.js');
let allowed = false;
try { allowed = localStorage.getItem('nm-consent') === 'yes'; } catch {}
oaiq('consent', allowed);
// Synthetic fixtures only: normalized UTF-8 SHA-256, never raw customer data.
window.nanoDemoUser = {
  email_sha256: 'bc8f3218675c512bd178c9ca1001f44dccc70dbe314dd2730226414002c9e9df',
  external_id_sha256: 'c03319762323b01cb3dd0eb113347fdde1fd3eb392adb5ce6aa7c2abd15554a7'
};
let matching = false;
try { matching = allowed && localStorage.getItem('nm-demo-matching') === 'yes'; } catch {}
window.nanoMatchingEnabled = matching;
oaiq('init', { pixelId: 'F7KSWkG5KCzsqcVr7nHP18', debug: new URLSearchParams(location.search).get('debug') === '1', ...(matching ? { user: window.nanoDemoUser } : {}) });
// The SDK owns __obref and __oppref. Never manufacture an ad attribution ID.
