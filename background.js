/**
 * Background Service Worker
 * 职责：负责代理跨域网络请求，规避特定宿主页面的 CSP (Content Security Policy) 限制
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.type === 'FETCH_MUSIC_METADATA') {
    const { url } = request;
    if (!url || typeof url !== 'string') {
      sendResponse({ success: false, error: 'Invalid URL' });
      return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      signal: controller.signal
    })
      .then(async res => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        sendResponse({ success: true, data });
      })
      .catch(error => {
        clearTimeout(timeoutId);
        sendResponse({ success: false, error: error.message });
      });

    return true; // 保持异步消息通道开启
  }
});
