import type { ErrorLogEntry } from '../types';
import { todayStr, daysBetween, parseDate } from '../utils/date';
import type { VaultService } from './VaultService';
import { ROOT } from './VaultService';
import type { InsightEngine } from './InsightEngine';

export const STATS_PATH = `${ROOT}/记录/统计分析.md`;

const FOCUS_HEADING = '## 本期专项';

/**
 * 统计分析：提问热点（每周）与复发热点（每两周）写入 记录/统计分析.md，
 * 复发热点附带「本期专项」——由 PromptAssembler 注入教练 prompt。
 * 区块式覆盖更新，其余内容（含学生手改）保留。
 */
export class StatsService {
  constructor(private vault: VaultService, private engine: InsightEngine) {}

  /** 每周：提问热点统计 */
  async runQuestionWeekly(): Promise<void> {
    const heat = await this.engine.topicHeat(7);
    const lines = heat.length
      ? heat.slice(0, 5).map(h => `- ${h.subject} · ${h.topic} ×${h.count}（${h.confusions.join('/')}）`)
      : ['- 本周暂无提问记录'];
    await this.replaceSection('## 提问热点', `最后更新：${todayStr()}（近 7 天）\n${lines.join('\n')}`);
  }

  /** 每两周：复发热点 + 生成新一期专项 */
  async runHotspotBiweekly(entries: ErrorLogEntry[]): Promise<void> {
    const recent = entries.filter(e => parseDate(e.date) !== null && daysBetween(e.date, todayStr()) <= 14);
    const codeMap = new Map<string, number>();
    const topicMap = new Map<string, number>();
    for (const e of recent) {
      if (e.code) codeMap.set(e.code.toUpperCase(), (codeMap.get(e.code.toUpperCase()) ?? 0) + 1);
      if (e.topic) topicMap.set(e.topic, (topicMap.get(e.topic) ?? 0) + 1);
    }
    const topCodes = [...codeMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topTopics = [...topicMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    const section =
      `统计区间：近两周（截至 ${todayStr()}）\n` +
      (topCodes.length ? `高频代码 Top3：${topCodes.map(([c, n]) => `${c} ${n}次`).join(' / ')}` : '高频代码：无') + '\n' +
      (topTopics.length ? `高频考点 Top3：${topTopics.map(([t, n]) => `${t} ${n}次`).join(' / ')}` : '高频考点：无');
    await this.replaceSection('## 复发热点', section);

    // 本期专项：针对最高频代码给一句可执行动作（沿用 error-log 模板的更新方法）
    const focus = topCodes.length ? focusForCode(topCodes[0][0]) : '保持当前节奏：做题前先练 5 分钟概念精练。';
    await this.replaceSection(FOCUS_HEADING, `自 ${todayStr()} 起：${focus}`);
  }

  /** 读取当前本期专项（注入教练 prompt 用） */
  async currentFocus(): Promise<string> {
    const content = await this.vault.read(STATS_PATH);
    if (!content) return '';
    const section = extractSection(content, FOCUS_HEADING);
    return section.trim();
  }

  private async replaceSection(heading: string, body: string): Promise<void> {
    const content = (await this.vault.read(STATS_PATH)) ?? '# 统计分析\n';
    const newSection = `${heading}\n\n${body}\n`;
    const next = replaceSection(content, heading, newSection);
    await this.vault.write(STATS_PATH, next);
  }
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
  if (start < 0) {
    return content.replace(/\s*$/, '') + `\n\n${newSection}`;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { end = i; break; }
  }
  return [...lines.slice(0, start), newSection.replace(/\s*$/, ''), ...lines.slice(end)].join('\n');
}

/** 按最高频失分码给出可执行的本期专项（与提示词体系的专项风格一致） */
function focusForCode(code: string): string {
  switch (code) {
    case 'DV': return '每次做题前先用概念精练练 5 分钟定义；写完解释题自查有没有漏必要成分。';
    case 'CL': return '写完任何答案先自己标一遍非术语词，再改写为教材表述。';
    case 'LK': return '解释题一律编号分步写，每步之间补 because/therefore。';
    case 'E': return '每天把一段中文解题思路改写成考场英文，练因果句式。';
    case 'C': return '每天 10 分钟纯代数化简训练，写完立即回代检验。';
    case 'U': return '每行式子后立刻写单位；结果先做量纲检查再提交。';
    case 'R': return '读题时圈出所有条件与 command word，动笔前先复述题意。';
    case 'G': return '作图题先列轴、单位、关键点清单，画完逐项核对。';
    default: return `针对高频失分码 ${code}：做题前先回顾相关条目的正确做法，结题时重点自查这一项。`;
  }
}
