function normalizeWhitespace(text) {
  return text.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function escapeInline(text) {
  return text.replace(/`/g, "\\`");
}

function htmlToMarkdown(root) {
  function walk(node, indent = "") {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const tag = node.tagName.toLowerCase();
    const children = Array.from(node.childNodes)
      .map((child) => walk(child, indent))
      .join("");

    if (tag === "pre") {
      const codeEl = node.querySelector("code");
      const className = codeEl?.className || "";
      const langMatch = className.match(/language-([\w-]+)/);
      const lang = langMatch ? langMatch[1] : "";
      const code = codeEl ? codeEl.textContent || "" : node.textContent || "";
      return `\n\n\`\`\`${lang}\n${code.trimEnd()}\n\`\`\`\n\n`;
    }

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

    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
      const level = Number(tag[1]);
      return `\n${"#".repeat(level)} ${children.trim()}\n\n`;
    }

    if (tag === "blockquote") {
      const lines = normalizeWhitespace(children)
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
        .map((child) => walk(child, indent + "  "))
        .join("");
      return `\n${listItems}`;
    }

    if (tag === "ol") {
      const lines = Array.from(node.children)
        .filter((child) => child.tagName?.toLowerCase() === "li")
        .map((child, i) => `${i + 1}. ${normalizeWhitespace(walk(child, indent + "  "))}`)
        .join("\n");
      return `\n${lines}\n`;
    }

    if (tag === "p") {
      return `\n${children.trim()}\n`;
    }

    if (tag === "br") {
      return "\n";
    }

    if (tag === "table") {
      return `\n${normalizeWhitespace(node.innerText)}\n\n`;
    }

    if (tag === "hr") {
      return "\n---\n";
    }

    return children;
  }

  return normalizeWhitespace(walk(root));
}

function buildFileName(text, index) {
  const firstLine = (text.split("\n").find((line) => line.trim()) || `reply-${index + 1}`).trim();
  const cleaned = firstLine
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40)
    .toLowerCase();

  return `chatgpt-reply-${String(index + 1).padStart(2, "0")}-${cleaned || "untitled"}.md`;
}

function getAssistantBlocks() {
  const selectors = [
    '[data-message-author-role="assistant"]',
    'article[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]'
  ];

  for (const selector of selectors) {
    const items = Array.from(document.querySelectorAll(selector));
    if (items.length > 0) {
      return items;
    }
  }

  return [];
}

function extractMarkdownFiles() {
  const assistantBlocks = getAssistantBlocks();

  return assistantBlocks
    .map((block, index) => {
      const markdownNode = block.querySelector(".markdown") || block;
      const md = htmlToMarkdown(markdownNode);
      if (!md) {
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
    sendResponse({ ok: false, error: "当前页面没有找到 ChatGPT 回复内容。" });
    return;
  }

  chrome.runtime.sendMessage({ action: "DOWNLOAD_MARKDOWN_FILES", files }, (downloadResponse) => {
    if (chrome.runtime.lastError) {
      sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }

    if (!downloadResponse?.ok) {
      sendResponse({ ok: false, error: downloadResponse?.error || "下载失败。" });
      return;
    }

    sendResponse({ ok: true, count: files.length });
  });

  return true;
});
