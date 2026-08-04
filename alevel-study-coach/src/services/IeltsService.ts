import { parseFrontmatter, stringifyFrontmatter } from '../utils/markdown';
import { todayStr } from '../utils/date';
import type { VaultService } from './VaultService';
import { ROOT } from './VaultService';
import type { LlmClient } from '../llm/LlmClient';

export const IELTS_DIR = `${ROOT}/雅思`;
export const ESSAY_DIR = `${IELTS_DIR}/作文`;
export const EXPR_LIB_PATH = `${IELTS_DIR}/表达积累库.md`;

export interface EssayScores {
  date: string;
  task: number;
  overall: number | null;
  tr: number | null;
  cc: number | null;
  lr: number | null;
  gra: number | null;
  file: string;
  title: string;
}

export interface IeltsExpression {
  expr: string;
  type: string;   // 高分词汇 / 高分短语 / 高分句型 / 可替换的普通表达
  note: string;
}

export interface GradeResult {
  scores: { overall: number | null; tr: number | null; cc: number | null; lr: number | null; gra: number | null };
  expressions: IeltsExpression[];
  reply: string;   // 六段结构化批改（已剥离 JSON 块）
}

const JSON_INSTRUCTION = `

════════ 插件附加指令（批改完成后必须执行）════════
在回复的最末尾额外输出一个 JSON 代码块（不要向学生解释它）：
\`\`\`json
{ "ieltsResult": { "task": 1或2, "overall": 6.5, "tr": 6.5, "cc": 6.0, "lr": 6.5, "gra": 6.0,
  "expressions": [ {"expr": "英文表达", "type": "高分词汇|高分短语|高分句型|可替换的普通表达", "note": "简短中文解释与适用场景"} ] } }
\`\`\`
要求：分数必须与正文【1. 总分与分项评分】一致；expressions 从【5】提取，最多 8 条，只要最值得积累的。`;

/**
 * 雅思专线：作文笔记管理、批改工作流、分数趋势。
 * 批改 = 注入 vault prompts/ielts-writing.md（ys.md）→ 六段输出回填笔记 → 分数入 frontmatter。
 */
export class IeltsService {
  constructor(private vault: VaultService) {}

  /** 新建作文笔记（模板含待批改的骨架），返回路径 */
  async createEssayNote(task: number, title: string): Promise<string> {
    const safe = title.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 30) || 'untitled';
    const path = `${ESSAY_DIR}/${todayStr()}-task${task}-${safe}.md`;
    const fm = { task: String(task), date: todayStr(), overall: '', tr: '', cc: '', lr: '', gra: '' };
    const body = `\n# 雅思 Task${task} · ${title || todayStr()}\n\n## 原文\n\n（在这里粘贴作文全文）\n\n## AI 批改\n\n（尚未批改：在雅思页签点「批改当前作文」）\n\n## 高分表达\n\n（批改后自动提取）\n`;
    await this.vault.write(path, stringifyFrontmatter(fm as Record<string, string>, body));
    return path;
  }

  /** 提取笔记「## 原文」小节内容 */
  extractEssay(content: string): string {
    return extractSection(content, '## 原文').replace(/（在这里粘贴作文全文）/g, '').trim();
  }

  /**
   * 批改当前作文：读原文 → ys.md prompt + JSON 指令 → 回填批改与分数 → 返回表达列表。
   * 分数解析失败不阻塞：批改正文照常回填，分数留空。
   */
  async gradeEssay(path: string, llm: LlmClient): Promise<GradeResult> {
    const content = await this.vault.read(path);
    if (!content) throw new Error('作文笔记不存在');
    const essay = this.extractEssay(content);
    if (!essay || essay.length < 40) throw new Error('「原文」小节为空或太短——先把作文粘贴进去');

    const template = (await this.vault.read(`${ROOT}/prompts/ielts-writing.md`)) ?? '';
    if (!template) throw new Error('找不到 prompts/ielts-writing.md 模板');

    const reply = await llm.chat({
      system: template.replace(/\s*$/, '') + JSON_INSTRUCTION,
      messages: [{ role: 'user', content: essay }],
      maxTokens: 8000,
      temperature: 0.3,
    });

    const parsed = parseIeltsResult(reply);
    await this.writeBack(path, content, reply, parsed);
    return parsed;
  }

  /** 回填：AI 批改小节 + 高分表达小节 + frontmatter 分数 */
  private async writeBack(path: string, content: string, reply: string, parsed: GradeResult): Promise<void> {
    let next = replaceSection(content, '## AI 批改', `## AI 批改\n\n${parsed.reply.trim()}\n`);
    if (parsed.expressions.length) {
      const lines = parsed.expressions.map(e => `- **${e.expr}**（${e.type}）：${e.note}`).join('\n');
      next = replaceSection(next, '## 高分表达', `## 高分表达\n\n${lines}\n`);
    }
    const { data, body } = parseFrontmatter(next);
    const s = parsed.scores;
    if (s.overall !== null) data.overall = String(s.overall);
    if (s.tr !== null) data.tr = String(s.tr);
    if (s.cc !== null) data.cc = String(s.cc);
    if (s.lr !== null) data.lr = String(s.lr);
    if (s.gra !== null) data.gra = String(s.gra);
    await this.vault.write(path, stringifyFrontmatter(data, body));
  }

  /** 扫描所有作文笔记的分数（按日期升序） */
  async loadScores(): Promise<EssayScores[]> {
    const adapter = this.vault.adapter;
    if (!(await adapter.exists(ESSAY_DIR))) return [];
    const listing = await adapter.list(ESSAY_DIR);
    const out: EssayScores[] = [];
    for (const path of listing.files.filter(f => f.endsWith('.md'))) {
      const content = await this.vault.read(path);
      if (!content) continue;
      const { data } = parseFrontmatter(content);
      const num = (v: unknown): number | null => (v === '' || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
      out.push({
        date: String(data.date ?? ''),
        task: Number(data.task) || 2,
        overall: num(data.overall),
        tr: num(data.tr),
        cc: num(data.cc),
        lr: num(data.lr),
        gra: num(data.gra),
        file: path,
        title: path.split('/').pop()?.replace(/\.md$/, '') ?? '',
      });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  /** 距目标最远的短板维度（最近一篇为准） */
  weakestDimension(latest: EssayScores): string | null {
    const dims: [string, number | null][] = [['TR', latest.tr], ['CC', latest.cc], ['LR', latest.lr], ['GRA', latest.gra]];
    const filled = dims.filter(([, v]) => v !== null) as [string, number][];
    if (!filled.length) return null;
    return filled.sort((a, b) => a[1] - b[1])[0][0];
  }
}

/** 解析批改回复：剥离 JSON 块得正文 + 提取分数/表达 */
export function parseIeltsResult(reply: string): GradeResult {
  let body = reply;
  let scores: GradeResult['scores'] = { overall: null, tr: null, cc: null, lr: null, gra: null };
  let expressions: IeltsExpression[] = [];

  const fenced = reply.match(/```json\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      const j = JSON.parse(fenced[1]) as { ieltsResult?: Record<string, unknown> };
      const r = j.ieltsResult;
      if (r) {
        const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
        scores = { overall: num(r.overall), tr: num(r.tr), cc: num(r.cc), lr: num(r.lr), gra: num(r.gra) };
        if (Array.isArray(r.expressions)) {
          expressions = r.expressions
            .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object' && typeof (e as Record<string, unknown>).expr === 'string')
            .slice(0, 8)
            .map(e => ({ expr: String(e.expr), type: String(e.type ?? '高分表达'), note: String(e.note ?? '') }));
        }
      }
    } catch {
      // JSON 损坏：正文照常，分数留空
    }
    body = reply.replace(fenced[0], '').trim();
  }
  return { scores, expressions, reply: body };
}

function extractSection(content: string, heading: string): string {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex(l => l.trim() === heading);
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n');
}

function replaceSection(content: string, heading: string, newSection: string): string {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex(l => l.trim() === heading);
  if (start < 0) return content.replace(/\s*$/, '') + '\n\n' + newSection;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { end = i; break; }
  }
  return [...lines.slice(0, start), newSection.replace(/\s*$/, ''), ...lines.slice(end)].join('\n');
}
