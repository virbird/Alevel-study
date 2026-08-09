import { renderRow, parseTable } from '../utils/markdown';
import { todayStr } from '../utils/date';
import { VaultService, ROOT } from './VaultService';
import type { IeltsExpression } from './IeltsService';

export const SPEAKING_LEDGER_PATH = `${ROOT}/雅思/口语记录.md`;
export const SPEAKING_REPORT_DIR = `${ROOT}/雅思/口语`;

/** 口语评分（四维 + 总分区间；无语音输入时 p 为 null，总分注明不含发音） */
export interface SpeakingScore {
  part: string;           // "1" / "2" / "3" / "final"
  fc: number | null;      // Fluency & Coherence
  lr: number | null;      // Lexical Resource
  gra: number | null;     // Grammatical Range & Accuracy
  p: number | null;       // Pronunciation（文字模式为 null）
  overallLow: number | null;
  overallHigh: number | null;
  biggestIssue: string;
}

export interface SpeakingWrong {
  topic: string;
  myError: string;
  code: string;           // SP=发音 GR=语法 VX=词汇
}

export interface SpeakingLedgerRow {
  date: string;
  mode: string;           // 模考 / 陪练 / 讨论
  fc: string;
  lr: string;
  gra: string;
  p: string;
  overall: string;        // "6.5–7.0" 区间或单分
  issue: string;
}

/** 提取回复中所有 ```json 围栏并逐个解析（一条终训回复可能含多个机器块） */
function allJsonBlocks(reply: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  for (const m of reply.matchAll(/```json\s*([\s\S]*?)```/g)) {
    try {
      blocks.push(JSON.parse(m[1].trim()) as Record<string, unknown>);
    } catch {
      // 解析失败的块跳过（不阻塞其他块）
    }
  }
  return blocks;
}

const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/** 雅思带位格式化：整数补一位小数（7 → "7.0"），半带原样（6.5） */
export function fmtBand(v: number | null): string {
  if (v === null) return '-';
  return Number.isInteger(v) ? v.toFixed(1) : String(v);
}

/** 从回复提取口语评分块（可能多条：各 Part + final）；导出供测试 */
export function parseSpeakingScores(reply: string): SpeakingScore[] {
  const out: SpeakingScore[] = [];
  for (const b of allJsonBlocks(reply)) {
    const r = b.ieltsSpeaking as Record<string, unknown> | undefined;
    if (!r) continue;
    out.push({
      part: typeof r.part === 'string' ? r.part : String(r.part ?? ''),
      fc: num(r.fc), lr: num(r.lr), gra: num(r.gra), p: num(r.p),
      overallLow: num(r.overall_low), overallHigh: num(r.overall_high),
      biggestIssue: typeof r.biggest_issue === 'string' ? r.biggest_issue : '',
    });
  }
  return out;
}

/** 从回复提取口语表达升级块，映射为现有表达积累库条目；导出供测试 */
export function parseSpeakingExpressions(reply: string): IeltsExpression[] {
  const out: IeltsExpression[] = [];
  for (const b of allJsonBlocks(reply)) {
    const r = b.ieltsExpressions as { items?: unknown[] } | undefined;
    if (!r?.items) continue;
    for (const it of r.items) {
      const i = it as Record<string, unknown>;
      if (typeof i.expr !== 'string' || !i.expr.trim()) continue;
      out.push({
        expr: i.expr.trim(),
        type: `口语 Band ${typeof i.band === 'string' ? i.band : '7+'} 表达`,
        note: typeof i.context === 'string' ? i.context : '',
      });
    }
  }
  return out;
}

/** 从回复提取口语错题块（科目由调用方填「雅思口语」）；导出供测试 */
export function parseSpeakingWrongs(reply: string): SpeakingWrong[] {
  const out: SpeakingWrong[] = [];
  for (const b of allJsonBlocks(reply)) {
    const r = b.wrongAnswers as { items?: unknown[] } | undefined;
    if (!r?.items) continue;
    for (const it of r.items) {
      const i = it as Record<string, unknown>;
      if (typeof i.topic !== 'string' || !i.topic.trim()) continue;
      out.push({
        topic: i.topic.trim(),
        myError: typeof i.myError === 'string' ? i.myError : '',
        code: typeof i.code === 'string' && i.code ? i.code.toUpperCase() : 'GR',
      });
    }
  }
  return out;
}

/**
 * 口语训练台账：评分进 雅思/口语记录.md（与写作批改记录并排的趋势数据源）。
 * 错题/表达不入本台账——分别走现有错题本与表达积累库（统一复习机制）。
 */
export class SpeakingService {
  constructor(private vault: VaultService) {}

  /** 总分区间展示：有区间给 "6.5–7.0"，只有一端给单分，都无给 '-' */
  static fmtOverall(s: SpeakingScore): string {
    if (s.overallLow === null && s.overallHigh === null) return '-';
    if (s.overallLow === null) return fmtBand(s.overallHigh);
    if (s.overallHigh === null || s.overallLow === s.overallHigh) return fmtBand(s.overallLow);
    return `${fmtBand(s.overallLow)}–${fmtBand(s.overallHigh)}`;
  }

  /** 登记一次评分（台账行）；mode：模考 / 陪练 / 讨论 */
  async registerScore(s: SpeakingScore, mode = '训练'): Promise<void> {
    const row = renderRow([todayStr(), mode, fmtBand(s.fc), fmtBand(s.lr), fmtBand(s.gra), fmtBand(s.p), SpeakingService.fmtOverall(s), s.biggestIssue || '-']);
    await this.vault.appendTableRow(SPEAKING_LEDGER_PATH, row); // 表格感知追加
  }

  async loadScores(): Promise<SpeakingLedgerRow[]> {
    const content = await this.vault.read(SPEAKING_LEDGER_PATH);
    if (!content) return [];
    return parseTable(content)
      .filter(r => r.length >= 8 && r[0] !== '日期' && r[0])
      .map(r => ({ date: r[0], mode: r[1], fc: r[2], lr: r[3], gra: r[4], p: r[5], overall: r[6], issue: r[7] }));
  }
}
