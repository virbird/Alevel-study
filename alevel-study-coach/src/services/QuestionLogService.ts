import type { SessionTag } from '../types';
import { renderRow } from '../utils/markdown';
import { VaultService, ROOT } from './VaultService';

export const QUESTION_LOG_PATH = `${ROOT}/记录/提问记录.md`;
export const PROGRESS_DIR = `${ROOT}/记录/进展`;
export const JOURNAL_PATH = `${ROOT}/记录/学习日志.md`;
export const TERM_LIST_PATH = `${ROOT}/记录/术语清单.md`;

/** 提问记录：每次求助自动追加一行（唯一不需要确认的自动记录） */
export class QuestionLogService {
  constructor(private vault: VaultService) {}

  async appendTag(tag: SessionTag): Promise<void> {
    const row = renderRow([tag.date, tag.subject, tag.topic, tag.confusion, tag.depth]);
    await this.vault.append(QUESTION_LOG_PATH, row);
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
