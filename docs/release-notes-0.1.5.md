# 0.1.5 — Evidence Loop 证据闭环 + Audit Fixes

The DeepTutor-inspired evidence loop (P1–P5) is complete, plus a round of UX and community-plugin audit fixes. / 借鉴 DeepTutor 的证据闭环 P1–P5 全部落地，另含一轮体验与社区插件审核修复。

## New / 新功能

- **P1 Wrong-answer ↔ session backlink / 错题↔会话回链** — the mistake ledger gains a Session column; one click reopens the exact session where the error happened. / 错题本新增会话列，一键回到当时做错的会话。
- **P2 Mastery badges + inline practice / 掌握度徽章+去练** — every status shows the distance to the next state ("1 spot-check away from stable"); per-row practice buttons jump to the coach with a prefilled request. / 状态旁显示升级距离；行内「去练」预填请求直达教练。
- **P3 Weakness profile (L2) / 弱点画像** — `记录/weakness-profile.md`: per-subject compressed profile with ledger-ID backlinks, manual-notes preserved on regen; injected instead of full tables when >10 open entries (saves tokens); weekly snapshots in 统计分析. / 按科目压缩画像+证据回链+人工备注保留；条目多时替代全表注入省 token；周快照落盘。
- **P4 Review sheet / 复习单** — `记录/review-sheet.md`: one click compiles due queues into printable flashcards / redo / sentence tasks; fingerprint drift detection flags stale sheets. / 一键编译到期队列为可打印复习单；指纹漂移检测提示过期。
- **P5 Trend charts & rewrite diff / 趋势图与复盘对照** — local SVG (no deps): overall-score sparklines, 30-day mark-loss code bars; after the English review step a Compare button shows a word-level before/after diff of the student's own two versions. / 零依赖 SVG 折线/条形图；英文复盘后词级 diff 对照学生两版。

## Fixes / 修复

- Conclude no longer closes the session before register/ignore confirm cards are handled (deferred close; click conclude again to skip). / 结题不再吞掉入库确认卡片（延迟关闭，再点结题可跳过）。
- Review queue explains not-yet-due entries; error-point cards now show ID · subject · topic + a question-type line; subject column whitelist-normalized (topic names fall back to the session subject); prompt log tables unified to one-line 13 columns. / 复习空态说明未到期条目；失分卡片可读性重排；科目白名单规范化；log 表头统一。
- Audit: SVG charts built via `createElementNS` (no innerHTML); MIT LICENSE added. Two warnings remain by design (declarative settings API deferred until minAppVersion ≥ 1.13.0; streaming fetch kept because `requestUrl` cannot stream). / 审核：SVG 改 createElementNS、补 MIT LICENSE；两条 Warning 为兼容性决策保留。

## Stats / 数据

- 484/484 tests green (UT+FVT). / 484 项测试全绿。
- Install: copy `main.js`, `manifest.json`, `styles.css` into `<vault>/.obsidian/plugins/alevel-study-coach/`.
