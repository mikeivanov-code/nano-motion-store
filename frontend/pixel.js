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
oaiq('init', { pixelId: 'F7KSWkG5KCzsqcVr7nHP18', debug: new URLSearchParams(location.search).get('debug') === '1' });
