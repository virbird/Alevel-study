import type { ModeKey, ErrorLogEntry } from '../types';
import { SUBJECTS } from '../types';
import { todayStr } from '../utils/date';
import { renderRow } from '../utils/markdown';
import type { VaultService } from './VaultService';
import type { ProfileService } from './ProfileService';
import type { ErrorLogService } from './ErrorLogService';
import type { ProgressService, WeakImpressionService, PracticeFocusService } from './QuestionLogService';
import type { StatsService } from './StatsService';
import { ROOT } from './VaultService';
import { getLang, t } from '../i18n';

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
    private weakImpressions: WeakImpressionService,
    private practiceFocus: PracticeFocusService,
    private statsService: StatsService,
  ) {}

  meta(key: ModeKey) {
    return SUBJECTS.find(s => s.key === key);
  }

  async buildSystemPrompt(key: ModeKey, extraBlocks: string[] = []): Promise<{ prompt: string; summary: string } | null> {
    const meta = this.meta(key);
    if (!meta) return null;

    const template = await this.loadPrompt(meta.promptFile);
    if (!template) return null;

    const profile = await this.profileService.load();
    const unresolved = await this.errorLogService.unresolved();
    const progress = await this.progressService.recentSummary(Object.keys(profile.subjects));
    const impressions = await this.weakImpressions.pendingForInjection(meta.logName);
    const focuses = await this.practiceFocus.activeForInjection(meta.logName);

    const parts: string[] = [template.replace(/\s*$/, '')];
    parts.push(`\n════════ ${t('prompt.langRule')} ════════\n${t('prompt.langRuleText')}`);
    parts.push(`\n════════ ${t('prompt.inject.profile')} ════════\n` + this.profileService.formatForInjection(profile));
    parts.push(t('prompt.today', { date: todayStr() }));

    if (unresolved.length) {
      parts.push(`\n════════ ${t('prompt.inject.unresolved')} ════════\n` + this.renderUnresolved(unresolved) +
        `\n${t('prompt.unresolved.usage')}`);
    } else {
      parts.push('\n' + t('prompt.noUnresolved'));
    }

    const focus = await this.statsService.currentFocus();
    if (focus) {
      parts.push(`\n════════ ${t('prompt.inject.focus')} ════════\n` + focus);
    }

    if (progress) parts.push(`\n════════ ${t('prompt.inject.progress')} ════════\n` + progress);

    if (impressions.length) {
      const lines = impressions.map(i => `- 【${i.subject}】${i.desc}`);
      parts.push(
        `\n════════ ${t('prompt.inject.impressions')} ════════\n` +
          lines.join('\n') +
          `\n${t('prompt.impressions.usage')}`,
      );
    }

    if (focuses.length) {
      const lines = focuses.map(f => `- 【${f.subject}】${f.desc}`);
      parts.push(
        `\n════════ ${t('prompt.inject.practice')} ════════\n` +
          lines.join('\n') +
          `\n${t('prompt.practice.usage')}`,
      );
    }

    for (const block of extraBlocks) parts.push('\n' + block);

    parts.push(t('prompt.tagInstruction'));
    const summary = [
      t('prompt.sum.template', { file: meta.promptFile }),
      t('prompt.sum.unresolved', { n: unresolved.length }),
      progress ? t('prompt.sum.progressYes') : t('prompt.sum.progressNo'),
      ...(focus ? [t('prompt.sum.focus')] : []),
      ...(impressions.length ? [t('prompt.sum.impressions', { n: impressions.length })] : []),
      ...(focuses.length ? [t('prompt.sum.practice', { n: focuses.length })] : []),
      ...(extraBlocks.length ? [t('prompt.sum.docs', { n: extraBlocks.length })] : []),
    ].join(' · ');
    return { prompt: parts.join('\n'), summary };
  }

  private renderUnresolved(entries: ErrorLogEntry[]): string {
    const header = renderRow(t('prompt.cols.unresolved').split('|'));
    const rows = entries.map(e => renderRow([e.id, e.subject, e.level, e.topic, e.code, e.desc, String(e.recurrence), e.reviewDate]));
    return [header, ...rows].join('\n');
  }

  /** 按语言加载提示词文件：zh 优先 xxx.zh.md，其他语言用 xxx.md（默认英文）；缺失时回退另一套（公开供 MainView 提取开场白） */
  async loadPromptPublic(file: string): Promise<string> {
    return this.loadPrompt(file);
  }

  /** 按语言加载提示词文件：zh 优先 xxx.zh.md，其他语言用 xxx.md（默认英文）；缺失时回退另一套 */
  private async loadPrompt(file: string): Promise<string> {
    const zhFile = file.replace(/\.md$/, '.zh.md');
    const primary = getLang() === 'zh' ? zhFile : file;
    const fallback = getLang() === 'zh' ? file : zhFile;
    const c = await this.vault.read(`${ROOT}/prompts/${primary}`);
    if (c) return c;
    return (await this.vault.read(`${ROOT}/prompts/${fallback}`)) ?? '';
  }
}
