import { renderRow, parseTable } from '../utils/markdown';
import type { VaultService } from './VaultService';
import { TERM_LIST_PATH } from './QuestionLogService';

export type TermStatus = '未稳定' | '观察中' | '已稳定';

export interface TermEntry {
  term: string;
  subject: string;
  bookDef: string;
  parts: string;
  missed: string;
  wrongWord: string;
  status: TermStatus;
}

export class TermListService {
  constructor(private vault: VaultService) {}

  async load(): Promise<TermEntry[]> {
    const content = await this.vault.read(TERM_LIST_PATH);
    if (!content) return [];
    return parseTable(content)
      .filter(r => r.length >= 7 && r[0] !== 'Term (EN)' && r[0])
      .map(r => ({
        term: r[0],
        subject: r[1],
        bookDef: r[2],
        parts: r[3],
        missed: r[4],
        wrongWord: r[5],
        status: (['未稳定', '观察中', '已稳定'] as const).includes(r[6] as TermStatus) ? (r[6] as TermStatus) : '未稳定',
      }));
  }

  /**
   * 抽查结果状态流转（drill-definitions 模式 E 规则）：
   * 通过：未稳定→观察中（通过一次），观察中→已稳定（连续两次）
   * 不过：任何状态回到 未稳定
   */
  async applyDrillResult(term: string, pass: boolean): Promise<TermStatus | null> {
    const content = await this.vault.read(TERM_LIST_PATH);
    if (!content) return null;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t.startsWith('|')) continue;
      const cells = t.slice(1, t.endsWith('|') ? -1 : undefined).split('|').map(c => c.trim());
      if (cells.length < 7 || cells[0] !== term) continue;
      const current: TermStatus = (['未稳定', '观察中', '已稳定'] as const).includes(cells[6] as TermStatus)
        ? (cells[6] as TermStatus)
        : '未稳定';
      const next: TermStatus = !pass ? '未稳定' : current === '未稳定' ? '观察中' : '已稳定';
      cells[6] = next;
      lines[i] = renderRow(cells);
      await this.vault.write(TERM_LIST_PATH, lines.join('\n'));
      return next;
    }
    return null;
  }

  /** 抽查题源：未稳定 + 观察中 的条目 */
  async drillPool(): Promise<TermEntry[]> {
    return (await this.load()).filter(t => t.status !== '已稳定');
  }
}

/** 模式 E 抽查提示词（drill-definitions 约定：30 秒盲写，只标三种结果，不展开讲评） */
export function buildDrillSystemPrompt(terms: TermEntry[]): string {
  const list = terms.map(t => `- ${t.term}${t.subject ? `（${t.subject}）` : ''}`).join('\n');
  return `你是英文学科术语抽查考官（概念精练模式 E）。请逐个考查以下术语：
${list}

规则：
1. 一次只给出一个术语，要求学生 30 秒内凭记忆写出英文定义，写完之前不给任何提示。
2. 学生写完后只标注三种结果之一：完整 / 漏成分 / 有口语词，不展开讲评。
3. 标注时检查：必要成分是否齐全（条件、方向、单位、比较基准、限定语、精确主体）、有没有用日常词替代术语。
4. 全部术语考完后，最后单独输出一个 JSON 代码块作为结果汇总（不要向学生解释它）：
\`\`\`json
{ "drillResults": [ { "term": "术语名", "pass": true或false } ] }
\`\`\`
pass=true 表示「完整」；「漏成分」「有口语词」均为 false。`;
}
