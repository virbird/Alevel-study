import { ItemView, MarkdownRenderer, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import type ALevelStudyCoachPlugin from '../main';
import { SUBJECTS } from '../types';
import type { ChatMessage, ErrorLogEntry, ModeKey, SessionTag } from '../types';
import { extractJson } from '../llm/LlmClient';
import { todayStr, addDays } from '../utils/date';
import { parseFrontmatter } from '../utils/markdown';
import { ROOT } from '../services/VaultService';
import { OnboardModal } from './OnboardModal';
import { CaptureModal } from './CaptureModal';
import { SessionHistoryModal, AttachPickerModal, ImagePickerModal } from './PickerModals';
import { SuggestionModal, DrillModal, OfflineFeedbackModal } from './InsightModals';
import { EXPR_LIB_PATH, GRADE_LEDGER_PATH, parseIeltsResult } from '../services/IeltsService';
import { WRONG_ANSWER_PATH } from '../services/WrongAnswerService';
import { CONCEPT_MAP_PATH } from '../services/ConceptMapService';
import { CHAPTER_PROGRESS_PATH, ChapterEntry, ChapterProgressService } from '../services/ChapterProgressService';
import { SPEAKING_LEDGER_PATH, SPEAKING_REPORT_DIR, parseSpeakingScores, parseSpeakingExpressions, parseSpeakingWrongs, SpeakingService, fmtBand } from '../services/SpeakingService';
import { AudioRecorder } from '../voice/AudioRecorder';
import { aliyunAsr, aliyunTts } from '../voice/AliyunNls';
import { splitForTts } from '../voice/audioUtils';
import { oxbridgeGuidance } from '../services/ReportService';
import type { TermEntry } from '../services/TermService';
import type { ImagePart } from '../types';
import { ContextCompressor } from '../services/ContextCompressor';
import { estimateTokens, formatTokens } from '../utils/tokens';

export const VIEW_TYPE = 'alevel-study-coach-view';

const SUBJECT_TO_MODE: Record<string, ModeKey> = {
  Maths: 'Maths', Physics: 'Physics', Chem: 'Chemistry', Chemistry: 'Chemistry',
  CS: 'CS', Econ: 'Economics', Economics: 'Economics',
};

const CLOSE_PROMPT = '现在结题。请按提示词完成结题流程的剩余环节（包括 log 行），并在回复末尾输出会话标签 JSON。';

type TabKey = 'home' | 'coach' | 'records' | 'review' | 'ielts';

export class MainView extends ItemView {
  private tab: TabKey = 'home';
  private bodyEl!: HTMLElement;

  // coach 会话状态
  private mode: ModeKey;
  private systemPrompt = '';
  private sessionSummary = '';
  private messages: ChatMessage[] = [];
  private sessionTagged = false;
  private busy = false;
  /** 当前会话的存档文件标识（空 = 尚未产生过存档） */
  private sessionId = '';
  /** 已写入存档文件的消息数，增量追加用 */
  private savedCount = 0;
  /** 本轮会话引用的文档 */
  private attachments: { path: string; name: string }[] = [];
  /** 待随下一条消息发送的图片（vault 路径） */
  private pendingImages: string[] = [];
  /** 结题请求已发出，回复成功后自动存档并关闭会话 */
  private pendingClose = false;
  /** 自动开会话防重入标志 */
  private startingSession = false;
  /** 上下文压缩进行中（耗时操作，需明确提示） */
  private compressing = false;
  /** 口语训练：TTS 播报状态（可打断） */
  private ttsPlaying = false;
  private ttsStopped = false;
  private ttsSource: AudioBufferSourceNode | null = null;
  /** 口语训练：按住说话录音状态 */
  private recording = false;
  private recorder: AudioRecorder | null = null;
  /** 线下练习反馈待确认结果（复习页签确认卡片） */
  private pendingFeedback: ReviewFeedback | null = null;
  /** 复习/记录共用的展开状态（默认：有内容的区展开、空区收起） */
  private expanded: Record<string, boolean> = {};
  /** 按科目隔离的会话槽：切科目时保存当前会话，切回时恢复 */
  private slots: Partial<Record<string, { sessionId: string; messages: ChatMessage[]; savedCount: number; sessionTagged: boolean }>> = {};
  /** 独立思考计时器（提示词门槛的产品硬约束，仅会话内可用） */
  private timerDeadline = 0;
  private timerMinutes = 0;
  /** 计时跑满后的「思考凭证」：下一条消息携带标注后清零 */
  private thinkCredit = 0;
  private timerInterval: number | null = null;
  /** 批改任务卡片秒数刷新定时器 */
  private taskTicker: number | null = null;
  /** 图片分段识别任务（>4 张自动分段，逐段识别后合并为文本发送） */
  private imgRecTask: {
    batches: { parts: ImagePart[]; status: 'pending' | 'running' | 'done' | 'failed'; result?: string; error?: string }[];
    msgText: string;
    status: 'running' | 'failed' | 'canceled';
    startedAt: number;
  } | null = null;
  private imgRecTicker: number | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: ALevelStudyCoachPlugin) {
    super(leaf);
    // 恢复上次选择的科目；首次默认概念精练（术语训练优先）
    const saved = plugin.settings.lastCoachMode;
    this.mode = SUBJECTS.some(s => s.key === saved) ? (saved as ModeKey) : 'drill';
  }

  getViewType(): string { return VIEW_TYPE; }
  getDisplayText(): string { return 'A-Level Study Coach'; }
  getIcon(): string { return 'graduation-cap'; }

  async onOpen(): Promise<void> {
    this.containerEl.addClass('asc-view');
    this.render();
  }

  async onClose(): Promise<void> {
    // 防止漏数据：关闭视图时把未存档的消息自动落盘（含其他科目槽里的未结束会话）
    await this.archiveIfNeeded(false);
    for (const [mode, slot] of Object.entries(this.slots)) {
      if (!slot || slot.messages.length <= slot.savedCount) continue;
      // 无交互的槽会话不落盘
      if (!slot.messages.some(m => m.role === 'user')) continue;
      const meta = SUBJECTS.find(s => s.key === mode);
      const path = `${ROOT}/会话/${slot.sessionId}-${mode}.md`;
      const existing = await this.plugin.vaultService.read(path);
      const lines: string[] = [];
      if (!existing) {
        lines.push('---', `mode: ${mode}`, `started: "${todayStr()} ${timeStr()}"`, '---', '', `# 教练会话 ${todayStr()} · ${meta?.label ?? mode}`, '');
      }
      for (let i = slot.savedCount; i < slot.messages.length; i++) {
        const m = slot.messages[i];
        lines.push(`## ${m.role === 'user' ? '学生' : '教练'}`, '', m.content, '');
      }
      await this.plugin.vaultService.append(path, lines.join('\n'));
    }
    this.slots = {};
    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.taskTicker !== null) {
      window.clearInterval(this.taskTicker);
      this.taskTicker = null;
    }
    this.stopImgRecTicker();
    this.containerEl.empty();
  }

  /** 长任务（批改等）完成后由插件调用刷新 */
  refresh(): void {
    this.render();
  }

  /** 当前页签（供插件判断是否可自动切到首页） */
  get currentTab(): string {
    return this.tab;
  }

  /** 切到首页（批改任务开始/结束时由插件调用，任务卡片在首页顶部） */
  showHome(): void {
    this.tab = 'home';
    this.render();
  }

  private render(): void {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass('asc-root');

    // 顶部一行：全局模型选择（缩小）+ 标题 + 快捷操作
    const header = root.createDiv({ cls: 'asc-header' });
    const gSel = header.createEl('select', { cls: 'asc-select asc-model-select' });
    const gModels = this.plugin.modelList();
    const gCur = this.plugin.settings.llm.model;
    const gDef = this.plugin.currentModelDefault();
    if (!gModels.length) gSel.createEl('option', { text: gCur || '未配置', value: gCur });
    for (const m of gModels) {
      gSel.createEl('option', { text: m === gDef ? `${m} ★` : m, value: m });
    }
    gSel.value = gCur;
    gSel.setAttr('title', `全局模型：影响教练/批改/抽查等所有 AI 调用。当前：${gCur}${gDef ? `，默认：${gDef}` : ''}`);
    gSel.addEventListener('change', async () => {
      this.plugin.settings.llm.model = gSel.value;
      await this.plugin.saveSettings();
      new Notice(`模型已切换：${gSel.value}`);
      this.render();
    });
    header.createSpan({ text: '🎓 A-Level Study Coach', cls: 'asc-title' });
    const actions = header.createDiv({ cls: 'asc-header-actions' });
    actions.createEl('button', { text: '随手记', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => new CaptureModal(this.app, this.plugin).open());
    actions.createEl('button', { text: '冷启动', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => new OnboardModal(this.app, this.plugin).open());
    actions.createEl('button', { text: '刷新', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => this.render());

    // 页签
    const tabs = root.createDiv({ cls: 'asc-tabs' });
    const defs: { key: TabKey; label: string }[] = [
      { key: 'home', label: '首页' },
      { key: 'coach', label: '教练' },
      { key: 'records', label: '记录' },
      { key: 'review', label: '复习' },
    ];
    for (const d of defs) {
      const btn = tabs.createEl('button', { text: d.label, cls: 'asc-tab' + (this.tab === d.key ? ' is-active' : '') });
      btn.addEventListener('click', () => { this.tab = d.key; this.render(); });
    }

    this.bodyEl = root.createDiv({ cls: 'asc-body' });
    switch (this.tab) {
      case 'home': void this.renderDashboard(); break;
      case 'coach': void this.renderCoach(); break;
      case 'records': void this.renderRecords(); break;
      case 'review': void this.renderReview(); break;
    }
  }

  private openFile(path: string): void {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) void this.app.workspace.getLeaf(true).openFile(file);
  }


  // ─── 首页 ────────────────────────────────────────────────
  private async renderDashboard(): Promise<void> {
    const el = this.bodyEl;
    const profile = await this.plugin.profiles.load();
    const entries = await this.plugin.errorLog.load();
    const pending = (await this.plugin.suggestions.loadAll()).filter(s => s.status === '待处理');

    // 0. 批改任务卡片（首页顶部，后台任务不阻塞操作）
    this.renderGradingTask(el);

    // 1. 待处理建议卡片（有才显示，最多 3 张）
    if (pending.length) {
      for (const s of pending.slice(0, 3)) {
        const card = el.createDiv({ cls: 'asc-card asc-suggest-card' });
        card.createEl('div', { text: s.title, cls: 'asc-card-title' });
        card.createEl('div', { text: `${s.kind} · ${s.created}`, cls: 'asc-muted' });
        const btns = card.createDiv({ cls: 'asc-row' });
        btns.createEl('button', { text: '看建议', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', () => {
          new SuggestionModal(this.app, this.plugin, s, () => this.render()).open();
        });
        btns.createEl('button', { text: '不准确', cls: 'asc-btn asc-btn-small' }).addEventListener('click', async () => {
          const note = window.prompt('哪里判断得不准确？') ?? '';
          await this.plugin.suggestions.setStatus(s.file, '不准确', note || undefined);
          this.render();
        });
      }
      if (pending.length > 3) el.createEl('div', { text: `… 还有 ${pending.length - 3} 张待处理建议卡片`, cls: 'asc-muted' });
    } else {
      el.createDiv({ text: '暂无待处理的建议卡片——弱点信号达到阈值时会自动出现在这里。', cls: 'asc-hint' });
    }

    // 2. 待复查入口（有才显示，一行）
    const radar = await this.plugin.engine.radar(entries, 14);
    if (radar.dueCount > 0) {
      const dueCard = el.createDiv({ cls: 'asc-card asc-due-card' });
      const dueRow = dueCard.createDiv({ cls: 'asc-row' });
      dueRow.createSpan({ text: `📌 ${radar.dueCount} 条失分点待复查`, cls: 'asc-strong' });
      dueRow.createEl('button', { text: '去处理', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', () => { this.tab = 'review'; this.render(); });
    } else if (!pending.length) {
      el.createEl('div', { text: '✓ 今天没有待办——主学习在线下，需要协助时随时来。', cls: 'asc-hint' });
    }

    // 3. 状态概览（一张紧凑卡片，每域一行；详细数据去「记录」页签）
    const scores = await this.plugin.ielts.loadScores();
    const terms = await this.plugin.terms.load();
    const exprs = await this.plugin.expressions.load();
    const dueExprs = await this.plugin.expressions.due();
    const ov = el.createDiv({ cls: 'asc-card' });
    ov.createEl('div', { text: '状态概览', cls: 'asc-card-title' });
    if (scores.length) {
      const latest = scores[scores.length - 1];
      const gap = latest.overall !== null ? profile.ielts.target - latest.overall : null;
      const weak = this.plugin.ielts.weakestDimension(latest);
      ov.createEl('div', {
        text: `📝 雅思 最近 ${latest.overall ?? '-'}${gap !== null && gap > 0 ? ` · 距目标差 ${gap.toFixed(1)}` : gap !== null ? ' · 达标 🎉' : ''}${weak ? ` · 短板 ${weak}` : ''} · 表达库 ${exprs.length}${dueExprs.length ? `（到期 ${dueExprs.length}）` : ''}`,
        cls: 'asc-row',
      });
    } else {
      ov.createEl('div', { text: `📝 雅思 目标 ${profile.ielts.target}（${profile.ielts.focus}）· 还没有批改记录`, cls: 'asc-row' });
    }
    const curCodes = this.plugin.engine.codeCountsRange(entries, -1, 14);
    const prevCodes = this.plugin.engine.codeCountsRange(entries, 14, 28);
    const cnt = (list: { code: string; count: number }[], c: string) => list.find(x => x.code === c)?.count ?? 0;
    const exprTrend = ['DV', 'CL', 'LK'].map(c => {
      const a = cnt(curCodes, c);
      const b = cnt(prevCodes, c);
      return `${c} ${b}→${a} ${a < b ? '↓' : a === b ? '→' : '↑'}`;
    }).join(' · ');
    const relapse = entries.filter(e => e.recurrence >= 2 && e.status !== '已消除')
      .sort((a, b) => b.recurrence - a.recurrence).slice(0, 2);
    ov.createEl('div', {
      text: `🎯 弱点 未消除 ${radar.unresolvedCount} · 表达码 ${exprTrend}${relapse.length ? ` · 复发：${relapse.map(e => `${e.topic}×${e.recurrence}`).join('、')}` : ''}`,
      cls: 'asc-row',
    });
    const unstable = terms.filter(t => t.status !== '已稳定').length;
    ov.createEl('div', { text: `📚 术语 待抽查 ${unstable} · 已稳定 ${terms.filter(t => t.status === '已稳定').length} · 共 ${terms.length}`, cls: 'asc-row' });
    ov.createEl('div', { text: `🎓 ${profile.stage} · 目标全 A* · 牛剑方向 ${profile.oxbridge.direction}`, cls: 'asc-row asc-muted' });

    // 4. 动作（一排小按钮，只留教练会话覆盖不了的独立功能；
    // 求助去「教练」页签，批改作文用命令面板「雅思：批改当前作文」）
    const actionsRow = el.createDiv({ cls: 'asc-row asc-home-actions' });
    actionsRow.createEl('button', { text: `🗣 表达抽查${dueExprs.length ? `（${dueExprs.length}）` : ''}`, cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => void this.plugin.startExpressionDrill());
    actionsRow.createEl('button', { text: '📚 术语抽查', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => void this.startDrill());
    actionsRow.createEl('button', { text: '📊 周报', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => void this.plugin.exportWeeklyReport());
    if (profile.oxbridge.enabled) {
      const ox = actionsRow.createEl('button', { text: '🧠 思维题', cls: 'asc-btn asc-btn-small' });
      ox.setAttr('title', oxbridgeGuidance(profile.stage, profile.oxbridge.direction));
      ox.addEventListener('click', () => void this.startOxbridgeSession());
    }
  }

  /** 术语抽查：未稳定+观察中抽 3 条 + 已稳定随机回抽 1 条（防假性掌握） */
  private async startDrill(): Promise<void> {
    if (!this.plugin.llm.configured) {
      new Notice('请先在设置里配置 LLM');
      return;
    }
    const all = await this.plugin.terms.load();
    const pool = all.filter(t => t.status !== '已稳定');
    if (!pool.length) {
      new Notice('术语清单为空——先在学习中添加术语（随手记或教练结题）');
      return;
    }
    const sampled = shuffle(pool).slice(0, 3);
    const stable = all.filter(t => t.status === '已稳定');
    if (stable.length) sampled.push(shuffle(stable)[0]); // 每周随机回抽，防假性掌握
    new DrillModal(this.app, this.plugin, sampled, () => this.render()).open();
  }

  /** 批改任务卡片：进行中（进度条+秒数+取消）/ 终态（结果摘要+打开笔记/关闭） */
  private renderGradingTask(el: HTMLElement): void {
    const task = this.plugin.gradingTask;
    if (this.taskTicker !== null) {
      window.clearInterval(this.taskTicker);
      this.taskTicker = null;
    }
    if (!task) return;

    const card = el.createDiv({ cls: 'asc-card asc-grading-card' });
    if (task.status === 'running') {
      card.scrollIntoView({ block: 'nearest' });
      const label = card.createEl('div', { cls: 'asc-card-title' });
      const setText = () => label.setText(`🕐 正在批改：${task.basename} · 已等待 ${this.plugin.gradingTask?.elapsed ?? 0} 秒（含图片通常 1–4 分钟）——可以先切走干别的，回来看结果`);
      setText();
      card.createDiv({ cls: 'asc-progress' }).createDiv({ cls: 'asc-progress-bar' });
      card.createDiv({ cls: 'asc-row' })
        .createEl('button', { text: '取消批改', cls: 'asc-btn asc-btn-small' })
        .addEventListener('click', () => this.plugin.cancelGrading());
      this.taskTicker = window.setInterval(() => {
        if (this.plugin.gradingTask?.status === 'running') setText();
        else if (this.taskTicker !== null) { window.clearInterval(this.taskTicker); this.taskTicker = null; }
      }, 1000);
    } else {
      const icon = { success: '✅', cancelled: '⏹', timeout: '⏱', failed: '❌' }[task.status];
      card.createEl('div', { text: `${icon} 批改${task.status === 'success' ? '成功' : task.status === 'cancelled' ? '已取消' : task.status === 'timeout' ? '超时' : '失败'}：${task.basename}`, cls: 'asc-card-title' });
      card.createEl('div', { text: task.message, cls: 'asc-row asc-muted' });
      const btns = card.createDiv({ cls: 'asc-row' });
      if (task.status === 'success') {
        btns.createEl('button', { text: '打开批改后的笔记', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', () => this.openFile(task.path));
      }
      btns.createEl('button', { text: '关闭', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => {
        this.plugin.gradingTask = null;
        this.render();
      });
    }
  }

  // ─── 教练 ────────────────────────────────────────────────
  private async renderCoach(): Promise<void> {
    const el = this.bodyEl;

    const bar = el.createDiv({ cls: 'asc-coach-bar' });
    const select = bar.createEl('select', { cls: 'asc-select asc-subject-select' });
    for (const s of SUBJECTS) {
      // option 用全名：展开下拉时可见全名；收起时由 CSS 宽度截断为前几个字
      select.createEl('option', { text: s.label, value: s.key });
    }
    select.value = this.mode;
    select.setAttr('title', SUBJECTS.find(s => s.key === this.mode)?.label ?? '');
    select.addEventListener('change', () => {
      const target = select.value as ModeKey;
      select.setAttr('title', SUBJECTS.find(s => s.key === target)?.label ?? '');
      // 会话按科目隔离：切科目 = 存当前会话 → 恢复目标科目会话（无则新开）
      void this.switchMode(target).then(ok => {
        if (!ok) select.value = this.mode; // 切换被拒（回复中）：下拉回退
      });
    });

    // 图片识别进度卡片（有才显示，后台任务不阻塞操作）
    this.renderImgRecTask(el);

    // 当前科目无未结束会话 → 自动新开会话（无需点按钮；无交互则不会被记录）
    if (!this.systemPrompt && !this.startingSession) {
      this.startingSession = true;
      void this.startSession(true).finally(() => { this.startingSession = false; });
    }

    // 会话生命周期按钮：会话始终自动存在，按钮只剩「结题」
    if (this.systemPrompt) {
      const sessionBtn = bar.createEl('button', { text: '✓ 结题', cls: 'asc-btn' });
      sessionBtn.setAttr('title', '结束当前题：走结题流程（自评/审查/log 行/会话打标），完成后自动开新会话');
      sessionBtn.addEventListener('click', () => {
        this.pendingClose = true; // 结题回复完成后自动存档并关闭会话
        void this.send(CLOSE_PROMPT);
      });
    }
    // 文字小按钮代替易混淆的图标（历史≠计时）
    const textBtn = (label: string, title: string, onClick: () => void) => {
      const b = bar.createEl('button', { text: label, cls: 'asc-btn asc-btn-small' });
      b.setAttr('title', title);
      b.addEventListener('click', onClick);
    };
    textBtn('存档', '把当前会话存档到笔记', () => void this.archiveIfNeeded(true));
    textBtn('历史', '加载历史会话继续聊', () => this.openHistory());
    textBtn('文档', '引用文档（全会话上下文）', () => this.openAttachPicker());
    textBtn('计时', this.systemPrompt ? '独立思考计时（到时间才允许求助）' : '独立思考计时（先开会话）', () => void this.startTimer());

    if (this.timerDeadline > Date.now()) {
      const cd = el.createDiv({ cls: 'asc-timer' });
      cd.setText(`⏱ 独立思考中，距求助门槛还有 ${fmtRemain(this.timerDeadline - Date.now())}——卡住本身就是训练内容`);
      if (this.timerInterval === null) {
        this.timerInterval = window.setInterval(() => {
          if (this.timerDeadline <= Date.now()) {
            if (this.timerInterval !== null) { window.clearInterval(this.timerInterval); this.timerInterval = null; }
            this.thinkCredit = this.timerMinutes;
            new Notice(`⏱ ${this.timerMinutes} 分钟独立思考完成，下一条消息会带上思考凭证`);
            this.render();
          } else {
            cd.setText(`⏱ 独立思考中，距求助门槛还有 ${fmtRemain(this.timerDeadline - Date.now())}——卡住本身就是训练内容`);
          }
        }, 1000);
      }
    } else if (this.thinkCredit > 0) {
      el.createDiv({ cls: 'asc-timer' }).setText(`✓ 已完成 ${this.thinkCredit} 分钟独立思考，下一条消息会自动标注给教练`);
    }

    if (this.attachments.length) {
      const chips = el.createDiv({ cls: 'asc-chips' });
      for (const a of this.attachments) {
        const chip = chips.createSpan({ cls: 'asc-chip', text: `📎 ${a.name}` });
        chip.createSpan({ text: ' ✕', cls: 'asc-chip-x' }).addEventListener('click', () => {
          this.attachments = this.attachments.filter(x => x.path !== a.path);
          void this.rebuildSystemPrompt().then(() => this.render());
        });
      }
    }

    if (this.sessionSummary) {
      el.createDiv({ text: `已注入：${this.sessionSummary}`, cls: 'asc-summary' });
    }

    const chatEl = el.createDiv({ cls: 'asc-chat' });
    if (this.messages.length === 0) {
      chatEl.createDiv({ text: this.systemPrompt ? '会话已开始，把题目或问题发过来。' : '正在开启会话…', cls: 'asc-empty' });
    }
    for (const m of this.messages) {
      const bubble = chatEl.createDiv({ cls: 'asc-msg asc-msg-' + m.role });
      // 展示时剥离机器用 JSON 块（ieltsResult/sessionTag），交互由下方入库卡片承担
      const display = m.role === 'assistant' ? stripMachineBlocks(m.content) : m.content;
      void MarkdownRenderer.render(this.app, display, bubble, '', this.plugin);
      if (m.role === 'assistant' && m === this.messages[this.messages.length - 1]) {
        if (this.mode === 'ielts') this.renderIeltsResultPrompt(bubble, m.content);
        else if (this.mode === 'speaking') this.renderSpeakingCards(bubble, m.content);
        else this.renderLogRowPrompt(bubble);
        this.renderWrongAnswerPrompt(bubble, m.content);
        this.renderConceptMapPrompt(bubble, m.content);
      }
    }
    chatEl.scrollTop = chatEl.scrollHeight;

    // 待发送图片条（IM 风格：紧贴输入框上方）
    if (this.pendingImages.length) {
      const chips = el.createDiv({ cls: 'asc-chips asc-img-chips' });
      for (const p of this.pendingImages) {
        const name = p.split('/').pop() ?? p;
        const chip = chips.createSpan({ cls: 'asc-chip', text: `🖼 ${name}` });
        chip.createSpan({ text: ' ✕', cls: 'asc-chip-x' }).addEventListener('click', () => {
          this.pendingImages = this.pendingImages.filter(x => x !== p);
          this.render();
        });
      }
    }

    // IM 风格发送框：textarea 占满，底栏左侧图标 + 快捷键提示 + 右侧发送
    const inputBar = el.createDiv({ cls: 'asc-input-bar' });
    const input = inputBar.createEl('textarea', { attr: { rows: '2', placeholder: this.systemPrompt ? '把题目原文发过来……' : '正在开启会话…' } });
    const actions = inputBar.createDiv({ cls: 'asc-input-actions' });
    // 附加图片（随下一条消息发送）
    const imgBtn = actions.createEl('button', { text: '🖼', cls: 'asc-btn asc-btn-icon' });
    imgBtn.setAttr('title', '附加图片（随下一条消息发送，可多选）');
    imgBtn.addEventListener('click', () =>
      new ImagePickerModal(this.app, this.pendingImages, f => {
        this.pendingImages.push(f.path);
        this.render();
      }).open(),
    );
    // 口语 + 语音：TTS 播报中显示停止按钮（🎤 按钮在快捷键提示后创建，复用 hintEl 显示状态）
    if (this.mode === 'speaking' && this.ttsPlaying) {
      const stopBtn = actions.createEl('button', { text: '⏹ 停止播报', cls: 'asc-btn asc-btn-small' });
      stopBtn.addEventListener('click', () => this.stopTts());
    }
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const hintEl = actions.createSpan({ text: `${isMac ? '⌘' : 'Ctrl'}↩ 发送`, cls: 'asc-input-hint' });
    const HINT_DEFAULT = hintEl.getText();
    // 口语 + 语音：🎤 按住说话（松开识别并自动发送）
    if (this.mode === 'speaking') {
      const micBtn = actions.createEl('button', { text: '🎤', cls: 'asc-btn asc-btn-icon' });
      const ready = await this.plugin.voiceReady();
      micBtn.setAttr('title', ready ? '按住说话，松开识别并发送' : '语音未配置：设置 → 语音训练（当前为文字模式）');
      micBtn.disabled = !ready || this.busy;
      micBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (this.recording || this.busy || !ready) return;
        void (async () => {
          try {
            const rec = new AudioRecorder();
            await rec.start();
            this.recorder = rec;
            this.recording = true;
            micBtn.setText('⏺');
            hintEl.setText('🎤 录音中…松开发送');
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            void this.voiceLog('ERROR', '录音启动', msg);
            new Notice(`录音启动失败：${msg}（请检查麦克风权限）`, 8000);
          }
        })();
      });
      const stopVoice = (): void => {
        if (!this.recording || !this.recorder) return;
        this.recording = false;
        const rec = this.recorder;
        this.recorder = null;
        micBtn.setText('🎤');
        hintEl.setText('识别中…');
        void (async () => {
          try {
            const vcfg = await this.plugin.loadVoiceConfig();
            const res = await rec.stop();
            void this.voiceLog('INFO', '录音完成', `${res.seconds.toFixed(1)} 秒 · PCM ${(res.pcm.length * 2 / 1024).toFixed(0)} KB · appKey=${vcfg.aliyunAppKey ? '已配置' : '空'}`);
            if (vcfg.saveRecordings) void this.saveRecording(res.wav);
            if (res.seconds < 0.5) {
              hintEl.setText(HINT_DEFAULT);
              void this.voiceLog('WARN', '录音过短', `${res.seconds.toFixed(2)} 秒，已拦截`);
              new Notice('录音太短，请按住说话后再松开');
              return;
            }
            const token = await this.plugin.getNlsToken();
            const text = await aliyunAsr(res.pcm.buffer as ArrayBuffer, {
              token, appKey: vcfg.aliyunAppKey,
              onLog: (s, d) => void this.voiceLog('INFO', s, d),
            });
            hintEl.setText(HINT_DEFAULT);
            if (!text.trim()) {
              void this.voiceLog('WARN', '识别为空', `音频 ${res.seconds.toFixed(1)} 秒但无识别结果（检查麦克风音量/环境）`);
              new Notice('未识别到内容，请再试一次');
              return;
            }
            void this.voiceLog('INFO', '识别成功', `${text.length} 字`);
            input.value = text;
            doSend();
          } catch (err) {
            hintEl.setText(HINT_DEFAULT);
            const msg = err instanceof Error ? err.message : String(err);
            void this.voiceLog('ERROR', '语音失败', msg);
            new Notice(`语音失败：${msg}（详见 雅思/口语/语音日志.md）`, 8000);
          }
        })();
      };
      micBtn.addEventListener('pointerup', stopVoice);
      micBtn.addEventListener('pointerleave', stopVoice);
    }
    const sendBtn = actions.createEl('button', { text: this.busy ? '回复中…' : '发送', cls: 'asc-btn asc-btn-cta' });
    sendBtn.disabled = this.busy || !this.systemPrompt || this.timerDeadline > Date.now();
    const doSend = () => {
      const text = input.value.trim();
      if (!text || this.busy || !this.systemPrompt) return;
      if (this.timerDeadline > Date.now()) {
        new Notice(`⏱ 还没到求助时间（剩 ${fmtRemain(this.timerDeadline - Date.now())}）`);
        return;
      }
      input.value = '';
      void this.send(text);
    };
    sendBtn.addEventListener('click', doSend);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); doSend(); }
    });

    // 上下文指示（Qoder 风格：用量/百分比 + 阈值超限变红提示强制压缩）
    const ctxRow = el.createDiv({ cls: 'asc-ctx-row' });
    const ctx = this.contextTokens();
    const win = this.plugin.settings.contextWindow;
    const limit = this.compressLimit();
    const over = ctx > limit;
    const pct = win > 0 ? Math.round((ctx / win) * 100) : 0;
    const ctxEl = ctxRow.createSpan({
      text: `已用上下文 ${formatTokens(ctx)} / ${formatTokens(win)}（${pct}%）${over ? ' ⚠ 已超压缩阈值' : ''}`,
      cls: 'asc-ctx' + (over ? ' asc-ctx-warn' : ''),
    });
    ctxEl.setAttr('title', `超过 ${this.plugin.settings.compressThreshold}% 阈值（≈${formatTokens(limit)}）时发送前自动压缩，可在设置中调节`);
    const compressBtn = ctxRow.createEl('button', {
      text: this.compressing ? '压缩中…' : over ? '强制压缩' : '压缩',
      cls: 'asc-btn asc-btn-small' + (over ? ' asc-btn-danger' : ''),
    });
    compressBtn.disabled = this.compressing;
    compressBtn.setAttr('title', this.compressing ? '正在压缩，请稍候' : '把较早对话压缩为摘要，保留最近几轮（需几秒）');
    compressBtn.addEventListener('click', () => void this.compressContext(true));
  }

  /** 进阶角思维题：数学会话 + 自动启动独立思考计时（提示词的思维题分支） */
  private async startOxbridgeSession(): Promise<void> {
    this.tab = 'coach';
    this.saveCurrentSlot();
    this.mode = 'Maths';
    await this.startSession();
    await this.startTimer();
    new Notice('进阶角：把思维题/估算题原文发过来——先独立想满门槛，卡住本身就是训练');
  }

  /** 独立思考计时器：会话内能力，按档案门槛倒计时；跑满后给下一条消息带思考凭证 */
  private async startTimer(): Promise<void> {
    if (!this.systemPrompt) {
      new Notice('先点「新会话」开始——独立思考计时只在会话内有意义（针对你正在做的题）');
      return;
    }
    if (this.timerDeadline > Date.now()) {
      new Notice(`⏱ 已在计时，剩 ${fmtRemain(this.timerDeadline - Date.now())}`);
      return;
    }
    const profile = await this.plugin.profiles.load();
    const minutes = profile.independent_minutes || 15;
    this.timerMinutes = minutes;
    this.timerDeadline = Date.now() + minutes * 60000;
    new Notice(`⏱ 开始独立思考，${minutes} 分钟内不能求助——先把试过的方向都列出来`);
    this.render();
  }

  /** 当前上下文估算 token：system + 消息历史 */
  private contextTokens(): number {
    let t = estimateTokens(this.systemPrompt);
    for (const m of this.messages) t += estimateTokens(m.content);
    return t;
  }

  /** 自动压缩阈值对应的 token 数（按设置百分比） */
  private compressLimit(): number {
    return this.plugin.settings.contextWindow * (this.plugin.settings.compressThreshold / 100);
  }

  private async compressContext(manual: boolean): Promise<void> {
    if (this.busy || this.compressing) return;
    if (!ContextCompressor.shouldCompress(this.messages)) {
      if (manual) new Notice('对话还短，不需要压缩');
      return;
    }
    if (!manual && this.contextTokens() <= this.compressLimit()) return;
    if (!this.plugin.llm.configured) {
      new Notice('请先在设置里配置 LLM');
      return;
    }
    this.compressing = true;
    this.busy = true;
    this.render();
    new Notice(manual ? '正在压缩上下文（总结较早对话，需几秒，请稍候）…' : '上下文已超过阈值，正在自动压缩（需几秒，请稍候）…', 6000);
    try {
      const before = this.contextTokens();
      const r = await ContextCompressor.compress(this.messages, this.plugin.llm);
      this.messages = r.messages;
      new Notice(`✓ 上下文已压缩：≈${formatTokens(before)} → ≈${formatTokens(this.contextTokens())} token`);
    } catch (e) {
      new Notice(`压缩失败：${e instanceof Error ? e.message : String(e)}`, 8000);
    } finally {
      this.compressing = false;
      this.busy = false;
      this.render();
    }
  }

  private async startSession(autoOpen = true): Promise<void> {
    if (!this.plugin.llm.configured) {
      new Notice('请先在设置里配置 LLM（接口类型 / Base URL / Key / 模型）');
      return;
    }
    // 防漏数据：开新会话前先把上一轮的未存档内容落盘；新题新计时，取消旧计时与凭证
    await this.archiveIfNeeded(false);
    this.timerDeadline = 0;
    this.thinkCredit = 0;
    await this.rebuildSystemPrompt();
    if (!this.systemPrompt) return;
    this.sessionId = `${todayStr()}-${timeStr()}`;
    this.savedCount = 0;
    this.messages = [];
    this.sessionTagged = false;
    this.render();
    // 自动开场：直接本地展示提示词里的开场内容，不请求模型（学生第一次输入后才请求）；
    // 开场作为 assistant 消息进历史，模型后续回复能看到自己给过的菜单/问题
    if (autoOpen) {
      const opening = await this.openingText();
      if (opening) {
        this.messages.push({ role: 'assistant', content: opening });
        this.render();
      }
    }
  }

  /** 从当前科目的提示词模板提取开场白：优先 ```opening 围栏（学生可见原文，不混入给 AI 的指令） */
  private async openingText(): Promise<string> {
    const meta = this.plugin.assembler.meta(this.mode);
    if (!meta) return '';
    const c = await this.plugin.vaultService.read(`${ROOT}/prompts/${meta.promptFile}`);
    if (!c) return '';
    const fence = c.match(/```opening\n([\s\S]*?)```/);
    if (fence) return fence[1].trim();
    // 兜底：整个「开场」小节（旧格式兼容）
    const lines = c.split(/\r?\n/);
    const start = lines.findIndex(l => /^#\s*开场/.test(l));
    if (start < 0) return '';
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (/^#\s/.test(lines[i]) || lines[i].startsWith('════')) { end = i; break; }
    }
    return lines.slice(start + 1, end).join('\n').trim();
  }

  /** 组装 System Prompt（模板 + 档案 + 未消除 log + 进展 + 引用文档） */
  private async rebuildSystemPrompt(): Promise<void> {
    const extras: string[] = [];
    // 未订正错题跟进（错题本台账）：让教练遇到相关题目时顺势让学生重做
    const openWas = await this.plugin.wrongAnswers.open();
    if (openWas.length) {
      const lines = openWas.map(w => `- 【${w.subject}】${w.topic}：${w.myError || '（未记错误描述）'}（错因码 ${w.code || '-'}）`);
      extras.push(
        '════════ 插件注入：未订正的错题（来自错题本）════════\n' + lines.join('\n') +
        '\n使用方式：学生来问相关题目/考点时，先让他自己重做一遍这些错题再讨论；不主动占用会话时间逐一清算。',
      );
    }
    // 概念地图预习概念（仅概念精练）：以后学到时转详细掌握
    if (this.mode === 'drill') {
      const previews = await this.plugin.conceptMap.pendingDetail();
      if (previews.length) {
        const plines = previews.map(p => `- 【${p.subject}】${p.chapter}：${p.concept}（${p.status}）`);
        extras.push(
          '════════ 插件注入：概念地图中的预习概念（尚未详细学习）════════\n' + plines.join('\n') +
          '\n使用方式：学生练到这些概念时是首次详细掌握，可从 A/B 正常练；练完让他确认「把 X 改为已学」。',
        );
      }
    }
    // 解锁章节（章节进度台账）：当前科目（经济/化学/物理）聚焦的章节与术语
    const subject = this.mode === 'drill' ? 'Economics' : this.mode;
    if (subject === 'Economics' || subject === 'Chemistry' || subject === 'Physics') {
      const unlocked = await this.plugin.chapters.unlocked(subject);
      if (unlocked.length) {
        const blocks: string[] = [];
        let size = 0;
        for (const ch of unlocked) {
          const c = await this.plugin.vaultService.read(ch.file);
          const terms = c ? ChapterProgressService.parseTerms(c) : [];
          const tlines = terms.map(t => `  - ${t.term}: ${t.def}`).join('\n');
          const block = `【${ch.chapter}】${ch.status === '已掌握' ? '（已掌握，可抽查复习）' : '（解锁学习中）'}\n${tlines || '（内容文件暂无术语表）'}`;
          if (size + block.length > 6000) break; // 注入限量，避免占用上下文
          size += block.length;
          blocks.push(block);
        }
        const subjCn = subject === 'Economics' ? '经济' : subject === 'Chemistry' ? '化学' : '物理';
        extras.push(
          `════════ 插件注入：已解锁的${subjCn}章节（章节进度）════════\n` + blocks.join('\n') +
          '\n使用方式：这些章节是当前学习与复习的聚焦范围；定义为 syllabus 口径，学生提供课本原文时以课本为准；未解锁章节不主动训练。',
        );
      }
    }
    for (const a of this.attachments) {
      const c = await this.plugin.vaultService.read(a.path);
      if (c) {
        // 图片 embed 换成标记，真实图片随下一条消息发送（见 openAttachPicker）
        const marked = this.plugin.ielts.markImagesInText(c);
        const truncated = marked.length > 20000 ? marked.slice(0, 20000) + '\n……（内容过长已截断）' : marked;
        extras.push(`════════ 插件注入：参考文档「${a.name}」════════\n以下是学生指定的参考文档，讨论时以它为准（[图片: 名] 标记对应的图片会随消息发送）：\n${truncated}`);
      }
    }
    const built = await this.plugin.assembler.buildSystemPrompt(this.mode, extras);
    if (!built) {
      new Notice(`找不到提示词模板 ${ROOT}/prompts/，请检查 vault 初始化`);
      return;
    }
    this.systemPrompt = built.prompt;
    this.sessionSummary = built.summary;
  }

  private async send(text: string): Promise<void> {
    if (!this.systemPrompt || this.busy) return;
    if (this.timerDeadline > Date.now()) {
      new Notice(`⏱ 还没到求助时间（剩 ${fmtRemain(this.timerDeadline - Date.now())}）。提示词约定：先独立思考满门槛再求助。`);
      return;
    }
    // 自动压缩：发送前超过 80% 窗口时先压缩历史
    await this.compressContext(false);
    // 思考凭证：计时跑满后的第一条消息带上标注，供教练按思维题模式验证
    const content = this.thinkCredit > 0 ? text + thinkAnnotation(this.thinkCredit) : text;
    this.thinkCredit = 0;

    // 图片：消息内 ![[x.png]] embed + 待发送附加图片；失败不阻塞文本发送
    let msgText = content;
    const images: ImagePart[] = [];
    try {
      const ext = await this.plugin.ielts.extractTextImages(content);
      msgText = ext.text;
      images.push(...ext.images);
      if (this.pendingImages.length) {
        images.push(...(await this.plugin.ielts.loadImageParts(this.pendingImages)));
        this.pendingImages = [];
      }
    } catch {
      // 图片加载失败不阻塞文本发送
    }

    // 超过单次上限（4 张）：自动分段识别，逐段进度可见，失败可从中断处重试
    if (images.length > 4) {
      const batches = [] as { parts: ImagePart[]; status: 'pending' | 'running' | 'done' | 'failed'; result?: string; error?: string }[];
      for (let i = 0; i < images.length; i += 4) {
        batches.push({ parts: images.slice(i, i + 4), status: 'pending' });
      }
      this.imgRecTask = { batches, msgText, status: 'running', startedAt: Date.now() };
      this.busy = true;
      this.render();
      void this.runImgRec();
      return;
    }

    await this.doSendCore(msgText, images.slice(0, 4));
  }

  /** 实际发送（流式回复、结题钩子、副作用处理） */
  private async doSendCore(msgText: string, images: ImagePart[]): Promise<void> {
    this.messages.push({ role: 'user', content: msgText, images: images.length ? images : undefined });
    this.busy = true;
    this.render();

    // 流式气泡：首字符前显示带秒数的等待指示，收到增量后切换为流式光标，完成后渲染 markdown
    const chatEl = this.bodyEl.querySelector('.asc-chat');
    let bubble: HTMLElement | null = null;
    if (chatEl) {
      bubble = chatEl.createDiv({ cls: 'asc-msg asc-msg-assistant' });
      bubble.setText('正在等待模型响应… ⏳');
    }
    const startedAt = Date.now();
    let waiting = true;
    const waitTicker = window.setInterval(() => {
      if (waiting && bubble) {
        bubble.setText(`正在等待模型响应… ${Math.round((Date.now() - startedAt) / 1000)} 秒（带图片/长作文时较慢，属正常）`);
      }
    }, 1000);

    let raw = '';
    let deltas = 0;
    let lastPaint = 0;
    try {
      for await (const ev of this.plugin.llm.chatStream({
        system: this.systemPrompt,
        messages: this.messages,
        maxTokens: 4096,
      })) {
        if (ev.type === 'text_delta') {
          if (waiting) {
            waiting = false;
            window.clearInterval(waitTicker);
          }
          raw += ev.text;
          deltas++;
          const now = Date.now();
          if (bubble && chatEl && now - lastPaint > 50) {
            bubble.setText(raw + '▍');
            chatEl.scrollTop = chatEl.scrollHeight;
            lastPaint = now;
          }
        } else if (ev.type === 'error') {
          throw new Error(ev.message);
        }
      }
      // 提供商不支持流式（忽略 stream:true 一次性返回）时自动降级，保证回复必达
      if (!raw.trim() && deltas === 0) {
        if (bubble) bubble.setText('（该接口未返回流式增量，改用整块请求…）');
        raw = await this.plugin.llm.chat({
          system: this.systemPrompt,
          messages: this.messages,
          maxTokens: 4096,
        });
      }
      if (!raw.trim()) throw new Error('模型返回内容为空');
      console.log(`[StudyCoach] 回复完成：${deltas} 个流式增量块，共 ${raw.length} 字${deltas <= 1 ? '（未检测到流式增量：提供商可能不支持流式，已自动降级为整块请求）' : ''}`);
      this.messages.push({ role: 'assistant', content: raw });
      // 结题回复完成：存档并关闭会话（下次切回本科目将新开会话）
      if (this.pendingClose) {
        this.pendingClose = false;
        await this.closeSession();
        return;
      }
      await this.handleReplySideEffects(raw);
      // 口语 + 语音已配置：考官回复自动播报（可随时打断；失败不影响文字流）
      if (this.mode === 'speaking' && (await this.plugin.voiceReady())) {
        const vcfg = await this.plugin.loadVoiceConfig();
        if (vcfg.autoPlayTts) void this.playReplyTts(raw);
      }
    } catch (e) {
      new Notice(`请求失败：${e instanceof Error ? e.message : String(e)}`, 10000);
      this.messages.pop(); // 撤回未成功的用户消息，方便重试
      this.pendingClose = false;
    } finally {
      waiting = false;
      window.clearInterval(waitTicker);
      this.busy = false;
      this.render();
    }
  }

  // ─── 图片分段识别（>4 张自动分段，进度卡片 + 断点重试）────────────

  /** 从首个 pending 批次开始识别；全部完成后把识别结果并入原消息发送 */
  private async runImgRec(): Promise<void> {
    const task = this.imgRecTask;
    if (!task) return;
    task.status = 'running';
    if (this.imgRecTicker === null) {
      this.imgRecTicker = window.setInterval(() => this.render(), 1000);
    }
    this.render();
    for (const b of task.batches) {
      if (b.status === 'done') continue;
      b.status = 'running';
      this.render();
      try {
        b.result = await this.recognizeBatch(b.parts);
        b.status = 'done';
        this.render();
      } catch (e) {
        b.status = 'failed';
        b.error = e instanceof Error && e.message === 'aborted' ? '超时（单段上限 120 秒）' : (e instanceof Error ? e.message : String(e));
        task.status = 'failed';
        this.stopImgRecTicker();
        this.busy = false;
        this.render();
        new Notice('图片识别失败：可在进度卡片上从中断处重试', 6000);
        return;
      }
    }
    // 全部完成：识别结果并入原消息，以纯文本发送（内容已进会话记录）
    this.stopImgRecTicker();
    this.imgRecTask = null;
    const blocks = task.batches
      .map((b, i) => `【图片识别 ${i + 1}：${b.parts.map(p => p.name).join('、')}】\n${b.result ?? ''}`)
      .join('\n\n');
    await this.doSendCore(`${task.msgText}\n\n（以下 ${task.batches.length} 段为附件图片的自动识别转录）\n${blocks}`, []);
  }

  /** 单批识别请求（≤4 张），120 秒超时 */
  private async recognizeBatch(parts: ImagePart[]): Promise<string> {
    const ac = new AbortController();
    const timer = window.setTimeout(() => ac.abort(), 120000);
    try {
      return await this.plugin.llm.chat({
        messages: [{ role: 'user', content: '请完整转录这些图片里的文字内容（题目、板书、图表数据等）；数学公式用 LaTeX；没有文字就简述图片内容。只输出转录，不要解题。', images: parts }],
        maxTokens: 2000,
        signal: ac.signal,
      });
    } finally {
      window.clearTimeout(timer);
    }
  }

  private stopImgRecTicker(): void {
    if (this.imgRecTicker !== null) {
      window.clearInterval(this.imgRecTicker);
      this.imgRecTicker = null;
    }
  }

  /** 图片识别进度卡片：正常等待有秒数，失败可从断点重试 */
  private renderImgRecTask(el: HTMLElement): void {
    const task = this.imgRecTask;
    if (!task) return;
    const card = el.createDiv({ cls: 'asc-card asc-grading-card' });
    const secs = Math.round((Date.now() - task.startedAt) / 1000);
    const done = task.batches.filter(b => b.status === 'done').length;
    card.createEl('div', {
      text: `🖼 图片识别：第 ${Math.min(done + 1, task.batches.length)}/${task.batches.length} 段 · 已用时 ${secs} 秒${task.status === 'failed' ? ' · 已中断' : ''}`,
      cls: 'asc-card-title',
    });
    task.batches.forEach((b, i) => {
      const label = `第 ${i + 1} 段（${b.parts.length} 张：${b.parts.map(p => p.name).join('、')}）`;
      if (b.status === 'done') card.createEl('div', { text: `✓ ${label}：识别完成（${(b.result ?? '').length} 字）`, cls: 'asc-row' });
      else if (b.status === 'running') card.createEl('div', { text: `⏳ ${label}：识别中…（单段超时上限 120 秒，属正常等待）`, cls: 'asc-row' });
      else if (b.status === 'failed') card.createEl('div', { text: `❌ ${label}：${b.error ?? '失败'}`, cls: 'asc-row asc-ctx-warn' });
      else card.createEl('div', { text: `… ${label}：待处理`, cls: 'asc-row asc-muted' });
    });
    const btns = card.createDiv({ cls: 'asc-row' });
    if (task.status === 'failed') {
      btns.createEl('button', { text: '从中断处重试', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', () => {
        this.busy = true;
        void this.runImgRec();
      });
      btns.createEl('button', { text: '取消识别', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => {
        this.stopImgRecTicker();
        this.imgRecTask = null;
        this.busy = false;
        new Notice('已取消图片识别，原消息未发送');
        this.render();
      });
    }
  }

  /** 把当前未结束的会话存入当前科目槽（切走前调用；无交互的不存，切回时直接新开） */
  private saveCurrentSlot(): void {
    if (this.systemPrompt && this.messages.length && this.messages.some(m => m.role === 'user')) {
      this.slots[this.mode] = {
        sessionId: this.sessionId,
        messages: this.messages,
        savedCount: this.savedCount,
        sessionTagged: this.sessionTagged,
      };
    }
  }

  /** 切换科目：当前会话存入原科目槽，目标科目有未结束会话则恢复，否则新开 */
  private async switchMode(newMode: ModeKey): Promise<boolean> {
    const oldMode = this.mode;
    if (newMode === oldMode) return true;
    if (this.busy) {
      new Notice('等当前回复完成再切换科目');
      return false;
    }
    this.saveCurrentSlot();
    this.mode = newMode;
    this.plugin.settings.lastCoachMode = newMode;
    await this.plugin.saveSettings();
    const slot = this.slots[newMode];
    if (slot) {
      // 恢复该科目未结束的会话
      delete this.slots[newMode];
      this.sessionId = slot.sessionId;
      this.messages = slot.messages;
      this.savedCount = slot.savedCount;
      this.sessionTagged = slot.sessionTagged;
      await this.rebuildSystemPrompt();
      this.render();
    } else {
      // 无未结束会话（从未开过或都已结题）→ 新开会话（含本地开场）
      await this.startSession(true);
    }
    return true;
  }

  /** 结题后关闭会话：存档 + 清空状态（历史可通过「历史」按钮找回） */
  private async closeSession(): Promise<void> {
    await this.archiveIfNeeded(true);
    this.systemPrompt = '';
    this.messages = [];
    this.savedCount = 0;
    this.sessionTagged = false;
    this.attachments = [];
    this.pendingImages = [];
    this.sessionSummary = '';
    delete this.slots[this.mode];
    new Notice('已结题：会话已存档并关闭');
    // 自动续开新会话（无需手动点按钮）
    await this.startSession(true);
  }

  /** 回复的副作用：会话打标 → 提问记录；log 行 → 一键入库确认 */
  private async handleReplySideEffects(reply: string): Promise<void> {
    // 1. 会话标签（同一会话只记一次，取最后一次出现的标签）
    if (!this.sessionTagged) {
      const parsed = extractJson<{ sessionTag?: Partial<SessionTag> }>(reply);
      const tag = parsed?.sessionTag;
      if (tag && tag.topic) {
        this.sessionTagged = true;
        await this.plugin.questionLog.appendTag({
          date: todayStr(),
          subject: tag.subject ?? String(this.mode),
          topic: tag.topic,
          confusion: tag.confusion ?? '其他',
          depth: tag.depth ?? '问一句就懂',
        });
      }
    }
    // 2. 入库确认在渲染时处理（renderCoach → renderLogRowPrompt）
  }

  /** 渲染最近一条 assistant 回复里解析出的候选 log 行的入库确认条 */
  private renderLogRowPrompt(parent: HTMLElement): void {
    const last = [...this.messages].reverse().find(m => m.role === 'assistant');
    if (!last) return;
    const rows = this.plugin.errorLog.parseAiRows(last.content);
    if (!rows.length) return;

    const bar = parent.createDiv({ cls: 'asc-logbar' });
    bar.createSpan({ text: `检测到 ${rows.length} 条 log 行：` });
    for (const r of rows) {
      bar.createEl('div', { text: `【${r.subject}】${r.topic} · ${r.code} · ${r.desc ?? ''}`, cls: 'asc-logrow' });
    }
    const btns = bar.createDiv();
    btns.createEl('button', { text: '一键入库', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', async ev => {
      (ev.target as HTMLElement).setAttr('disabled', 'true');
      let ok = 0;
      for (const r of rows) {
        try {
          const res = await this.plugin.errorLog.addEntry(r);
          if (res) ok++;
        } catch (e) {
          new Notice(`入库失败：${e instanceof Error ? e.message : String(e)}`, 8000);
          break;
        }
      }
      new Notice(`已入库 ${ok} 条（复发条目自动 +1 并顺延复查日期）`);
      void this.plugin.refreshStatusBar();
      bar.remove();
    });
    btns.createEl('button', { text: '忽略', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => bar.remove());
  }

  /** 教练雅思会话：检测回复里的批改结果 JSON → 确认卡片，分数进台账、表达进积累库 */
  private renderIeltsResultPrompt(parent: HTMLElement, reply: string): void {
    const parsed = parseIeltsResult(reply);
    const s = parsed.scores;
    if (s.overall === null) return;

    const bar = parent.createDiv({ cls: 'asc-logbar' });
    const fmt = (v: number | null) => (v === null ? '-' : String(v));
    // 来源：有引用文档则精确到 vault 文档路径，否则才是「教练会话」（直接贴作文时）
    const source = this.attachments.length ? this.attachments[this.attachments.length - 1].path : '教练会话';
    bar.createSpan({
      text: `检测到批改结果：总分 ${fmt(s.overall)}（TR ${fmt(s.tr)} / CC ${fmt(s.cc)} / LR ${fmt(s.lr)} / GRA ${fmt(s.gra)}）· ${parsed.expressions.length} 条高分表达`,
    });
    bar.createEl('div', {
      text: `来源：${source}${this.attachments.length ? '（最近引用的文档）' : '（未引用文档，作文直接贴在对话里）'}`,
      cls: 'asc-logrow',
    });
    const btns = bar.createDiv();
    btns.createEl('button', { text: '入库分数与表达', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', async ev => {
      (ev.target as HTMLElement).setAttr('disabled', 'true');
      try {
        await this.plugin.ielts.registerGrade(s, source);
        const added = parsed.expressions.length
          ? await this.plugin.expressions.appendAll(parsed.expressions, `教练会话-${todayStr()}`)
          : 0;
        new Notice(`已入库：分数进批改记录（趋势可见）${added ? `，${added} 条表达进积累库` : ''}`);
        bar.remove();
      } catch (e) {
        new Notice(`入库失败：${e instanceof Error ? e.message : String(e)}`, 8000);
        (ev.target as HTMLElement).removeAttribute('disabled');
      }
    });
    btns.createEl('button', { text: '忽略', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => bar.remove());
  }

  /** 订正会话：检测回复里的错题 JSON → 确认卡片，入错题本台账 */
  private renderWrongAnswerPrompt(parent: HTMLElement, reply: string): void {
    const parsed = extractJson<{ wrongAnswer?: Partial<{ subject: string; topic: string; myError: string; code: string; answerSource: string; status: string }> }>(reply);
    const w = parsed?.wrongAnswer;
    if (!w || !w.topic) return;

    const bar = parent.createDiv({ cls: 'asc-logbar' });
    bar.createSpan({ text: `检测到错题记录：【${w.subject ?? '-'}】${w.topic} · ${w.code ?? '-'} · ${w.status === '未订正' ? '未订正（下次自动跟进）' : '已订正'}` });
    bar.createEl('div', { text: `我的错误：${w.myError ?? '-'} · 答案基线：${w.answerSource ?? '模型解答（待确认）'}`, cls: 'asc-logrow' });
    const btns = bar.createDiv();
    btns.createEl('button', { text: '入错题本', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', async ev => {
      (ev.target as HTMLElement).setAttr('disabled', 'true');
      try {
        const entry = await this.plugin.wrongAnswers.addEntry({
          subject: w.subject, topic: w.topic, myError: w.myError, code: w.code,
          answerSource: w.answerSource, status: w.status === '未订正' ? '未订正' : '已订正',
        });
        new Notice(entry ? `已入错题本（${entry.id}）${entry.status === '未订正' ? '，下次会话自动跟进' : ''}` : '今日已有同考点记录，未重复登记');
        bar.remove();
      } catch (e) {
        new Notice(`入库失败：${e instanceof Error ? e.message : String(e)}`, 8000);
        (ev.target as HTMLElement).removeAttribute('disabled');
      }
    });
    btns.createEl('button', { text: '忽略', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => bar.remove());
  }

  /** 口语训练：检测终训评分/表达/错题机器块 → 确认卡片一次入库三处（口语台账/表达库/错题本） */
  private renderSpeakingCards(parent: HTMLElement, reply: string): void {
    const finals = parseSpeakingScores(reply).filter(s => s.part === 'final');
    const exprs = parseSpeakingExpressions(reply);
    const wrongs = parseSpeakingWrongs(reply);
    if (!finals.length && !exprs.length && !wrongs.length) return;

    const bar = parent.createDiv({ cls: 'asc-logbar' });
    if (finals.length) {
      const s = finals[finals.length - 1];
      bar.createSpan({
        text: `检测到终训评分：FC ${fmtBand(s.fc)} / LR ${fmtBand(s.lr)} / GRA ${fmtBand(s.gra)} / P ${fmtBand(s.p)} · 总分 ${SpeakingService.fmtOverall(s)}${s.p === null ? '（不含发音）' : ''}`,
      });
      if (s.biggestIssue) bar.createEl('div', { text: `最大问题：${s.biggestIssue}`, cls: 'asc-logrow' });
    }
    const parts: string[] = [];
    if (exprs.length) parts.push(`${exprs.length} 条高分表达`);
    if (wrongs.length) parts.push(`${wrongs.length} 条错题（SP/GR/VX）`);
    if (parts.length) bar.createEl('div', { text: parts.join(' · '), cls: 'asc-logrow' });

    const row = bar.createDiv({ cls: 'asc-row' });
    // 模式选择：台账按模考/陪练/讨论区分趋势
    const modeSel = row.createEl('select', { cls: 'asc-select' });
    for (const m of ['模考', '陪练', '讨论']) modeSel.createEl('option', { text: m, value: m });
    row.createEl('button', { text: '入库（分数+表达+错题）', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', async ev => {
      (ev.target as HTMLElement).setAttr('disabled', 'true');
      try {
        const msgs: string[] = [];
        if (finals.length) {
          await this.plugin.speaking.registerScore(finals[finals.length - 1], modeSel.value);
          msgs.push('分数进口语记录（趋势可见）');
        }
        if (exprs.length) {
          const added = await this.plugin.expressions.appendAll(exprs, `口语训练-${todayStr()}`);
          if (added) msgs.push(`${added} 条表达进积累库`);
        }
        if (wrongs.length) {
          let added = 0;
          for (const w of wrongs) {
            const e = await this.plugin.wrongAnswers.addEntry({ subject: '雅思口语', topic: w.topic, myError: w.myError, code: w.code, answerSource: '口语训练', status: '未订正' });
            if (e) added++;
          }
          if (added) msgs.push(`${added} 条错题进错题本（下次自动跟进）`);
        }
        new Notice(msgs.length ? `已入库：${msgs.join('，')}` : '今日已有同考点记录，未重复登记');
        bar.remove();
      } catch (e) {
        new Notice(`入库失败：${e instanceof Error ? e.message : String(e)}`, 8000);
        (ev.target as HTMLElement).removeAttribute('disabled');
      }
    });
    row.createEl('button', { text: '忽略', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => bar.remove());
  }

  /** 口语训练：按句合成并播报 AI 回复（可打断；失败不影响文字流） */
  private async playReplyTts(raw: string): Promise<void> {
    const sents = splitForTts(stripMachineBlocks(raw));
    if (!sents.length) return;
    let ctx: AudioContext | null = null;
    try {
      const vcfg = await this.plugin.loadVoiceConfig();
      const token = await this.plugin.getNlsToken();
      const cfg = { token, appKey: vcfg.aliyunAppKey, voice: vcfg.ttsVoice };
      ctx = new AudioContext();
      this.ttsPlaying = true;
      this.ttsStopped = false;
      this.render();
      for (const s of sents) {
        if (this.ttsStopped) break;
        const audio = await aliyunTts(s, cfg);
        if (this.ttsStopped) break;
        const buf = await ctx.decodeAudioData(audio);
        await new Promise<void>(resolve => {
          if (!ctx) { resolve(); return; }
          const src = ctx.createBufferSource();
          this.ttsSource = src;
          src.buffer = buf;
          src.connect(ctx.destination);
          src.onended = (): void => resolve();
          src.start();
        });
        this.ttsSource = null;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      void this.voiceLog('ERROR', 'TTS 播报', msg);
      new Notice(`播报失败：${msg}（详见 雅思/口语/语音日志.md）`, 6000);
    } finally {
      if (ctx) void ctx.close();
      this.ttsSource = null;
      this.ttsPlaying = false;
      this.render();
    }
  }

  /** 打断当前播报（已合成的未播句全部放弃） */
  private stopTts(): void {
    this.ttsStopped = true;
    try {
      this.ttsSource?.stop();
    } catch { /* 已停 */ }
    this.ttsPlaying = false;
    this.render();
  }

  /** 保存录音到 雅思/口语/（可选附件；失败不影响主流程） */
  private async saveRecording(wav: ArrayBuffer): Promise<void> {
    try {
      const path = `${SPEAKING_REPORT_DIR}/rec-${todayStr()}-${timeStr()}.wav`;
      await this.app.vault.adapter.writeBinary(path, wav);
    } catch { /* 附件保存失败不影响主流程 */ }
  }

  /** 语音诊断日志：追加到 雅思/口语/语音日志.md（排障用，永不阻塞主流程） */
  private async voiceLog(level: 'INFO' | 'WARN' | 'ERROR', stage: string, detail = ''): Promise<void> {
    try {
      await this.plugin.vaultService.append(`${SPEAKING_REPORT_DIR}/语音日志.md`, formatVoiceLogLine(level, stage, detail));
    } catch { /* 日志失败不影响主流程 */ }
  }

  /**
   * 存档：把未落盘的消息增量追加到会话文件。
   * 新会话 / 关闭视图 / 点「存档」都会调用，因此不会丢数据也不会重复写。
   */
  private async archiveIfNeeded(notify: boolean): Promise<void> {
    if (!this.messages.length || this.messages.length <= this.savedCount) return;
    // 无交互（只有开场、学生没说过话）的会话不记录
    if (!this.messages.some(m => m.role === 'user')) return;
    if (!this.sessionId) this.sessionId = `${todayStr()}-${timeStr()}`;
    const meta = SUBJECTS.find(s => s.key === this.mode);
    const path = `${ROOT}/会话/${this.sessionId}-${String(this.mode)}.md`;
    const existing = await this.plugin.vaultService.read(path);
    const lines: string[] = [];
    if (!existing) {
      lines.push('---', `mode: ${String(this.mode)}`, `started: "${todayStr()} ${timeStr()}"`, '---', '', `# 教练会话 ${todayStr()} · ${meta?.label ?? this.mode}`, '');
    }
    for (let i = this.savedCount; i < this.messages.length; i++) {
      const m = this.messages[i];
      lines.push(`## ${m.role === 'user' ? '学生' : '教练'}`, '', m.content, '');
    }
    await this.plugin.vaultService.append(path, lines.join('\n'));
    this.savedCount = this.messages.length;
    if (notify) new Notice(`已存档：${path}`);
  }

  // ─── 历史会话 ───────────────────────────────────────────────

  private openHistory(): void {
    const files = this.app.vault
      .getMarkdownFiles()
      .filter(f => f.path.startsWith(`${ROOT}/会话/`))
      .sort((a, b) => b.basename.localeCompare(a.basename));
    new SessionHistoryModal(this.app, files, f => void this.loadSession(f.path)).open();
  }

  /** 加载已存档的会话并接着聊（继续追加到同一文件） */
  private async loadSession(path: string): Promise<void> {
    const content = await this.plugin.vaultService.read(path);
    if (!content) {
      new Notice('会话文件读取失败');
      return;
    }
    await this.archiveIfNeeded(false);

    const { data } = parseFrontmatter(content);
    const mode = SUBJECTS.find(s => s.key === (data.mode as ModeKey)) ? (data.mode as ModeKey) : 'Maths';
    const messages = parseSessionMessages(content);
    if (!messages.length) {
      new Notice('该文件里没有可解析的对话');
      return;
    }

    this.mode = mode;
    this.sessionId = path.split('/').pop()!.replace(/\.md$/, '');
    this.messages = messages;
    this.savedCount = messages.length;
    this.sessionTagged = true; // 历史会话不重复打标
    this.tab = 'coach';
    await this.rebuildSystemPrompt();
    this.render();
    new Notice(`已加载历史会话，可直接继续（新消息会追加到同一文件）`);
  }

  // ─── 引用文档 ───────────────────────────────────────────────

  private openAttachPicker(): void {
    new AttachPickerModal(this.app, this.attachments.map(a => a.path), f => {
      this.attachments.push({ path: f.path, name: f.name });
      // 文档内嵌图片自动排队：随下一条消息发送，模型才能真正“看到”图片
      void (async () => {
        try {
          const content = await this.plugin.vaultService.read(f.path);
          if (content) {
            const imgPaths = await this.plugin.ielts.listNoteImages(f.path, content);
            for (const p of imgPaths) {
              if (!this.pendingImages.includes(p)) this.pendingImages.push(p);
            }
            if (imgPaths.length) new Notice(`引用文档含 ${imgPaths.length} 张图片，将随下一条消息发送`);
          }
        } catch {
          // 图片提取失败不阻塞文档引用
        }
        await this.rebuildSystemPrompt();
        this.render();
      })();
    }).open();
  }

  // ─── 记录 ────────────────────────────────────────────────

  /** 可折叠分区卡片（复习/记录共用）：标题行（折叠钮+标题+徽标+动作）+ 主体；
   * 默认全部折叠（避免单个分区内容过长影响整体），手动展开后本会话保持；收起时返回 null 不渲染主体 */
  private collapsibleSection(key: string, el: HTMLElement, title: string, badge: string, hot: boolean, headerActions?: (h: HTMLElement) => void): HTMLElement | null {
    const expanded = this.expanded[key] ?? false;
    const card = el.createDiv({ cls: 'asc-card asc-queue-card' });
    const head = card.createDiv({ cls: 'asc-queue-head' });
    const tg = head.createEl('button', { text: expanded ? '▾' : '▸', cls: 'asc-btn asc-btn-icon asc-fold-btn' });
    tg.setAttr('title', expanded ? '收起细节' : '展开细节');
    tg.addEventListener('click', () => { this.expanded[key] = !expanded; this.render(); });
    head.createSpan({ text: title, cls: 'asc-queue-title' });
    head.createSpan({ text: badge, cls: 'asc-queue-badge' + (hot ? ' asc-badge-hot' : '') });
    if (headerActions) headerActions(head);
    if (!expanded) return null;
    return card.createDiv({ cls: 'asc-queue-body' });
  }

  private async renderRecords(): Promise<void> {
    const el = this.bodyEl;
    const entries = await this.plugin.errorLog.load();
    const ROW_CAP = 50;

    el.createEl('div', {
      text: '记录中心：A-Level 与雅思记录统一展示（数据文件保持独立，零信息丢失）；全部明细见底部 .md 源文件。',
      cls: 'asc-muted',
    });

    const open = (path: string) => () => {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) void this.app.workspace.getLeaf(true).openFile(file);
    };

    // ① A-Level 失分记录（带科目/状态筛选）
    const b1 = this.collapsibleSection('rec-errorlog', el, '① A-Level 失分记录', `${entries.length} 条`, entries.length > 0);
    if (b1) {
      const bar = b1.createDiv({ cls: 'asc-row' });
      const subjectSel = bar.createEl('select', { cls: 'asc-select' });
      subjectSel.createEl('option', { text: '全部科目', value: '' });
      for (const s of ['Maths', 'Physics', 'Chem', 'CS', 'Econ']) subjectSel.createEl('option', { text: s, value: s });
      const statusSel = bar.createEl('select', { cls: 'asc-select' });
      statusSel.createEl('option', { text: '全部状态', value: '' });
      for (const s of ['未消除', '观察中', '已消除']) statusSel.createEl('option', { text: s, value: s });
      const tableWrap = b1.createDiv({ cls: 'asc-table-wrap' });
      const draw = () => {
        tableWrap.empty();
        const filtered = entries.filter(
          e => (!subjectSel.value || e.subject === subjectSel.value) && (!statusSel.value || e.status === statusSel.value),
        );
        if (!filtered.length) {
          tableWrap.createDiv({ text: '没有符合条件的条目。', cls: 'asc-empty' });
          return;
        }
        const table = tableWrap.createEl('table', { cls: 'asc-table' });
        const head = table.createEl('tr');
        for (const h of ['ID', '日期', '科目', '层级', '考点(EN)', '代码', '描述', '复发', '状态', '复查日期']) head.createEl('th', { text: h });
        for (const e of filtered.slice(0, ROW_CAP)) {
          const tr = table.createEl('tr');
          for (const cell of [e.id, e.date, e.subject, e.level, e.topic, e.code, e.desc, String(e.recurrence), e.status, e.reviewDate]) tr.createEl('td', { text: cell });
        }
        if (filtered.length > ROW_CAP) tableWrap.createDiv({ text: `… 仅显示最近 ${ROW_CAP} 条，全 ${filtered.length} 条见 error-log.md`, cls: 'asc-muted' });
      };
      subjectSel.addEventListener('change', draw);
      statusSel.addEventListener('change', draw);
      draw();
    }

    // ② 雅思批改记录（评分事件，与失分表语义不同，独立展示）
    const scores = await this.plugin.ielts.loadScores();
    const b2 = this.collapsibleSection('rec-grades', el, '② 雅思批改记录（趋势）', `${scores.length} 次`, scores.length > 0);
    if (b2) {
      if (!scores.length) {
        b2.createDiv({ text: '还没有批改记录。', cls: 'asc-empty' });
      } else {
        const wrap = b2.createDiv({ cls: 'asc-table-wrap' });
        const st = wrap.createEl('table', { cls: 'asc-table' });
        const shead = st.createEl('tr');
        for (const h of ['日期', '来源', '总分', 'TR', 'CC', 'LR', 'GRA']) shead.createEl('th', { text: h });
        for (const s of [...scores].reverse().slice(0, ROW_CAP)) {
          const tr = st.createEl('tr');
          tr.createEl('td', { text: s.date });
          const srcTd = tr.createEl('td', { text: s.title });
          srcTd.addClass('asc-link');
          srcTd.addEventListener('click', open(s.file));
          for (const v of [s.overall, s.tr, s.cc, s.lr, s.gra]) tr.createEl('td', { text: v === null ? '-' : String(v) });
        }
      }
    }

    // ③ 表达积累库（雅思高分表达 + 学科通用，同一能力池）
    const exprs = await this.plugin.expressions.load();
    const b3 = this.collapsibleSection('rec-exprs', el, '③ 表达积累库', `${exprs.length} 条 · 已掌握 ${exprs.filter(x => x.status === '已掌握').length}`, exprs.length > 0);
    if (b3) {
      if (!exprs.length) {
        b3.createDiv({ text: '还没有积累表达——批改作文后自动入库。', cls: 'asc-empty' });
      } else {
        const wrap = b3.createDiv({ cls: 'asc-table-wrap' });
        const et = wrap.createEl('table', { cls: 'asc-table' });
        const ehead = et.createEl('tr');
        for (const h of ['表达', '类型', '来源', '入库日期', '状态']) ehead.createEl('th', { text: h });
        for (const x of exprs.slice(0, ROW_CAP)) {
          const tr = et.createEl('tr');
          for (const cell of [x.expr, x.type, x.source, x.date, x.status]) tr.createEl('td', { text: cell });
        }
        if (exprs.length > ROW_CAP) wrap.createDiv({ text: `… 仅显示最近 ${ROW_CAP} 条，全 ${exprs.length} 条见积累库.md`, cls: 'asc-muted' });
      }
    }

    // ④ 错题本（订正与卡题统一记录）
    const was = await this.plugin.wrongAnswers.load();
    const openWasCount = was.filter(w => w.status === '未订正').length;
    const b4 = this.collapsibleSection('rec-wrongs', el, '④ 错题本', `${was.length} 条${openWasCount ? ` · 未订正 ${openWasCount}` : ''}`, was.length > 0);
    if (b4) {
      if (!was.length) {
        b4.createDiv({ text: '还没有错题记录——教练会话里问任何题（订正/卡住），结题后可一键入库。', cls: 'asc-empty' });
      } else {
        const wrap = b4.createDiv({ cls: 'asc-table-wrap' });
        const wt = wrap.createEl('table', { cls: 'asc-table' });
        const whead = wt.createEl('tr');
        for (const h of ['ID', '日期', '科目', '考点(EN)', '我的错误', '错因码', '答案来源', '状态']) whead.createEl('th', { text: h });
        for (const w of [...was].reverse().slice(0, ROW_CAP)) {
          const tr = wt.createEl('tr');
          for (const cell of [w.id, w.date, w.subject, w.topic, w.myError, w.code, w.answerSource, w.status]) tr.createEl('td', { text: cell });
        }
      }
    }

    // ⑤ 提问记录（最近 20 条）
    const tags = (await this.plugin.engine.loadQuestionTags()).slice(-20).reverse();
    const b5 = this.collapsibleSection('rec-questions', el, '⑤ 提问记录', `最近 ${tags.length} 条`, tags.length > 0);
    if (b5) {
      if (!tags.length) {
        b5.createDiv({ text: '还没有提问记录——每次结题自动打标。', cls: 'asc-empty' });
      } else {
        const wrap = b5.createDiv({ cls: 'asc-table-wrap' });
        const tt = wrap.createEl('table', { cls: 'asc-table' });
        const thead = tt.createEl('tr');
        for (const h of ['日期', '科目', '考点(EN)', '困惑类型', '求助深度']) thead.createEl('th', { text: h });
        for (const t of tags) {
          const tr = tt.createEl('tr');
          for (const cell of [t.date, t.subject, t.topic, t.confusion, t.depth]) tr.createEl('td', { text: cell });
        }
      }
    }

    // ⑥ 概念地图（模式 F 登记；预习/待详学概念注入概念精练提示词）
    const cms = await this.plugin.conceptMap.load();
    const pendingCount = cms.filter(c => c.status !== '已学').length;
    const b6 = this.collapsibleSection('rec-conceptmap', el, '⑥ 概念地图', `${cms.length} 个概念${pendingCount ? ` · 预习/待详学 ${pendingCount}` : ''}`, cms.length > 0);
    if (b6) {
      if (!cms.length) {
        b6.createDiv({ text: '还没有概念地图——概念精练里说「练 F」画章节级关系图，会自动登记。', cls: 'asc-empty' });
      } else {
        const wrap = b6.createDiv({ cls: 'asc-table-wrap' });
        const ct = wrap.createEl('table', { cls: 'asc-table' });
        const chead = ct.createEl('tr');
        for (const h of ['章节', '概念', '科目', '状态', '更新日期']) chead.createEl('th', { text: h });
        for (const c of cms.slice(0, ROW_CAP)) {
          const tr = ct.createEl('tr');
          for (const cell of [c.chapter, c.concept, c.subject, c.status, c.date]) tr.createEl('td', { text: cell });
        }
        if (cms.length > ROW_CAP) wrap.createDiv({ text: `… 仅显示最近 ${ROW_CAP} 条，全 ${cms.length} 条见概念地图.md`, cls: 'asc-muted' });
      }
    }

    // ⑦ 口语记录（口语训练终训评分入库；与写作批改记录并排的趋势）
    const sps = await this.plugin.speaking.loadScores();
    const b7 = this.collapsibleSection('rec-speaking', el, '⑦ 口语记录（趋势）', `${sps.length} 次`, sps.length > 0);
    if (b7) {
      if (!sps.length) {
        b7.createDiv({ text: '还没有口语评分——教练页签选「雅思口语训练」，终训总结后确认入库。', cls: 'asc-empty' });
      } else {
        const wrap = b7.createDiv({ cls: 'asc-table-wrap' });
        const st = wrap.createEl('table', { cls: 'asc-table' });
        const shead = st.createEl('tr');
        for (const h of ['日期', '模式', 'FC', 'LR', 'GRA', 'P', '总分', '最大问题']) shead.createEl('th', { text: h });
        for (const s of [...sps].reverse().slice(0, ROW_CAP)) {
          const tr = st.createEl('tr');
          for (const cell of [s.date, s.mode, s.fc, s.lr, s.gra, s.p, s.overall, s.issue]) tr.createEl('td', { text: cell });
        }
        if (sps.length > ROW_CAP) wrap.createDiv({ text: `… 仅显示最近 ${ROW_CAP} 条，全 ${sps.length} 条见口语记录.md`, cls: 'asc-muted' });
      }
    }

    // ⑧ 章节进度（解锁的章节注入对应科目教练提示词，聚焦学习与复习）
    const chs = await this.plugin.chapters.load();
    const unlockedN = chs.filter(c => c.status !== '锁定').length;
    const b8 = this.collapsibleSection('rec-chapters', el, '⑧ 章节进度', `${chs.length} 章 · 解锁 ${unlockedN}`, chs.length > 0);
    if (b8) {
      if (!chs.length) {
        b8.createDiv({ text: '还没有章节——在 记录/章节进度.md 登记科目章节后即可在这里控制解锁。', cls: 'asc-empty' });
      }
      // 按科目分组折叠：每组标题显示科目 + 章节数/解锁数，默认收起（避免 58 章平铺）
      const SUBJECT_LABEL: Record<string, string> = { Economics: '📘 Economics 经济', Chemistry: '🧪 Chemistry 化学' };
      const groups = new Map<string, ChapterEntry[]>();
      for (const c of chs) {
        const list = groups.get(c.subject) ?? [];
        list.push(c);
        groups.set(c.subject, list);
      }
      for (const [subject, list] of groups) {
        const groupUnlocked = list.filter(c => c.status !== '锁定').length;
        const gKey = `rec-chapters-${subject}`;
        const gExpanded = this.expanded[gKey] ?? false;
        const card = b8.createDiv({ cls: 'asc-card asc-queue-card' });
        const head = card.createDiv({ cls: 'asc-queue-head' });
        const tg = head.createEl('button', { text: gExpanded ? '▾' : '▸', cls: 'asc-btn asc-btn-icon asc-fold-btn' });
        tg.setAttr('title', gExpanded ? '收起细节' : '展开细节');
        tg.addEventListener('click', () => { this.expanded[gKey] = !gExpanded; this.render(); });
        head.createSpan({ text: SUBJECT_LABEL[subject] ?? subject, cls: 'asc-queue-title' });
        head.createSpan({ text: `${list.length} 章 · 解锁 ${groupUnlocked}`, cls: 'asc-queue-badge' + (groupUnlocked > 0 ? ' asc-badge-hot' : '') });
        if (!gExpanded) continue;
        const body = card.createDiv({ cls: 'asc-queue-body' });
        for (const c of list) {
          const row = body.createDiv({ cls: 'asc-queue-item' });
          const head2 = row.createDiv({ cls: 'asc-row' });
          head2.createSpan({ text: `${c.chapter}`, cls: 'asc-strong' });
          head2.createSpan({ text: c.status + (c.unlocked ? `（${c.unlocked}）` : ''), cls: 'asc-muted' });
          const btns = row.createDiv({ cls: 'asc-row' });
          if (c.status === '锁定') {
            btns.createEl('button', { text: '解锁进入学习', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', async () => {
              await this.plugin.chapters.updateStatus(c.subject, c.chapter, '解锁');
              this.render();
            });
          } else {
            if (c.status === '解锁') {
              btns.createEl('button', { text: '标记已掌握', cls: 'asc-btn asc-btn-small' }).addEventListener('click', async () => {
                await this.plugin.chapters.updateStatus(c.subject, c.chapter, '已掌握');
                this.render();
              });
            }
            btns.createEl('button', { text: '锁定', cls: 'asc-btn asc-btn-small' }).addEventListener('click', async () => {
              await this.plugin.chapters.updateStatus(c.subject, c.chapter, '锁定');
              this.render();
            });
          }
          btns.createEl('button', { text: '打开内容', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(c.file));
        }
      }
      b8.createDiv({ text: '解锁的章节会自动注入经济/化学/概念精练教练提示词（章节+术语），未解锁章节不主动训练。', cls: 'asc-muted' });
    }

    const links = el.createDiv({ cls: 'asc-row' });
    links.createEl('button', { text: '打开 error-log.md', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(`${ROOT}/记录/error-log.md`));
    links.createEl('button', { text: '批改记录.md', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(GRADE_LEDGER_PATH));
    links.createEl('button', { text: '口语记录.md', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(SPEAKING_LEDGER_PATH));
    links.createEl('button', { text: '积累库.md', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(EXPR_LIB_PATH));
    links.createEl('button', { text: '错题本.md', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(WRONG_ANSWER_PATH));
    links.createEl('button', { text: '概念地图.md', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(CONCEPT_MAP_PATH));
    links.createEl('button', { text: '章节进度.md', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(CHAPTER_PROGRESS_PATH));
    links.createEl('button', { text: '提问记录.md', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(`${ROOT}/记录/提问记录.md`));
    links.createEl('button', { text: '术语清单.md', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(`${ROOT}/记录/术语清单.md`));
  }

  // ─── 复习 ────────────────────────────────────────────────

  private async renderReview(): Promise<void> {
    const el = this.bodyEl;
    const due = await this.plugin.errorLog.dueEntries();
    const terms = await this.plugin.terms.load();
    const drillTerms = terms.filter(t => t.status !== '已稳定');
    const exprDue = await this.plugin.expressions.due();
    const openWas = await this.plugin.wrongAnswers.open();

    // 顶栏：汇总 + 线下汇报入口
    const topRow = el.createDiv({ cls: 'asc-row' });
    topRow.createSpan({
      text: `今日全部到期：失分点 ${due.length} · 术语 ${drillTerms.length} · 表达 ${exprDue.length} · 错题 ${openWas.length}`,
      cls: 'asc-muted',
    });
    const fbBtn = topRow.createEl('button', { text: '📝 汇报线下练习结果', cls: 'asc-btn asc-btn-small' });
    fbBtn.setAttr('title', '线下自己练了术语/表达/错题？把结果报回来，同样更新记录');
    fbBtn.addEventListener('click', () => {
      const ctx = [
        drillTerms.map(t => `- ${t.term}（${t.status}）`).join('\n') || '（无）',
        exprDue.map(x => `- ${x.expr}`).join('\n') || '（无）',
        due.map(e => `- ${e.topic}（${e.subject}）`).join('\n') || '（无）',
        openWas.map(w => `- ${w.topic}（${w.subject}）`).join('\n') || '（无）',
      ].join('\n===\n');
      new OfflineFeedbackModal(this.app, this.plugin, ctx, (fb) => {
        this.pendingFeedback = fb;
        this.render();
      }).open();
    });

    // 待确认的线下反馈卡片
    if (this.pendingFeedback) this.renderFeedbackCard(el, this.pendingFeedback);

    // 队列卡片工厂：复用共享折叠组件（默认全部折叠，手动展开）
    const queue = (key: string, title: string, badge: string, hot: boolean, headerActions?: (h: HTMLElement) => void): HTMLElement | null =>
      this.collapsibleSection(`rev-${key}`, el, title, badge, hot, headerActions);

    // ① 失分点复查：不重做原题，让 AI 出同考点、同陷阱的变式题
    const b1 = queue('points', '① 失分点复查', `${due.length} 条到期`, due.length > 0);
    if (b1) {
      if (!due.length) {
        b1.createDiv({ text: '没有到期失分点。待复查队列到期时这里会出现。', cls: 'asc-empty' });
      }
      for (const e of due) {
        const item = b1.createDiv({ cls: 'asc-queue-item' });
        item.createEl('div', { text: `#${e.id} 【${e.subject}】${e.topic} · ${e.code} · 复发 ${e.recurrence}`, cls: 'asc-card-title' });
        item.createEl('div', { text: e.desc, cls: 'asc-row' });
        if (e.fix) item.createEl('div', { text: `正确做法：${e.fix}`, cls: 'asc-row asc-muted' });
        const btns = item.createDiv({ cls: 'asc-row' });
        btns.createEl('button', { text: '出变式题', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', () => this.startVariantDrill(e));
        btns.createEl('button', { text: '复查通过', cls: 'asc-btn asc-btn-small' }).addEventListener('click', async () => {
          const next = e.status === '未消除' ? '观察中' : '已消除';
          await this.plugin.errorLog.updateEntry(e.id, { status: next, reviewDate: addDays(todayStr(), 7) });
          new Notice(next === '已消除' ? `#${e.id} 已连续两次通过，标记为已消除` : `#${e.id} 通过一次，状态改为观察中`);
          void this.plugin.refreshStatusBar();
          this.render();
        });
        btns.createEl('button', { text: '再犯', cls: 'asc-btn asc-btn-small' }).addEventListener('click', async () => {
          await this.plugin.errorLog.addEntry({ subject: e.subject, topic: e.topic, code: e.code });
          new Notice(`#${e.id} 复发 +1，复查日期顺延 3 天`);
          void this.plugin.refreshStatusBar();
          this.render();
        });
      }
    }

    // ② 术语抽查：未稳定/观察中全抽 + 已稳定随机回抽一条（防假性掌握）
    const b2 = queue('terms', '② 术语抽查', `待抽查 ${drillTerms.length}`, drillTerms.length > 0, h => {
      if (drillTerms.length) {
        h.createEl('button', { text: '开始抽查', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', () => void this.startDrill());
      }
    });
    if (b2) {
      if (!drillTerms.length) {
        b2.createDiv({ text: '术语清单里没有待抽查条目（学习/结题会自动积累）。', cls: 'asc-empty' });
      } else {
        for (const t of drillTerms) {
          b2.createDiv({ text: `- ${t.term}（${t.subject} · ${t.status}）`, cls: 'asc-row asc-muted' });
        }
        b2.createDiv({ text: '点「开始抽查」：30 秒盲写，含已稳定随机回抽一条。', cls: 'asc-empty' });
      }
    }

    // ③ 表达造句抽查：SM-2 到期的表达逐条造句，AI 判定升档/重置
    const b3 = queue('exprs', '③ 表达造句抽查', `到期 ${exprDue.length}`, exprDue.length > 0, h => {
      if (exprDue.length) {
        h.createEl('button', { text: '开始造句抽查', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', () => void this.plugin.startExpressionDrill());
      }
    });
    if (b3) {
      if (!exprDue.length) {
        b3.createDiv({ text: '没有到期表达——批改作文会自动积累，到期后这里提示。', cls: 'asc-empty' });
      } else {
        for (const x of exprDue) {
          b3.createDiv({ text: `- ${x.expr}（${x.type}）`, cls: 'asc-row asc-muted' });
        }
      }
    }

    // ④ 错题跟进：未订正条目逐条手工反馈（线下重做完成即可标记）
    const b4 = queue('wrongs', '④ 错题跟进', `未订正 ${openWas.length}`, openWas.length > 0);
    if (b4) {
      if (!openWas.length) {
        b4.createDiv({ text: '没有未订正错题——解题/订正会话中卡住的题会在这里跟进。', cls: 'asc-empty' });
      }
      for (const w of openWas) {
        const item = b4.createDiv({ cls: 'asc-queue-item' });
        item.createEl('div', { text: `${w.id}【${w.subject}】${w.topic}`, cls: 'asc-card-title' });
        item.createEl('div', { text: `我的错误：${w.myError || '-'} · 答案基线：${w.answerSource}`, cls: 'asc-row asc-muted' });
        const btns = item.createDiv({ cls: 'asc-row' });
        const okBtn = btns.createEl('button', { text: '已重做掌握', cls: 'asc-btn asc-btn-small' });
        okBtn.setAttr('title', '线下/课上已重做并掌握，手工标记为已订正');
        okBtn.addEventListener('click', async () => {
          const done = await this.plugin.wrongAnswers.updateStatus(w.id, '已订正');
          new Notice(done ? `${w.id} 已标记为已订正` : '更新失败：条目可能已变更');
          this.render();
        });
      }
    }
  }

  /** 线下反馈确认卡片：解析结果逐条列出，确认后应用到三队记录 */
  private renderFeedbackCard(el: HTMLElement, fb: ReviewFeedback): void {
    const card = el.createDiv({ cls: 'asc-card' });
    card.createEl('div', { text: '线下练习反馈（确认后应用）', cls: 'asc-card-title' });
    const mark = (p: boolean) => (p ? '✓' : '✗');
    for (const t of fb.terms) card.createEl('div', { text: `${mark(t.pass)} 术语：${t.name}`, cls: 'asc-row' });
    for (const x of fb.expressions) card.createEl('div', { text: `${mark(x.pass)} 表达：${x.name}`, cls: 'asc-row' });
    for (const p of fb.points) card.createEl('div', { text: `${mark(p.pass)} 失分点：${p.topic}`, cls: 'asc-row' });
    for (const w of fb.wrongs) card.createEl('div', { text: `${mark(w.pass)} 错题：${w.topic}`, cls: 'asc-row' });
    const btns = card.createDiv({ cls: 'asc-row' });
    btns.createEl('button', { text: '确认应用', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', () => void this.applyReviewFeedback(fb));
    btns.createEl('button', { text: '丢弃', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => {
      this.pendingFeedback = null;
      this.render();
    });
  }

  /** 应用线下反馈：术语/表达走抽查结果同一条状态机；失分点走复查通过/再犯同一逻辑 */
  private async applyReviewFeedback(fb: ReviewFeedback): Promise<void> {
    let applied = 0;
    const misses: string[] = [];
    for (const t of fb.terms) {
      const r = await this.plugin.terms.applyDrillResult(t.name, t.pass);
      if (r) applied++; else misses.push(`术语 ${t.name}`);
    }
    for (const x of fb.expressions) {
      const r = await this.plugin.expressions.applyResult(x.name, x.pass);
      if (r) applied++; else misses.push(`表达 ${x.name}`);
    }
    const entries = await this.plugin.errorLog.load();
    for (const p of fb.points) {
      const e = entries.find(x => x.topic.toLowerCase() === p.topic.toLowerCase());
      if (!e) { misses.push(`失分点 ${p.topic}`); continue; }
      if (p.pass) {
        const next = e.status === '未消除' ? '观察中' : '已消除';
        await this.plugin.errorLog.updateEntry(e.id, { status: next, reviewDate: addDays(todayStr(), 7) });
      } else {
        await this.plugin.errorLog.addEntry({ subject: e.subject, topic: e.topic, code: e.code });
      }
      applied++;
    }
    const wrongs = await this.plugin.wrongAnswers.load();
    for (const w of fb.wrongs) {
      const e = wrongs.find(x => x.topic.toLowerCase() === w.topic.toLowerCase());
      if (!e) { misses.push(`错题 ${w.topic}`); continue; }
      if (w.pass) await this.plugin.wrongAnswers.updateStatus(e.id, '已订正');
      // 未掌握则保持未订正，继续自动跟进
      applied++;
    }
    this.pendingFeedback = null;
    void this.plugin.refreshStatusBar();
    new Notice(misses.length ? `已应用 ${applied} 条；未匹配：${misses.join('、')}` : `已应用 ${applied} 条线下反馈`, misses.length ? 8000 : 4000);
    this.render();
  }

  /** 概念地图确认卡片：模式 F 章节级画图结果 → 概念登记入台账 */
  private renderConceptMapPrompt(parent: HTMLElement, reply: string): void {
    const cm = parseConceptMap(reply);
    if (!cm || !cm.concepts.length) return;

    const bar = parent.createDiv({ cls: 'asc-logbar' });
    bar.createSpan({ text: `检测到概念地图：【${cm.subject ?? '-'}】${cm.chapter ?? '-'} · ${cm.concepts.length} 个概念` });
    for (const c of cm.concepts) {
      bar.createEl('div', { text: `${c.status === '已学' ? '✓' : '◌'} ${c.name}（${c.status}）`, cls: 'asc-logrow' });
    }
    const btns = bar.createDiv();
    btns.createEl('button', { text: '登记到概念地图', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', async ev => {
      (ev.target as HTMLElement).setAttr('disabled', 'true');
      try {
        for (const c of cm.concepts) {
          await this.plugin.conceptMap.upsert({ chapter: cm.chapter ?? '未分章', concept: c.name, status: c.status, subject: cm.subject });
        }
        const pending = cm.concepts.filter(c => c.status !== '已学').length;
        new Notice(`已登记 ${cm.concepts.length} 个概念${pending ? `，其中 ${pending} 个预习/待详学（以后学到时提示词会提醒）` : ''}`);
        bar.remove();
      } catch (e) {
        new Notice(`登记失败：${e instanceof Error ? e.message : String(e)}`, 8000);
        (ev.target as HTMLElement).removeAttribute('disabled');
      }
    });
    btns.createEl('button', { text: '忽略', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => bar.remove());
  }

  /** 出变式题：跳到教练页签，用对应科目开会话并预填请求 */
  private async startVariantDrill(e: ErrorLogEntry): Promise<void> {
    this.saveCurrentSlot();
    this.mode = SUBJECT_TO_MODE[e.subject] ?? 'Maths';
    this.tab = 'coach';
    await this.startSession(false); // 变式题预填请求，不自动开场
    this.render();
    const input = this.bodyEl.querySelector<HTMLTextAreaElement>('.asc-input-bar textarea');
    if (input) {
      input.value = `复查任务：针对「${e.topic}」（代码 ${e.code}，曾犯：${e.desc}）出一道同考点、同陷阱的新变式题，不要和原题相同。`;
      input.focus();
    }
  }
}

function timeStr(): string {
  return new Date().toTimeString().slice(0, 8).replace(/:/g, '');
}

function fmtRemain(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)} 分 ${s % 60} 秒`;
}

/** 语音诊断日志行格式（导出供测试）：[级别] HH:MM:SS · 阶段 · 详情 */
export function formatVoiceLogLine(level: 'INFO' | 'WARN' | 'ERROR', stage: string, detail: string, d = new Date()): string {
  const t = d.toTimeString().slice(0, 8);
  return `[${level}] ${t} · ${stage}${detail ? ` · ${detail}` : ''}`;
}

/** 剥离回复里机器用 JSON 块（ieltsResult / sessionTag / wrongAnswer），其他内容原样保留；导出供测试 */
export function stripMachineBlocks(content: string): string {
  return content
    .replace(/```json\s*[\s\S]*?```/g, block => (/"ieltsResult"|"sessionTag"|"wrongAnswer"|"conceptMap"|"ieltsSpeaking"|"ieltsExpressions"|"wrongAnswers"/.test(block) ? '' : block))
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

/** 思考凭证标注（导出供测试）：让教练知道学生真想满了门槛，而非口头声称 */
export function thinkAnnotation(minutes: number): string {
  return `\n\n[插件注：该生刚由插件计时完成 ${minutes} 分钟独立思考，达到卡住耐受力门槛，请把试过的方向列出来再继续。]`;
}

/** 线下练习反馈：复习四队（失分点/术语/表达/错题）的线下结果结构化 */
export interface ReviewFeedback {
  terms: { name: string; pass: boolean }[];
  expressions: { name: string; pass: boolean }[];
  points: { topic: string; pass: boolean }[];
  wrongs: { topic: string; pass: boolean }[];
}

/** 从 AI 解析回复提取线下练习反馈 JSON（宽容字段名差异）；导出供测试 */
export function parseReviewFeedback(reply: string): ReviewFeedback {
  const p = extractJson<{ reviewFeedback?: Record<string, unknown> }>(reply)?.reviewFeedback;
  const fb: ReviewFeedback = { terms: [], expressions: [], points: [], wrongs: [] };
  if (!p || typeof p !== 'object') return fb;
  const norm = (arr: unknown, nameKeys: string[], passOut: { name: string; pass: boolean }[] | { topic: string; pass: boolean }[], keyOut: 'name' | 'topic') => {
    if (!Array.isArray(arr)) return;
    for (const it of arr) {
      if (!it || typeof it !== 'object') continue;
      const o = it as Record<string, unknown>;
      let name = '';
      for (const k of nameKeys) {
        const v = o[k];
        if (typeof v === 'string' && v.trim()) { name = v.trim(); break; }
      }
      if (!name) continue;
      const pass = o.pass !== false && o.result !== 'fail';
      if (keyOut === 'name') (passOut as { name: string; pass: boolean }[]).push({ name, pass });
      else (passOut as { topic: string; pass: boolean }[]).push({ topic: name, pass });
    }
  };
  norm(p.terms, ['name', 'term', '术语'], fb.terms, 'name');
  norm(p.expressions, ['name', 'expr', '表达'], fb.expressions, 'name');
  norm(p.points, ['topic', 'name', '考点'], fb.points, 'topic');
  norm(p.wrongs, ['topic', 'name', '错题'], fb.wrongs, 'topic');
  return fb;
}

/** 从 AI 回复提取概念地图 JSON（模式 F 收尾输出）；导出供测试 */
export interface ConceptMapResult {
  chapter: string;
  subject: string;
  concepts: { name: string; status: '已学' | '预习' | '待详学' }[];
}

export function parseConceptMap(reply: string): ConceptMapResult | null {
  const p = extractJson<{ conceptMap?: Record<string, unknown> }>(reply)?.conceptMap;
  if (!p || typeof p !== 'object' || !Array.isArray(p.concepts)) return null;
  const concepts: ConceptMapResult['concepts'] = [];
  for (const it of p.concepts) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!name) continue;
    const status = o.status === '预习' || o.status === '待详学' ? o.status : '已学';
    concepts.push({ name, status });
  }
  if (!concepts.length) return null;
  return {
    chapter: typeof p.chapter === 'string' ? p.chapter.trim() : '',
    subject: typeof p.subject === 'string' ? p.subject.trim() : '',
    concepts,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 解析会话存档文件为消息序列（## 学生 / ## 教练 分段）；导出供测试 */
export function parseSessionMessages(content: string): ChatMessage[] {
  const msgs: ChatMessage[] = [];
  const parts = content.split(/^## (学生|教练)\s*$/m);
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const role = parts[i] === '学生' ? 'user' : 'assistant';
    const body = parts[i + 1].replace(/\n-{3,}\s*$/, '').trim();
    if (body) msgs.push({ role, content: body });
  }
  return msgs;
}
