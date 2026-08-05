/** 本地日期 YYYY-MM-DD */
export function todayStr(): string {
  return toStr(new Date());
}

export function toStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(base: string, days: number): string {
  const d = new Date(base + 'T00:00:00');
  if (isNaN(d.getTime())) return toStr(new Date(Date.now() + days * 86400000));
  d.setDate(d.getDate() + days);
  return toStr(d);
}

/** 宽松解析 YYYY-MM-DD；失败返回 null */
export function parseDate(s: string): Date | null {
  const m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** a 是否早于或等于今天 */
export function isDue(dateStr: string): boolean {
  const d = parseDate(dateStr);
  if (!d) return false;
  const t = new Date();
  t.setHours(23, 59, 59, 999);
  return d.getTime() <= t.getTime();
}

export function daysBetween(a: string, b: string): number {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

/** ISO 周标识（如 2026-W32），用于周报与统计节流 */
export function isoWeekKey(dateStr?: string): string {
  const t = dateStr && parseDate(dateStr) ? new Date(parseDate(dateStr)!.getTime()) : new Date();
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const week1 = new Date(t.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((t.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${t.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
