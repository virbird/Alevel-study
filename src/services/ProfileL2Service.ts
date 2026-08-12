import type { ErrorLogEntry } from '../types';
import type { TermEntry } from './TermService';
import type { WrongAnswerEntry } from './WrongAnswerService';
import { todayStr, daysBetween, parseDate } from '../utils/date';
import type { VaultService } from './VaultService';
import { ROOT } from './VaultService';
import type { InsightEngine } from './InsightEngine';

export const PROFILE_L2_PATH = `${ROOT}/记录/weakness-profile.md`;
const MANUAL_HEADING = '## 人工备注';
const FRESH_DAYS = 7;

/**
 * L2 弱点画像（借鉴 DeepTutor 三层记忆的中层）：
 * 纯本地统计生成按科目分节的压缩画像，每行带台账 ID 回链（可审计）；
 * 条目多时由 PromptAssembler 注入替代全表（省 token）；「人工备注」节重新生成时原样保留。
 */
export class ProfileL2Service {
  constructor(private vault: VaultService, private engine: InsightEngine) {}

  /** 生成并写盘整份画像，返回内容 */
  async generate(entries: ErrorLogEntry[], terms: TermEntry[], was: WrongAnswerEntry[]): Promise<string> {
    const subjects = [...new Set([
      ...entries.map(e => e.subject),
      ...terms.map(x => x.subject),
      ...was.map(w => w.subject),
    ].filter(Boolean))];
    const secs: string[] = [];
    for (const s of subjects) {
      const lines = this.sectionFor(
        entries.filter(e => e.subject === s),
        terms.filter(x => x.subject === s),
        was.filter(w => w.subject === s),
      );
      if (lines.length) secs.push(`## ${s}\n${lines.join('\n')}`);
    }
    const prev = await this.vault.read(PROFILE_L2_PATH);
    const manual = prev ? extractManual(prev) : '';
    const body =
      `# 弱点画像（插件生成，可手改；「人工备注」节重新生成时原样保留）\n\n` +
      `${secs.join('\n\n')}\n\n${MANUAL_HEADING}\n${manual || '（学生/家长手写区）'}\n`;
    const content = `---\nupdated: ${todayStr()}\n---\n${body}`;
    await this.vault.write(PROFILE_L2_PATH, content);
    return content;
  }

  /** 单科目画像行（≤6 行，带证据 ID 回链） */
  private sectionFor(es: ErrorLogEntry[], ts: TermEntry[], ws: WrongAnswerEntry[]): string[] {
    const lines: string[] = [];
    const codes = this.engine.codeCountsRange(es, -1, 30).slice(0, 3);
    if (codes.length) {
      const ev = codes.flatMap(c => es.filter(e => (e.code || '').toUpperCase() === c.code).slice(0, 2).map(e => e.id));
      lines.push(`- 高频失分码（近30天）：${codes.map(c => `${c.code} ×${c.count}`).join('、')}（证据：${ev.join(' ')}）`);
    }
    for (const e of es.filter(e => e.recurrence >= 2 && e.status !== '已消除').slice(0, 3)) {
      lines.push(`- 复发热点：${e.topic} 复发 ${e.recurrence} 次（证据：${e.id}）`);
    }
    const unstable = ts.filter(x => x.status === '未稳定');
    if (unstable.length) lines.push(`- 术语未稳定 ${unstable.length} 个（${unstable.slice(0, 3).map(x => x.term).join('、')}）`);
    const open = ws.filter(w => w.status === '未订正');
    if (open.length) lines.push(`- 错题未订正 ${open.length} 条（证据：${open.slice(0, 4).map(w => w.id).join(' ')}）`);
    return lines.slice(0, 6);
  }

  /** 读取科目 H2 节（不含标题行）；无则空串 */
  async loadSection(subject: string): Promise<string> {
    const content = await this.vault.read(PROFILE_L2_PATH);
    if (!content) return '';
    const lines = content.split(/\r?\n/);
    const start = lines.findIndex(l => l.trim() === `## ${subject}`);
    if (start < 0) return '';
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) { end = i; break; }
    }
    return lines.slice(start + 1, end).join('\n').trim();
  }

  /** 画像是否新鲜（updated ≤7 天） */
  async isFresh(): Promise<boolean> {
    const content = await this.vault.read(PROFILE_L2_PATH);
    if (!content) return false;
    const m = content.match(/^updated:\s*(\d{4}-\d{2}-\d{2})/m);
    if (!m || !parseDate(m[1])) return false;
    return daysBetween(m[1], todayStr()) <= FRESH_DAYS;
  }
}

function extractManual(content: string): string {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex(l => l.trim() === MANUAL_HEADING);
  if (start < 0) return '';
  return lines.slice(start + 1).join('\n').trim();
}
