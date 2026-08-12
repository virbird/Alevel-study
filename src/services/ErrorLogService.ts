import type { ErrorLogEntry, EntryStatus } from '../types';
import { addDays, isDue, todayStr, parseDate } from '../utils/date';
import { renderRow } from '../utils/markdown';
import { VaultService, ROOT } from './VaultService';

const LOG_PATH = `${ROOT}/记录/error-log.md`;
const HEADER_CELLS = ['ID', '日期', '科目', '层级', '考点(EN)', '题型', '代码', '一句话描述', '正确做法', '英文标准表述', '复发', '状态', '复查日期'];

export interface AddResult {
  action: 'new' | 'recurrence';
  entry: ErrorLogEntry;
}

/**
 * Error Log 主表读写与规则引擎。
 * 规则（与提示词体系一致）：
 * - 一个失分点一行；同一「科目+考点+代码」复发时不新增行：复发 +1、状态回「未消除」、复查日期顺延
 * - 复查日期默认 7 天后；复发条目 3 天
 */
export class ErrorLogService {
  constructor(private vault: VaultService) {}

  async load(): Promise<ErrorLogEntry[]> {
    const content = await this.vault.read(LOG_PATH);
    if (!content) return [];
    return this.parseEntries(content);
  }

  parseEntries(content: string): ErrorLogEntry[] {
    const entries: ErrorLogEntry[] = [];
    for (const cells of this.tableRows(content)) {
      const entry = this.cellsToEntry(cells);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  /** 解析 AI 结题输出中的候选 log 行（容错：占位符、列缺失） */
  parseAiRows(text: string): Partial<ErrorLogEntry>[] {
    const rows: Partial<ErrorLogEntry>[] = [];
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t.startsWith('|')) continue;
      const cells = t.slice(1, t.endsWith('|') ? -1 : undefined).split('|').map(c => c.trim());
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue;              // 分隔行
      if (cells.some(c => c === 'ID') && cells.some(c => c === '考点(EN)' || c === '考点')) continue; // 表头
      const entry = this.cellsToEntry(cells);
      if (entry && entry.topic && entry.code) rows.push(entry);
    }
    return rows;
  }

  /**
   * 入库：先查复发（同科目+考点+代码），复发则更新原行，否则追加新行。
   * 返回实际落库的条目。
   */
  async addEntry(partial: Partial<ErrorLogEntry>, fallbackSubject = ''): Promise<AddResult | null> {
    const content = await this.vault.read(LOG_PATH);
    if (!content) return null;
    if (await this.vault.hasConflict(LOG_PATH)) {
      throw new Error('error-log.md 存在同步冲突标记，请先在编辑器里处理冲突');
    }

    const entries = this.parseEntries(content);
    const topicKey = (partial.topic ?? '').trim().toLowerCase();
    const codeKey = (partial.code ?? '').trim().toUpperCase();
    // 科目规范化：AI 可能把考点名填进科目列或省略——白名单+别名校验，不合法回退会话科目
    const subjectKey = normalizeSubject(partial.subject, fallbackSubject);
    if (!topicKey || !subjectKey) return null;
    const existing = entries.find(
      e => e.topic.trim().toLowerCase() === topicKey && e.code.trim().toUpperCase() === codeKey && e.subject === subjectKey,
    );

    if (existing) {
      existing.recurrence += 1;
      existing.status = '未消除';
      existing.reviewDate = addDays(todayStr(), existing.recurrence >= 2 ? 3 : 7);
      await this.vault.write(LOG_PATH, this.rebuildTable(content, entries));
      return { action: 'recurrence', entry: existing };
    }

    const nextId = String(entries.reduce((max, e) => Math.max(max, Number(e.id) || 0), 0) + 1).padStart(3, '0');
    const entry: ErrorLogEntry = {
      id: nextId,
      date: todayStr(),
      subject: subjectKey,
      level: partial.level ?? '',
      topic: partial.topic ?? '',
      qtype: partial.qtype ?? '',
      code: partial.code ?? '',
      desc: partial.desc ?? '',
      fix: partial.fix ?? '',
      stdExpr: partial.stdExpr ?? '',
      recurrence: 1,
      status: '未消除',
      reviewDate: partial.reviewDate && parseDate(partial.reviewDate) ? partial.reviewDate : addDays(todayStr(), 7),
    };
    entries.push(entry);
    await this.vault.write(LOG_PATH, this.rebuildTable(content, entries));
    return { action: 'new', entry };
  }

  async updateEntry(id: string, patch: Partial<ErrorLogEntry>): Promise<void> {
    const content = await this.vault.read(LOG_PATH);
    if (!content) return;
    const entries = this.parseEntries(content);
    const target = entries.find(e => e.id === id);
    if (!target) return;
    Object.assign(target, patch);
    await this.vault.write(LOG_PATH, this.rebuildTable(content, entries));
  }

  /** 复查到期且未消除/观察中的条目，按 复发×等待天数 降序 */
  async dueEntries(): Promise<ErrorLogEntry[]> {
    const entries = await this.load();
    const t = todayStr();
    return entries
      .filter(e => e.status !== '已消除' && isDue(e.reviewDate))
      .sort((a, b) => {
        const score = (e: ErrorLogEntry) => e.recurrence * Math.max(0, daysOverdue(e.reviewDate, t));
        return score(b) - score(a);
      });
  }

  /** 未消除条目（注入教练 prompt 用） */
  async unresolved(): Promise<ErrorLogEntry[]> {
    const entries = await this.load();
    return entries.filter(e => e.status === '未消除');
  }

  // ─── 内部 ────────────────────────────────────────────────

  private tableRows(content: string): string[][] {
    const rows: string[][] = [];
    let inMainTable = false;
    for (const line of content.split(/\r?\n/)) {
      const t = line.trim();
      if (t.startsWith('#')) {
        inMainTable = /主表/.test(t);
        continue;
      }
      if (!t.startsWith('|')) continue;
      // 只在主表区域解析；若无「## 主表」标题则解析第一个 13 列表格
      const cells = t.slice(1, t.endsWith('|') ? -1 : undefined).split('|').map(c => c.trim());
      if (cells.some(c => c === 'ID') && cells.length >= 12) {
        inMainTable = true;
        continue;
      }
      if (!inMainTable) continue;
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue;
      rows.push(cells);
    }
    return rows;
  }

  private cellsToEntry(cells: string[]): ErrorLogEntry | null {
    let c = [...cells];
    if (c.length === 12) c.splice(10, 0, '1'); // AI 偶尔漏「复发」列
    if (c.length < 13) return null;
    const clean = (s: string) => (s === '???' || s === '?' ? '' : s);
    const recurrence = Math.max(1, Number(clean(c[10])) || 1);
    const status: EntryStatus = (['未消除', '观察中', '已消除'] as const).includes(clean(c[11]) as EntryStatus)
      ? (clean(c[11]) as EntryStatus)
      : '未消除';
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
      reviewDate: parseDate(clean(c[12])) ? clean(c[12]) : addDays(todayStr(), 7),
    };
  }

  private rebuildTable(content: string, entries: ErrorLogEntry[]): string {
    const lines = content.split(/\r?\n/);
    let headerIdx = -1;
    let tableEnd = -1;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (headerIdx < 0 && t.startsWith('|') && t.includes('ID') && t.includes('考点')) {
        headerIdx = i;
        continue;
      }
      if (headerIdx >= 0 && t.startsWith('|')) {
        tableEnd = i;
      } else if (headerIdx >= 0 && tableEnd >= 0) {
        break;
      }
    }
    if (headerIdx < 0) {
      // 没有主表则追加
      const table = this.renderTable(entries);
      return content.replace(/\s*$/, '') + '\n\n## 主表\n\n' + table + '\n';
    }
    const table = this.renderTable(entries);
    return [...lines.slice(0, headerIdx), table, ...lines.slice(tableEnd + 1)].join('\n');
  }

  private renderTable(entries: ErrorLogEntry[]): string {
    const header = renderRow(HEADER_CELLS);
    const sep = renderRow(HEADER_CELLS.map(() => '----'));
    const rows = entries.map(e =>
      renderRow([e.id, e.date, e.subject, e.level, e.topic, e.qtype, e.code, e.desc, e.fix, e.stdExpr, String(e.recurrence), e.status, e.reviewDate]),
    );
    return [header, sep, ...rows].join('\n');
  }
}

/** 失分台账科目白名单（最多精确到科目/章节，不填考点名） */
export const LOG_SUBJECTS = ['Maths', 'Physics', 'Chem', 'CS', 'Econ', 'IELTS'];
const SUBJECT_ALIASES: Record<string, string> = {
  math: 'Maths', mathematics: 'Maths', chemistry: 'Chem', economics: 'Econ',
  'computer science': 'CS', ielts: 'IELTS', '雅思': 'IELTS', '雅思口语': 'IELTS', '雅思写作': 'IELTS',
};

/** 科目规范化：白名单+别名匹配；不合法（如填了考点名）回退 fallback（会话科目） */
export function normalizeSubject(s: string | undefined, fallback: string): string {
  const key = (s ?? '').trim().toLowerCase();
  const hit = LOG_SUBJECTS.find(x => x.toLowerCase() === key) ?? SUBJECT_ALIASES[key];
  return hit ?? (fallback || (s ?? '').trim());
}

function daysOverdue(reviewDate: string, today: string): number {
  const r = parseDate(reviewDate);
  const t = parseDate(today);
  if (!r || !t) return 0;
  return Math.max(1, Math.round((t.getTime() - r.getTime()) / 86400000));
}
