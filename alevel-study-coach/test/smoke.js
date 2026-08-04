"use strict";

// src/utils/date.ts
function todayStr() {
  return toStr(/* @__PURE__ */ new Date());
}
function toStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(base, days) {
  const d = /* @__PURE__ */ new Date(base + "T00:00:00");
  if (isNaN(d.getTime())) return toStr(new Date(Date.now() + days * 864e5));
  d.setDate(d.getDate() + days);
  return toStr(d);
}
function parseDate(s) {
  const m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}
function isDue(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return false;
  const t = /* @__PURE__ */ new Date();
  t.setHours(23, 59, 59, 999);
  return d.getTime() <= t.getTime();
}
function daysBetween(a, b) {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / 864e5);
}

// src/utils/markdown.ts
function parseTable(content) {
  const rows = [];
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith("|")) continue;
    const cells = t.slice(1, t.endsWith("|") ? -1 : void 0).split("|").map((c) => c.trim());
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
    rows.push(cells);
  }
  return rows;
}
function renderRow(cells) {
  return `| ${cells.join(" | ")} |`;
}

// src/services/VaultService.ts
var ROOT = "StudyCoach";

// src/services/ErrorLogService.ts
var LOG_PATH = `${ROOT}/\u8BB0\u5F55/error-log.md`;
var HEADER_CELLS = ["ID", "\u65E5\u671F", "\u79D1\u76EE", "\u5C42\u7EA7", "\u8003\u70B9(EN)", "\u9898\u578B", "\u4EE3\u7801", "\u4E00\u53E5\u8BDD\u63CF\u8FF0", "\u6B63\u786E\u505A\u6CD5", "\u82F1\u6587\u6807\u51C6\u8868\u8FF0", "\u590D\u53D1", "\u72B6\u6001", "\u590D\u67E5\u65E5\u671F"];
var ErrorLogService = class {
  constructor(vault) {
    this.vault = vault;
  }
  async load() {
    const content = await this.vault.read(LOG_PATH);
    if (!content) return [];
    return this.parseEntries(content);
  }
  parseEntries(content) {
    const entries = [];
    for (const cells of this.tableRows(content)) {
      const entry = this.cellsToEntry(cells);
      if (entry) entries.push(entry);
    }
    return entries;
  }
  /** 解析 AI 结题输出中的候选 log 行（容错：占位符、列缺失） */
  parseAiRows(text) {
    const rows = [];
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t.startsWith("|")) continue;
      const cells = t.slice(1, t.endsWith("|") ? -1 : void 0).split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      if (cells.some((c) => c === "ID") && cells.some((c) => c === "\u8003\u70B9(EN)" || c === "\u8003\u70B9")) continue;
      const entry = this.cellsToEntry(cells);
      if (entry && entry.topic && entry.code) rows.push(entry);
    }
    return rows;
  }
  /**
   * 入库：先查复发（同科目+考点+代码），复发则更新原行，否则追加新行。
   * 返回实际落库的条目。
   */
  async addEntry(partial) {
    const content = await this.vault.read(LOG_PATH);
    if (!content) return null;
    if (await this.vault.hasConflict(LOG_PATH)) {
      throw new Error("error-log.md \u5B58\u5728\u540C\u6B65\u51B2\u7A81\u6807\u8BB0\uFF0C\u8BF7\u5148\u5728\u7F16\u8F91\u5668\u91CC\u5904\u7406\u51B2\u7A81");
    }
    const entries = this.parseEntries(content);
    const topicKey = (partial.topic ?? "").trim().toLowerCase();
    const codeKey = (partial.code ?? "").trim().toUpperCase();
    const subjectKey = (partial.subject ?? "").trim();
    const existing = entries.find(
      (e) => e.topic.trim().toLowerCase() === topicKey && e.code.trim().toUpperCase() === codeKey && e.subject === subjectKey
    );
    if (existing) {
      existing.recurrence += 1;
      existing.status = "\u672A\u6D88\u9664";
      existing.reviewDate = addDays(todayStr(), existing.recurrence >= 2 ? 3 : 7);
      await this.vault.write(LOG_PATH, this.rebuildTable(content, entries));
      return { action: "recurrence", entry: existing };
    }
    const nextId = String(entries.reduce((max, e) => Math.max(max, Number(e.id) || 0), 0) + 1).padStart(3, "0");
    const entry = {
      id: nextId,
      date: todayStr(),
      subject: subjectKey,
      level: partial.level ?? "",
      topic: partial.topic ?? "",
      qtype: partial.qtype ?? "",
      code: partial.code ?? "",
      desc: partial.desc ?? "",
      fix: partial.fix ?? "",
      stdExpr: partial.stdExpr ?? "",
      recurrence: 1,
      status: "\u672A\u6D88\u9664",
      reviewDate: partial.reviewDate && parseDate(partial.reviewDate) ? partial.reviewDate : addDays(todayStr(), 7)
    };
    entries.push(entry);
    await this.vault.write(LOG_PATH, this.rebuildTable(content, entries));
    return { action: "new", entry };
  }
  async updateEntry(id, patch) {
    const content = await this.vault.read(LOG_PATH);
    if (!content) return;
    const entries = this.parseEntries(content);
    const target = entries.find((e) => e.id === id);
    if (!target) return;
    Object.assign(target, patch);
    await this.vault.write(LOG_PATH, this.rebuildTable(content, entries));
  }
  /** 复查到期且未消除/观察中的条目，按 复发×等待天数 降序 */
  async dueEntries() {
    const entries = await this.load();
    const t = todayStr();
    return entries.filter((e) => e.status !== "\u5DF2\u6D88\u9664" && isDue(e.reviewDate)).sort((a, b) => {
      const score = (e) => e.recurrence * Math.max(0, daysOverdue(e.reviewDate, t));
      return score(b) - score(a);
    });
  }
  /** 未消除条目（注入教练 prompt 用） */
  async unresolved() {
    const entries = await this.load();
    return entries.filter((e) => e.status === "\u672A\u6D88\u9664");
  }
  // ─── 内部 ────────────────────────────────────────────────
  tableRows(content) {
    const rows = [];
    let inMainTable = false;
    for (const line of content.split(/\r?\n/)) {
      const t = line.trim();
      if (t.startsWith("#")) {
        inMainTable = /主表/.test(t);
        continue;
      }
      if (!t.startsWith("|")) continue;
      const cells = t.slice(1, t.endsWith("|") ? -1 : void 0).split("|").map((c) => c.trim());
      if (cells.some((c) => c === "ID") && cells.length >= 12) {
        inMainTable = true;
        continue;
      }
      if (!inMainTable) continue;
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      rows.push(cells);
    }
    return rows;
  }
  cellsToEntry(cells) {
    let c = [...cells];
    if (c.length === 12) c.splice(10, 0, "1");
    if (c.length < 13) return null;
    const clean = (s) => s === "???" || s === "?" ? "" : s;
    const recurrence = Math.max(1, Number(clean(c[10])) || 1);
    const status = ["\u672A\u6D88\u9664", "\u89C2\u5BDF\u4E2D", "\u5DF2\u6D88\u9664"].includes(clean(c[11])) ? clean(c[11]) : "\u672A\u6D88\u9664";
    return {
      id: clean(c[0]),
      date: parseDate(clean(c[1])) ? clean(c[1]) : todayStr(),
      subject: clean(c[2]),
      level: clean(c[3]),
      topic: clean(c[4]),
      qtype: clean(c[5]),
      code: clean(c[6]),
      desc: clean(c[7]),
      fix: clean(c[8]),
      stdExpr: clean(c[9]),
      recurrence,
      status,
      reviewDate: parseDate(clean(c[12])) ? clean(c[12]) : addDays(todayStr(), 7)
    };
  }
  rebuildTable(content, entries) {
    const lines = content.split(/\r?\n/);
    let headerIdx = -1;
    let tableEnd = -1;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (headerIdx < 0 && t.startsWith("|") && t.includes("ID") && t.includes("\u8003\u70B9")) {
        headerIdx = i;
        continue;
      }
      if (headerIdx >= 0 && t.startsWith("|")) {
        tableEnd = i;
      } else if (headerIdx >= 0 && tableEnd >= 0) {
        break;
      }
    }
    if (headerIdx < 0) {
      const table2 = this.renderTable(entries);
      return content.replace(/\s*$/, "") + "\n\n## \u4E3B\u8868\n\n" + table2 + "\n";
    }
    const table = this.renderTable(entries);
    return [...lines.slice(0, headerIdx), table, ...lines.slice(tableEnd + 1)].join("\n");
  }
  renderTable(entries) {
    const header = renderRow(HEADER_CELLS);
    const sep = renderRow(HEADER_CELLS.map(() => "----"));
    const rows = entries.map(
      (e) => renderRow([e.id, e.date, e.subject, e.level, e.topic, e.qtype, e.code, e.desc, e.fix, e.stdExpr, String(e.recurrence), e.status, e.reviewDate])
    );
    return [header, sep, ...rows].join("\n");
  }
};
function daysOverdue(reviewDate, today) {
  const r = parseDate(reviewDate);
  const t = parseDate(today);
  if (!r || !t) return 0;
  return Math.max(1, Math.round((t.getTime() - r.getTime()) / 864e5));
}

// src/services/QuestionLogService.ts
var QUESTION_LOG_PATH = `${ROOT}/\u8BB0\u5F55/\u63D0\u95EE\u8BB0\u5F55.md`;
var PROGRESS_DIR = `${ROOT}/\u8BB0\u5F55/\u8FDB\u5C55`;
var JOURNAL_PATH = `${ROOT}/\u8BB0\u5F55/\u5B66\u4E60\u65E5\u5FD7.md`;
var TERM_LIST_PATH = `${ROOT}/\u8BB0\u5F55/\u672F\u8BED\u6E05\u5355.md`;
var WEAK_IMPRESSIONS_PATH = `${ROOT}/\u8BB0\u5F55/\u5F31\u70B9\u5370\u8C61.md`;
var PRACTICE_FOCUS_PATH = `${ROOT}/\u8BB0\u5F55/\u7EC3\u4E60\u4FA7\u91CD.md`;
function subjectMatches(entrySubject, current) {
  if (!current) return true;
  const s = entrySubject.trim();
  if (!s || s === "?" || s === "\u901A\u7528") return true;
  return s.toLowerCase() === current.toLowerCase();
}
var PracticeFocusService = class {
  constructor(vault) {
    this.vault = vault;
  }
  async append(subject, desc) {
    const row = renderRow([todayStr(), subject || "?", desc, "\u751F\u6548\u4E2D"]);
    await this.vault.append(PRACTICE_FOCUS_PATH, row);
  }
  async load() {
    const content = await this.vault.read(PRACTICE_FOCUS_PATH);
    if (!content) return [];
    const rows = parseTable(content);
    if (!rows.length) return [];
    return rows.filter((r) => r.length >= 4 && r[0] !== "\u65E5\u671F").map((r) => ({
      date: r[0],
      subject: r[1],
      desc: r[2],
      status: r[3] === "\u5DF2\u7F13\u89E3" ? "\u5DF2\u7F13\u89E3" : "\u751F\u6548\u4E2D"
    }));
  }
  /** 注入教练 prompt 用：生效中的侧重，按科目过滤，最多 8 条 */
  async activeForInjection(subject) {
    return (await this.load()).filter((f) => f.status === "\u751F\u6548\u4E2D" && subjectMatches(f.subject, subject)).slice(-8);
  }
};
var WeakImpressionService = class {
  constructor(vault) {
    this.vault = vault;
  }
  async append(subject, desc) {
    const row = renderRow([todayStr(), subject || "?", desc, "0", "\u5F85\u9A8C\u8BC1"]);
    await this.vault.append(WEAK_IMPRESSIONS_PATH, row);
  }
  async load() {
    const content = await this.vault.read(WEAK_IMPRESSIONS_PATH);
    if (!content) return [];
    const rows = parseTable(content);
    if (!rows.length) return [];
    return rows.filter((r) => r.length >= 5 && r[0] !== "\u65E5\u671F").map((r) => ({
      date: r[0],
      subject: r[1],
      desc: r[2],
      evidence: Number(r[3]) || 0,
      status: ["\u5F85\u9A8C\u8BC1", "\u5DF2\u786E\u8BA4", "\u5DF2\u4F5C\u5E9F"].includes(r[4]) ? r[4] : "\u5F85\u9A8C\u8BC1"
    }));
  }
  /** 注入教练 prompt 用：待验证的印象，按科目过滤，最多 8 条 */
  async pendingForInjection(subject) {
    return (await this.load()).filter((i) => i.status === "\u5F85\u9A8C\u8BC1" && subjectMatches(i.subject, subject)).slice(-8);
  }
};

// src/services/TermService.ts
var TermListService = class {
  constructor(vault) {
    this.vault = vault;
  }
  async load() {
    const content = await this.vault.read(TERM_LIST_PATH);
    if (!content) return [];
    return parseTable(content).filter((r) => r.length >= 7 && r[0] !== "Term (EN)" && r[0]).map((r) => ({
      term: r[0],
      subject: r[1],
      bookDef: r[2],
      parts: r[3],
      missed: r[4],
      wrongWord: r[5],
      status: ["\u672A\u7A33\u5B9A", "\u89C2\u5BDF\u4E2D", "\u5DF2\u7A33\u5B9A"].includes(r[6]) ? r[6] : "\u672A\u7A33\u5B9A"
    }));
  }
  /**
   * 抽查结果状态流转（drill-definitions 模式 E 规则）：
   * 通过：未稳定→观察中（通过一次），观察中→已稳定（连续两次）
   * 不过：任何状态回到 未稳定
   */
  async applyDrillResult(term, pass) {
    const content = await this.vault.read(TERM_LIST_PATH);
    if (!content) return null;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t.startsWith("|")) continue;
      const cells = t.slice(1, t.endsWith("|") ? -1 : void 0).split("|").map((c) => c.trim());
      if (cells.length < 7 || cells[0] !== term) continue;
      const current = ["\u672A\u7A33\u5B9A", "\u89C2\u5BDF\u4E2D", "\u5DF2\u7A33\u5B9A"].includes(cells[6]) ? cells[6] : "\u672A\u7A33\u5B9A";
      const next = !pass ? "\u672A\u7A33\u5B9A" : current === "\u672A\u7A33\u5B9A" ? "\u89C2\u5BDF\u4E2D" : "\u5DF2\u7A33\u5B9A";
      cells[6] = next;
      lines[i] = renderRow(cells);
      await this.vault.write(TERM_LIST_PATH, lines.join("\n"));
      return next;
    }
    return null;
  }
  /** 抽查题源：未稳定 + 观察中 的条目 */
  async drillPool() {
    return (await this.load()).filter((t) => t.status !== "\u5DF2\u7A33\u5B9A");
  }
};

// src/ui/MainView.ts
function parseSessionMessages(content) {
  const msgs = [];
  const parts = content.split(/^## (学生|教练)\s*$/m);
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const role = parts[i] === "\u5B66\u751F" ? "user" : "assistant";
    const body = parts[i + 1].replace(/\n-{3,}\s*$/, "").trim();
    if (body) msgs.push({ role, content: body });
  }
  return msgs;
}

// src/services/InsightEngine.ts
var InsightEngine = class {
  constructor(vault) {
    this.vault = vault;
  }
  async loadQuestionTags() {
    const content = await this.vault.read(QUESTION_LOG_PATH);
    if (!content) return [];
    return parseTable(content).filter((r) => r.length >= 5 && r[0] !== "\u65E5\u671F" && parseDate(r[0])).map((r) => ({ date: r[0], subject: r[1], topic: r[2], confusion: r[3], depth: r[4] }));
  }
  withinDays(date, days) {
    const d = parseDate(date);
    if (!d) return false;
    return daysBetween(date, todayStr()) <= days;
  }
  /** 提问热点：窗口内按「科目+考点」聚合 */
  async topicHeat(windowDays = 14) {
    const tags = (await this.loadQuestionTags()).filter((t) => this.withinDays(t.date, windowDays) && t.topic);
    const map = /* @__PURE__ */ new Map();
    for (const t of tags) {
      const key = `${t.subject}|${t.topic.toLowerCase()}`;
      const cur = map.get(key) ?? { subject: t.subject, topic: t.topic, count: 0, last: t.date, confusions: [] };
      cur.count++;
      if (t.date > cur.last) cur.last = t.date;
      if (t.confusion && !cur.confusions.includes(t.confusion)) cur.confusions.push(t.confusion);
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }
  /** 窗口内失分码统计（含所有状态的新增与复发记录，按日期统计） */
  async codeCounts(entries, windowDays = 14) {
    const map = /* @__PURE__ */ new Map();
    for (const e of entries.filter((e2) => this.withinDays(e2.date, windowDays))) {
      const code = (e.code || "").toUpperCase();
      if (!code) continue;
      map.set(code, (map.get(code) ?? 0) + 1);
    }
    return [...map.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count);
  }
  async confusionDist(windowDays = 14) {
    const tags = (await this.loadQuestionTags()).filter((t) => this.withinDays(t.date, windowDays));
    const map = /* @__PURE__ */ new Map();
    for (const t of tags) {
      if (!t.confusion) continue;
      map.set(t.confusion, (map.get(t.confusion) ?? 0) + 1);
    }
    return [...map.entries()].map(([confusion, count]) => ({ confusion, count })).sort((a, b) => b.count - a.count);
  }
  /** Dashboard 弱点雷达数据 */
  async radar(entries, windowDays = 14) {
    const today = todayStr();
    return {
      windowDays,
      topicHeat: (await this.topicHeat(windowDays)).slice(0, 5),
      codeCounts: (await this.codeCounts(entries, windowDays)).slice(0, 5),
      confusionDist: await this.confusionDist(windowDays),
      unresolvedCount: entries.filter((e) => e.status === "\u672A\u6D88\u9664").length,
      dueCount: entries.filter((e) => e.status !== "\u5DF2\u6D88\u9664" && parseDate(e.reviewDate) !== null && e.reviewDate <= today).length
    };
  }
  /**
   * 生成建议候选（阈值内置，样本不足时返回空数组）。
   * 注意：这里不做去重过滤，由 SuggestionService 结合已存在卡片过滤。
   */
  async generateCandidates(entries, terms) {
    const out = [];
    const today = todayStr();
    for (const h of await this.topicHeat(14)) {
      if (h.count >= 3) {
        out.push({
          key: `\u63D0\u95EE\u70ED\u70B9|${h.subject}|${h.topic.toLowerCase()}`,
          kind: "\u63D0\u95EE\u70ED\u70B9",
          title: `${h.subject} \u7684 ${h.topic} \u6700\u8FD1\u4E24\u5468\u6C42\u52A9 ${h.count} \u6B21`,
          evidence: [
            `\u8FD1 14 \u5929\u5728 ${h.topic} \u4E0A\u6C42\u52A9 ${h.count} \u6B21\uFF08\u6700\u8FD1 ${h.last}\uFF09`,
            `\u56F0\u60D1\u7C7B\u578B\uFF1A${h.confusions.join("\u3001") || "\u672A\u8BB0\u5F55"}`,
            h.confusions.includes("\u6982\u5FF5\u4E0D\u61C2") ? "\u542B\u300C\u6982\u5FF5\u4E0D\u61C2\u300D\u2014\u2014\u53EF\u80FD\u662F\u57FA\u7840\u7406\u89E3\u6CA1\u5230\u4F4D\uFF0C\u800C\u4E0D\u53EA\u662F\u719F\u7EC3\u5EA6\u95EE\u9898" : ""
          ].filter(Boolean)
        });
      }
    }
    for (const e of entries.filter((e2) => e2.recurrence >= 3 && e2.status !== "\u5DF2\u6D88\u9664").slice(0, 3)) {
      out.push({
        key: `\u590D\u53D1\u70ED\u70B9|${e.subject}|${e.topic.toLowerCase()}|${e.code.toUpperCase()}`,
        kind: "\u590D\u53D1\u70ED\u70B9",
        title: `${e.subject}\u300C${e.topic}\u300D\u5DF2\u590D\u53D1 ${e.recurrence} \u6B21\uFF08${e.code}\uFF09`,
        evidence: [
          `\u5931\u5206\u63CF\u8FF0\uFF1A${e.desc}`,
          e.fix ? `\u6B63\u786E\u505A\u6CD5\uFF1A${e.fix}` : "",
          "\u6309\u63D0\u793A\u8BCD\u89C4\u5219\uFF0C\u590D\u53D1 3 \u6B21\u4EE5\u4E0A\u7684\u4EE3\u7801\u4F18\u5148\u7EA7\u9AD8\u4E8E\u9898\u76EE\u672C\u8EAB\uFF0C\u9700\u8981\u4E13\u95E8\u68C0\u67E5\u73AF\u8282"
        ].filter(Boolean)
      });
    }
    const exprCodes = ["DV", "CL", "LK", "E"];
    const expr = (await this.codeCounts(entries, 14)).filter((c) => exprCodes.includes(c.code));
    const exprTotal = expr.reduce((s, c) => s + c.count, 0);
    if (exprTotal >= 5) {
      out.push({
        key: `\u8868\u8FBE\u7801\u8D8B\u52BF|${today.slice(0, 7)}`,
        kind: "\u8868\u8FBE\u7801\u8D8B\u52BF",
        title: `\u82F1\u6587\u8868\u8FBE\u7C7B\u5931\u5206\u8FD1\u4E24\u5468\u5171 ${exprTotal} \u6B21`,
        evidence: [
          expr.map((c) => `${c.code} \xD7${c.count}`).join("\u3001"),
          "\u8FD9\u4E9B\u7801\u4E0E\u96C5\u601D LR/GRA \u662F\u540C\u4E00\u80FD\u529B\u2014\u2014\u672F\u8BED\u8BAD\u7EC3\u540C\u65F6\u4E5F\u5728\u7EC3\u96C5\u601D",
          "\u5EFA\u8BAE\uFF1A\u505A\u9898\u524D\u5148\u505A 5 \u5206\u949F\u6982\u5FF5\u7CBE\u7EC3\uFF08\u5B9A\u4E49\u6210\u5206\u8BA1\u6570 + \u53E3\u8BED\u8BCD\u62E6\u622A\uFF09"
        ]
      });
    }
    const unstable = terms.filter((t) => t.status === "\u672A\u7A33\u5B9A");
    if (unstable.length >= 8) {
      out.push({
        key: `\u672F\u8BED\u672A\u7A33\u5B9A|${today.slice(0, 7)}`,
        kind: "\u672F\u8BED\u672A\u7A33\u5B9A",
        title: `${unstable.length} \u4E2A\u672F\u8BED\u5904\u4E8E\u672A\u7A33\u5B9A\u72B6\u6001`,
        evidence: [
          `\u793A\u4F8B\uFF1A${unstable.slice(0, 5).map((t) => t.term).join("\u3001")}`,
          "\u5EFA\u8BAE\uFF1A\u6BCF\u5468\u4E00\u6B21\u6A21\u5F0F E \u62BD\u67E5\uFF08\u590D\u4E60\u9875\u7B7E\u53D1\u8D77\uFF09\uFF0C\u628A\u62BD\u67E5\u901A\u8FC7\u4E00\u6B21\u5347\u4E3A\u89C2\u5BDF\u4E2D"
        ]
      });
    }
    const overdue = entries.filter((e) => e.status !== "\u5DF2\u6D88\u9664" && parseDate(e.reviewDate) !== null && e.reviewDate <= today);
    if (overdue.length >= 12) {
      const worst = [...overdue].sort((a, b) => b.recurrence - a.recurrence).slice(0, 3);
      out.push({
        key: `\u590D\u67E5\u5806\u79EF|${today}`,
        kind: "\u590D\u67E5\u5806\u79EF",
        title: `\u590D\u67E5\u961F\u5217\u5806\u79EF ${overdue.length} \u6761`,
        evidence: [
          `\u6700\u75DB\u7684\u51E0\u6761\uFF1A${worst.map((e) => `${e.topic}\uFF08\u590D\u53D1 ${e.recurrence}\uFF09`).join("\u3001")}`,
          "\u5EFA\u8BAE\uFF1A\u4E0D\u5FC5\u5168\u6E05\uFF0C\u5148\u5904\u7406\u6700\u75DB\u7684 3 \u6761\uFF08\u590D\u4E60\u9875\u7B7E\u5DF2\u6309\u590D\u53D1\xD7\u903E\u671F\u6392\u5E8F\uFF09"
        ]
      });
    }
    return out;
  }
};

// src/services/StatsService.ts
var STATS_PATH = `${ROOT}/\u8BB0\u5F55/\u7EDF\u8BA1\u5206\u6790.md`;
var FOCUS_HEADING = "## \u672C\u671F\u4E13\u9879";
var StatsService = class {
  constructor(vault, engine) {
    this.vault = vault;
    this.engine = engine;
  }
  /** 每周：提问热点统计 */
  async runQuestionWeekly() {
    const heat = await this.engine.topicHeat(7);
    const lines = heat.length ? heat.slice(0, 5).map((h) => `- ${h.subject} \xB7 ${h.topic} \xD7${h.count}\uFF08${h.confusions.join("/")}\uFF09`) : ["- \u672C\u5468\u6682\u65E0\u63D0\u95EE\u8BB0\u5F55"];
    await this.replaceSection("## \u63D0\u95EE\u70ED\u70B9", `\u6700\u540E\u66F4\u65B0\uFF1A${todayStr()}\uFF08\u8FD1 7 \u5929\uFF09
${lines.join("\n")}`);
  }
  /** 每两周：复发热点 + 生成新一期专项 */
  async runHotspotBiweekly(entries) {
    const recent = entries.filter((e) => parseDate(e.date) !== null && daysBetween(e.date, todayStr()) <= 14);
    const codeMap = /* @__PURE__ */ new Map();
    const topicMap = /* @__PURE__ */ new Map();
    for (const e of recent) {
      if (e.code) codeMap.set(e.code.toUpperCase(), (codeMap.get(e.code.toUpperCase()) ?? 0) + 1);
      if (e.topic) topicMap.set(e.topic, (topicMap.get(e.topic) ?? 0) + 1);
    }
    const topCodes = [...codeMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topTopics = [...topicMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const section = `\u7EDF\u8BA1\u533A\u95F4\uFF1A\u8FD1\u4E24\u5468\uFF08\u622A\u81F3 ${todayStr()}\uFF09
` + (topCodes.length ? `\u9AD8\u9891\u4EE3\u7801 Top3\uFF1A${topCodes.map(([c, n]) => `${c} ${n}\u6B21`).join(" / ")}` : "\u9AD8\u9891\u4EE3\u7801\uFF1A\u65E0") + "\n" + (topTopics.length ? `\u9AD8\u9891\u8003\u70B9 Top3\uFF1A${topTopics.map(([t, n]) => `${t} ${n}\u6B21`).join(" / ")}` : "\u9AD8\u9891\u8003\u70B9\uFF1A\u65E0");
    await this.replaceSection("## \u590D\u53D1\u70ED\u70B9", section);
    const focus = topCodes.length ? focusForCode(topCodes[0][0]) : "\u4FDD\u6301\u5F53\u524D\u8282\u594F\uFF1A\u505A\u9898\u524D\u5148\u7EC3 5 \u5206\u949F\u6982\u5FF5\u7CBE\u7EC3\u3002";
    await this.replaceSection(FOCUS_HEADING, `\u81EA ${todayStr()} \u8D77\uFF1A${focus}`);
  }
  /** 读取当前本期专项（注入教练 prompt 用） */
  async currentFocus() {
    const content = await this.vault.read(STATS_PATH);
    if (!content) return "";
    const section = extractSection(content, FOCUS_HEADING);
    return section.trim();
  }
  async replaceSection(heading, body) {
    const content = await this.vault.read(STATS_PATH) ?? "# \u7EDF\u8BA1\u5206\u6790\n";
    const newSection = `${heading}

${body}
`;
    const next = replaceSection(content, heading, newSection);
    await this.vault.write(STATS_PATH, next);
  }
};
function extractSection(content, heading) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start < 0) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n");
}
function replaceSection(content, heading, newSection) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start < 0) {
    return content.replace(/\s*$/, "") + `

${newSection}`;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }
  return [...lines.slice(0, start), newSection.replace(/\s*$/, ""), ...lines.slice(end)].join("\n");
}
function focusForCode(code) {
  switch (code) {
    case "DV":
      return "\u6BCF\u6B21\u505A\u9898\u524D\u5148\u7528\u6982\u5FF5\u7CBE\u7EC3\u7EC3 5 \u5206\u949F\u5B9A\u4E49\uFF1B\u5199\u5B8C\u89E3\u91CA\u9898\u81EA\u67E5\u6709\u6CA1\u6709\u6F0F\u5FC5\u8981\u6210\u5206\u3002";
    case "CL":
      return "\u5199\u5B8C\u4EFB\u4F55\u7B54\u6848\u5148\u81EA\u5DF1\u6807\u4E00\u904D\u975E\u672F\u8BED\u8BCD\uFF0C\u518D\u6539\u5199\u4E3A\u6559\u6750\u8868\u8FF0\u3002";
    case "LK":
      return "\u89E3\u91CA\u9898\u4E00\u5F8B\u7F16\u53F7\u5206\u6B65\u5199\uFF0C\u6BCF\u6B65\u4E4B\u95F4\u8865 because/therefore\u3002";
    case "E":
      return "\u6BCF\u5929\u628A\u4E00\u6BB5\u4E2D\u6587\u89E3\u9898\u601D\u8DEF\u6539\u5199\u6210\u8003\u573A\u82F1\u6587\uFF0C\u7EC3\u56E0\u679C\u53E5\u5F0F\u3002";
    case "C":
      return "\u6BCF\u5929 10 \u5206\u949F\u7EAF\u4EE3\u6570\u5316\u7B80\u8BAD\u7EC3\uFF0C\u5199\u5B8C\u7ACB\u5373\u56DE\u4EE3\u68C0\u9A8C\u3002";
    case "U":
      return "\u6BCF\u884C\u5F0F\u5B50\u540E\u7ACB\u523B\u5199\u5355\u4F4D\uFF1B\u7ED3\u679C\u5148\u505A\u91CF\u7EB2\u68C0\u67E5\u518D\u63D0\u4EA4\u3002";
    case "R":
      return "\u8BFB\u9898\u65F6\u5708\u51FA\u6240\u6709\u6761\u4EF6\u4E0E command word\uFF0C\u52A8\u7B14\u524D\u5148\u590D\u8FF0\u9898\u610F\u3002";
    case "G":
      return "\u4F5C\u56FE\u9898\u5148\u5217\u8F74\u3001\u5355\u4F4D\u3001\u5173\u952E\u70B9\u6E05\u5355\uFF0C\u753B\u5B8C\u9010\u9879\u6838\u5BF9\u3002";
    default:
      return `\u9488\u5BF9\u9AD8\u9891\u5931\u5206\u7801 ${code}\uFF1A\u505A\u9898\u524D\u5148\u56DE\u987E\u76F8\u5173\u6761\u76EE\u7684\u6B63\u786E\u505A\u6CD5\uFF0C\u7ED3\u9898\u65F6\u91CD\u70B9\u81EA\u67E5\u8FD9\u4E00\u9879\u3002`;
  }
}

// test/smoke.ts
var SEED = `# Error Log

## \u4E3B\u8868

| ID | \u65E5\u671F | \u79D1\u76EE | \u5C42\u7EA7 | \u8003\u70B9(EN) | \u9898\u578B | \u4EE3\u7801 | \u4E00\u53E5\u8BDD\u63CF\u8FF0 | \u6B63\u786E\u505A\u6CD5 | \u82F1\u6587\u6807\u51C6\u8868\u8FF0 | \u590D\u53D1 | \u72B6\u6001 | \u590D\u67E5\u65E5\u671F |
|----|------|------|------|---------|------|------|-----------|---------|-------------|------|------|---------|
| 001 | 2026-07-25 | Maths | AS | Quadratic inequalities | \u89E3\u4E0D\u7B49\u5F0F | D | \u4E34\u754C\u70B9\u672A\u68C0\u9A8C\u5F00\u95ED | \u4EE3\u56DE\u539F\u5F0F | for all x such that | 1 | \u672A\u6D88\u9664 | 2026-08-01 |
| 002 | 2026-08-01 | Physics | AS | Work done | \u5B9A\u4E49\u9898 | CL | \u53E3\u8BED\u5316\u8868\u8FBE | \u7528 a force acts on | the force acts | 1 | \u89C2\u5BDF\u4E2D | 2026-09-01 |
`;
var files = { "StudyCoach/\u8BB0\u5F55/error-log.md": SEED };
var fakeVault = {
  read: async (p) => files[p] ?? null,
  write: async (p, c) => {
    files[p] = c;
  },
  append: async (p, c) => {
    const existing = files[p];
    files[p] = existing === void 0 ? c : existing.endsWith("\n") ? existing + c : existing + "\n" + c;
  },
  hasConflict: async () => false
};
var failed = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failed++;
}
async function main() {
  const svc = new ErrorLogService(fakeVault);
  const entries = await svc.load();
  check("\u89E3\u6790\u4E3B\u8868\u5F97\u5230 2 \u6761", entries.length === 2);
  check("\u5B57\u6BB5\u6620\u5C04\u6B63\u786E", entries[0].topic === "Quadratic inequalities" && entries[0].code === "D" && entries[0].recurrence === 1);
  const due = await svc.dueEntries();
  check("\u5230\u671F\u961F\u5217\u53EA\u542B 001", due.length === 1 && due[0].id === "001");
  const added = await svc.addEntry({ subject: "Econ", topic: "Opportunity cost", code: "DV", desc: "\u6F0F next best" });
  check("\u65B0\u6761\u76EE ID \u9012\u589E", added?.entry.id === "003");
  check("\u65B0\u6761\u76EE\u590D\u67E5\u65E5\u671F = \u4ECA\u5929+7", !!added && added.entry.reviewDate > (/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
  const again = await svc.addEntry({ subject: "Econ", topic: "Opportunity cost", code: "DV", desc: "\u53C8\u6F0F\u4E86" });
  const after = await svc.load();
  check("\u590D\u53D1\u4E0D\u65B0\u589E\u884C", after.length === 3);
  check("\u590D\u53D1\u6B21\u6570 +1", again?.entry.recurrence === 2);
  check("\u590D\u53D1\u72B6\u6001\u56DE\u5230\u672A\u6D88\u9664", again?.entry.status === "\u672A\u6D88\u9664");
  const aiText = [
    "\u77E5\u8BC6\u5361\u7247\u7565\u2026\u2026",
    "| ??? | ??? | Maths | AS | Circle theorems | \u51E0\u4F55\u8BC1\u660E | P | \u672A\u5F15\u7528\u5B9A\u7406 | \u6CE8\u660E\u5B9A\u7406\u540D | Angles in same segment | 1 | \u672A\u6D88\u9664 | ??? |",
    "| ??? | ??? | Chem | IG | Reactivity series | \u7F6E\u6362 | F | \u672A\u914D\u5E73 | \u9010\u5143\u7D20\u6570 | balanced equation | \u672A\u6D88\u9664 | 2026-08-11 |"
  ].join("\n");
  const rows = svc.parseAiRows(aiText);
  check("AI \u884C\u89E3\u6790\u51FA 2 \u884C", rows.length === 2);
  check("12 \u5217\u884C\u81EA\u52A8\u8865\u590D\u53D1\u5217", rows[1].recurrence === 1 && rows[1].status === "\u672A\u6D88\u9664");
  const final = files["StudyCoach/\u8BB0\u5F55/error-log.md"];
  check("\u8868\u5934\u4ECD\u5728", final.includes("| ID | \u65E5\u671F | \u79D1\u76EE |"));
  check("\u6807\u9898\u4ECD\u5728", final.startsWith("# Error Log"));
  const sessionFile = [
    "---",
    "mode: Maths",
    'started: "2026-08-04 150000"',
    "---",
    "",
    "# \u6559\u7EC3\u4F1A\u8BDD 2026-08-04 \xB7 \u6570\u5B66 Maths",
    "",
    "## \u5B66\u751F",
    "",
    "\u8FD9\u9053\u4E0D\u7B49\u5F0F\u600E\u4E48\u505A\uFF1F",
    "",
    "## \u6559\u7EC3",
    "",
    "\u5148\u79FB\u9879\u3002",
    "",
    "## \u5B66\u751F",
    "",
    "\u505A\u51FA\u6765\u4E86\u3002",
    ""
  ].join("\n");
  const msgs = parseSessionMessages(sessionFile);
  check("\u4F1A\u8BDD\u89E3\u6790\u51FA 3 \u6761\u6D88\u606F", msgs.length === 3);
  check("\u4F1A\u8BDD\u89D2\u8272\u4E0E\u5185\u5BB9\u6B63\u786E", msgs[0].role === "user" && msgs[1].role === "assistant" && msgs[2].content === "\u505A\u51FA\u6765\u4E86\u3002");
  files["StudyCoach/\u8BB0\u5F55/\u5F31\u70B9\u5370\u8C61.md"] = [
    "# \u5F31\u70B9\u5370\u8C61",
    "",
    "| \u65E5\u671F | \u79D1\u76EE | \u63CF\u8FF0 | \u8BC1\u636E\u6570 | \u72B6\u6001 |",
    "|------|------|------|--------|------|"
  ].join("\n") + "\n";
  const wis = new WeakImpressionService(fakeVault);
  await wis.append("Physics", "\u529B\u5B66\u6574\u4F53\u504F\u5F31");
  await wis.append("Econ", "\u5B8F\u89C2\u90E8\u5206\u611F\u89C9\u6A21\u7CCA");
  const loaded = await wis.load();
  check("\u5F31\u70B9\u5370\u8C61\u8FFD\u52A0\u5E76\u53EF\u89E3\u6790", loaded.length === 2 && loaded[0].desc === "\u529B\u5B66\u6574\u4F53\u504F\u5F31" && loaded[0].status === "\u5F85\u9A8C\u8BC1");
  const pending = await wis.pendingForInjection();
  check("\u65E0\u79D1\u76EE\u53C2\u6570\u65F6\u5168\u91CF\u6CE8\u5165\uFF08\u7CBE\u7EC3/\u96C5\u601D\u6A21\u5F0F\uFF09", pending.length === 2);
  const pendingPhy = await wis.pendingForInjection("Physics");
  check("\u6309\u79D1\u76EE\u8FC7\u6EE4\uFF1APhysics \u4F1A\u8BDD\u53EA\u6CE8\u5165\u7269\u7406\u5370\u8C61", pendingPhy.length === 1 && pendingPhy[0].subject === "Physics");
  check("\u5F31\u70B9\u5370\u8C61\u672A\u8FDB\u5165\u4E3B\u8868", (await svc.load()).every((e) => !e.desc.includes("\u529B\u5B66\u6574\u4F53")));
  files["StudyCoach/\u8BB0\u5F55/\u7EC3\u4E60\u4FA7\u91CD.md"] = [
    "# \u7EC3\u4E60\u4FA7\u91CD",
    "",
    "| \u65E5\u671F | \u79D1\u76EE | \u63CF\u8FF0 | \u72B6\u6001 |",
    "|------|------|------|------|"
  ].join("\n") + "\n";
  const pfs = new PracticeFocusService(fakeVault);
  await pfs.append("Econ", "\u95EE\u7B54\u9898\u4E60\u60EF\u7528\u65E5\u5E38\u8BCD\u66FF\u4EE3\u672F\u8BED\uFF0C\u5BFC\u81F4\u4E22\u5931\u5206\u70B9");
  await pfs.append("Physics", "\u5B9E\u9A8C\u9898\u76EE\u6210\u529F\u7387\u4E0D\u9AD8");
  await pfs.append("\u901A\u7528", "\u89E3\u91CA\u9898\u4E60\u60EF\u7701\u7565\u56E0\u679C\u8FDE\u63A5\u8BCD");
  const loadedFocus = await pfs.load();
  check("\u7EC3\u4E60\u4FA7\u91CD\u8FFD\u52A0\u5E76\u53EF\u89E3\u6790", loadedFocus.length === 3 && loadedFocus[0].status === "\u751F\u6548\u4E2D");
  const active = await pfs.activeForInjection();
  check("\u65E0\u79D1\u76EE\u53C2\u6570\u65F6\u5168\u91CF\u6CE8\u5165", active.length === 3);
  const activePhy = await pfs.activeForInjection("Physics");
  check("\u6309\u79D1\u76EE\u8FC7\u6EE4\uFF1APhysics \u6CE8\u5165\u7269\u7406 + \u901A\u7528\uFF0C\u4E0D\u542B Econ", activePhy.length === 2 && activePhy.every((f) => f.subject === "Physics" || f.subject === "\u901A\u7528"));
  const activeEcon = await pfs.activeForInjection("Econ");
  check("\u6309\u79D1\u76EE\u8FC7\u6EE4\uFF1AEcon \u6CE8\u5165 Econ + \u901A\u7528", activeEcon.length === 2);
  check("\u7EC3\u4E60\u4FA7\u91CD\u672A\u8FDB\u5165\u4E3B\u8868", (await svc.load()).every((e) => !e.desc.includes("\u65E5\u5E38\u8BCD\u66FF\u4EE3")));
  const today = todayStr();
  files[QUESTION_LOG_PATH] = [
    "# \u63D0\u95EE\u8BB0\u5F55",
    "",
    "| \u65E5\u671F | \u79D1\u76EE | \u8003\u70B9(EN) | \u56F0\u60D1\u7C7B\u578B | \u6C42\u52A9\u6DF1\u5EA6 |",
    "|------|------|---------|---------|---------|",
    `| ${today} | Physics | Moments | \u5361\u5728\u67D0\u6B65 | \u9700\u8981\u5B8C\u6574\u5F15\u5BFC |`,
    `| ${today} | Physics | Moments | \u6982\u5FF5\u4E0D\u61C2 | \u9700\u8981\u5B8C\u6574\u5F15\u5BFC |`,
    `| ${today} | Physics | Moments | \u5361\u5728\u67D0\u6B65 | \u95EE\u4E00\u53E5\u5C31\u61C2 |`,
    `| ${today} | Maths | Quadratic inequalities | \u4F1A\u4F46\u4E0D\u719F | \u95EE\u4E00\u53E5\u5C31\u61C2 |`
  ].join("\n") + "\n";
  const engine = new InsightEngine(fakeVault);
  const heat = await engine.topicHeat(14);
  check("\u63D0\u95EE\u70ED\u70B9\u805A\u5408\uFF1AMoments \xD73 \u6392\u9996\u4F4D", heat.length > 0 && heat[0].topic === "Moments" && heat[0].count === 3);
  const candHeat = await engine.generateCandidates([], []);
  check("\u63D0\u95EE\u70ED\u70B9 \u22653 \u6B21\u751F\u6210\u5019\u9009", candHeat.some((c) => c.kind === "\u63D0\u95EE\u70ED\u70B9" && c.title.includes("Moments")));
  const recEntry = {
    id: "099",
    date: today,
    subject: "Maths",
    level: "AS",
    topic: "Circle theorems",
    qtype: "\u51E0\u4F55\u8BC1\u660E",
    code: "P",
    desc: "\u672A\u5F15\u7528\u5B9A\u7406",
    fix: "",
    stdExpr: "",
    recurrence: 3,
    status: "\u672A\u6D88\u9664",
    reviewDate: today
  };
  const candRec = await engine.generateCandidates([recEntry], []);
  check("\u590D\u53D1 \u22653 \u6B21\u751F\u6210\u5019\u9009", candRec.some((c) => c.kind === "\u590D\u53D1\u70ED\u70B9"));
  const candFew = await engine.generateCandidates([{ ...recEntry, recurrence: 1 }], []);
  check("\u6837\u672C\u4E0D\u8DB3\u4E0D\u51FA\u590D\u53D1\u5019\u9009\uFF08\u5B81\u53EF\u4E0D\u8BF4\uFF09", !candFew.some((c) => c.kind === "\u590D\u53D1\u70ED\u70B9"));
  files["StudyCoach/\u8BB0\u5F55/\u7EDF\u8BA1\u5206\u6790.md"] = "# \u7EDF\u8BA1\u5206\u6790\n";
  const stats = new StatsService(fakeVault, engine);
  await stats.runQuestionWeekly();
  await stats.runHotspotBiweekly([{ ...recEntry, recurrence: 1 }]);
  const statsContent = files["StudyCoach/\u8BB0\u5F55/\u7EDF\u8BA1\u5206\u6790.md"];
  check("\u7EDF\u8BA1\u5206\u6790\u5199\u5165\u63D0\u95EE\u70ED\u70B9\u4E0E\u590D\u53D1\u70ED\u70B9\u533A\u5757", statsContent.includes("## \u63D0\u95EE\u70ED\u70B9") && statsContent.includes("## \u590D\u53D1\u70ED\u70B9"));
  const focus = await stats.currentFocus();
  check("\u672C\u671F\u4E13\u9879\u53EF\u8BFB\u53D6", focus.includes("\u81EA") && focus.length > 10);
  files[TERM_LIST_PATH] = [
    "# \u672F\u8BED\u6E05\u5355",
    "",
    "| Term (EN) | \u79D1\u76EE | \u6559\u6750\u539F\u6587\u5B9A\u4E49 | \u5FC5\u8981\u6210\u5206\u62C6\u89E3 | \u6211\u6F0F\u6389\u8FC7\u7684\u6210\u5206 | \u6211\u7528\u9519\u7684\u53E3\u8BED\u8BCD | \u72B6\u6001 |",
    "|-----------|------|-------------|-------------|--------------|--------------|------|",
    "| Opportunity cost | Econ | \uFF08\u62C4\u8BFE\u672C\u539F\u6587\uFF09 | \u2460next best \u2461forgone | \u6F0F next best | / | \u672A\u7A33\u5B9A |",
    "| Work done | Physics | \uFF08\u62C4\u8BFE\u672C\u539F\u6587\uFF09 | \u2460force \u2461distance \u2462\u65B9\u5411 | \u6F0F\u2462 | / | \u89C2\u5BDF\u4E2D |"
  ].join("\n") + "\n";
  const tls = new TermListService(fakeVault);
  check("\u62BD\u67E5\u9898\u6E90\u4E0D\u542B\u5DF2\u7A33\u5B9A", (await tls.drillPool()).length === 2);
  check("\u672A\u7A33\u5B9A\u901A\u8FC7\u4E00\u6B21 \u2192 \u89C2\u5BDF\u4E2D", await tls.applyDrillResult("Opportunity cost", true) === "\u89C2\u5BDF\u4E2D");
  check("\u89C2\u5BDF\u4E2D\u518D\u901A\u8FC7 \u2192 \u5DF2\u7A33\u5B9A", await tls.applyDrillResult("Opportunity cost", true) === "\u5DF2\u7A33\u5B9A");
  check("\u5DF2\u7A33\u5B9A\u56DE\u62BD\u4E0D\u8FC7 \u2192 \u672A\u7A33\u5B9A", await tls.applyDrillResult("Opportunity cost", false) === "\u672A\u7A33\u5B9A");
  check("\u89C2\u5BDF\u4E2D\u4E0D\u8FC7 \u2192 \u672A\u7A33\u5B9A", await tls.applyDrillResult("Work done", false) === "\u672A\u7A33\u5B9A");
  console.log(failed === 0 ? "\n\u5168\u90E8\u901A\u8FC7 \u2714" : `
${failed} \u9879\u5931\u8D25 \u2718`);
  process.exit(failed === 0 ? 0 : 1);
}
void main();
