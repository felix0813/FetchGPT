chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action !== "DOWNLOAD_MARKDOWN_FILES") {
    return;
  }

  const files = Array.isArray(message.files) ? message.files : [];
  if (files.length === 0) {
    console.error("[FetchGPT] 后台下载失败：没有收到可下载的文件。")
    sendResponse({ ok: false, error: "没有收到可下载的文件。" });
    return;
  }

  console.info(`[FetchGPT] 后台开始下载 ${files.length} 个文件。`);

  files.forEach((file, index) => {
    const safeName = file.name || `chatgpt-reply-${index + 1}.md`;
    const content = typeof file.content === "string" ? file.content : "";
    const dataUrl = `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`;

    chrome.downloads.download({
      url: dataUrl,
      filename: safeName,
      conflictAction: "uniquify",
      saveAs: false
    });
  });

  sendResponse({ ok: true, count: files.length });
});
