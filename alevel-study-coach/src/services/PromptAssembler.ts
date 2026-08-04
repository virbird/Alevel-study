import type { ModeKey, ErrorLogEntry } from '../types';
import { SUBJECTS } from '../types';
import { todayStr } from '../utils/date';
import { renderRow } from '../utils/markdown';
import type { VaultService } from './VaultService';
import type { ProfileService } from './ProfileService';
import type { ErrorLogService } from './ErrorLogService';
import type { ProgressService } from './QuestionLogService';
import { ROOT } from './VaultService';

const TAG_INSTRUCTION = `

════════ 插件集成指令（由 A-Level Study Coach 插件追加，优先级等同最高原则）════════
1. 每次会话到达结题环节（完成结题流程、或学生明确结束本次求助）时，在回复末尾额外输出一个 JSON 代码块作为会话标签，格式如下（字段值用中文或英文术语均可）：
\`\`\`json
{ "sessionTag": { "subject": "科目名", "topic": "考点英文名", "confusion": "概念不懂|会但不熟|卡在某步|术语表达|作文批改|其他", "depth": "问一句就懂|需要完整引导" } }
\`\`\`
2. 该标签供插件统计弱点，不要向学生解释它，也不要因为输出它而改变你的教学方式。
3. 结题输出 log 行时严格遵守提示词中的表格格式（13 列），一个失分点一行。`;

/**
 * 教练模式的 System Prompt 组装：
 * 科目 prompt 主体 + 学生档案 + 未消除 error log + 最近进展 + 会话打标指令。
 * prompt 文件以 vault 内 StudyCoach/prompts/ 为准，用户可直接编辑。
 */
export class PromptAssembler {
  constructor(
    private vault: VaultService,
    private profileService: ProfileService,
    private errorLogService: ErrorLogService,
    private progressService: ProgressService,
  ) {}

  meta(key: ModeKey) {
    return SUBJECTS.find(s => s.key === key);
  }

  async buildSystemPrompt(key: ModeKey, extraBlocks: string[] = []): Promise<{ prompt: string; summary: string } | null> {
    const meta = this.meta(key);
    if (!meta) return null;

    const template = await this.vault.read(`${ROOT}/prompts/${meta.promptFile}`);
    if (!template) return null;

    const profile = await this.profileService.load();
    const unresolved = await this.errorLogService.unresolved();
    const progress = await this.progressService.recentSummary(Object.keys(profile.subjects));

    const parts: string[] = [template.replace(/\s*$/, '')];
    parts.push('\n════════ 插件注入：学生档案 ════════\n' + this.profileService.formatForInjection(profile));
    parts.push(`今天是 ${todayStr()}。`);

    if (unresolved.length) {
      parts.push('\n════════ 插件注入：当前未消除的失分记录 ════════\n' + this.renderUnresolved(unresolved) +
        '\n按提示词要求使用这些信息（复发 3 次以上的代码优先级高于题目本身）。');
    } else {
      parts.push('\n当前没有未消除的失分记录。');
    }

    if (progress) parts.push('\n════════ 插件注入：最近学习进展 ════════\n' + progress);

    for (const block of extraBlocks) parts.push('\n' + block);

    parts.push(TAG_INSTRUCTION);
    const summary = `模板 ${meta.promptFile} · 未消除 ${unresolved.length} 条 · ${progress ? '含最近进展' : '暂无进展记录'}${extraBlocks.length ? ` · 引用文档 ${extraBlocks.length} 份` : ''}`;
    return { prompt: parts.join('\n'), summary };
  }

  private renderUnresolved(entries: ErrorLogEntry[]): string {
    const header = renderRow(['ID', '科目', '层级', '考点(EN)', '代码', '一句话描述', '复发', '复查日期']);
    const rows = entries.map(e => renderRow([e.id, e.subject, e.level, e.topic, e.code, e.desc, String(e.recurrence), e.reviewDate]));
    return [header, ...rows].join('\n');
  }
}
