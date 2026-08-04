import { parseTable, renderRow } from '../utils/markdown';
import { todayStr, addDays, isDue } from '../utils/date';
import type { VaultService } from './VaultService';
import { EXPR_LIB_PATH } from './IeltsService';
import type { IeltsExpression } from './IeltsService';

export interface ExpressionRow {
  expr: string;
  type: string;
  source: string;
  date: string;
  interval: number;    // 当前间隔档位索引
  next: string;        // 下次复习日期
  status: '学习中' | '已掌握';
}

/** SM-2 简化间隔（天）：1 → 3 → 7 → 14 → 30 → 60（封顶即「已掌握」） */
export const INTERVALS = [1, 3, 7, 14, 30, 60];

export class ExpressionService {
  constructor(private vault: VaultService) {}

  async load(): Promise<ExpressionRow[]> {
    const content = await this.vault.read(EXPR_LIB_PATH);
    if (!content) return [];
    return parseTable(content)
      .filter(r => r.length >= 7 && r[0] !== '表达' && r[0])
      .map(r => ({
        expr: r[0],
        type: r[1],
        source: r[2],
        date: r[3],
        interval: Math.min(Number(r[4]) || 0, INTERVALS.length - 1),
        next: r[5],
        status: r[6] === '已掌握' ? '已掌握' : '学习中',
      }));
  }

  /** 追加表达（按 expr 去重，已有的跳过）；source 为来源作文标题 */
  async appendAll(expressions: IeltsExpression[], source: string): Promise<number> {
    const existing = new Set((await this.load()).map(r => r.expr.toLowerCase()));
    let added = 0;
    const rows: string[] = [];
    for (const e of expressions) {
      const key = e.expr.trim().toLowerCase();
      if (!key || existing.has(key)) continue;
      existing.add(key);
      rows.push(renderRow([e.expr.trim(), e.type, source, todayStr(), '0', addDays(todayStr(), INTERVALS[0]), '学习中']));
      added++;
    }
    if (rows.length) {
      // 直接读原文件拼接：不依赖末尾换行（编辑器/同步工具可能去掉尾换行，导致行粘连解析丢失）
      const current = (await this.vault.read(EXPR_LIB_PATH)) ?? '';
      const sep = current === '' || current.endsWith('\n') ? '' : '\n';
      await this.vault.write(EXPR_LIB_PATH, current + sep + rows.join('\n') + '\n');
    }
    return added;
  }

  /** 到期复习的表达（学习中 且 next ≤ 今天），最多取 8 条 */
  async due(): Promise<ExpressionRow[]> {
    return (await this.load()).filter(r => r.status === '学习中' && isDue(r.next)).slice(0, 8);
  }

  /**
   * 造句抽查结果：通过 → 间隔升档（封顶即已掌握）；不过 → 重置到 1 天。
   * 返回更新后的行（找不到返回 null）。
   */
  async applyResult(expr: string, pass: boolean): Promise<ExpressionRow | null> {
    const content = await this.vault.read(EXPR_LIB_PATH);
    if (!content) return null;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t.startsWith('|')) continue;
      const cells = t.slice(1, t.endsWith('|') ? -1 : undefined).split('|').map(c => c.trim());
      if (cells.length < 7 || cells[0].toLowerCase() !== expr.toLowerCase()) continue;
      const cur = Math.min(Number(cells[4]) || 0, INTERVALS.length - 1);
      const nextIdx = pass ? Math.min(cur + 1, INTERVALS.length - 1) : 0;
      const mastered = pass && nextIdx === INTERVALS.length - 1 && cur === INTERVALS.length - 1;
      cells[4] = String(nextIdx);
      cells[5] = addDays(todayStr(), INTERVALS[nextIdx]);
      cells[6] = mastered ? '已掌握' : '学习中';
      lines[i] = renderRow(cells);
      await this.vault.write(EXPR_LIB_PATH, lines.join('\n'));
      return { expr: cells[0], type: cells[1], source: cells[2], date: cells[3], interval: nextIdx, next: cells[5], status: cells[6] as ExpressionRow['status'] };
    }
    return null;
  }

  /** 造句抽查提示词：逐个表达造句，AI 只判可用性与改进，末尾输出 JSON 汇总 */
  buildDrillPrompt(rows: ExpressionRow[]): string {
    const list = rows.map(r => `- ${r.expr}（${r.type}）`).join('\n');
    return `你是雅思表达抽查考官。请逐个考查以下高分表达：
${list}

规则：
1. 一次只给一个表达，要求学生用它造一个雅思写作场景的英文句子。
2. 学生写完后只判断两件事：表达用得对不对（搭配、语境）、句子是否达到雅思 6.5+ 水准。
   给一句简短改进建议（不超过 20 字），不展开讲评。
3. 全部考完后，最后单独输出一个 JSON 代码块（不要向学生解释它）：
\`\`\`json
{ "exprResults": [ { "expr": "表达原文", "pass": true或false } ] }
\`\`\`
pass=true 表示用对且句子合格；搭配错误、语境不当或句子过简为 false。`;
  }
}
