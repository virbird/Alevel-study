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
import { SessionHistoryModal, AttachPickerModal } from './PickerModals';
import { SuggestionModal, DrillModal } from './InsightModals';
import { NewEssayModal } from './IeltsModals';
import { EXPR_LIB_PATH } from '../services/IeltsService';
import type { TermEntry } from '../services/TermService';

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
  /** 独立思考计时器（提示词门槛的产品硬约束，仅会话内可用） */
  private timerDeadline = 0;
  private timerMinutes = 0;
  /** 计时跑满后的「思考凭证」：下一条消息携带标注后清零 */
  private thinkCredit = 0;
  private timerInterval: number | null = null;

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
    this.containerEl.empty();
  }

  private render(): void {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass('asc-root');

    // 头部
    const header = root.createDiv({ cls: 'asc-header' });
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
      { key: 'ielts', label: '雅思' },
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
      case 'ielts': void this.renderIelts(); break;
    }
  }

  private openFile(path: string): void {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) void this.app.workspace.getLeaf(true).openFile(file);
  }

  // ─── 雅思页签 ─────────────────────────────────────
  private async renderIelts(): Promise<void> {
    const el = this.bodyEl;
    const profile = await this.plugin.profiles.load();

    // 1. 分数趋势与短板
    const scores = await this.plugin.ielts.loadScores();
    const sc = el.createDiv({ cls: 'asc-card' });
    sc.createEl('div', { text: `雅思写作进展（目标 ${profile.ielts.target}，主攻 ${profile.ielts.focus}）`, cls: 'asc-card-title' });
    if (!scores.length) {
      sc.createEl('div', { text: '还没有批改记录：命令「雅思：新建作文笔记」→ 粘贴作文 →「批改当前作文」。', cls: 'asc-hint' });
    } else {
      for (const s of scores.slice(-6).reverse()) {
        const dims = `TR ${s.tr ?? '-'} / CC ${s.cc ?? '-'} / LR ${s.lr ?? '-'} / GRA ${s.gra ?? '-'}`;
        sc.createEl('div', { text: `${s.date} · Task${s.task} · 总分 ${s.overall ?? '-'}（${dims}）`, cls: 'asc-row' });
      }
      const latest = scores[scores.length - 1];
      if (latest.overall !== null) {
        const gap = profile.ielts.target - latest.overall;
        sc.createEl('div', {
          text: gap > 0 ? `最近 ${latest.overall}，距目标还差 ${gap.toFixed(1)}` : `最近 ${latest.overall}，已达目标 🎉`,
          cls: 'asc-row asc-strong',
        });
      }
      const weak = this.plugin.ielts.weakestDimension(latest);
      if (weak) sc.createEl('div', { text: `短板维度：${weak}——下一篇作文可以重点练这里`, cls: 'asc-row asc-muted' });
    }

    // 2. 与 A-Level 联动（表达码与 LR/GRA 同根）
    const entries = await this.plugin.errorLog.load();
    const codes = (await this.plugin.engine.codeCounts(entries, 14)).filter(c => ['DV', 'CL', 'LK', 'E'].includes(c.code));
    const lc = el.createDiv({ cls: 'asc-card' });
    lc.createEl('div', { text: '与 A-Level 联动（练术语 = 练雅思）', cls: 'asc-card-title' });
    lc.createEl('div', {
      text: codes.length ? `近两周学科表达类失分码：${codes.map(c => `${c.code}×${c.count}`).join('  ')}` : '近两周无表达类失分码',
      cls: 'asc-row',
    });
    lc.createEl('div', { text: 'DV/CL/LK/E 与雅思 LR/GRA 是同一能力：学科的术语拦截与链条训练，同时在练雅思学术表达。', cls: 'asc-hint' });

    // 3. 表达积累库
    const exprs = await this.plugin.expressions.load();
    const dueExprs = await this.plugin.expressions.due();
    const mastered = exprs.filter(r => r.status === '已掌握').length;
    const ec = el.createDiv({ cls: 'asc-card' });
    ec.createEl('div', { text: `表达积累库：共 ${exprs.length} · 已掌握 ${mastered} · 到期抽查 ${dueExprs.length}`, cls: 'asc-card-title' });
    const ebtns = ec.createDiv({ cls: 'asc-row' });
    ebtns.createEl('button', { text: `表达造句抽查（${dueExprs.length}）`, cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', () => void this.plugin.startExpressionDrill());
    ebtns.createEl('button', { text: '打开积累库', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => this.openFile(EXPR_LIB_PATH));

    // 4. 作文工作流入口
    const wc = el.createDiv({ cls: 'asc-card' });
    wc.createEl('div', { text: '作文工作流', cls: 'asc-card-title' });
    wc.createEl('div', { text: '新建作文笔记 → 把作文粘到「## 原文」→ 批改当前作文：六段输出回填笔记，分数入库，高分表达进积累库。', cls: 'asc-hint' });
    const wbtns = wc.createDiv({ cls: 'asc-row' });
    wbtns.createEl('button', { text: '新建作文笔记', cls: 'asc-btn asc-btn-cta asc-btn-small' }).addEventListener('click', () => new NewEssayModal(this.app, this.plugin).open());
    wbtns.createEl('button', { text: '批改当前作文', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => void this.plugin.gradeActiveEssay());
    if (scores.length) {
      const last = scores[scores.length - 1].file;
      wbtns.createEl('button', { text: '打开最近一篇', cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => this.openFile(last));
    }
  }

  // ─── 首页 ────────────────────────────────────────────────
  private async renderDashboard(): Promise<void> {
    const el = this.bodyEl;
    const entries = await this.plugin.errorLog.load();
    const pending = (await this.plugin.suggestions.loadAll()).filter(s => s.status === '待处理');

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

    // 4. 档案摘要与入口
    const profile = await this.plugin.profiles.load();
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

  // ─── 教练 ────────────────────────────────────────────────
  private renderCoach(): void {
    const el = this.bodyEl;

    const bar = el.createDiv({ cls: 'asc-coach-bar' });
    const select = bar.createEl('select', { cls: 'asc-select' });
    for (const s of SUBJECTS) {
      select.createEl('option', { text: s.label, value: s.key });
    }
    select.value = this.mode;
    select.addEventListener('change', () => { this.mode = select.value as ModeKey; });

    bar.createEl('button', { text: '新会话', cls: 'asc-btn' }).addEventListener('click', () => void this.startSession());
    bar.createEl('button', { text: '结题', cls: 'asc-btn' }).addEventListener('click', () => void this.send(CLOSE_PROMPT));
    bar.createEl('button', { text: '存档', cls: 'asc-btn' }).addEventListener('click', () => void this.archiveIfNeeded(true));
    bar.createEl('button', { text: '历史', cls: 'asc-btn' }).addEventListener('click', () => this.openHistory());
    bar.createEl('button', { text: '＋文档', cls: 'asc-btn' }).addEventListener('click', () => this.openAttachPicker());
    bar.createEl('button', { text: '⏱ 独立思考', cls: 'asc-btn' + (this.systemPrompt ? '' : ' asc-btn-disabled') }).addEventListener('click', () => void this.startTimer());

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
      chatEl.createDiv({ text: this.systemPrompt ? '会话已开始，把题目或问题发过来。' : '选择科目后点「新会话」开始（自动注入提示词、档案与未消除失分记录）。', cls: 'asc-empty' });
    }
    for (const m of this.messages) {
      const bubble = chatEl.createDiv({ cls: 'asc-msg asc-msg-' + m.role });
      void MarkdownRenderer.render(this.app, m.content, bubble, '', this.plugin);
      if (m.role === 'assistant' && m === this.messages[this.messages.length - 1]) {
        this.renderLogRowPrompt(bubble);
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
        const truncated = c.length > 20000 ? c.slice(0, 20000) + '\n……（内容过长已截断）' : c;
        extras.push(`════════ 插件注入：参考文档「${a.name}」════════\n以下是学生指定的参考文档，讨论时以它为准：\n${truncated}`);
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
    // 思考凭证：计时跑满后的第一条消息带上标注，供教练按思维题模式验证
    const content = this.thinkCredit > 0 ? text + thinkAnnotation(this.thinkCredit) : text;
    this.thinkCredit = 0;
    this.messages.push({ role: 'user', content });
    this.busy = true;
    this.render();
    try {
      const reply = await this.plugin.llm.chat({
        system: this.systemPrompt,
        messages: this.messages,
        maxTokens: 4096,
      });
      this.messages.push({ role: 'assistant', content: reply });
      await this.handleReplySideEffects(reply);
    } catch (e) {
      new Notice(`请求失败：${e instanceof Error ? e.message : String(e)}`, 10000);
      this.messages.pop(); // 撤回未成功的用户消息，方便重试
    } finally {
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
      void this.rebuildSystemPrompt().then(() => this.render());
    }).open();
  }

  // ─── 记录 ────────────────────────────────────────────────
  private async renderRecords(): Promise<void> {
    const el = this.bodyEl;
    const entries = await this.plugin.errorLog.load();

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

    const links = el.createDiv({ cls: 'asc-row' });
    const open = (path: string) => () => {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) void this.app.workspace.getLeaf(true).openFile(file);
    };
    links.createEl('button', { text: '打开 error-log.md', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(`${ROOT}/记录/error-log.md`));
    links.createEl('button', { text: '提问记录', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(`${ROOT}/记录/提问记录.md`));
    links.createEl('button', { text: '术语清单', cls: 'asc-btn asc-btn-small' }).addEventListener('click', open(`${ROOT}/记录/术语清单.md`));
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
