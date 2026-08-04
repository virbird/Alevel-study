# A-Level Study Coach（Obsidian 插件 · Phase 1）

A-Level 学习**辅助**教练：主学习在线下，需要协助时才打开它——概念不懂、题目卡住、作文批改。
插件记录每次求助，逐步发现弱点；目标 A-Level 全 A*、雅思 7.5+。

产品设计见仓库 `docs/产品设计.md`（v0.3）。提示词体系来自 chat-2 教练配置包，
技术底座简化 fork 自 AI Study Buddy（LLM_Private_Teacher）。

## Phase 1 功能

| 功能 | 说明 |
|---|---|
| 冷启动 | 用自己的话描述现状 → AI 提取 → 逐条确认，生成进展基线 + error log 种子 |
| 教练会话 | 选科目 → 自动注入 prompt + 学生档案 + 未消除失分记录 + 最近进展；结题后 log 行一键入库 |
| 会话打标 | 每次结题 AI 自动输出会话标签 → 追加到 `提问记录.md`（弱点分析的数据源，Phase 2 使用） |
| Error Log | 13 列主表；复发自动 +1（不新增行）；复查默认 7 天 / 复发 3 天；状态流转 未消除→观察中→已消除 |
| 随手记 | 一句自然语言 → AI 建议归类（进展/失分/术语/日志）→ 收/改/丢 确认 |
| 复习提醒 | 状态栏 📌 徽标 + 每日一次温和 Notice；复查用 AI 变式题（不重做原题） |

## 数据位置（全部在 vault 内，git / iCloud 可同步）

```
vault/StudyCoach/
├── 档案.md          # frontmatter 学生参数（设置页可改）
├── 三年路线图.md
├── prompts/         # 六份教练提示词 + 雅思批改，可直接编辑
├── 记录/
│   ├── error-log.md # 失分主表 + 代码表
│   ├── 提问记录.md  # 每次求助自动追加
│   ├── 术语清单.md
│   ├── 进展/        # 每科一份，日期+一句话
│   └── 学习日志.md
└── 会话/            # 教练对话存档
```

## 安装

```bash
npm install
npm run build
./install.sh /path/to/your/vault
```

然后在 Obsidian：设置 → 第三方插件 → 启用 **A-Level Study Coach** → 插件设置里配置 LLM
（OpenAI 兼容端点或 Anthropic 原生；Key 只存本机）。

## 开发

```bash
npm run dev        # esbuild watch
npm run typecheck  # tsc --noEmit
npm test           # 规则引擎冒烟测试（解析/入库/复发/到期）
```

## 已知限制（Phase 1 范围内刻意不做）

- 聊天非流式（回复整段出现）；不支持图片
- 弱点分析与建议卡片、术语抽查 SM-2、雅思趋势图在 Phase 2–3
- prompt 模板更新不会覆盖 vault 里已存在的文件（用户修改优先）
