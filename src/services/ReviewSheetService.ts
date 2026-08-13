import { todayStr } from '../utils/date';
import { hashStr } from '../utils/hash';
import type { VaultService } from './VaultService';
import { ROOT } from './VaultService';

export const REVIEW_SHEET_PATH = `${ROOT}/记录/review-sheet.md`;

export interface SheetSources {
  terms: { term: string; subject: string; status: string }[];
  points: { id: string; subject: string; topic: string; code: string; recurrence: number }[];
  wrongs: { id: string; subject: string; topic: string; myError: string; session: string }[];
  exprs: { expr: string; type: string }[];
}

/** 交错编排阈值：条目 ≥6 且跨 ≥2 科目才轮转（小样本交错=噪音，固定不加开关） */
const INTERLEAVE_MIN = 6;

/**
 * Q4 科目轮转交错（round-robin）：按科目分桶（桶内保持原优先级序），轮流各取 1 条直至取尽。
 * 确定性可解释；不用随机洗牌（复习单可再生，随机导致每次重生成顺序跳变）。
 */
export function interleave<T extends { subject: string }>(items: T[]): T[] {
  const buckets = new Map<string, T[]>();
  for (const it of items) {
    const key = it.subject || '-';
    const b = buckets.get(key);
    if (b) b.push(it);
    else buckets.set(key, [it]);
  }
  const out: T[] = [];
  const queues = [...buckets.values()];
  let remaining = true;
  while (remaining) {
    remaining = false;
    for (const q of queues) {
      if (q.length) { out.push(q.shift() as T); remaining = true; }
    }
  }
  return out;
}

/**
 * 复习单（P4）：四队到期项纯本地编译成一页可读产物（术语闪卡/错题重做/表达造句）；
 * frontmatter 存源数据指纹，复习页签据此检测漂移并提示重生成。
 */
export class ReviewSheetService {
  constructor(private vault: VaultService) {}

  /** 源数据指纹：各队列 ID 串排序后哈希（顺序无关，同集合乱序入参同指纹） */
  static fingerprint(src: SheetSources): string {
    const ids = [
      ...src.terms.map(x => `t:${x.term}`),
      ...src.points.map(p => `p:${p.id}`),
      ...src.wrongs.map(w => `w:${w.id}`),
      ...src.exprs.map(e => `e:${e.expr}`),
    ].sort().join('|');
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
      // ②节 points+wrongs 统一成带科目条目；达阈时科目轮转交错（desirable difficulty 提升迁移）
      const items: { subject: string; text: string }[] = [
        ...src.points.map(p => ({ subject: p.subject, text: `- [ ] ${p.topic}（${p.subject} · ${p.code} · 复发 ${p.recurrence}）：出同陷阱变式重做 —— 台账 ${p.id}` })),
        ...src.wrongs.map(w => ({ subject: w.subject, text: `- [ ] ${w.id} ${w.topic}：重做原题（我当时错在：${w.myError || '-'}）${w.session ? ` —— 原会话 会话/${w.session}.md` : ''}` })),
      ];
      const subjectCount = new Set(items.map(x => x.subject)).size;
      const interleaved = items.length >= INTERLEAVE_MIN && subjectCount >= 2;
      const rows = (interleaved ? interleave(items) : items).map(x => x.text);
      parts.push(`## ② 错题重做（${items.length}）${interleaved ? '（交错编排）' : ''}\n${rows.join('\n')}`);
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
