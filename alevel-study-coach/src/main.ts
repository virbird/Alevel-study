import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
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
import { MainView, VIEW_TYPE } from './ui/MainView';
import { StudyCoachSettingTab } from './ui/SettingsTab';
import { OnboardModal } from './ui/OnboardModal';
import { CaptureModal } from './ui/CaptureModal';
import { todayStr, daysBetween } from './utils/date';

export interface CoachPluginSettings {
  llm: LlmSettings;
  /** 每日提醒已发出的日期，避免重复打扰 */
  lastNoticeDate: string;
  /** 统计分析节流：每周提问热点 / 每两周复发热点 */
  lastWeeklyStats: string;
  lastBiweeklyStats: string;
}

const DEFAULT_SETTINGS: CoachPluginSettings = {
  llm: { provider: 'openai-compat', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: '' },
  lastNoticeDate: '',
  lastWeeklyStats: '',
  lastBiweeklyStats: '',
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
  assembler!: PromptAssembler;
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
    this.engine = new InsightEngine(this.vaultService);
    this.suggestions = new SuggestionService(this.vaultService);
    this.stats = new StatsService(this.vaultService, this.engine);
    this.assembler = new PromptAssembler(
      this.vaultService, this.profiles, this.errorLog, this.progress,
      this.weakImpressions, this.practiceFocus, this.stats,
    );

    this.registerView(VIEW_TYPE, leaf => new MainView(leaf, this));

    this.addRibbonIcon('graduation-cap', '打开 A-Level Study Coach', () => this.activateView());

    this.addCommand({ id: 'open-coach', name: '打开学习教练', callback: () => this.activateView() });
    this.addCommand({ id: 'quick-capture', name: '随手记一条', callback: () => new CaptureModal(this.app, this).open() });
    this.addCommand({ id: 'onboarding', name: '冷启动：记录当前学习状况', callback: () => new OnboardModal(this.app, this).open() });

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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.llm = Object.assign({}, DEFAULT_SETTINGS.llm, this.settings.llm);
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
}

export function getLeafForView(plugin: Plugin): WorkspaceLeaf | null {
  return plugin.app.workspace.getLeavesOfType(VIEW_TYPE)[0] ?? null;
}

/** ISO 周标识，用于每周统计节流 */
function isoWeekKey(): string {
  const t = new Date();
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const week1 = new Date(t.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((t.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${t.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
