# ChatGPT 回复导出 Edge 插件

这是一个适用于 **Microsoft Edge (Manifest V3)** 的浏览器插件，用于将当前 ChatGPT 页面中的助手回复导出为 Markdown 文件。

## 功能

- 读取当前页面中的所有 ChatGPT 助手回复。
- 每条回复导出为单独的 `.md` 文件。
- 文件名会自动按顺序编号，并使用回复首行生成可读名称。

## 安装方式（开发者模式）

1. 打开 `edge://extensions/`
2. 开启右上角 **开发人员模式**。
3. 点击 **加载解压缩的扩展**。
4. 选择本项目目录 `/workspace/FetchGPT`。

## 使用方式

1. 打开任意 ChatGPT 对话页面（`chatgpt.com` 或 `chat.openai.com`）。
2. 点击扩展图标。
3. 点击 **导出当前页面所有 ChatGPT 回复**。
4. 浏览器会自动下载多个 Markdown 文件（每条回复一个文件）。

## 文件说明

- `manifest.json`：插件清单配置
- `popup.html` / `popup.js`：扩展弹窗及导出按钮逻辑
- `content.js`：提取页面中的助手回复并转换为 Markdown
- `background.js`：调用下载 API 保存多个文件
