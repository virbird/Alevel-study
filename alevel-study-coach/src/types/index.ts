// ─── LLM 设置 ───────────────────────────────────────────────
export interface LlmSettings {
  provider: 'openai-compat' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── 科目 ──────────────────────────────────────────────────
export type SubjectKey = 'Maths' | 'Physics' | 'Chemistry' | 'CS' | 'Economics';
export type ModeKey = SubjectKey | 'drill' | 'ielts';

export interface SubjectMeta {
  key: ModeKey;
  label: string;
  /** vault prompts/ 下的模板文件名 */
  promptFile: string;
  /** error log 中使用的科目名 */
  logName?: string;
}

export const SUBJECTS: SubjectMeta[] = [
  { key: 'Maths', label: '数学 Maths', promptFile: 'prompt-maths.md', logName: 'Maths' },
  { key: 'Physics', label: '物理 Physics', promptFile: 'prompt-physics.md', logName: 'Physics' },
  { key: 'Chemistry', label: '化学 Chemistry', promptFile: 'prompt-chemistry.md', logName: 'Chem' },
  { key: 'CS', label: '计算机 CS', promptFile: 'prompt-cs.md', logName: 'CS' },
  { key: 'Economics', label: '经济 Economics', promptFile: 'prompt-economics.md', logName: 'Econ' },
  { key: 'drill', label: '概念精练（术语训练）', promptFile: 'prompt-drill.md' },
  { key: 'ielts', label: '雅思写作批改', promptFile: 'ielts-writing.md' },
];

// ─── 学生档案 ───────────────────────────────────────────────
export interface SubjectProfile {
  level: string;   // IG / IG+AS
  bias: string;    // IG主导 / AS主导 / IG主导（AS未开）
  target: string;  // A*
  language?: string;
}

export interface Profile {
  stage: string;
  subjects: Partial<Record<SubjectKey, SubjectProfile>>;
  ielts: { target: number; focus: string };
  oxbridge: { enabled: boolean; direction: string };
  independent_minutes: number;
}

// ─── Error Log ─────────────────────────────────────────────
export type EntryStatus = '未消除' | '观察中' | '已消除';

export interface ErrorLogEntry {
  id: string;
  date: string;          // YYYY-MM-DD
  subject: string;
  level: string;         // IG / AS / IG→AS / 思维题
  topic: string;         // 考点(EN)
  qtype: string;         // 题型
  code: string;          // 失分类型代码
  desc: string;          // 一句话描述
  fix: string;           // 正确做法
  stdExpr: string;       // 英文标准表述
  recurrence: number;    // 复发次数
  status: EntryStatus;
  reviewDate: string;    // YYYY-MM-DD
}

// ─── 会话打标 ───────────────────────────────────────────────
export interface SessionTag {
  date: string;
  subject: string;
  topic: string;
  confusion: string;     // 概念不懂 / 会但不熟 / 卡在某步 / 术语表达 / 作文批改 / 其他
  depth: string;         // 问一句就懂 / 需要完整引导
}

// ─── 随手记提取结果 ─────────────────────────────────────────
export type CaptureType = 'progress' | 'error' | 'term' | 'journal';

export interface CaptureCandidate {
  type: CaptureType;
  confidence: 'high' | 'low';
  subject?: string;
  text: string;          // 一句话摘要
  topic?: string;        // type=error 时的候选考点(EN)
  code?: string;         // type=error 时的候选失分代码
  term?: string;         // type=term 时的术语
}

// ─── 冷启动提取结果 ─────────────────────────────────────────
export interface OnboardProgress {
  subject: string;
  text: string;
}

export interface OnboardResult {
  progress: OnboardProgress[];
  errors: Partial<ErrorLogEntry>[];
}
