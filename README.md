# 惊天背单词

一个支持 AI（Gemini）自动生成例句/词组、支持离线缓存与桌面打包 (Electron) 的 CET6 背单词 / 复习工具。

## 已实现功能

- CET6 词库加载（构建期切片 + 运行期惰性合并）
- 词义 / 音标展示，浏览器语音合成发音（英/美音切换）
- 闪卡模式（支持例句、词组显示与翻转）
- AI 生成：
	- 单词缺失例句/词组时自动按需生成
	- 批量区间生成，跳过已存在数据
	- 生成内容（例句 / 句子中文 / 词组 / 词组释义）本地持久化，刷新不丢
- 学习进度与 SRS 风格质量评分（0–5）
- 收藏 / 常错 / 难词标记
- 高级搜索（支持正则模式）
- 数据本地缓存（localStorage），无后端上传
- 桌面端 (Electron) 打包与自定义图标
- 构建期网络失败回退到最小内置词集合，保证可安装

## 后续可扩展

- 完整离线全量词库打包（预生成 JSON，跳过网络）
- 导出 / 导入（进度、AI 生成内容）
- 多词书支持（CET4 / 考研 / 托福）
- 自定义 AI 模型与温度参数
- 例句质量人工评估 & 重生成功能
- 真题语料反向索引（倒排）
- 统计面板（记忆曲线、每日复习量）
- PWA 安装与离线 Service Worker 强化
- 多语言 UI / 暗色模式切换

## 运行

```powershell
npm install
npm run dev
```

### 桌面与图标

已引入 Electron，可使用 `icon.png` 生成多尺寸 ICO：

1. 内置脚本（无需外部工具）
   
	```powershell
	npm run icon:gen
	```

2. （可选）使用 ImageMagick 自行生成：
   
	```powershell
	magick convert icon.png -define icon:auto-resize=256,128,64,48,32,24,16 build/icon.ico
	```

3. 开发桌面版：
   
	```powershell
	npm run dev:desktop
	```

4. 打包桌面版：
   
	```powershell
	npm run build:desktop
	```

5. 若需 favicon：复制并在 `index.html` `<head>` 中加入：
   
	```powershell
	Copy-Item icon.png public/favicon.png -Force
	```
   
	```html
	<link rel="icon" type="image/png" href="/favicon.png" />
	```

浏览器访问终端提示地址（默认 http://localhost:5173）。首次会尝试联网抓取词库；若失败使用内置少量后备词，后续仍可正常体验与 AI 功能。

## 数据缓存说明
- 词库切片缓存：`cet6_words_cache_v1`（名称示例，视代码而定）
- 进度：`cet6_progress_v2`
- 收藏：`cet6_fav_v1`
- AI 生成覆盖数据：`enrich_overrides_v1`
- AI 设置（模型等）：`ai_settings_v1`

刷新词库按钮会清除词库缓存（不影响进度 / 收藏 / AI 覆盖）。存在构建期切片时优先使用 `public/cet6/*.json`。

## 隐私

所有学习数据仅存于浏览器 localStorage，不上传服务器。

## 发音

使用浏览器内置 SpeechSynthesis，支持英/美音切换与批量（前 20 词）朗读。首次可能需要等待声源列表加载。

## 贡献

欢迎提出改进想法（性能、算法、UI、可访问性等）。

## 高级搜索使用说明
- 正则：输入正则模式（例如 `^re.*`）。如需完整 JS 正则可直接写表达式主体（不含两侧 `/`）。

## SRS 质量评分指南

0 完全不会 / 空白；1 回忆失败有印象；2 犹豫后错误；3 犹豫后正确；4 基本熟悉；5 秒回非常熟练。

## 日目标与提醒
- “提醒”按钮安排一个 30 分钟后的一次性浏览器通知（若目标未达成且授权允许）。

---

维护者：KYJCASTER  |  邮箱：2016559265w@gmail.com

