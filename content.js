function collapseTextWhitespace(text) {
  return text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
}

function normalizeMarkdown(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeInline(text) {
  return text.replace(/`/g, "\\`");
}

function tableToMarkdown(tableEl) {
  const rows = Array.from(tableEl.querySelectorAll("tr"));
  if (rows.length === 0) {
    return "";
  }

  const matrix = rows.map((row) => {
    const cells = Array.from(row.querySelectorAll("th, td"));
    return cells.map((cell) => collapseTextWhitespace((cell.textContent || "").trim()));
  });

  const colCount = Math.max(...matrix.map((row) => row.length), 1);
  const padded = matrix.map((row) => {
    const next = [...row];
    while (next.length < colCount) {
      next.push("");
    }
    return next;
  });

  const header = padded[0];
  const divider = new Array(colCount).fill("---");
  const body = padded.slice(1);

  const formatRow = (row) => `| ${row.join(" | ")} |`;
  const lines = [formatRow(header), formatRow(divider), ...body.map(formatRow)];
  return `\n${lines.join("\n")}\n\n`;
}

function htmlToMarkdown(root) {
  function walk(node, indent = "") {
    if (node.nodeType === Node.TEXT_NODE) {
      return collapseTextWhitespace(node.textContent || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const tag = node.tagName.toLowerCase();

    if (tag === "pre") {
      const codeEl = node.querySelector("code");
      const className = codeEl?.className || "";
      const langMatch = className.match(/language-([\w-]+)/);
      const lang = langMatch ? langMatch[1] : "";
      const code = codeEl ? codeEl.textContent || "" : node.textContent || "";
      return `\n\n\`\`\`${lang}\n${code.trimEnd()}\n\`\`\`\n\n`;
    }

    const children = Array.from(node.childNodes)
      .map((child) => walk(child, indent))
      .join("");

    if (tag === "code") {
      return `\`${escapeInline(children)}\``;
    }

    if (tag === "strong" || tag === "b") {
      return `**${children.trim()}**`;
    }

    if (tag === "em" || tag === "i") {
      return `*${children.trim()}*`;
    }

    if (tag === "a") {
      const href = node.getAttribute("href") || "";
      const label = children.trim() || href;
      return `[${label}](${href})`;
    }

    if (tag.match(/^h[1-6]$/)) {
      const level = Number(tag[1]);
      return `\n${"#".repeat(level)} ${children.trim()}\n\n`;
    }

    if (tag === "blockquote") {
      const lines = normalizeMarkdown(children)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      return `\n${lines}\n\n`;
    }

    if (tag === "li") {
      return `${indent}- ${children.trim()}\n`;
    }

    if (tag === "ul") {
      const listItems = Array.from(node.children)
        .filter((child) => child.tagName?.toLowerCase() === "li")
        .map((child) => walk(child, `${indent}  `))
        .join("");
      return `\n${listItems}`;
    }

    if (tag === "ol") {
      const lines = Array.from(node.children)
        .filter((child) => child.tagName?.toLowerCase() === "li")
        .map((child, i) => `${i + 1}. ${normalizeMarkdown(walk(child, `${indent}  `))}`)
        .join("\n");
      return `\n${lines}\n`;
    }

    if (tag === "p") {
      return `\n${children.trim()}\n`;
    }

    if (tag === "div" || tag === "section" || tag === "article") {
      return `${children}\n`;
    }

    if (tag === "br") {
      return "\n";
    }

    if (tag === "table") {
      return tableToMarkdown(node);
    }

    if (tag === "hr") {
      return "\n---\n";
    }

    return children;
  }

  return normalizeMarkdown(walk(root));
}

function buildFileName(text, index) {
  const firstLine = (text.split("\n").find((line) => line.trim()) || `reply-${index + 1}`).trim();
  const cleaned = firstLine
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/^[#\-\s\d.]+/, "")
    .replace(/\s+/g, "-")
    .slice(0, 40)
    .toLowerCase();

  return `${String(index + 1).padStart(2, "0")}-${cleaned || "untitled"}.md`;
}

function getAssistantBlocks() {
  const selectors = [
    '[data-message-author-role="assistant"]',
    'article[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]'
  ];

  for (const selector of selectors) {
    const items = Array.from(document.querySelectorAll(selector));
    if (items.length > 0) {
      console.info(`[FetchGPT] 找到 ${items.length} 个助手回复块。`);
      return items;
    }
  }

  console.warn("[FetchGPT] 未找到助手回复块。请确认当前页面在对话详情中。");
  return [];
}

function extractMarkdownFiles() {
  const assistantBlocks = getAssistantBlocks();

  return assistantBlocks
    .map((block, index) => {
      const markdownNode = block.querySelector(".markdown") || block;
      const md = htmlToMarkdown(markdownNode);
      if (!md) {
        console.warn(`[FetchGPT] 第 ${index + 1} 条回复提取为空，已跳过。`);
        return null;
      }
      return {
        name: buildFileName(md, index),
        content: md
      };
    })
    .filter(Boolean);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action !== "EXPORT_CHATGPT_REPLIES") {
    return;
  }

  const files = extractMarkdownFiles();

  if (files.length === 0) {
    console.error("[FetchGPT] 导出失败：当前页面没有找到 ChatGPT 回复内容。");
    sendResponse({ ok: false, error: "当前页面没有找到 ChatGPT 回复内容。" });
    return;
  }

  chrome.runtime.sendMessage({ action: "DOWNLOAD_MARKDOWN_FILES", files }, (downloadResponse) => {
    if (chrome.runtime.lastError) {
      console.error("[FetchGPT] 下载消息发送失败：", chrome.runtime.lastError.message);
      sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }

    if (!downloadResponse?.ok) {
      console.error("[FetchGPT] 下载失败：", downloadResponse?.error || "下载失败。");
      sendResponse({ ok: false, error: downloadResponse?.error || "下载失败。" });
      return;
    }

    console.info(`[FetchGPT] 已触发 ${files.length} 个文件下载。`);
    sendResponse({ ok: true, count: files.length });
  });

  return true;
});
