# 0.1.6 — Learning-Method Enhancements 学习方法增强（Q1–Q4）

DeepTutor-inspired learning-method layer, all local & zero extra LLM calls: retrieval practice, metacognitive calibration, attention focusing, interleaving. / 借鉴 DeepTutor 学习方法层的四项增强全部落地，纯本地统计、零新增 LLM 调用。

## New / 新功能

- **Q1 Blind redo with session attachment / 附件式盲重做** — the wrong-answer "Practice" button now attaches the original session archive and prefills a 3-step retrieval-practice flow: attempt blind first → contrast with your past mistake → then walk to the standard approach. Falls back to the old prefill when the session file is missing. / 错题「去练」自动挂上原会话存档并预填三步检索练习流：先盲做 → 再对照当时的错误 → 最后到标准做法；会话缺失时降级为旧预填。
- **Q2 Self-rating instrumentation / 自评埋点** — the closing self-rating (1–5) is now stored: sessionTag gains `selfRating`, the question log grows a 6th column (read lenient, write full). / 结题自评 1–5 落库：sessionTag 新增 selfRating，提问记录台账扩为 6 列（旧行宽容读取）。
- **Q2 Calibration flags / 自评校准旗标** — per mark-loss code: self-rating avg ≥4 but the code recurred ≥2× within 30 days (min 3 rated samples) → "overconfident code" line appended to the subject section of `记录/weakness-profile.md` with evidence dates; reverse case → "underestimated" (display only). Weekly snapshot gains an overconfident-code-count column (old 5-column tables migrate leniently). / 按失分码聚合自评与实际复发：自评均 ≥4 但 30 天内复发 ≥2 次（样本 ≥3）→「过度自信码」进入弱点画像科目节尾（带证据日期）；反向为「低估码」仅展示。周快照新增「过度自信码数」列（旧 5 列表宽容迁移）。
- **Q3 This week's top 3 / 本周三件事** — home tab shows an action card with the 3 items to clear first (2 due mark-loss entries + oldest open wrong answer), each with a one-line reason and a direct practice button. / 首页顶部行动卡：本周最该清的 3 条（到期失分前 2 + 最旧未订正错题），各带一句理由和直达「去练」。
- **Q4 Interleaved review sheet / 复习单交错编排** — when section ② has ≥6 items across ≥2 subjects, items are arranged by subject round-robin (desirable difficulty); fingerprint is now order-independent. / 复习单②节条目 ≥6 且跨 ≥2 科目时按科目轮转排列（合意难度）；源指纹改为顺序无关。

## Fixes / 修复

- Topic names containing non-breaking spaces (U+A0, common in AI sessionTag output) are normalized before cross-ledger matching — calibration links no longer silently fail. / 考点名中的不换行空格（U+A0，AI 打标输出常见）在跨台账匹配前归一，校准关联不再静默失效。
- Review tab ① empty state explains not-yet-due entries; review cards show readable ID · subject · topic layout; subject column normalized to a whitelist (mark-loss log); closing confirmation cards stay visible until handled.（已随 dev 合入）

## Notes / 说明

- All features are local statistics — no new model calls, no new settings; thresholds are fixed and documented in `docs/学习方法增强设计.md`. / 全部为本地统计，无新增模型调用与设置项；阈值固定并记录于设计文档。
- Calibration flags need a few weeks of self-rating data to appear — instrumentation starts from this version. / 校准旗标需积累数周自评数据后才会出现，埋点自本版开始。
- 512/512 UT+FVT passed. / 512/512 测试全绿。
