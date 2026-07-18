# Clinical Signal Desk

Lawrence 的个人临床研发情报应用。GitHub 云端每天自动采集公开来源，筛选真正相关且未在历史库出现的新内容，并发布到 GitHub Pages。

## 每天更新什么

- **AI × 临床医学**：最多 3 条，必须直接影响临床诊疗、临床试验、医学监查、药物研发或临床数据质量。
- **癫痫 / 脑卒中**：合计 2–3 条，优先指南、关键试验、诊疗变化、安全性、终点和 patient-level/source-data 影响。
- 如果没有足够高质量的新信息，宁可少发或不发，不用旧闻补齐。

每条内容包括事实、与 Lawrence 的相关性、证据与局限、临床研发落点、置信度和可点击原始来源。

## 云端运行

工作流在 GitHub 云服务器运行，电脑关机或休眠不影响更新。

- 定时启动：每天 **06:45（Asia/Shanghai）**
- 目标发布时间：通常在 **07:00 前**
- 手动更新：仓库 `Actions` → `Daily Clinical Intelligence` → `Run workflow`
- 默认解读模型：GitHub Models 的 `openai/gpt-4.1`
- 默认不需要另配 API Key；调用使用 GitHub Actions 自动提供的 `GITHUB_TOKEN`

GitHub 定时任务可能偶尔延迟数分钟，因此工作流提前 15 分钟启动。

## 信息源

- PubMed / NCBI E-utilities
- Google News RSS、Bing Web RSS 与公开新闻站点
- 监管机构、期刊、公司一手披露等公开网页
- YouTube 和 X 的公开检索结果

YouTube 和 X 只作为早期信号，不得作为医学事实的唯一证据。模型必须回到更高等级来源核对；无法核对的内容降低置信度或不入选。

## 不重复机制

历史记录保存在 `site/data/archive.json`，每日候选与完整历史库比较：

1. URL、DOI、PMID、YouTube video ID、X status ID 精确去重。
2. 标题分词、指纹和相似度去重，拦截换标题的转载。
3. GPT 依据事件键和事实内容识别“同一事件的不同报道”。

同一研究只有出现新增结果、监管决定、指南变化、新安全信号或新临床里程碑时，才可作为“进展更新”再次出现，并必须写清新增内容。

## 可选：升级为 OpenAI 联网检索

在仓库 `Settings` → `Secrets and variables` → `Actions` 中添加 `OPENAI_API_KEY` 后，工作流会自动改用：

- `gpt-5.6-terra`
- OpenAI Responses API 的 `web_search` 工具

不添加该密钥时，仍可使用 GitHub Models + 云端公开来源采集器正常运行。

## 本地验证

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
GITHUB_TOKEN=... python scripts/update_digest.py --dry-run
```

网站为纯静态页面，入口位于 `site/index.html`。仓库只保存公开来源资讯，不写入患者数据或内部临床文档。
