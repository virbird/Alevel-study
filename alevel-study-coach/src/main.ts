import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import type { LlmSettings } from './types';
import { LlmClient } from './llm/LlmClient';
import { VaultService } from './services/VaultService';
import { ProfileService } from './services/ProfileService';
import { ErrorLogService } from './services/ErrorLogService';
import { QuestionLogService, ProgressService, WeakImpressionService, PracticeFocusService } from './services/QuestionLogService';
import { PromptAssembler } from './services/PromptAssembler';
import { InsightEngine } from './services/InsightEngine';
import { SuggestionService } from './services/SuggestionService';
import { StatsService } from './services/StatsService';
import { TermListService } from './services/TermService';
import { IeltsService } from './services/IeltsService';
import { ExpressionService } from './services/ExpressionService';
import { ReportService } from './services/ReportService';
import { MainView, VIEW_TYPE } from './ui/MainView';
import { StudyCoachSettingTab } from './ui/SettingsTab';
import { OnboardModal } from './ui/OnboardModal';
import { CaptureModal } from './ui/CaptureModal';
import { ExpressionDrillModal, GradeConfirmModal } from './ui/IeltsModals';
import { todayStr, daysBetween, isoWeekKey } from './utils/date';

export interface CoachPluginSettings {
  llm: LlmSettings;
  /** 每日提醒已发出的日期，避免重复打扰 */
  lastNoticeDate: string;
  /** 统计分析节流：每周提问热点 / 每两周复发热点 */
  lastWeeklyStats: string;
  lastBiweeklyStats: string;
  /** 候选模型列表：按 provider 分别配置（英文逗号分隔），教练页签可快捷切换 */
  modelCandidates: Record<string, string>;
  /** 上下文窗口大小（token，用于展示与自动压缩阈值） */
  contextWindow: number;
}

/** 批改任务状态：后台运行，雅思页签内展示进度与结果，不阻塞其他操作 */
export interface GradingTask {
  path: string;
  basename: string;
  status: 'running' | 'success' | 'cancelled' | 'timeout' | 'failed';
  started: number;
  elapsed: number;
  message: string;   // 终态摘要（成功/失败原因）
}

const DEFAULT_SETTINGS: CoachPluginSettings = {
  llm: { provider: 'openai-compat', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: '' },
  lastNoticeDate: '',
  lastWeeklyStats: '',
  lastBiweeklyStats: '',
  modelCandidates: { 'openai-compat': '', anthropic: '' },
  contextWindow: 128000,
};

export default class ALevelStudyCoachPlugin extends Plugin {
  settings!: CoachPluginSettings;
  vaultService!: VaultService;
  profiles!: ProfileService;
  errorLog!: ErrorLogService;
  questionLog!: QuestionLogService;
  progress!: ProgressService;
  weakImpressions!: WeakImpressionService;
  practiceFocus!: PracticeFocusService;
  terms!: TermListService;
  engine!: InsightEngine;
  suggestions!: SuggestionService;
  stats!: StatsService;
  ielts!: IeltsService;
  expressions!: ExpressionService;
  reports!: ReportService;
  assembler!: PromptAssembler;
  /** 当前批改任务（后台运行，雅思页签展示） */
  gradingTask: GradingTask | null = null;
  private gradingAbort: AbortController | null = null;
  private gradingCancelled = false;
  private gradingTicker: number | null = null;
  private statusBarEl!: HTMLElement;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.vaultService = new VaultService(this.app, this.manifest.dir ?? '');
    this.profiles = new ProfileService(this.vaultService);
    this.errorLog = new ErrorLogService(this.vaultService);
    this.questionLog = new QuestionLogService(this.vaultService);
    this.progress = new ProgressService(this.vaultService);
    this.weakImpressions = new WeakImpressionService(this.vaultService);
    this.practiceFocus = new PracticeFocusService(this.vaultService);
    this.terms = new TermListService(this.vaultService);
    this.ielts = new IeltsService(this.vaultService);
    this.expressions = new ExpressionService(this.vaultService);
    this.engine = new InsightEngine(this.vaultService);
    this.suggestions = new SuggestionService(this.vaultService);
    this.stats = new StatsService(this.vaultService, this.engine);
    this.reports = new ReportService(this.vaultService, this.errorLog, this.engine, this.terms, this.ielts, this.suggestions);
    this.assembler = new PromptAssembler(
      this.vaultService, this.profiles, this.errorLog, this.progress,
      this.weakImpressions, this.practiceFocus, this.stats,
    );

    this.registerView(VIEW_TYPE, leaf => new MainView(leaf, this));

    this.addRibbonIcon('graduation-cap', '打开 A-Level Study Coach', () => this.activateView());

    this.addCommand({ id: 'open-coach', name: '打开学习教练', callback: () => this.activateView() });
    this.addCommand({ id: 'quick-capture', name: '随手记一条', callback: () => new CaptureModal(this.app, this).open() });
    this.addCommand({ id: 'onboarding', name: '冷启动：记录当前学习状况', callback: () => new OnboardModal(this.app, this).open() });
    this.addCommand({ id: 'ielts-grade', name: '雅思：批改当前作文', callback: () => void this.gradeActiveEssay() });
    this.addCommand({ id: 'ielts-expr-drill', name: '雅思：表达造句抽查', callback: () => void this.startExpressionDrill() });
    this.addCommand({ id: 'export-weekly', name: '导出本周周报', callback: () => void this.exportWeeklyReport() });

    this.addSettingTab(new StudyCoachSettingTab(this.app, this));

    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass('asc-statusbar');
    this.statusBarEl.addEventListener('click', () => this.activateView());

    await this.vaultService.init();
    void this.refreshStatusBar();

    this.app.workspace.onLayoutReady(() => {
      void this.dailyReminder();
      void this.runAnalysisCycle();
    });
  }

  get llm(): LlmClient {
    return new LlmClient(this.settings.llm);
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      const right = workspace.getRightLeaf(false);
      if (!right) return;
      leaf = right;
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    const raw = ((await this.loadData()) ?? {}) as Record<string, unknown>;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
    this.settings.llm = Object.assign({}, DEFAULT_SETTINGS.llm, this.settings.llm);
    // 候选模型列表：按 provider 分开存；旧版全局字符串迁移到两个 provider
    const mc = raw.modelCandidates;
    if (typeof mc === 'string') {
      this.settings.modelCandidates = { 'openai-compat': mc, anthropic: mc };
    } else {
      this.settings.modelCandidates = Object.assign({}, DEFAULT_SETTINGS.modelCandidates, (mc as Record<string, string>) ?? {});
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** 状态栏徽标：待复习数 */
  async refreshStatusBar(): Promise<void> {
    try {
      const due = await this.errorLog.dueEntries();
      this.statusBarEl.setText(due.length > 0 ? `📌 ${due.length}` : '📌 0');
      this.statusBarEl.setAttribute('aria-label', due.length > 0 ? `${due.length} 条失分点待复查` : '没有待复查条目');
    } catch {
      this.statusBarEl.setText('📌');
    }
  }

  /** 每日首次打开提醒一次待复查；辅助工具定位：温和、不重复、不升级 */
  async dailyReminder(): Promise<void> {
    const today = todayStr();
    if (this.settings.lastNoticeDate === today) return;
    const due = await this.errorLog.dueEntries();
    this.settings.lastNoticeDate = today;
    await this.saveSettings();
    if (due.length === 0) return;
    const minutes = Math.max(3, due.length * 3);
    new Notice(`A-Level Coach：有 ${due.length} 条失分点到期复查，预计 ${minutes} 分钟。点击 📌 打开。`, 8000);
  }

  /**
   * 分析循环（每次启动跑，内部节流）：
   * 每周提问热点 / 每两周复发热点写入统计分析；之后同步建议候选（按 key 去重，幂等）。
   */
  async runAnalysisCycle(): Promise<void> {
    try {
      const today = todayStr();
      const entries = await this.errorLog.load();
      let statsChanged = false;

      const wk = isoWeekKey();
      if (this.settings.lastWeeklyStats !== wk) {
        await this.stats.runQuestionWeekly();
        this.settings.lastWeeklyStats = wk;
        statsChanged = true;
      }
      const lastBi = this.settings.lastBiweeklyStats;
      if (!lastBi || daysBetween(lastBi, today) >= 14) {
        await this.stats.runHotspotBiweekly(entries);
        this.settings.lastBiweeklyStats = today;
        statsChanged = true;
      }
      if (statsChanged) await this.saveSettings();

      const terms = await this.terms.load();
      const candidates = await this.engine.generateCandidates(entries, terms);
      const created = await this.suggestions.syncCandidates(candidates);
      if (created > 0) {
        new Notice(`A-Level Coach：发现 ${created} 个新弱点信号，首页查看建议卡片。`, 8000);
      }
    } catch {
      // 分析失败不阻塞主功能
    }
  }

  /** 批改入口：先弹窗确认目标文件（避免误批改），确认后走 gradeFilePath */
  async gradeActiveEssay(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || !file.path.endsWith('.md')) {
      new Notice('请先打开含作文的笔记（题目与作文可写在同一篇，支持图片）');
      return;
    }
    new GradeConfirmModal(this.app, this, file.path).open();
  }

  /**
   * 批改指定笔记：后台任务模式——立即返回，雅思页签显示任务卡片（进度+可取消），
   * 用户可切走干别的，回来直接看结果。
   */
  async gradeFilePath(path: string): Promise<void> {
    if (!this.llm.configured) {
      new Notice('请先在设置里配置 LLM');
      return;
    }
    if (this.gradingTask?.status === 'running') {
      new Notice('已有一个批改任务进行中，等它完成或取消后再发起');
      return;
    }
    const basename = path.split('/').pop()?.replace(/\.md$/, '') ?? path;
    const controller = new AbortController();
    this.gradingAbort = controller;
    this.gradingCancelled = false;
    const task: GradingTask = { path, basename, status: 'running', started: Date.now(), elapsed: 0, message: '' };
    this.gradingTask = task;
    if (this.gradingTicker !== null) window.clearInterval(this.gradingTicker);
    this.gradingTicker = window.setInterval(() => {
      task.elapsed = Math.round((Date.now() - task.started) / 1000);
    }, 1000);
    const timeoutId = window.setTimeout(() => controller.abort(), GRADE_TIMEOUT_MS);
    this.refreshCoachViews(true);

    try {
      const result = await this.ielts.gradeNote(path, this.llm, controller.signal);
      const added = await this.expressions.appendAll(result.expressions, basename);
      const s = result.scores;
      task.status = 'success';
      task.message =
        `用时 ${task.elapsed} 秒${s.overall !== null ? ` · 预估总分 ${s.overall}` : ''}` +
        `${result.imageCount ? ` · 含 ${result.imageCount} 张图片` : ''}${added ? ` · ${added} 条高分表达进积累库` : ''}` +
        ' · 结果已写入笔记「## AI 批改」小节';
      new Notice(`✅ 批改成功：${basename}，去雅思页签查看详情`, 6000);
    } catch (e) {
      if (this.gradingCancelled) {
        task.status = 'cancelled';
        task.message = '已取消，未产生任何写入';
      } else if (controller.signal.aborted) {
        task.status = 'timeout';
        task.message = `等待超过 ${GRADE_TIMEOUT_MS / 1000} 秒。请检查网络/模型后重试，或换更快的模型`;
        new Notice(`⏱ 批改超时：${basename}`, 8000);
      } else {
        task.status = 'failed';
        task.message = e instanceof Error ? e.message : String(e);
        new Notice(`❌ 批改失败：${basename}`, 8000);
      }
    } finally {
      if (this.gradingTicker !== null) {
        window.clearInterval(this.gradingTicker);
        this.gradingTicker = null;
      }
      window.clearTimeout(timeoutId);
      this.gradingAbort = null;
      this.refreshCoachViews(true);
    }
  }

  /** 当前 provider 的候选模型列表（当前模型始终包含） */
  modelList(): string[] {
    const raw = this.settings.modelCandidates[this.settings.llm.provider] ?? '';
    const list = raw.split(',').map(s => s.trim()).filter(Boolean);
    const cur = this.settings.llm.model.trim();
    if (cur && !list.includes(cur)) list.unshift(cur);
    return list;
  }

  /** 保存当前 provider 的候选模型列表 */
  async setModelCandidates(value: string): Promise<void> {
    this.settings.modelCandidates[this.settings.llm.provider] = value;
    await this.saveSettings();
  }

  currentModelCandidates(): string {
    return this.settings.modelCandidates[this.settings.llm.provider] ?? '';
  }

  /** 取消当前批改任务 */
  cancelGrading(): void {
    if (this.gradingTask?.status !== 'running') return;
    this.gradingCancelled = true;
    this.gradingAbort?.abort();
  }

  /** 长任务状态变化后刷新插件视图；switchToHome=true 时切到首页（批改任务卡片在首页顶部，不打断教练会话） */
  private refreshCoachViews(switchToHome = false): void {
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    const view = leaf?.view as unknown as { refresh?: () => void; showHome?: () => void; currentTab?: string } | undefined;
    if (!view) return;
    if (switchToHome && view.showHome && view.currentTab !== 'coach') {
      view.showHome();
    } else if (view.refresh) {
      view.refresh();
    }
  }

  /** 表达造句抽查：到期表达入队 */
  async startExpressionDrill(): Promise<void> {
    if (!this.llm.configured) {
      new Notice('请先在设置里配置 LLM');
      return;
    }
    const due = await this.expressions.due();
    if (!due.length) {
      new Notice('没有到期表达——批改作文会自动积累，或在表达积累库手动添加');
      return;
    }
    new ExpressionDrillModal(this.app, this, due).open();
  }

  /** 导出本周周报：六块统计落盘 周报/ 并打开 */
  async exportWeeklyReport(): Promise<void> {
    try {
      const path = await this.reports.exportWeekly();
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) await this.app.workspace.getLeaf(true).openFile(file);
      new Notice(`周报已生成：${path}`);
    } catch (e) {
      new Notice(`周报生成失败：${e instanceof Error ? e.message : String(e)}`, 8000);
    }
  }
}

export function getLeafForView(plugin: Plugin): WorkspaceLeaf | null {
  return plugin.app.workspace.getLeavesOfType(VIEW_TYPE)[0] ?? null;
}

/** 批改超时：含图片的六段输出较慢，给足余量 */
const GRADE_TIMEOUT_MS = 300_000;
