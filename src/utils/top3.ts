// 本周三件事（Q3）：纯本地选取——到期失分前 2 + 最旧未订正错题 1，不足按池序补齐，全空不渲染
import type { ErrorLogEntry } from '../types';
import type { WrongAnswerEntry } from '../services/WrongAnswerService';
import { daysBetween, todayStr } from './date';

export interface Top3Pick {
  kind: 'log' | 'wrong';
  log?: ErrorLogEntry;
  wrong?: WrongAnswerEntry;
  /** log：逾期天数；wrong：登记天数 */
  days: number;
  recurrence: number;
}

export function pickTop3(due: ErrorLogEntry[], openWrongs: WrongAnswerEntry[], today = todayStr()): Top3Pick[] {
  const picks: Top3Pick[] = [];
  const pushLog = (e: ErrorLogEntry) => picks.push({ kind: 'log', log: e, days: Math.max(0, daysBetween(e.reviewDate, today)), recurrence: e.recurrence });
  const pushWrong = (w: WrongAnswerEntry) => picks.push({ kind: 'wrong', wrong: w, days: Math.max(0, daysBetween(w.date, today)), recurrence: 0 });

  // 固定规则：到期失分（已按 复发×逾期 排序）取前 2 + 最旧未订正错题 1
  due.slice(0, 2).forEach(pushLog);
  const byOldest = [...openWrongs].sort((a, b) => a.date.localeCompare(b.date));
  if (byOldest.length) pushWrong(byOldest[0]);
  for (const e of due.slice(2)) { if (picks.length >= 3) break; pushLog(e); }
  for (const w of byOldest.slice(1)) { if (picks.length >= 3) break; pushWrong(w); }
  return picks.slice(0, 3);
}
