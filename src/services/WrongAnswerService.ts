import { renderRow, parseTable } from '../utils/markdown';
import { todayStr } from '../utils/date';
import { VaultService, ROOT } from './VaultService';

export const WRONG_ANSWER_PATH = `${ROOT}/记录/错题本.md`;

export type WrongAnswerStatus = '未订正' | '已订正';

export interface WrongAnswerEntry {
  id: string;
  date: string;
  subject: string;
  topic: string;        // 考点(EN)
  myError: string;      // 学生错在哪（一句话，思路层面）
  code: string;         // 错因代码（DV/CL/LK 或科目码）
  answerSource: string; // 官方答案 / 模型解答（已确认）/ 模型解答（待确认）
  status: WrongAnswerStatus;
  session: string;      // 会话回链：<sessionId>-<mode>（可空；旧 8 列行为 ''）
}

/**
 * 错题本台账：订正会话结题时由确认卡片入库。
 * 与 error-log 的分工：error-log 记「丢分知识点」（可复查消除），
 * 错题本记「错题案例」（我的错误轨迹 + 答案基线来源），两者知识点互相印证。
 */
export class WrongAnswerService {
  constructor(private vault: VaultService) {}

  async load(): Promise<WrongAnswerEntry[]> {
    const content = await this.vault.read(WRONG_ANSWER_PATH);
    if (!content) return [];
    const rows = parseTable(content);
    if (!rows.length) return [];
    return rows
      .filter(r => r.length >= 8 && r[0] !== 'ID')
      .map(r => ({
        id: r[0],
        date: r[1],
        subject: r[2],
        topic: r[3],
        myError: r[4],
        code: r[5],
        answerSource: r[6],
        status: r[7] === '未订正' ? '未订正' : '已订正',
        session: r[8] ?? '',
      }));
  }

  /** 入库一条错题；ID 递增。同日+同考点去重（避免重复结题重复登记） */
  async addEntry(p: Partial<WrongAnswerEntry>): Promise<WrongAnswerEntry | null> {
    if (!p.topic || !p.subject) return null;
    const entries = await this.load();
    const date = p.date || todayStr();
    if (entries.some(e => e.date === date && e.topic === p.topic && e.subject === p.subject)) {
      return null;
    }
    const entry: WrongAnswerEntry = {
      id: `W${entries.length + 1}`,
      date,
      subject: String(p.subject),
      topic: String(p.topic),
      myError: p.myError ?? '',
      code: p.code ?? '',
      answerSource: p.answerSource ?? '模型解答（待确认）',
      status: p.status === '未订正' ? '未订正' : '已订正',
      session: p.session ?? '',
    };
    const row = renderRow([entry.id, entry.date, entry.subject, entry.topic, entry.myError, entry.code, entry.answerSource, entry.status, entry.session]);
    await this.vault.appendTableRow(WRONG_ANSWER_PATH, row);
    return entry;
  }

  /** 未订正条目（注入教练提示词跟进用） */
  async open(): Promise<WrongAnswerEntry[]> {
    return (await this.load()).filter(e => e.status === '未订正');
  }

  /** 手工更新状态（线下重做完成等逐条反馈）：整行替换重写 */
  async updateStatus(id: string, status: WrongAnswerStatus): Promise<boolean> {
    const e = (await this.load()).find(x => x.id === id);
    if (!e || e.status === status) return false;
    const content = await this.vault.read(WRONG_ANSWER_PATH);
    if (!content) return false;
    const oldRow9 = renderRow([e.id, e.date, e.subject, e.topic, e.myError, e.code, e.answerSource, e.status, e.session]);
    const oldRow8 = renderRow([e.id, e.date, e.subject, e.topic, e.myError, e.code, e.answerSource, e.status]);
    const newRow = renderRow([e.id, e.date, e.subject, e.topic, e.myError, e.code, e.answerSource, status, e.session]);
    // 旧 8 列行兼容：优先匹配 9 列，回退 8 列（重写时顺带迁移为 9 列）
    const oldRow = content.includes(oldRow9) ? oldRow9 : oldRow8;
    if (!content.includes(oldRow)) return false;
    await this.vault.write(WRONG_ANSWER_PATH, content.replace(oldRow, newRow));
    return true;
  }
}
