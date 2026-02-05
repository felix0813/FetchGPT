const exportBtn = document.getElementById("exportBtn");
const statusEl = document.getElementById("status");

const CHATGPT_URL_RE = /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//i;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#1f2937";
}

function sendExportMessage(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: "EXPORT_CHATGPT_REPLIES" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message, needsInjection: true });
        return;
      }

      resolve({ ok: true, response });
    });
  });
}

function injectContentScript(tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    }, () => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      resolve({ ok: true });
    });
  });
}

exportBtn.addEventListener("click", async () => {
  setStatus("正在读取当前页面内容...");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    setStatus("无法获取当前标签页。", true);
    return;
  }

  if (!CHATGPT_URL_RE.test(tab.url || "")) {
    setStatus("请先打开 chatgpt.com 或 chat.openai.com 的会话页面。", true);
    return;
  }

  let messageResult = await sendExportMessage(tab.id);

  if (!messageResult.ok && messageResult.needsInjection) {
    const injectResult = await injectContentScript(tab.id);
    if (!injectResult.ok) {
      setStatus(`导出失败：${injectResult.error}`, true);
      return;
    }

    messageResult = await sendExportMessage(tab.id);
  }

  if (!messageResult.ok) {
    setStatus(`导出失败：${messageResult.error}`, true);
    return;
  }

  const response = messageResult.response;
  if (!response || !response.ok) {
    setStatus(response?.error || "未找到可导出的回复。", true);
    return;
  }

  setStatus(`已开始下载 ${response.count} 个 Markdown 文件。`);
});
