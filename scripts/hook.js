// 注入 XHR/fetch 拦截钩子：把后续所有接口响应记录到 window.__net_log
// 之后 reload 页面，题目数据接口的响应会被完整捕获
(() => {
  if (window.__net_hooked) return 'already';
  window.__net_log = [];
  window.__net_hooked = true;

  const log = (kind, url, body) => {
    try {
      window.__net_log.push({ kind, url: String(url).slice(0, 300), body: typeof body === 'string' ? body.slice(0, 500000) : body });
    } catch (e) {}
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__hook_url = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      try {
        if (this.responseType === '' || this.responseType === 'text') {
          log('xhr', this.__hook_url, this.responseText);
        } else if (this.responseType === 'json') {
          log('xhr', this.__hook_url, JSON.stringify(this.response));
        }
      } catch (e) {}
    });
    return origSend.apply(this, arguments);
  };

  const origFetch = window.fetch;
  window.fetch = function () {
    const url = arguments[0];
    const u = typeof url === 'string' ? url : (url && url.url) || '';
    return origFetch.apply(this, arguments).then((res) => {
      try {
        res.clone().text().then((t) => log('fetch', u, t));
      } catch (e) {}
      return res;
    });
  };
  return 'hooked';
})();
