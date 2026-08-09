import { todayStr, addDays, daysBetween, isoWeekKey } from '../utils/date';
import { stringifySimpleFrontmatter } from '../utils/markdown';
import type { VaultService } from './VaultService';
import { ROOT } from './VaultService';
import type { ErrorLogService } from './ErrorLogService';
import type { InsightEngine } from './InsightEngine';
import type { TermListService } from './TermService';
import type { IeltsService } from './IeltsService';
import type { SuggestionService } from './SuggestionService';
import type { WrongAnswerService } from './WrongAnswerService';

export const REPORT_DIR = `${ROOT}/周报`;

/**
 * 周报：过去 7 天六块统计（求助/失分/复习/术语/雅思/建议），纯本地生成 Markdown。
 * 只读汇总，不修改任何账本；同一周重复生成覆盖同名文件（幂等）。
 */
export class ReportService {
  constructor(
    private vault: VaultService,
    private errorLog: ErrorLogService,
    private engine: InsightEngine,
    private terms: TermListService,
    private ielts: IeltsService,
    private suggestions: SuggestionService,
    private wrongAnswers?: WrongAnswerService,
  ) {}

  /** 生成并落盘，返回文件路径 */
  async exportWeekly(): Promise<string> {
    const body = await this.buildWeekly();
    const path = `${REPORT_DIR}/${isoWeekKey()}.md`;
    await this.vault.write(path, body);
    return path;
  }

  async buildWeekly(): Promise<string> {
    const today = todayStr();
    const weekAgo = addDays(today, -7);
    const inWeek = (date: string) => daysBetween(date, today) >= 0 && daysBetween(date, today) <= 7;

    const entries = await this.errorLog.load();
    const tags = (await this.engine.loadQuestionTags()).filter(t => inWeek(t.date));
    const newEntries = entries.filter(e => inWeek(e.date));
    const due = await this.errorLog.dueEntries();
    const reviewed = entries.filter(e => e.status !== '未消除' && e.reviewDate >= weekAgo && e.reviewDate <= today);
    const terms = await this.terms.load();
    const essays = (await this.ielts.loadScores()).filter(s => inWeek(s.date));
    const suggestions = (await this.suggestions.loadAll()).filter(s => inWeek(s.created));

    // 求助分布
    const bySubject = new Map<string, number>();
    for (const t of tags) bySubject.set(t.subject, (bySubject.get(t.subject) ?? 0) + 1);
    const heat = (await this.engine.topicHeat(7)).slice(0, 3);

    // 失分码环比（本期近7天 vs 上期7天）
    const curCodes = this.engine.codeCountsRange(entries, -1, 7);
    const prevCodes = this.engine.codeCountsRange(entries, 7, 14);
    const exprOf = (list: { code: string; count: number }[]) =>
      ['DV', 'CL', 'LK'].map(c => list.find(x => x.code === c)?.count ?? 0).reduce((a, b) => a + b, 0);
    const exprCur = exprOf(curCodes);
    const exprPrev = exprOf(prevCodes);

    // 复发热点（复发≥2 且未消除，按复发次数）
    const relapse = entries.filter(e => e.recurrence >= 2 && e.status !== '已消除')
      .sort((a, b) => b.recurrence - a.recurrence).slice(0, 3);

    const termCount = (s: string) => terms.filter(t => t.status === s).length;
    const latestEssay = essays.length ? essays[essays.length - 1] : null;

    const L: string[] = [];
    L.push(`# 周报 ${isoWeekKey()}（${weekAgo} ~ ${today}）`);
    L.push('');
    L.push('## 求助记录');
    if (tags.length) {
      L.push(`- 本周共求助 ${tags.length} 次`);
      L.push(`- 科目分布：${[...bySubject.entries()].map(([s, n]) => `${s} ×${n}`).join('、')}`);
      if (heat.length) L.push(`- 提问热点：${heat.map(h => `${h.topic} ×${h.count}`).join('、')}`);
    } else {
      L.push('- 本周无求助记录（主学习在线下，按需求助即可）');
    }
    L.push('');
    L.push('## 失分与复发');
    L.push(`- 本周新增失分记录 ${newEntries.length} 条`);
    L.push(`- 表达码（DV/CL/LK）：本期 ${exprCur} 次，上期 ${exprPrev} 次 ${exprCur < exprPrev ? '↓ 好转' : exprCur === exprPrev ? '→ 持平' : '↑ 抬头'}`);
    L.push(`- 本周高频失分码：${curCodes.slice(0, 3).map(c => `${c.code} ×${c.count}`).join('、') || '无'}`);
    L.push(`- 复发热点：${relapse.map(e => `${e.topic}（${e.code}，复发 ${e.recurrence}）`).join('、') || '无'}`);
    L.push('');
    L.push('## 复习');
    L.push(`- 当前待复查 ${due.length} 条；未消除共 ${entries.filter(e => e.status === '未消除').length} 条`);
    L.push(`- 本周完成复查（通过）${reviewed.length} 条`);
    L.push('');
    L.push('## 术语');
    L.push(`- 未稳定 ${termCount('未稳定')} · 观察中 ${termCount('观察中')} · 已稳定 ${termCount('已稳定')}`);
    L.push('');
    L.push('## 雅思');
    if (essays.length) {
      L.push(`- 本周批改 ${essays.length} 篇${latestEssay?.overall !== null && latestEssay ? `，最近总分 ${latestEssay.overall}` : ''}`);
      if (latestEssay) {
        const weak = this.ielts.weakestDimension(latestEssay);
        if (weak) L.push(`- 短板维度：${weak}`);
      }
    } else {
      L.push('- 本周未批改作文');
    }
    L.push('');
    L.push('## 错题本');
    if (this.wrongAnswers) {
      const was = await this.wrongAnswers.load();
      const newWas = was.filter(w => inWeek(w.date));
      const openWas = was.filter(w => w.status === '未订正');
      L.push(`- 本周新增订正 ${newWas.length} 条 · 当前未订正 ${openWas.length} 条`);
      for (const w of openWas.slice(0, 3)) {
        L.push(`- 待跟进：【${w.subject}】${w.topic}（${w.myError || w.code}）`);
      }
    } else {
      L.push('- （未启用）');
    }
    L.push('');
    L.push('## 建议卡片');
    const byStatus = (s: string) => suggestions.filter(x => x.status === s).length;
    L.push(`- 本周新增 ${suggestions.length} 张：已处理 ${byStatus('已处理')} · 待处理 ${byStatus('待处理')} · 不准确 ${byStatus('不准确')}`);
    L.push('');
    L.push('> 本报表由插件自动生成，数据均来自 StudyCoach/ 记录文件，可手动补充主观复盘。');

    return stringifySimpleFrontmatter({ week: isoWeekKey(), generated: today }, '\n' + L.join('\n') + '\n');
  }
}

/** 进阶考试阶段指引（牛剑延伸，仅建议参考） */
export function oxbridgeGuidance(stage: string, direction: string): string {
  const dirText = direction && direction !== '待定' ? `（方向：${direction}）` : '';
  if (stage.startsWith('G12')) {
    return `G12 阶段${dirText}：STEP 2&3 冲刺 / PAT / ESAT + 申请。进阶考试要求每年可能调整，正式报考前核对官方招生页。`;
  }
  if (stage.startsWith('G11')) {
    return `G11 阶段${dirText}：MAT / TMUA 正式训练，STEP 起步。独立卡住门槛建议 25–30 分钟。`;
  }
  return `G10 阶段${dirText}：UKMT SMC / BMO1 风格思维题打底；G10 下可开始 TMUA / MAT 入门题（范围基本在 AS 以内）。G10 不碰 STEP 真题。`;
}
