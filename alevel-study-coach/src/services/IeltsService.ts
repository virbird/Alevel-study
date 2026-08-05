import { parseFrontmatter, stringifyFrontmatter, parseTable, renderRow } from '../utils/markdown';
import { todayStr } from '../utils/date';
import type { VaultService } from './VaultService';
import { ROOT } from './VaultService';
import type { LlmClient, ImagePart } from '../llm/LlmClient';

export const IELTS_DIR = `${ROOT}/雅思`;
export const ESSAY_DIR = `${IELTS_DIR}/作文`;
export const EXPR_LIB_PATH = `${IELTS_DIR}/表达积累库.md`;
export const GRADE_LEDGER_PATH = `${IELTS_DIR}/批改记录.md`;

const IMG_MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface NoteExtract {
  text: string;           // 去 frontmatter、图片替换为 [图片: 名] 标记后的正文
  images: ImagePart[];    // 成功加载的图片（base64）
  skipped: string[];      // 被跳过的图片（原因）
}

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
   * 提取笔记正文与内嵌图片（支持 ![[xxx.png]] 与 ![](path) 两种语法）。
   * 图片先按笔记所在目录解析，再尝试 vault 根；限制最多 4 张、单张 5MB、png/jpg/gif/webp。
   */
  async extractNoteImages(path: string, content: string): Promise<NoteExtract> {
    const body = parseFrontmatter(content).body;
    const noteDir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    return this.extractImages(body, async src => {
      const candidates = [noteDir ? `${noteDir}/${src}` : src, src];
      for (const c of candidates) {
        const buf = await this.vault.readBinary(c);
        if (buf) return buf;
      }
      return null;
    });
  }

  /**
   * 从任意文本（如聊天消息）提取图片引用：按文件名在整个 vault 内查找
   * （Obsidian embed 的最短路径语义简化为 basename 匹配，精确路径优先）。
   */
  async extractTextImages(text: string): Promise<NoteExtract> {
    const listing = await this.vault.adapter.list('');
    const byPath = new Set(listing.files);
    const byBase = new Map<string, string>();
    for (const p of listing.files) {
      const b = p.split('/').pop();
      if (b && !byBase.has(b)) byBase.set(b, p);
    }
    return this.extractImages(text, async src => {
      const resolved = byPath.has(src) ? src : byBase.get(src.split('/').pop() ?? src);
      if (!resolved) return null;
      return this.vault.readBinary(resolved);
    });
  }

  /** 按 vault 路径批量加载图片（附加发送用），同样受格式/大小/数量限制 */
  async loadImageParts(paths: string[]): Promise<ImagePart[]> {
    const out: ImagePart[] = [];
    for (const p of paths) {
      if (out.length >= MAX_IMAGES) break;
      const name = p.split('/').pop() ?? p;
      const mime = IMG_MIME[(name.split('.').pop() ?? '').toLowerCase()];
      if (!mime) continue;
      const buf = await this.vault.readBinary(p);
      if (!buf || buf.byteLength > MAX_IMAGE_BYTES) continue;
      out.push({ mimeType: mime, data: arrayBufferToBase64(buf), name });
    }
    return out;
  }

  /** 列出笔记内图片的 vault 实际路径（引用文档附随发图用），同样受格式/数量限制 */
  async listNoteImages(path: string, content: string): Promise<string[]> {
    const body = parseFrontmatter(content).body;
    const noteDir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const out: string[] = [];
    for (const hit of this.collectImageHits(body)) {
      if (out.length >= MAX_IMAGES) break;
      const name = hit.src.split('/').pop() ?? hit.src;
      if (!IMG_MIME[(name.split('.').pop() ?? '').toLowerCase()]) continue;
      const candidates = [noteDir ? `${noteDir}/${hit.src}` : hit.src, hit.src];
      for (const c of candidates) {
        if (await this.vault.readBinary(c)) {
          out.push(c);
          break;
        }
      }
    }
    return out;
  }

  /** 把文本里的图片 embed 替换为 [图片: 名] 标记（纯文本，不读文件），供注入上下文使用 */
  markImagesInText(body: string): string {
    const hits = this.collectImageHits(body);
    let text = '';
    let cursor = 0;
    for (const hit of hits) {
      const name = hit.src.split('/').pop() ?? hit.src;
      text += body.slice(cursor, hit.start) + `[图片: ${name}]`;
      cursor = hit.end;
    }
    return text + body.slice(cursor);
  }

  /** 扫描文本中的图片引用（![[x.png]] 与 ![](path)） */
  private collectImageHits(body: string): { start: number; end: number; src: string }[] {
    const hits: { start: number; end: number; src: string }[] = [];
    for (const m of body.matchAll(/!\[\[([^\]|#]+?)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)) {
      hits.push({ start: m.index!, end: m.index! + m[0].length, src: m[1].trim() });
    }
    for (const m of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
      hits.push({ start: m.index!, end: m.index! + m[0].length, src: m[1].trim() });
    }
    hits.sort((a, b) => a.start - b.start);
    return hits;
  }

  /** 共用核心：扫描图片引用 → 逐个 resolve → 限制与标记 */
  private async extractImages(body: string, resolve: (src: string) => Promise<ArrayBuffer | null>): Promise<NoteExtract> {
    const images: ImagePart[] = [];
    const skipped: string[] = [];
    const hits = this.collectImageHits(body);

    let text = '';
    let cursor = 0;
    for (const hit of hits) {
      text += body.slice(cursor, hit.start);
      cursor = hit.end;
      const name = hit.src.split('/').pop() ?? hit.src;
      const ext = (name.split('.').pop() ?? '').toLowerCase();
      const mime = IMG_MIME[ext];
      if (!mime) {
        text += `[图片跳过: ${name}（不支持的格式）]`;
        skipped.push(name);
        continue;
      }
      if (images.length >= MAX_IMAGES) {
        text += `[图片跳过: ${name}（超过 ${MAX_IMAGES} 张上限）]`;
        skipped.push(name);
        continue;
      }
      const buf = await resolve(hit.src);
      if (!buf) {
        text += `[图片未找到: ${name}]`;
        skipped.push(name);
        continue;
      }
      if (buf.byteLength > MAX_IMAGE_BYTES) {
        text += `[图片跳过: ${name}（超过 5MB）]`;
        skipped.push(name);
        continue;
      }
      images.push({ mimeType: mime, data: arrayBufferToBase64(buf), name });
      text += `[图片: ${name}]`;
    }
    text += body.slice(cursor);
    return { text, images, skipped };
  }

  /**
   * 批改任意笔记（题目+作文可在同一篇，可含图片）：
   * 图片随请求发给视觉模型 → 六段输出回填笔记 ## AI 批改 小节 → 分数进台账。
   * signal 支持取消/超时（透传给 LLM 请求）。
   */
  async gradeNote(path: string, llm: LlmClient, signal?: AbortSignal): Promise<GradeResult & { imageCount: number; skipped: string[] }> {
    const content = await this.vault.read(path);
    if (!content) throw new Error('笔记不存在');
    const { text, images, skipped } = await this.extractNoteImages(path, content);
    const textOnly = text.replace(/\[图片[^\]]*\]/g, '').trim();
    // 题目与作文可能全在图片里：只要有图片就放行，交给视觉模型识别；
    // 仅当文字极少且无图片时才拦截
    if (textOnly.length < 40 && images.length === 0) throw new Error('未在笔记中找到作文内容——请写入题目与作文（文字或图片引用均可）');

    const template = (await this.vault.read(`${ROOT}/prompts/ielts-writing.md`)) ?? '';
    if (!template) throw new Error('找不到 prompts/ielts-writing.md 模板');

    // 复批模式：笔记已有 ## AI 批改 → 上次批改归档保留，并要求 AI 对比评价修订效果
    const prevGrading = extractSection(content, '## AI 批改').trim();
    let userPrefix = '';
    if (prevGrading) {
      const truncated = prevGrading.length > 4000 ? prevGrading.slice(0, 4000) + '\n……（已截断）' : prevGrading;
      userPrefix =
        '【复批模式】这是学生根据上一次批改建议修订后的版本。上一次批改记录如下：\n' +
        truncated +
        '\n\n请在批改时对比评价：① 上次指出的失分点/问题是否已解决（逐项说明）；' +
        '② 修订是否引入新问题；③【4. 失分点总结】中明确标注相比上次的改进与残留问题。' +
        '分数按当前真实水平给，不受上次分数影响。\n\n学生当前的作文内容如下：\n';
    }

    const reply = await llm.chat({
      system: template.replace(/\s*$/, '') + JSON_INSTRUCTION,
      messages: [{
        role: 'user',
        content: userPrefix + `以下是题目与作文${images.length ? `（含 ${images.length} 张图片，正文里的 [图片: 文件名] 是图片位置标记，请按图片内容理解题目）` : ''}：\n\n${text}`,
        images,
      }],
      maxTokens: 8000,
      temperature: 0.3,
      signal,
    });

    const parsed = parseIeltsResult(reply);
    const section = `## AI 批改\n\n> 批改日期：${todayStr()}${prevGrading ? ' · 复批（修订版）' : ''}${images.length ? ` · 含 ${images.length} 张图片` : ''}${skipped.length ? ` · ${skipped.length} 张跳过` : ''}\n\n${parsed.reply.trim()}\n`;
    // 先归档旧批改为「## 历史批改」，再写入新批改（不存在则追加）
    let base = content;
    if (prevGrading) {
      base = replaceSection(content, '## AI 批改', `## 历史批改（${todayStr()}）\n\n${prevGrading}\n`);
    }
    await this.vault.write(path, replaceSection(base, '## AI 批改', section));
    await this.appendLedger(parsed.scores, path);
    return { ...parsed, imageCount: images.length, skipped };
  }

  /** 分数台账：批改后追加一行（趋势数据源）；教练会话入库也走这里 */
  private async appendLedger(s: GradeResult['scores'], notePath: string): Promise<void> {
    const fmt = (v: number | null) => (v === null ? '-' : String(v));
    const row = renderRow([todayStr(), notePath, fmt(s.overall), fmt(s.tr), fmt(s.cc), fmt(s.lr), fmt(s.gra)]);
    await this.vault.append(GRADE_LEDGER_PATH, row);
  }

  /** 教练会话中批改结果入库（来源记为「教练会话」） */
  async registerGrade(s: GradeResult['scores'], source = '教练会话'): Promise<void> {
    await this.appendLedger(s, source);
  }

  private async loadLedger(): Promise<EssayScores[]> {
    const content = await this.vault.read(GRADE_LEDGER_PATH);
    if (!content) return [];
    return parseTable(content)
      .filter(r => r.length >= 7 && r[0] !== '日期' && r[1])
      .map(r => ({
        date: r[0],
        task: 2,
        overall: num(r[2]),
        tr: num(r[3]),
        cc: num(r[4]),
        lr: num(r[5]),
        gra: num(r[6]),
        file: r[1],
        title: (r[1].split('/').pop() ?? r[1]).replace(/\.md$/, ''),
      }));
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

  /** 扫描所有分数：台账（任意笔记批改）+ 作文目录笔记（旧流程），按日期升序 */
  async loadScores(): Promise<EssayScores[]> {
    const ledger = await this.loadLedger();
    const seen = new Set(ledger.map(s => s.file));
    const notes = (await this.scanEssayNotes()).filter(s => !seen.has(s.file));
    return [...ledger, ...notes].sort((a, b) => a.date.localeCompare(b.date));
  }

  /** 旧流程：扫描 雅思/作文/ 目录笔记 frontmatter 分数 */
  private async scanEssayNotes(): Promise<EssayScores[]> {
    const adapter = this.vault.adapter;
    if (!(await adapter.exists(ESSAY_DIR))) return [];
    const listing = await adapter.list(ESSAY_DIR);
    const out: EssayScores[] = [];
    for (const path of listing.files.filter(f => f.endsWith('.md'))) {
      const content = await this.vault.read(path);
      if (!content) continue;
      const { data } = parseFrontmatter(content);
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
    return out;
  }

  /** 距目标最远的短板维度（最近一篇为准） */
  weakestDimension(latest: EssayScores): string | null {
    const dims: [string, number | null][] = [['TR', latest.tr], ['CC', latest.cc], ['LR', latest.lr], ['GRA', latest.gra]];
    const filled = dims.filter(([, v]) => v !== null) as [string, number][];
    if (!filled.length) return null;
    return filled.sort((a, b) => a[1] - b[1])[0][0];
  }
}

function num(v: unknown): number | null {
  return v === '' || v === undefined || v === null || v === '-' || Number.isNaN(Number(v)) ? null : Number(v);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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
