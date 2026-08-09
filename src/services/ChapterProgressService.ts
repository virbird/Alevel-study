import { renderRow, parseTable } from '../utils/markdown';
import { todayStr } from '../utils/date';
import { VaultService, ROOT } from './VaultService';

export const CHAPTER_PROGRESS_PATH = `${ROOT}/记录/章节进度.md`;

export type ChapterStatus = '锁定' | '解锁' | '已掌握';

export interface ChapterEntry {
  subject: string;      // 科目（如 Economics）
  chapter: string;      // 章节名（如 Ch1 The basic economic problem）
  file: string;         // 章节内容文件（vault 路径）
  status: ChapterStatus;
  unlocked: string;     // 解锁日期
}

/** 章节内容文件里的术语行（## 术语 表格） */
export interface ChapterTerm {
  term: string;
  def: string;
  cn: string;
}

/**
 * 章节进度台账：按科目管理章节的 锁定/解锁/已掌握。
 * 解锁的章节会注入对应科目的教练提示词（章节名 + 术语定义），
 * 使概念精练/做题/复习聚焦在当前进度；章节内容文件存学习资产（大纲/术语/计算）。
 */
export class ChapterProgressService {
  constructor(private vault: VaultService) {}

  async load(): Promise<ChapterEntry[]> {
    const content = await this.vault.read(CHAPTER_PROGRESS_PATH);
    if (!content) return [];
    return parseTable(content)
      .filter(r => r.length >= 5 && r[0] !== '科目' && r[1])
      .map(r => ({
        subject: r[0],
        chapter: r[1],
        file: r[2],
        status: (['锁定', '解锁', '已掌握'].includes(r[3]) ? r[3] : '锁定') as ChapterStatus,
        unlocked: r[4],
      }));
  }

  /** 某科目已解锁（含已掌握）的章节 */
  async unlocked(subject: string): Promise<ChapterEntry[]> {
    return (await this.load()).filter(e => e.subject === subject && e.status !== '锁定');
  }

  /** 更新状态：整行替换；解锁时记录日期 */
  async updateStatus(subject: string, chapter: string, status: ChapterStatus): Promise<boolean> {
    const e = (await this.load()).find(x => x.subject === subject && x.chapter === chapter);
    if (!e || e.status === status) return false;
    const content = await this.vault.read(CHAPTER_PROGRESS_PATH);
    if (!content) return false;
    const oldRow = renderRow([e.subject, e.chapter, e.file, e.status, e.unlocked]);
    const unlocked = status === '解锁' && !e.unlocked ? todayStr() : e.unlocked;
    const newRow = renderRow([e.subject, e.chapter, e.file, status, unlocked]);
    if (!content.includes(oldRow)) return false;
    await this.vault.write(CHAPTER_PROGRESS_PATH, content.replace(oldRow, newRow));
    return true;
  }

  /** 从章节内容文件提取术语（## 术语 / ## 红色关键词与原文定义 / ## 关键词与原文定义 表格：Term/关键词 | 定义(EN) | 中文提示；表头允许带括号后缀如（KEY WORDS）） */
  static parseTerms(fileContent: string): ChapterTerm[] {
    const m = fileContent.match(/## (术语|红色关键词与原文定义|关键词与原文定义)[^\n]*\n([\s\S]*?)(?=\n## |$)/);
    if (!m) return [];
    return parseTable(m[2])
      .filter(r => r.length >= 2 && r[0] !== 'Term (EN)' && r[0] !== '关键词 (EN)' && r[0])
      .map(r => ({ term: r[0], def: r[1], cn: r[2] ?? '' }));
  }

  /** 提取「考纲独有考点」小节全文（考纲有要求而教材未覆盖，学习与复习时单独强调） */
  static parseSyllabusOnly(fileContent: string): string {
    const re = new RegExp('## [^\\n]*考纲独有考点[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)');
    const m = fileContent.match(re);
    return m ? m[1].trim() : '';
  }

  /** 提取「技能重点（SKILLS FOCUS）」小节：只保留各小节标题与「要点 Key points」行（控制注入体积），作为模式 B/F 的教材方法基准 */
  static parseSkillsFocus(fileContent: string): string {
    const m = fileContent.match(/## 技能重点[^\n]*\n([\s\S]*?)(?=\n## |$)/);
    if (!m) return '';
    const out: string[] = [];
    let title = '';
    for (const l of m[1].split('\n')) {
      const t = l.trim();
      if (t.startsWith('### ')) title = t.slice(4);
      else if (t.startsWith('- **要点 Key points**')) {
        const body = t.replace(/^-\s*\*\*要点 Key points\*\*[:：]\s*/, '');
        out.push(`- ${title}: ${body}`);
      }
    }
    return out.join('\n');
  }
}
