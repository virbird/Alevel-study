# 0.1.7 — Session Resilience 会话健壮性补丁

A focused patch release: unfinished coach sessions now survive restarts, plus two data-integrity fixes for the closing flow. / 专注补丁版本：未结束的教练会话在重启后自动恢复，另含结题链路两项数据完整性修复。

## New / 新功能

- **Session slot persistence / 会话槽位持久化** — unfinished sessions (messages, archive progress, tagging state, attachment references) are now stored in plugin data and automatically restored after restarting Obsidian or reloading the plugin; closed sessions are cleared from the restore set. Image payloads are intentionally not persisted to keep the data file small (all text is retained and incrementally archived to the vault). / 未结束会话（消息、存档进度、打标状态、附件引用）写入插件数据，重启 Obsidian 或重载插件后自动恢复现场；已结题会话不再恢复。图片不持久化以控制数据文件体积（文字全量保留且已增量存档）。

## Fixes / 修复

- **Closing replies no longer skip session tagging / 结题回复不再跳过会话打标** — a regression from the delayed-close change made the closing branch return before the side-effect handler ran, so the sessionTag (the only source of the question log) was never parsed and the question log silently stopped growing. The side effect now runs for every reply before any closing branch. / 延迟关闭改动引入的回归导致结题分支提前返回、跳过副作用处理，sessionTag（提问记录唯一数据源）永不被解析、提问记录静默断流；现副作用在所有回复上先于结题分支执行。
- **Self-rating stored in the question log / 自评落库修复** — `appendTag` now passes `selfRating` (0.1.6 instrumentation omission), so closing self-ratings actually reach the ledger and can feed the calibration flags. / `appendTag` 补传 `selfRating`（0.1.6 埋点遗漏），结题自评真正落入提问记录，支撑自评校准旗标。

## Notes / 说明

- No vault data format changes; no new settings. / 无 vault 数据格式变更，无新设置项。
- 512/512 UT+FVT passed. / 512/512 测试全绿。
