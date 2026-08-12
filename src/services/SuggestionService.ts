import { parseSimpleFrontmatter, stringifySimpleFrontmatter } from '../utils/markdown';
import { todayStr } from '../utils/date';
import type { VaultService } from './VaultService';
import { ROOT } from './VaultService';
import type { LlmClient } from '../llm/LlmClient';
import type { SuggestionCandidate } from './InsightEngine';
import { t } from '../i18n';

export const SUGGESTION_DIR = `${ROOT}/建议`;

export type SuggestionStatus = '待处理' | '已处理' | '不准确';

export interface Suggestion {
  file: string;                // vault 路径
  title: string;
  kind: string;
  key: string;
  status: SuggestionStatus;
  created: string;
  body: string;                // 证据正文（不含已生成的学习建议部分）
  hasPlan: boolean;            // 是否已生成过学习建议
}

/**
 * 建议卡片：分析发现弱点后落为 建议/ 下的 Markdown（frontmatter 存状态）。
 * 两段式：卡片先出现（待处理）→ 学生同意 → 生成学习建议追加到同一文件（已处理）。
 */
export class SuggestionService {
  constructor(private vault: VaultService) {}

  /** 扫描并落盘新候选（同 key 已有未处理/已处理卡片时跳过） */
  async syncCandidates(candidates: SuggestionCandidate[]): Promise<number> {
    const existing = await this.loadAll();
    const known = new Set(existing.filter(s => s.status !== '不准确').map(s => s.key));
    let created = 0;
    for (const c of candidates) {
      if (known.has(c.key)) continue;
      const slug = slugify(c.title);
      // 同一天同标题可能撞路径（如「不准确」后重新生成），自动加序号
      let path = `${SUGGESTION_DIR}/${todayStr()}-${slug}.md`;
      for (let n = 2; await this.vault.read(path); n++) {
        path = `${SUGGESTION_DIR}/${todayStr()}-${slug}-${n}.md`;
      }
      const fm = { title: c.title, kind: c.kind, key: c.key, status: '待处理', created: todayStr() };
      const body = `\n# ${c.title}\n\n## 证据\n\n${c.evidence.map(e => `- ${e}`).join('\n')}\n`;
      await this.vault.write(path, stringifySimpleFrontmatter(fm, body));
      known.add(c.key);
      created++;
    }
    return created;
  }

  async loadAll(): Promise<Suggestion[]> {
    const out: Suggestion[] = [];
    // 通过 adapter 列目录（避免在 service 里依赖 App 类型）
    const adapter = this.vault.adapter;
    if (!(await adapter.exists(SUGGESTION_DIR))) return out;
    const listing = await adapter.list(SUGGESTION_DIR);
    for (const path of listing.files.filter(f => f.endsWith('.md')).sort().reverse()) {
      const content = await this.vault.read(path);
      if (!content) continue;
      const { data, body } = parseSimpleFrontmatter(content);
      out.push({
        file: path,
        title: data.title ?? path,
        kind: data.kind ?? '',
        key: data.key ?? '',
        status: (['待处理', '已处理', '不准确'] as const).includes(data.status as SuggestionStatus)
          ? (data.status as SuggestionStatus)
          : '待处理',
        created: data.created ?? '',
        body,
        hasPlan: body.includes('## 学习建议'),
      });
    }
    return out;
  }

  pending(): Promise<Suggestion[]> {
    return this.loadAll().then(all => all.filter(s => s.status === '待处理'));
  }

  async setStatus(file: string, status: SuggestionStatus, note?: string): Promise<void> {
    const content = await this.vault.read(file);
    if (!content) return;
    const { data, body } = parseSimpleFrontmatter(content);
    data.status = status;
    let newBody = body;
    if (note) newBody += `\n## 学生反馈（${todayStr()}）\n\n${note}\n`;
    await this.vault.write(file, stringifySimpleFrontmatter(data, newBody));
  }

  /**
   * 同意后生成学习建议：弱点诊断已由卡片证据给出，LLM 只负责产出可执行动作。
   * 建议面向线下执行（辅助工具定位），不排日程表。
   */
  async generatePlan(s: Suggestion, llm: LlmClient, profileSummary: string): Promise<string> {
    const system = t('suggest.planSystem', { profile: profileSummary });
    const plan = await llm.chat({
      system,
      messages: [{ role: 'user', content: t('suggest.llmInput', { title: s.title, body: s.body }) }],
      maxTokens: 1200,
      temperature: 0.4,
    });
    const content = await this.vault.read(s.file);
    if (!content) throw new Error(t('suggest.fileReadFail'));
    const { data, body } = parseSimpleFrontmatter(content);
    data.status = '已处理';
    await this.vault.write(s.file, stringifySimpleFrontmatter(data, body + `\n${t('suggest.planHeading', { date: todayStr() })}\n\n${plan.trim()}\n`));
    return plan;
  }
}

function slugify(title: string): string {
  const s = title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-');
  return s.slice(0, 40) || 'suggestion';
}
