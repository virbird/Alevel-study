import type { ErrorLogEntry } from '../types';
import type { TermEntry } from './TermService';
import { parseTable } from '../utils/markdown';
import { todayStr, parseDate, daysBetween } from '../utils/date';
import { QUESTION_LOG_PATH } from './QuestionLogService';
import type { VaultService } from './VaultService';
import { t } from '../i18n';

export interface QuestionTagRow {
  date: string;
  subject: string;
  topic: string;
  confusion: string;
  depth: string;
  selfRating: string;
}

export interface TopicHeat {
  subject: string;
  topic: string;
  count: number;
  last: string;
  confusions: string[];
}

export type SuggestionKind = '提问热点' | '复发热点' | '表达码趋势' | '术语未稳定' | '复查堆积';

export interface SuggestionCandidate {
  key: string;                 // 去重用：kind|核心标识
  kind: SuggestionKind;
  title: string;
  evidence: string[];          // 证据行，展示在卡片与学习建议上下文里
}

export interface RadarData {
  windowDays: number;
  topicHeat: TopicHeat[];
  codeCounts: { code: string; count: number }[];
  confusionDist: { confusion: string; count: number }[];
  unresolvedCount: number;
  dueCount: number;
}

/**
 * 弱点分析引擎：三源交叉（提问记录 × error log × 术语状态）。
 * 全部纯本地统计，不调 LLM；只在学生同意生成学习建议时才调一次 LLM。
 * 阈值遵循设计原则：单弱点信号 ≥3 条才出建议，宁可不说不可乱说。
 */
export class InsightEngine {
  constructor(private vault: VaultService) {}

  async loadQuestionTags(): Promise<QuestionTagRow[]> {
    const content = await this.vault.read(QUESTION_LOG_PATH);
    if (!content) return [];
    return parseTable(content)
      .filter(r => r.length >= 5 && r[0] !== '日期' && parseDate(r[0]))
      .map(r => ({ date: r[0], subject: r[1], topic: r[2], confusion: r[3], depth: r[4], selfRating: r[5] ?? '' }));
  }

  private withinDays(date: string, days: number): boolean {
    const d = parseDate(date);
    if (!d) return false;
    return daysBetween(date, todayStr()) <= days;
  }

  /** 提问热点：窗口内按「科目+考点」聚合 */
  async topicHeat(windowDays = 14): Promise<TopicHeat[]> {
    const tags = (await this.loadQuestionTags()).filter(t => this.withinDays(t.date, windowDays) && t.topic);
    const map = new Map<string, TopicHeat>();
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
  async codeCounts(entries: ErrorLogEntry[], windowDays = 14): Promise<{ code: string; count: number }[]> {
    return this.codeCountsRange(entries, -1, windowDays);
  }

  /**
   * 任意窗口的失分码统计：天数距今天落在 (fromDaysAgo, toDaysAgo] 内。
   * 环比用：本期 codeCountsRange(entries, -1, 14)，上期 codeCountsRange(entries, 14, 28)。
   */
  codeCountsRange(entries: ErrorLogEntry[], fromDaysAgo: number, toDaysAgo: number): { code: string; count: number }[] {
    const map = new Map<string, number>();
    for (const e of entries) {
      const d = parseDate(e.date);
      if (!d) continue;
      const n = daysBetween(e.date, todayStr());
      if (n <= fromDaysAgo || n > toDaysAgo) continue;
      const code = (e.code || '').toUpperCase();
      if (!code) continue;
      map.set(code, (map.get(code) ?? 0) + 1);
    }
    return [...map.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count);
  }

  async confusionDist(windowDays = 14): Promise<{ confusion: string; count: number }[]> {
    const tags = (await this.loadQuestionTags()).filter(t => this.withinDays(t.date, windowDays));
    const map = new Map<string, number>();
    for (const t of tags) {
      if (!t.confusion) continue;
      map.set(t.confusion, (map.get(t.confusion) ?? 0) + 1);
    }
    return [...map.entries()].map(([confusion, count]) => ({ confusion, count })).sort((a, b) => b.count - a.count);
  }

  /** Dashboard 弱点雷达数据 */
  async radar(entries: ErrorLogEntry[], windowDays = 14): Promise<RadarData> {
    const today = todayStr();
    return {
      windowDays,
      topicHeat: (await this.topicHeat(windowDays)).slice(0, 5),
      codeCounts: (await this.codeCounts(entries, windowDays)).slice(0, 5),
      confusionDist: await this.confusionDist(windowDays),
      unresolvedCount: entries.filter(e => e.status === '未消除').length,
      dueCount: entries.filter(e => e.status !== '已消除' && parseDate(e.reviewDate) !== null && e.reviewDate <= today).length,
    };
  }

  /**
   * 生成建议候选（阈值内置，样本不足时返回空数组）。
   * 注意：这里不做去重过滤，由 SuggestionService 结合已存在卡片过滤。
   */
  async generateCandidates(entries: ErrorLogEntry[], terms: TermEntry[]): Promise<SuggestionCandidate[]> {
    const out: SuggestionCandidate[] = [];
    const today = todayStr();

    // 1. 提问热点：近 14 天同一考点求助 ≥3 次
    for (const h of await this.topicHeat(14)) {
      if (h.count >= 3) {
        out.push({
          key: `提问热点|${h.subject}|${h.topic.toLowerCase()}`,
          kind: '提问热点',
          title: t('insight.heat.title', { subject: h.subject, topic: h.topic, n: h.count }),
          evidence: [
            t('insight.heat.ev1', { topic: h.topic, n: h.count, last: h.last }),
            t('insight.heat.ev2', { list: h.confusions.join('、') || t('insight.heat.noRecord') }),
            h.confusions.includes('概念不懂') ? t('insight.heat.ev3') : '',
          ].filter(Boolean),
        });
      }
    }

    // 2. 复发热点：复发 ≥3 次且未消除（提示词规定这类优先级高于题目本身）
    for (const e of entries.filter(e => e.recurrence >= 3 && e.status !== '已消除').slice(0, 3)) {
      out.push({
        key: `复发热点|${e.subject}|${e.topic.toLowerCase()}|${e.code.toUpperCase()}`,
        kind: '复发热点',
        title: t('insight.relapse.title', { subject: e.subject, topic: e.topic, n: e.recurrence, code: e.code }),
        evidence: [
          t('insight.relapse.ev1', { desc: e.desc }),
          e.fix ? t('insight.relapse.ev2', { fix: e.fix }) : '',
          t('insight.relapse.ev3'),
        ].filter(Boolean),
      });
    }

    // 3. 表达码趋势：近 14 天 DV/CL/LK/E 合计 ≥5 次
    const exprCodes = ['DV', 'CL', 'LK', 'E'];
    const expr = (await this.codeCounts(entries, 14)).filter(c => exprCodes.includes(c.code));
    const exprTotal = expr.reduce((s, c) => s + c.count, 0);
    if (exprTotal >= 5) {
      out.push({
        key: `表达码趋势|${today.slice(0, 7)}`,
        kind: '表达码趋势',
        title: t('insight.expr.title', { n: exprTotal }),
        evidence: [
          expr.map(c => `${c.code} ×${c.count}`).join(' · '),
          t('insight.expr.ev2'),
          t('insight.expr.ev3'),
        ],
      });
    }

    // 4. 术语未稳定堆积：未稳定 ≥8 个
    const unstable = terms.filter(t => t.status === '未稳定');
    if (unstable.length >= 8) {
      out.push({
        key: `术语未稳定|${today.slice(0, 7)}`,
        kind: '术语未稳定',
        title: t('insight.terms.title', { n: unstable.length }),
        evidence: [
          t('insight.terms.ev1', { list: unstable.slice(0, 5).map(x => x.term).join(' · ') }),
          t('insight.terms.ev2'),
        ],
      });
    }

    // 5. 复查堆积：未消除且到期 ≥12 条（设计文档：长期堆积转建议而非升级骚扰）
    const overdue = entries.filter(e => e.status !== '已消除' && parseDate(e.reviewDate) !== null && e.reviewDate <= today);
    if (overdue.length >= 12) {
      const worst = [...overdue].sort((a, b) => b.recurrence - a.recurrence).slice(0, 3);
      out.push({
        key: `复查堆积|${today}`,
        kind: '复查堆积',
        title: t('insight.overdue.title', { n: overdue.length }),
        evidence: [
          t('insight.overdue.ev1', { list: worst.map(e => t('insight.overdue.item', { topic: e.topic, n: e.recurrence })).join(' · ') }),
          t('insight.overdue.ev2'),
        ],
      });
    }

    return out;
  }
}
