import type { SessionTag } from '../types';
import { renderRow, parseTable } from '../utils/markdown';
import { todayStr } from '../utils/date';
import { VaultService, ROOT } from './VaultService';

export const QUESTION_LOG_PATH = `${ROOT}/记录/提问记录.md`;
export const PROGRESS_DIR = `${ROOT}/记录/进展`;
export const JOURNAL_PATH = `${ROOT}/记录/学习日志.md`;
export const TERM_LIST_PATH = `${ROOT}/记录/术语清单.md`;
export const WEAK_IMPRESSIONS_PATH = `${ROOT}/记录/弱点印象.md`;
export const PRACTICE_FOCUS_PATH = `${ROOT}/记录/练习侧重.md`;

/**
 * 科目过滤规则：注入时只保留当前科目 + 跨科通用条目。
 * 通用 = 无科目 / '?' / '通用'（跨科习惯如「问答题容易口语化」可把科目写成 通用）。
 * current 为 undefined（精练模式/雅思）时不过滤，全量注入。
 */
function subjectMatches(entrySubject: string, current?: string): boolean {
  if (!current) return true;
  const s = entrySubject.trim();
  if (!s || s === '?' || s === '通用') return true;
  return s.toLowerCase() === current.toLowerCase();
}

export interface PracticeFocus {
  date: string;
  subject: string;
  desc: string;
  status: '生效中' | '已缓解';
}

/**
 * 练习侧重：题型/作答习惯层面的倾向（「实验题成功率不高」「问答题容易口语化」）。
 * 与弱点印象的区别：它更具体、可行动——注入教练 prompt 后，遇到对应题型时加强 scrutiny。
 * 同样不进主表、不进复查队列：无法用变式题判定消除，靠长期作答质量观察缓解。
 */
export class PracticeFocusService {
  constructor(private vault: VaultService) {}

  async append(subject: string, desc: string): Promise<void> {
    const row = renderRow([todayStr(), subject || '?', desc, '生效中']);
    await this.vault.appendTableRow(PRACTICE_FOCUS_PATH, row);
  }

  async load(): Promise<PracticeFocus[]> {
    const content = await this.vault.read(PRACTICE_FOCUS_PATH);
    if (!content) return [];
    const rows = parseTable(content);
    if (!rows.length) return [];
    return rows
      .filter(r => r.length >= 4 && r[0] !== '日期')
      .map(r => ({
        date: r[0],
        subject: r[1],
        desc: r[2],
        status: r[3] === '已缓解' ? '已缓解' : '生效中',
      }));
  }

  /** 注入教练 prompt 用：生效中的侧重，按科目过滤，最多 8 条 */
  async activeForInjection(subject?: string): Promise<PracticeFocus[]> {
    return (await this.load()).filter(f => f.status === '生效中' && subjectMatches(f.subject, subject)).slice(-8);
  }
}

export interface WeakImpression {
  date: string;
  subject: string;
  desc: string;
  evidence: number;
  status: '待验证' | '已确认' | '已作废';
}

/**
 * 弱点印象：冷启动/随手记里的模糊自述（「力学比较弱」这类没有具体考点的描述）。
 * 不进主表、不进复查队列；作为先验注入教练 prompt，等具体证据验证（Phase 2 做自动关联）。
 */
export class WeakImpressionService {
  constructor(private vault: VaultService) {}

  async append(subject: string, desc: string): Promise<void> {
    const row = renderRow([todayStr(), subject || '?', desc, '0', '待验证']);
    await this.vault.appendTableRow(WEAK_IMPRESSIONS_PATH, row);
  }

  async load(): Promise<WeakImpression[]> {
    const content = await this.vault.read(WEAK_IMPRESSIONS_PATH);
    if (!content) return [];
    const rows = parseTable(content);
    if (!rows.length) return [];
    return rows
      .filter(r => r.length >= 5 && r[0] !== '日期')
      .map(r => ({
        date: r[0],
        subject: r[1],
        desc: r[2],
        evidence: Number(r[3]) || 0,
        status: (['待验证', '已确认', '已作废'] as const).includes(r[4] as WeakImpression['status'])
          ? (r[4] as WeakImpression['status'])
          : '待验证',
      }));
  }

  /** 注入教练 prompt 用：待验证的印象，按科目过滤，最多 8 条 */
  async pendingForInjection(subject?: string): Promise<WeakImpression[]> {
    return (await this.load()).filter(i => i.status === '待验证' && subjectMatches(i.subject, subject)).slice(-8);
  }
}

/** 提问记录：每次求助自动追加一行（唯一不需要确认的自动记录） */
export class QuestionLogService {
  constructor(private vault: VaultService) {}

  async appendTag(tag: SessionTag): Promise<void> {
    const row = renderRow([tag.date, tag.subject, tag.topic, tag.confusion, tag.depth]);
    await this.vault.appendTableRow(QUESTION_LOG_PATH, row);
  }
}

/** 学习进展：每科一份文件，追加「日期 + 一句话」 */
export class ProgressService {
  constructor(private vault: VaultService) {}

  async append(subject: string, text: string, date: string): Promise<void> {
    const safe = subject.replace(/[\\/:*?"<>|]/g, '').trim() || '其他';
    const path = `${PROGRESS_DIR}/${safe}.md`;
    const existing = await this.vault.read(path);
    const header = existing ?? `# ${safe} 学习进展\n\n> 条目只要求「日期 + 一句话」。想精确时可以括号挂 syllabus 编号。\n`;
    await this.vault.write(path, header.replace(/\s*$/, '') + `\n- ${date}：${text}\n`);
  }

  /** 教练模式开场注入的最近进展（每科最近 5 条） */
  async recentSummary(subjects: string[]): Promise<string> {
    const blocks: string[] = [];
    for (const s of subjects) {
      const safe = s.replace(/[\\/:*?"<>|]/g, '').trim();
      const content = await this.vault.read(`${PROGRESS_DIR}/${safe}.md`);
      if (!content) continue;
      const items = content.split(/\r?\n/).filter(l => l.trim().startsWith('- ')).slice(-5);
      if (items.length) blocks.push(`${s}：\n${items.map(i => '  ' + i.trim()).join('\n')}`);
    }
    return blocks.length ? '最近学习进展（学生随手记，供你判断他大概学到哪）：\n' + blocks.join('\n') : '';
  }
}
