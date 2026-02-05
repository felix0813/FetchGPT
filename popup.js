const exportBtn = document.getElementById("exportBtn");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#1f2937";
}

exportBtn.addEventListener("click", () => {
  setStatus("正在读取当前页面内容...");

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.id) {
      setStatus("无法获取当前标签页。", true);
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "EXPORT_CHATGPT_REPLIES" }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus(`导出失败：${chrome.runtime.lastError.message}`, true);
        return;
      }

      if (!response || !response.ok) {
        setStatus(response?.error || "未找到可导出的回复。", true);
        return;
      }

      setStatus(`已开始下载 ${response.count} 个 Markdown 文件。`);
    });
  });
});
