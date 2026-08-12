import { todayStr } from '../utils/date';
import { hashStr } from '../utils/hash';
import type { VaultService } from './VaultService';
import { ROOT } from './VaultService';

export const REVIEW_SHEET_PATH = `${ROOT}/记录/review-sheet.md`;

export interface SheetSources {
  terms: { term: string; subject: string; status: string }[];
  points: { id: string; subject: string; topic: string; code: string; recurrence: number }[];
  wrongs: { id: string; topic: string; myError: string; session: string }[];
  exprs: { expr: string; type: string }[];
}

/**
 * 复习单（P4）：四队到期项纯本地编译成一页可读产物（术语闪卡/错题重做/表达造句）；
 * frontmatter 存源数据指纹，复习页签据此检测漂移并提示重生成。
 */
export class ReviewSheetService {
  constructor(private vault: VaultService) {}

  /** 源数据指纹：各队列 ID 串哈希 */
  static fingerprint(src: SheetSources): string {
    const ids = [
      ...src.terms.map(x => `t:${x.term}`),
      ...src.points.map(p => `p:${p.id}`),
      ...src.wrongs.map(w => `w:${w.id}`),
      ...src.exprs.map(e => `e:${e.expr}`),
    ].join('|');
    return hashStr(ids);
  }

  /** 编译并写盘，返回内容 */
  async generate(src: SheetSources): Promise<string> {
    const fp = ReviewSheetService.fingerprint(src);
    const parts: string[] = [];
    if (src.terms.length) {
      parts.push(
        `## ① 术语闪卡（${src.terms.length}）\n\n` +
        src.terms.map(x => `> [!question]- ${x.term}（${x.subject} · ${x.status}）\n> 自测：定义有几个必要成分？各是什么？答完对照术语清单。`).join('\n\n'),
      );
    }
    if (src.points.length || src.wrongs.length) {
      const rows = [
        ...src.points.map(p => `- [ ] ${p.topic}（${p.subject} · ${p.code} · 复发 ${p.recurrence}）：出同陷阱变式重做 —— 台账 ${p.id}`),
        ...src.wrongs.map(w => `- [ ] ${w.id} ${w.topic}：重做原题（我当时错在：${w.myError || '-'}）${w.session ? ` —— 原会话 会话/${w.session}.md` : ''}`),
      ];
      parts.push(`## ② 错题重做（${src.points.length + src.wrongs.length}）\n${rows.join('\n')}`);
    }
    if (src.exprs.length) {
      parts.push(`## ③ 表达造句（${src.exprs.length}）\n` + src.exprs.map(e => `- [ ] ${e.expr}（${e.type}）—— 造一个雅思语境句`).join('\n'));
    }
    const body = parts.length ? parts.join('\n\n') : '（当前无到期复习项）';
    const content = `---\ngenerated: ${todayStr()}\nfingerprint: ${fp}\n---\n# 复习单 ${todayStr()}\n\n${body}\n`;
    await this.vault.write(REVIEW_SHEET_PATH, content);
    return content;
  }

  /** 读取已生成复习单的指纹；文件不存在返回 null */
  async readFingerprint(): Promise<string | null> {
    const content = await this.vault.read(REVIEW_SHEET_PATH);
    if (!content) return null;
    const m = content.match(/^fingerprint:\s*(\S+)/m);
    return m ? m[1] : null;
  }
}
