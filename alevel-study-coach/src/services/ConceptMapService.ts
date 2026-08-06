import { renderRow, parseTable } from '../utils/markdown';
import { todayStr } from '../utils/date';
import { VaultService, ROOT } from './VaultService';

export const CONCEPT_MAP_PATH = `${ROOT}/记录/概念地图.md`;

export type ConceptStatus = '已学' | '预习' | '待详学';

export interface ConceptMapEntry {
  chapter: string;      // 章节/概念簇
  concept: string;      // 概念（EN）
  subject: string;      // 科目
  status: ConceptStatus;
  date: string;         // 最近更新日期
}

/**
 * 概念地图台账：模式 F 章节级画图时登记概念及其掌握状态。
 * 预习/待详学的概念会注入概念精练提示词——以后真正学到时转入详细掌握（A/B），
 * 学生说「把 X 改为已学」后由确认卡片更新状态。
 */
export class ConceptMapService {
  constructor(private vault: VaultService) {}

  async load(): Promise<ConceptMapEntry[]> {
    const content = await this.vault.read(CONCEPT_MAP_PATH);
    if (!content) return [];
    const rows = parseTable(content);
    if (!rows.length) return [];
    return rows
      .filter(r => r.length >= 5 && r[0] !== '章节')
      .map(r => ({
        chapter: r[0],
        concept: r[1],
        subject: r[2],
        status: (r[3] === '预习' || r[3] === '待详学' ? r[3] : '已学') as ConceptStatus,
        date: r[4],
      }));
  }

  /** 新增或更新（同章节+同概念视为同一项，更新状态与日期） */
  async upsert(p: { chapter: string; concept: string; status: ConceptStatus; subject?: string }): Promise<ConceptMapEntry> {
    const entries = await this.load();
    const existing = entries.find(e => e.chapter === p.chapter && e.concept.toLowerCase() === p.concept.toLowerCase());
    const entry: ConceptMapEntry = existing
      ? { ...existing, status: p.status, date: todayStr(), subject: p.subject ?? existing.subject }
      : { chapter: p.chapter, concept: p.concept, subject: p.subject ?? '', status: p.status, date: todayStr() };

    if (existing) {
      const content = await this.vault.read(CONCEPT_MAP_PATH);
      if (content) {
        const oldRow = renderRow([existing.chapter, existing.concept, existing.subject, existing.status, existing.date]);
        const newRow = renderRow([entry.chapter, entry.concept, entry.subject, entry.status, entry.date]);
        if (content.includes(oldRow)) {
          await this.vault.write(CONCEPT_MAP_PATH, content.replace(oldRow, newRow));
          return entry;
        }
      }
    }
    const row = renderRow([entry.chapter, entry.concept, entry.subject, entry.status, entry.date]);
    await this.vault.appendTableRow(CONCEPT_MAP_PATH, row);
    return entry;
  }

  /** 尚未详细掌握的概念（注入概念精练提示词，学到时转详细掌握） */
  async pendingDetail(): Promise<ConceptMapEntry[]> {
    return (await this.load()).filter(e => e.status !== '已学');
  }
}
