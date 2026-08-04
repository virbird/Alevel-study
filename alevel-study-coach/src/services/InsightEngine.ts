import type { ErrorLogEntry } from '../types';
import type { TermEntry } from './TermService';
import { parseTable } from '../utils/markdown';
import { todayStr, parseDate, daysBetween } from '../utils/date';
import { QUESTION_LOG_PATH } from './QuestionLogService';
import type { VaultService } from './VaultService';

export interface QuestionTagRow {
  date: string;
  subject: string;
  topic: string;
  confusion: string;
  depth: string;
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
      .map(r => ({ date: r[0], subject: r[1], topic: r[2], confusion: r[3], depth: r[4] }));
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
    const map = new Map<string, number>();
    for (const e of entries.filter(e => this.withinDays(e.date, windowDays))) {
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
          title: `${h.subject} 的 ${h.topic} 最近两周求助 ${h.count} 次`,
          evidence: [
            `近 14 天在 ${h.topic} 上求助 ${h.count} 次（最近 ${h.last}）`,
            `困惑类型：${h.confusions.join('、') || '未记录'}`,
            h.confusions.includes('概念不懂') ? '含「概念不懂」——可能是基础理解没到位，而不只是熟练度问题' : '',
          ].filter(Boolean),
        });
      }
    }

    // 2. 复发热点：复发 ≥3 次且未消除（提示词规定这类优先级高于题目本身）
    for (const e of entries.filter(e => e.recurrence >= 3 && e.status !== '已消除').slice(0, 3)) {
      out.push({
        key: `复发热点|${e.subject}|${e.topic.toLowerCase()}|${e.code.toUpperCase()}`,
        kind: '复发热点',
        title: `${e.subject}「${e.topic}」已复发 ${e.recurrence} 次（${e.code}）`,
        evidence: [
          `失分描述：${e.desc}`,
          e.fix ? `正确做法：${e.fix}` : '',
          '按提示词规则，复发 3 次以上的代码优先级高于题目本身，需要专门检查环节',
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
        title: `英文表达类失分近两周共 ${exprTotal} 次`,
        evidence: [
          expr.map(c => `${c.code} ×${c.count}`).join('、'),
          '这些码与雅思 LR/GRA 是同一能力——术语训练同时也在练雅思',
          '建议：做题前先做 5 分钟概念精练（定义成分计数 + 口语词拦截）',
        ],
      });
    }

    // 4. 术语未稳定堆积：未稳定 ≥8 个
    const unstable = terms.filter(t => t.status === '未稳定');
    if (unstable.length >= 8) {
      out.push({
        key: `术语未稳定|${today.slice(0, 7)}`,
        kind: '术语未稳定',
        title: `${unstable.length} 个术语处于未稳定状态`,
        evidence: [
          `示例：${unstable.slice(0, 5).map(t => t.term).join('、')}`,
          '建议：每周一次模式 E 抽查（复习页签发起），把抽查通过一次升为观察中',
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
        title: `复查队列堆积 ${overdue.length} 条`,
        evidence: [
          `最痛的几条：${worst.map(e => `${e.topic}（复发 ${e.recurrence}）`).join('、')}`,
          '建议：不必全清，先处理最痛的 3 条（复习页签已按复发×逾期排序）',
        ],
      });
    }

    return out;
  }
}
