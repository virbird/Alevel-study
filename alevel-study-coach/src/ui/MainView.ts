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
import { SuggestionModal, DrillModal } from './InsightModals';
import { EXPR_LIB_PATH, GRADE_LEDGER_PATH, parseIeltsResult } from '../services/IeltsService';
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
  private mode: ModeKey = 'Maths';
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
  /** 独立思考计时器（提示词门槛的产品硬约束，仅会话内可用） */
  private timerDeadline = 0;
  private timerMinutes = 0;
  /** 计时跑满后的「思考凭证」：下一条消息携带标注后清零 */
  private thinkCredit = 0;
  private timerInterval: number | null = null;
  /** 批改任务卡片秒数刷新定时器 */
  private taskTicker: number | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: ALevelStudyCoachPlugin) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE; }
  getDisplayText(): string { return 'A-Level Study Coach'; }
  getIcon(): string { return 'graduation-cap'; }

  async onOpen(): Promise<void> {
    this.containerEl.addClass('asc-view');
    this.render();
  }

  async onClose(): Promise<void> {
    // 防止漏数据：关闭视图时把未存档的消息自动落盘
    await this.archiveIfNeeded(false);
    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.taskTicker !== null) {
      window.clearInterval(this.taskTicker);
      this.taskTicker = null;
    }
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
      case 'coach': this.renderCoach(); break;
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

    // 1. 建议卡片（有才显示，不打断不强推）
    if (pending.length) {
      el.createEl('div', { text: `📌 弱点信号（${pending.length} 张待处理建议卡片）`, cls: 'asc-card-title' });
      for (const s of pending.slice(0, 5)) {
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
    } else {
      el.createDiv({ text: '暂无待处理的建议卡片——弱点信号达到阈值时会自动出现在这里。', cls: 'asc-hint' });
    }

    // 2. 弱点雷达（近 14 天，纯本地统计）
    const radar = await this.plugin.engine.radar(entries, 14);
    const rc = el.createDiv({ cls: 'asc-card' });
    rc.createEl('div', { text: `弱点雷达（近 ${radar.windowDays} 天）`, cls: 'asc-card-title' });
    rc.createEl('div', {
      text: `未消除失分点 ${radar.unresolvedCount} │ 待复查 ${radar.dueCount}`,
      cls: 'asc-row asc-strong',
    });
    if (radar.topicHeat.length) {
      rc.createEl('div', { text: '提问热点：' + radar.topicHeat.map(h => `${h.topic} ×${h.count}`).join(' · '), cls: 'asc-row' });
    }
    if (radar.codeCounts.length) {
      rc.createEl('div', {
        text: '失分码：' + radar.codeCounts.map(c => `${c.code}${'▮'.repeat(Math.min(c.count, 8))}${c.count}`).join('  '),
        cls: 'asc-row',
      });
    }
    if (radar.confusionDist.length) {
      rc.createEl('div', { text: '困惑类型：' + radar.confusionDist.map(c => `${c.confusion} ×${c.count}`).join(' · '), cls: 'asc-row' });
    }
    // 表达码双周环比（DV/CL/LK 是当前最高优先级弱点，下降才是目标）
    const curCodes = this.plugin.engine.codeCountsRange(entries, -1, 14);
    const prevCodes = this.plugin.engine.codeCountsRange(entries, 14, 28);
    const cnt = (list: { code: string; count: number }[], c: string) => list.find(x => x.code === c)?.count ?? 0;
    const exprTrend = ['DV', 'CL', 'LK'].map(c => {
      const a = cnt(curCodes, c);
      const b = cnt(prevCodes, c);
      const arrow = a < b ? '↓' : a === b ? '→' : '↑';
      return `${c} ${b}→${a} ${arrow}`;
    }).join('  ');
    rc.createEl('div', { text: `表达码环比（近两周 vs 前两周）：${exprTrend}`, cls: 'asc-row' });
    const relapse = entries.filter(e => e.recurrence >= 2 && e.status !== '已消除')
      .sort((a, b) => b.recurrence - a.recurrence).slice(0, 3);
    if (relapse.length) {
      rc.createEl('div', { text: '复发热点：' + relapse.map(e => `${e.topic} ×${e.recurrence}（${e.code}）`).join(' · '), cls: 'asc-row' });
    }
    if (!radar.topicHeat.length && !radar.codeCounts.length) {
      rc.createEl('div', { text: '近两周数据还太少——每次结题都会自动积累提问记录与失分记录。', cls: 'asc-hint' });
    }

    // 3. 术语与快捷动作
    const terms = await this.plugin.terms.load();
    const unstable = terms.filter(t => t.status !== '已稳定').length;
    const tc = el.createDiv({ cls: 'asc-card' });
    tc.createEl('div', { text: `术语清单：待抽查 ${unstable} / 共 ${terms.length}`, cls: 'asc-card-title' });
    const tbtns = tc.createDiv({ cls: 'asc-row' });
    tbtns.createEl('button', { text: '发起术语抽查（模式 E）', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', () => void this.startDrill());
    tbtns.createEl('button', { text: '重新分析一次', cls: 'asc-btn asc-btn-small' }).addEventListener('click', async () => {
      await this.plugin.runAnalysisCycle();
      new Notice('分析完成');
      this.render();
    });
    tbtns.createEl('button', { text: '导出本周周报', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => void this.plugin.exportWeeklyReport());

    // 雅思写作（日常训练在教练「雅思写作训练」会话；这里提供趋势与快捷入口）
    const scores = await this.plugin.ielts.loadScores();
    const ic = el.createDiv({ cls: 'asc-card' });
    ic.createEl('div', { text: `雅思写作（目标 ${profile.ielts.target} · 主攻 ${profile.ielts.focus}）`, cls: 'asc-card-title' });
    if (scores.length) {
      for (const s of scores.slice(-3).reverse()) {
        const dims = `TR ${s.tr ?? '-'} / CC ${s.cc ?? '-'} / LR ${s.lr ?? '-'} / GRA ${s.gra ?? '-'}`;
        ic.createEl('div', { text: `${s.date} · 总分 ${s.overall ?? '-'}（${dims}）· ${s.title}`, cls: 'asc-row' });
      }
      const latest = scores[scores.length - 1];
      if (latest.overall !== null) {
        const gap = profile.ielts.target - latest.overall;
        ic.createEl('div', {
          text: gap > 0 ? `距目标还差 ${gap.toFixed(1)}` : '已达目标 🎉',
          cls: 'asc-row asc-strong',
        });
      }
      const weak = this.plugin.ielts.weakestDimension(latest);
      if (weak) ic.createEl('div', { text: `短板维度：${weak}——下一篇可以重点练这里`, cls: 'asc-row asc-muted' });
    } else {
      ic.createEl('div', { text: '还没有批改记录：去教练选「雅思写作训练」，或用命令「雅思：批改当前作文」。', cls: 'asc-hint' });
    }
    const exprs = await this.plugin.expressions.load();
    const dueExprs = await this.plugin.expressions.due();
    ic.createEl('div', {
      text: `表达积累库：共 ${exprs.length} · 已掌握 ${exprs.filter(r => r.status === '已掌握').length} · 到期抽查 ${dueExprs.length}`,
      cls: 'asc-row asc-muted',
    });
    const ibtns = ic.createDiv({ cls: 'asc-row' });
    ibtns.createEl('button', { text: '批改当前作文', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', () => void this.plugin.gradeActiveEssay());
    ibtns.createEl('button', { text: `表达造句抽查（${dueExprs.length}）`, cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => void this.plugin.startExpressionDrill());
    ibtns.createEl('button', { text: '打开批改记录', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => this.openFile(GRADE_LEDGER_PATH));
    ibtns.createEl('button', { text: '打开积累库', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => this.openFile(EXPR_LIB_PATH));

    // 进阶角（牛剑延伸，兴趣驱动，默认低调）
    if (profile.oxbridge.enabled) {
      const due = await this.plugin.errorLog.dueEntries();
      const oc = el.createDiv({ cls: 'asc-card asc-oxbridge-card' });
      oc.createEl('div', { text: '进阶角（牛剑延伸）', cls: 'asc-card-title' });
      oc.createEl('div', { text: oxbridgeGuidance(profile.stage, profile.oxbridge.direction), cls: 'asc-row' });
      oc.createEl('div', {
        text: due.length === 0
          ? '复查队列已清空，可解锁一道思维题 ▸'
          : `建议先清空复查队列（剩 ${due.length} 条）；当然你也可以直接挑战。`,
        cls: 'asc-row asc-muted',
      });
      oc.createDiv({ cls: 'asc-row' })
        .createEl('button', { text: '开始一道思维题（自动计时）', cls: 'asc-btn asc-btn-cta asc-btn-small' })
        .addEventListener('click', () => void this.startOxbridgeSession());
    }

    // 4. 档案摘要与入口（profile 已在函数开头加载）
    const pc = el.createDiv({ cls: 'asc-card' });
    pc.createEl('div', { text: `阶段 ${profile.stage} ｜ 雅思目标 ${profile.ielts.target}（${profile.ielts.focus}）`, cls: 'asc-card-title' });
    for (const [key, sp] of Object.entries(profile.subjects)) {
      if (!sp) continue;
      pc.createEl('div', { text: `${key}：${sp.level} · ${sp.bias} · 目标 ${sp.target}`, cls: 'asc-row' });
    }
    const hint = el.createDiv({ cls: 'asc-hint' });
    hint.setText('主学习在线下，需要协助时才去「教练」页签：概念不懂、题目卡住、作文批改。每次求助都会被记录，插件据此发现弱点。');
    const btnRow = el.createDiv({ cls: 'asc-row' });
    btnRow.createEl('button', { text: '📖 开始一次求助', cls: 'asc-btn asc-btn-cta' }).addEventListener('click', () => { this.tab = 'coach'; this.render(); });
    btnRow.createEl('button', { text: `📌 处理待复查（${radar.dueCount}）`, cls: 'asc-btn' }).addEventListener('click', () => { this.tab = 'review'; this.render(); });
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
  private renderCoach(): void {
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
      this.mode = select.value as ModeKey;
      select.setAttr('title', SUBJECTS.find(s => s.key === this.mode)?.label ?? '');
    });

    bar.createEl('button', { text: '新会话', cls: 'asc-btn' }).addEventListener('click', () => void this.startSession());
    bar.createEl('button', { text: '结题', cls: 'asc-btn' }).addEventListener('click', () => void this.send(CLOSE_PROMPT));
    const iconBtn = (icon: string, label: string, onClick: () => void) => {
      const b = bar.createEl('button', { text: icon, cls: 'asc-btn asc-btn-icon' });
      b.setAttr('aria-label', label);
      b.setAttr('title', label);
      b.addEventListener('click', onClick);
    };
    iconBtn('💾', '存档对话', () => void this.archiveIfNeeded(true));
    iconBtn('🕘', '历史会话', () => this.openHistory());
    iconBtn('📄', '引用文档（全会话上下文）', () => this.openAttachPicker());
    iconBtn('🖼', '附加图片（随下一条消息）', () =>
      new ImagePickerModal(this.app, this.pendingImages, f => {
        this.pendingImages.push(f.path);
        this.render();
      }).open(),
    );
    iconBtn('⏱', this.systemPrompt ? '独立思考计时' : '独立思考计时（先开会话）', () => void this.startTimer());

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

    if (this.pendingImages.length) {
      const chips = el.createDiv({ cls: 'asc-chips' });
      for (const p of this.pendingImages) {
        const name = p.split('/').pop() ?? p;
        const chip = chips.createSpan({ cls: 'asc-chip', text: `🖼 ${name}（随下条消息发送）` });
        chip.createSpan({ text: ' ✕', cls: 'asc-chip-x' }).addEventListener('click', () => {
          this.pendingImages = this.pendingImages.filter(x => x !== p);
          this.render();
        });
      }
    }

    if (this.sessionSummary) {
      el.createDiv({ text: `已注入：${this.sessionSummary}`, cls: 'asc-summary' });
    }

    const chatEl = el.createDiv({ cls: 'asc-chat' });
    if (this.messages.length === 0) {
      chatEl.createDiv({ text: this.systemPrompt ? '会话已开始，把题目或问题发过来。' : '选择科目后点「新会话」开始（自动注入提示词、档案与未消除失分记录）。', cls: 'asc-empty' });
    }
    for (const m of this.messages) {
      const bubble = chatEl.createDiv({ cls: 'asc-msg asc-msg-' + m.role });
      // 展示时剥离机器用 JSON 块（ieltsResult/sessionTag），交互由下方入库卡片承担
      const display = m.role === 'assistant' ? stripMachineBlocks(m.content) : m.content;
      void MarkdownRenderer.render(this.app, display, bubble, '', this.plugin);
      if (m.role === 'assistant' && m === this.messages[this.messages.length - 1]) {
        if (this.mode === 'ielts') this.renderIeltsResultPrompt(bubble, m.content);
        else this.renderLogRowPrompt(bubble);
      }
    }
    chatEl.scrollTop = chatEl.scrollHeight;

    const inputBar = el.createDiv({ cls: 'asc-input-bar' });
    const input = inputBar.createEl('textarea', { attr: { rows: '2', placeholder: this.systemPrompt ? '把题目原文发过来……' : '先点「新会话」开始' } });
    const sendBtn = inputBar.createEl('button', { text: this.busy ? '回复中…' : '发送', cls: 'asc-btn asc-btn-cta' });
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

    // 上下文指示：发送框下方（符合聊天应用习惯；发送前超 80% 自动压缩，也可手动）
    const ctxRow = el.createDiv({ cls: 'asc-ctx-row' });
    const ctx = this.contextTokens();
    const win = this.plugin.settings.contextWindow;
    const ctxEl = ctxRow.createSpan({
      text: `上下文 ≈${formatTokens(ctx)}/${formatTokens(win)}${ctx > win * 0.8 ? ' ⚠' : ''}`,
      cls: 'asc-ctx' + (ctx > win * 0.8 ? ' asc-ctx-warn' : ''),
    });
    ctxEl.setAttr('title', '当前会话的估算上下文；发送前超过 80% 会自动压缩');
    const compressBtn = ctxRow.createEl('button', { text: '压缩', cls: 'asc-btn asc-btn-small' });
    compressBtn.setAttr('title', '把较早对话压缩为摘要，保留最近几轮');
    compressBtn.addEventListener('click', () => void this.compressContext(true));
  }

  /** 进阶角思维题：数学会话 + 自动启动独立思考计时（提示词的思维题分支） */
  private async startOxbridgeSession(): Promise<void> {
    this.tab = 'coach';
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

  /** 上下文压缩：manual=false 时仅在超过 80% 窗口时自动执行 */
  private async compressContext(manual: boolean): Promise<void> {
    if (this.busy) return;
    if (!ContextCompressor.shouldCompress(this.messages)) {
      if (manual) new Notice('对话还短，不需要压缩');
      return;
    }
    const win = this.plugin.settings.contextWindow;
    if (!manual && this.contextTokens() <= win * 0.8) return;
    if (!this.plugin.llm.configured) {
      new Notice('请先在设置里配置 LLM');
      return;
    }
    this.busy = true;
    this.render();
    try {
      const before = this.contextTokens();
      const r = await ContextCompressor.compress(this.messages, this.plugin.llm);
      this.messages = r.messages;
      new Notice(`上下文已压缩：≈${formatTokens(before)} → ≈${formatTokens(this.contextTokens())} token`);
    } catch (e) {
      new Notice(`压缩失败：${e instanceof Error ? e.message : String(e)}`, 8000);
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async startSession(): Promise<void> {
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
  }

  /** 组装 System Prompt（模板 + 档案 + 未消除 log + 进展 + 引用文档） */
  private async rebuildSystemPrompt(): Promise<void> {
    const extras: string[] = [];
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

    this.messages.push({ role: 'user', content: msgText, images: images.length ? images.slice(0, 4) : undefined });
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
      await this.handleReplySideEffects(raw);
    } catch (e) {
      new Notice(`请求失败：${e instanceof Error ? e.message : String(e)}`, 10000);
      this.messages.pop(); // 撤回未成功的用户消息，方便重试
    } finally {
      waiting = false;
      window.clearInterval(waitTicker);
      this.busy = false;
      this.render();
    }
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

  /**
   * 存档：把未落盘的消息增量追加到会话文件。
   * 新会话 / 关闭视图 / 点「存档」都会调用，因此不会丢数据也不会重复写。
   */
  private async archiveIfNeeded(notify: boolean): Promise<void> {
    if (!this.messages.length || this.messages.length <= this.savedCount) return;
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
  private async renderRecords(): Promise<void> {
    const el = this.bodyEl;
    const entries = await this.plugin.errorLog.load();

    el.createEl('div', {
      text: '记录中心：A-Level 失分记录与雅思记录统一展示（数据文件保持独立，不丢信息）。学科表达码（DV/CL/LK）与雅思 LR/GRA 同根。',
      cls: 'asc-hint',
    });
    el.createEl('div', { text: 'A-Level 失分记录', cls: 'asc-section-title' });

    const bar = el.createDiv({ cls: 'asc-row' });
    const subjectSel = bar.createEl('select', { cls: 'asc-select' });
    subjectSel.createEl('option', { text: '全部科目', value: '' });
    for (const s of ['', 'Maths', 'Physics', 'Chem', 'CS', 'Econ']) {
      if (s) subjectSel.createEl('option', { text: s, value: s });
    }
    const statusSel = bar.createEl('select', { cls: 'asc-select' });
    statusSel.createEl('option', { text: '全部状态', value: '' });
    for (const s of ['未消除', '观察中', '已消除']) statusSel.createEl('option', { text: s, value: s });

    const tableWrap = el.createDiv({ cls: 'asc-table-wrap' });
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
      for (const h of ['ID', '日期', '科目', '层级', '考点(EN)', '代码', '描述', '复发', '状态', '复查日期']) {
        head.createEl('th', { text: h });
      }
      for (const e of filtered) {
        const tr = table.createEl('tr');
        for (const cell of [e.id, e.date, e.subject, e.level, e.topic, e.code, e.desc, String(e.recurrence), e.status, e.reviewDate]) {
          tr.createEl('td', { text: cell });
        }
      }
    };
    subjectSel.addEventListener('change', draw);
    statusSel.addEventListener('change', draw);
    draw();

    const open = (path: string) => () => {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) void this.app.workspace.getLeaf(true).openFile(file);
    };

    // 雅思批改记录（评分事件，与失分表语义不同，独立展示）
    el.createEl('div', { text: '雅思批改记录（趋势轨迹）', cls: 'asc-section-title' });
    const scores = await this.plugin.ielts.loadScores();
    if (!scores.length) {
      el.createDiv({ text: '还没有批改记录。', cls: 'asc-empty' });
    } else {
      const st = el.createEl('table', { cls: 'asc-table' });
      const shead = st.createEl('tr');
      for (const h of ['日期', '来源', '总分', 'TR', 'CC', 'LR', 'GRA']) shead.createEl('th', { text: h });
      for (const s of [...scores].reverse()) {
        const tr = st.createEl('tr');
        tr.createEl('td', { text: s.date });
        const srcTd = tr.createEl('td', { text: s.title });
        srcTd.addClass('asc-link');
        srcTd.addEventListener('click', open(s.file));
        for (const v of [s.overall, s.tr, s.cc, s.lr, s.gra]) tr.createEl('td', { text: v === null ? '-' : String(v) });
      }
    }

    // 表达积累库（雅思高分表达 + 学科通用，同一能力池）
    el.createEl('div', { text: '表达积累库（雅思+学科通用）', cls: 'asc-section-title' });
    const exprs = await this.plugin.expressions.load();
    if (!exprs.length) {
      el.createDiv({ text: '还没有积累表达——批改作文后自动入库。', cls: 'asc-empty' });
    } else {
      const et = el.createEl('table', { cls: 'asc-table' });
      const ehead = et.createEl('tr');
      for (const h of ['表达', '类型', '来源', '入库日期', '状态']) ehead.createEl('th', { text: h });
      for (const x of exprs) {
        const tr = et.createEl('tr');
        for (const cell of [x.expr, x.type, x.source, x.date, x.status]) tr.createEl('td', { text: cell });
      }
    }

    // 提问记录（最近 20 条）
    el.createEl('div', { text: '提问记录（最近 20 条）', cls: 'asc-section-title' });
    const tags = (await this.plugin.engine.loadQuestionTags()).slice(-20).reverse();
    if (!tags.length) {
      el.createDiv({ text: '还没有提问记录——每次结题自动打标。', cls: 'asc-empty' });
    } else {
      const tt = el.createEl('table', { cls: 'asc-table' });
      const thead = tt.createEl('tr');
      for (const h of ['日期', '科目', '考点(EN)', '困惑类型', '求助深度']) thead.createEl('th', { text: h });
      for (const t of tags) {
        const tr = tt.createEl('tr');
        for (const cell of [t.date, t.subject, t.topic, t.confusion, t.depth]) tr.createEl('td', { text: cell });
      }
    }

    const links = el.createDiv({ cls: 'asc-row' });
    links.createEl('button', { text: '打开 error-log.md', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(`${ROOT}/记录/error-log.md`));
    links.createEl('button', { text: '批改记录.md', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(GRADE_LEDGER_PATH));
    links.createEl('button', { text: '积累库.md', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(EXPR_LIB_PATH));
    links.createEl('button', { text: '提问记录.md', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(`${ROOT}/记录/提问记录.md`));
    links.createEl('button', { text: '术语清单.md', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(`${ROOT}/记录/术语清单.md`));
  }

  // ─── 复习 ────────────────────────────────────────────────
  private async renderReview(): Promise<void> {
    const el = this.bodyEl;
    const due = await this.plugin.errorLog.dueEntries();

    el.createDiv({
      text: due.length
        ? `${due.length} 条到期复查。复查方式：不重做原题，让 AI 出同考点、同陷阱的变式题。`
        : '没有到期复查。待复查队列到期时这里会出现。',
      cls: 'asc-hint',
    });

    for (const e of due) {
      const card = el.createDiv({ cls: 'asc-card asc-review-card' });
      card.createEl('div', { text: `#${e.id} 【${e.subject}】${e.topic} · ${e.code} · 复发 ${e.recurrence}`, cls: 'asc-card-title' });
      card.createEl('div', { text: e.desc, cls: 'asc-row' });
      if (e.fix) card.createEl('div', { text: `正确做法：${e.fix}`, cls: 'asc-row asc-muted' });
      const btns = card.createDiv({ cls: 'asc-row' });
      btns.createEl('button', { text: '出变式题', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', () => this.startVariantDrill(e));
      btns.createEl('button', { text: '复查通过', cls: 'asc-btn asc-btn-small' }).addEventListener('click', async () => {
        // 状态流转：未消除 → 观察中（复查一次通过）→ 已消除（连续两次）
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

  /** 出变式题：跳到教练页签，用对应科目开会话并预填请求 */
  private async startVariantDrill(e: ErrorLogEntry): Promise<void> {
    this.mode = SUBJECT_TO_MODE[e.subject] ?? 'Maths';
    this.tab = 'coach';
    await this.startSession();
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

/** 剥离回复里机器用 JSON 块（ieltsResult / sessionTag），其他内容原样保留；导出供测试 */
export function stripMachineBlocks(content: string): string {
  return content
    .replace(/```json\s*[\s\S]*?```/g, block => (/"ieltsResult"|"sessionTag"/.test(block) ? '' : block))
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

/** 思考凭证标注（导出供测试）：让教练知道学生真想满了门槛，而非口头声称 */
export function thinkAnnotation(minutes: number): string {
  return `\n\n[插件注：该生刚由插件计时完成 ${minutes} 分钟独立思考，达到卡住耐受力门槛，请把试过的方向列出来再继续。]`;
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
