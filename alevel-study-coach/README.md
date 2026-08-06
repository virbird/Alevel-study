# A-Level Study Coach（Obsidian 插件）

A-Level 学习**辅助**教练：主学习在线下，需要协助时才打开它——概念不懂、题目卡住、作文批改。
插件记录每次求助，逐步发现弱点；目标 A-Level 全 A*、雅思 7.5+。

An **assistive** A-Level study coach for Obsidian: offline-first learning, open the plugin only when
you need help — unclear concepts, stuck on a problem, or essay grading. Every request is logged to
discover weaknesses over time. Targets: A-Level all A*, IELTS 7.5+.

产品设计见 `docs/产品设计.md`（v0.3）。提示词体系来自 chat-2 教练配置包，技术底座简化 fork 自 AI Study Buddy。
Product design: `docs/产品设计.md` (v0.3). Prompt system from the chat-2 coach pack; tech base simplified-forked from AI Study Buddy.

## 功能总览 · Feature Overview

### 教练会话 · Coach Sessions

| 功能 | Feature | 说明 / Description |
|---|---|---|
| 按科目隔离的会话 | Per-subject sessions | 每个科目维护自己的会话；切科目自动存/恢复，结题即关闭 / Each subject keeps its own session; switching saves/restores automatically, concluding closes it |
| 自动开会话 | Auto session start | 进入科目即新开会话并展示开场，无需点按钮；无交互的会话不记录 / Sessions open automatically on entry; sessions with no user input are never recorded |
| 开场模式菜单 | Opening mode menu | 开场白从提示词 ` ```opening ` 围栏本地零请求展示（概念精练 A-E / 经济 A-D / 雅思 A-D）；回复字母选模式、随时显式跳转、不选则 AI 场景引导 / Opening is rendered locally (zero API call); reply a letter to pick a mode, jump anytime, or let the AI guide |
| 结题闭环 | Conclude flow | 结题=自评/审查/log 行/会话打标，完成后自动存档并续开新会话 / Conclude = self-review, log rows, session tagging, then auto-archive and auto-reopen |
| 会话增强 | Session extras | SSE 流式输出、发图（视觉模型，限 4 张/5MB）、引用文档作全会话上下文、历史会话续聊 / Streaming output, image attachments, session-wide doc references, resume from history |
| 独立思考计时 | Think-first timer | 会话内倒计时，未到门槛拦截发送；跑满后消息带「思考凭证」 / In-session countdown; sending is blocked before the threshold; full time adds a "thinking credit" note |

### 上下文与模型 · Context & Models

| 功能 | Feature | 说明 / Description |
|---|---|---|
| 全局模型选择 | Global model selector | 顶部下拉作用于所有 AI 调用；设置页模型列表化管理（逐个添加/单独测试/设为默认/删除），按接口分别配置 / Top-bar selector for all AI calls; settings list manages models per provider (add / test individually / set default / delete) |
| 上下文管理 | Context management | 发送框下方显示「已用上下文 x/y（n%）」；阈值可配置（默认 80%），超限红色提示+「强制压缩」；压缩为耗时操作，全程有提示 / Usage shown under the input box; threshold configurable (default 80%); over-limit turns red with a "force compress" button; compression is long-running and always shows progress notices |

### 记录与复习 · Records & Review

| 功能 | Feature | 说明 / Description |
|---|---|---|
| Error Log | Error log ledger | 13 列主表；复发自动 +1；复查 7 天 / 复发 3 天；状态流转 未消除→观察中→已消除 / Recurrence auto +1; review in 7d (3d if recurring); status flows unresolved→observing→resolved |
| 三层分流 | 3-way routing | 具体失分→主表；题型/习惯→练习侧重；模糊自述→弱点印象 / Specific losses → ledger; habits → practice focus; vague claims → weakness impressions |
| 记录中心 | Records center | 「记录」页签统一展示 A-Level 失分表 + 雅思批改记录 + 表达积累库 + 提问记录（数据文件保持独立，零信息丢失） / One tab shows all ledgers (data files stay separate, zero information loss) |
| 复习提醒 | Review reminders | 状态栏徽标 + 每日温和 Notice；复查用 AI 变式题（不重做原题） / Status-bar badge + daily gentle notice; reviews use AI-generated variants, never the same question |
| 随手记 | Quick capture | 一句自然语言 → AI 建议归类 → 收/改/丢 确认 / One natural sentence → AI suggests a category → accept/edit/discard |

### 弱点分析 · Weakness Analysis

| 功能 | Feature | 说明 / Description |
|---|---|---|
| 分析引擎 | Insight engine | 提问热点 × 复发热点 × 表达码趋势 × 术语/复查堆积，纯本地统计，单信号 ≥3 条才出建议 / Local stats across 5 signals; suggestions need ≥3 hits |
| 建议卡片 | Suggestion cards | 落盘 `建议/`；看建议/不准确反馈回路；同意后一次性生成学习建议（不排日程表） / Persisted cards with feedback loop; study advice generated only after consent |
| 周报导出 | Weekly report | `周报/{ISO周}.md` 六块统计（求助/失分复发/复习/术语/雅思/建议） / Six stat blocks per ISO week |
| 进阶角 | Advanced corner | 按阶段给进阶考试指引（G10 UKMT → G11 MAT/TMUA → G12 STEP/PAT/ESAT），一键思维题会话+自动计时 / Stage-based exam roadmap + one-click thinking-problem session with auto timer |

### 雅思 · IELTS

| 功能 | Feature | 说明 / Description |
|---|---|---|
| 统一训练入口 | Unified entry | 教练「雅思写作训练」：A 完整批改 / B 段落点评 / C 讨论与异议 / D 针对练习，可混用、可中途切换 / Grade / comment / dispute / practice modes, freely mixed and switchable mid-session |
| 任意笔记批改 | Grade any note | 打开任意笔记（题目+作文同篇，可含图片），六段输出写入「## AI 批改」，支持复批归档对比 / Grade any note with six-part output; re-grading archives the previous version |
| 分数台账 | Score ledger | 每次批改总分与 TR/CC/LR/GRA 追加进 `雅思/批改记录.md`，即提升轨迹 / Every grade appends to the ledger — your improvement trajectory |
| 表达积累库 | Expression library | 批改提取高分表达自动入库（去重），SM-2 简化间隔 1→3→7→14→30→60 天，到期造句抽查 / High-score expressions auto-collected with simplified SM-2 scheduling and sentence drills |

## 数据位置 · Data Locations（全部在 vault 内，git / iCloud 可同步 · all inside the vault, syncable via git / iCloud）

```
vault/StudyCoach/
├── 档案.md          # 学生参数 frontmatter（设置页可改）/ student profile
├── 三年路线图.md    # 3-year roadmap
├── prompts/         # 教练提示词（含 ```opening 围栏），可直接编辑 / coach prompts, editable
├── 建议/            # 弱点建议卡片 / suggestion cards
├── 雅思/            # 作文/ 批改记录.md（台账）/ 表达积累库.md / IELTS essays, ledger, library
├── 周报/            # 每周统计（幂等覆盖）/ weekly reports
├── 记录/            # error-log / 提问记录 / 术语清单 / 练习侧重 / 弱点印象 / 统计分析 / 进展 / 学习日志
│                    # records: error log, question log, terms, focus, impressions, stats, progress, diary
└── 会话/            # 教练对话存档（无交互不落盘）/ session archives (only if there was interaction)
```

## 安装 · Installation

```bash
npm install
npm run build
./install.sh /path/to/your/vault
```

然后在 Obsidian：设置 → 第三方插件 → 启用 **A-Level Study Coach** → 插件设置里配置 LLM（OpenAI 兼容端点或 Anthropic 原生；Key 只存本机）。
Then in Obsidian: Settings → Community plugins → enable **A-Level Study Coach** → configure the LLM in plugin settings (OpenAI-compatible endpoint or native Anthropic; the key stays on your machine).

## 开发 · Development

```bash
npm run dev        # esbuild watch
npm run typecheck  # tsc --noEmit
npm test           # UT + FVT 全量套件（每次改动必须全绿）/ full suite, must stay green
```

测试体系（test/，基于 FakeVault 隔离 obsidian，node 直接跑）：

| 层 | Layer | 范围 / Scope |
|---|---|---|
| UT | utils / errorlog / services / insight / ielts / report | 解析、入库规则、状态机、分析阈值、批改容错、周报统计 / parsing, ledger rules, state machines, thresholds, grading tolerance, report stats |
| FVT | session | 完整求助闭环：注入→结题→打标+入库→复发→存档续聊 / full help loop |
| FVT | dataflow | 冷启动三层分流、复习流转、分析循环 / cold-start routing, review flow, analysis cycle |
| FVT | ielts | 批改闭环：回填→分数入库→表达去重→趋势短板 / grading closed loop |

## 已知限制 · Known Limitations（刻意不做 · by design）

- 术语/表达抽查弹窗非流式（回复短，无需流式）/ drill modals are non-streaming (short replies)
- 雅思口语/听力/阅读不做批改打卡（线下主学习范畴）/ no IELTS speaking/listening/reading features (offline scope)
- 周报/雷达为文本统计，不引入图表库（保持轻量）/ reports are plain text, no chart libs
- prompt 模板更新不覆盖 vault 已存在文件（用户修改优先）/ template updates never overwrite existing vault files
- 流式依赖 fetch；提供商拦截 CORS 时换 OpenAI 兼容网关 / streaming relies on fetch; use an OpenAI-compatible gateway if CORS is blocked
