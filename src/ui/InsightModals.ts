import { App, MarkdownRenderer, Modal, Notice, Setting, TFile } from 'obsidian';
import type ALevelStudyCoachPlugin from '../main';
import { PromptModal } from './PromptModal';
import { t } from '../i18n';
import type { Suggestion } from '../services/SuggestionService';
import { buildDrillSystemPrompt } from '../services/TermService';
import type { TermEntry } from '../services/TermService';
import type { ChatMessage } from '../types';
import { extractJson } from '../llm/LlmClient';
import { createRenderScope } from './RenderScope';

/**
 * 建议卡片详情：展示证据 → 同意后生成学习建议（两段式，征得同意是硬性步骤）。
 */
export class SuggestionModal extends Modal {
  private renderScope = createRenderScope();

  constructor(app: App, private plugin: ALevelStudyCoachPlugin, private suggestion: Suggestion, private onChanged: () => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal');
    contentEl.createEl('h2', { text: this.suggestion.title });
    contentEl.createDiv( { text: `${this.suggestion.kind} · ${this.suggestion.created} · ${this.suggestion.status}`, cls: 'asc-muted' });

    const bodyEl = contentEl.createDiv();
    void MarkdownRenderer.render(this.app, this.suggestion.body, bodyEl, '', this.renderScope);

    const bar = new Setting(contentEl);
    if (this.suggestion.status === '待处理' || !this.suggestion.hasPlan) {
      bar.addButton(b =>
        b
          .setButtonText(t('suggest.agree'))
          .setCta()
          .onClick(async () => {
            if (!this.plugin.llm.configured) return new Notice(t('suggest.needLlm'));
            b.setButtonText(t('suggest.generating')).setDisabled(true);
            try {
              const profile = await this.plugin.profiles.load();
              const plan = await this.plugin.suggestions.generatePlan(
                this.suggestion,
                this.plugin.llm,
                this.plugin.profiles.formatForInjection(profile),
              );
              const planEl = contentEl.createDiv();
              planEl.createEl('h3', { text: t('suggest.planTitle') });
              void MarkdownRenderer.render(this.app, plan, planEl, '', this.renderScope);
              bar.settingEl.remove();
              new Notice(t('suggest.saved'));
              this.onChanged();
            } catch (e) {
              new Notice(t('suggest.fail', { msg: e instanceof Error ? e.message : String(e) }), 8000);
              b.setButtonText(t('suggest.agree')).setDisabled(false);
            }
          }),
      );
    }
    bar.addButton(b =>
      b.setButtonText(t('suggest.openFile')).onClick(() => {
        const file = this.app.vault.getAbstractFileByPath(this.suggestion.file);
        if (file instanceof TFile) void this.app.workspace.getLeaf(true).openFile(file);
      }),
    );
    if (this.suggestion.status === '待处理') {
      bar.addButton(b =>
        b.setButtonText(t('suggest.inaccurate')).onClick(() => {
          new PromptModal(this.app, t('suggest.inaccuratePrompt'), t('suggest.inaccurateDesc'), note => {
            void (async () => {
              await this.plugin.suggestions.setStatus(this.suggestion.file, '不准确', note || undefined);
              new Notice(t('suggest.marked'));
              this.onChanged();
              this.close();
            })();
          }).open();
        }),
      );
    }
  }

  onClose(): void {
    this.renderScope.dispose();
    this.contentEl.empty();
  }
}

const DRILL_CLOSE = 'The drill is over. Summarize the results of all terms and output the drillResults JSON code block.';

/**
 * 模式 E 术语抽查：从题源随机抽 3 条，30 秒盲写，AI 只标结果，结束自动更新状态。
 */
export class DrillModal extends Modal {
  private system = '';
  private messages: ChatMessage[] = [];
  private busy = false;
  private finished = false;
  private renderScope = createRenderScope();

  constructor(app: App, private plugin: ALevelStudyCoachPlugin, private sampled: TermEntry[], private onDone: () => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal', 'asc-drill');
    contentEl.createEl('h2', { text: t('drill.termTitle', { n: this.sampled.length }) });
    contentEl.createEl('p', {
      text: t('drill.termDesc', { list: this.sampled.map(x => x.term).join('、') }),
      cls: 'asc-muted',
    });

    this.system = buildDrillSystemPrompt(this.sampled);

    this.chatEl = contentEl.createDiv({ cls: 'asc-chat asc-drill-chat' });
    const inputBar = contentEl.createDiv({ cls: 'asc-input-bar' });
    this.inputEl = inputBar.createEl('textarea', { attr: { rows: '2', placeholder: t('drill.termInput') } });
    this.sendBtn = inputBar.createEl('button', { text: t('drill.send'), cls: 'asc-btn asc-btn-cta' });
    this.sendBtn.addEventListener('click', () => this.doSend());
    this.inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); this.doSend(); }
    });
    const finishBtn = inputBar.createEl('button', { text: t('drill.finish'), cls: 'asc-btn' });
    finishBtn.addEventListener('click', () => {
      if (!this.finished) void this.send(DRILL_CLOSE);
    });

    void this.send(t('drill.termStart'));
  }

  private chatEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;

  private doSend(): void {
    const text = this.inputEl.value.trim();
    if (!text || this.busy || this.finished) return;
    this.inputEl.value = '';
    void this.send(text);
  }

  private async send(text: string): Promise<void> {
    if (this.busy) return;
    this.messages.push({ role: 'user', content: text });
    this.busy = true;
    this.renderMessages();
    try {
      const reply = await this.plugin.llm.chat({ system: this.system, messages: this.messages, maxTokens: 2000 });
      this.messages.push({ role: 'assistant', content: reply });
      this.renderMessages();
      if (text === DRILL_CLOSE) {
        this.finished = true;
        await this.applyResults(reply);
      }
    } catch (e) {
      new Notice(t('drill.requestFail', { msg: e instanceof Error ? e.message : String(e) }), 8000);
      this.messages.pop();
    } finally {
      this.busy = false;
      this.renderMessages();
    }
  }

  private renderMessages(): void {
    this.chatEl.empty();
    this.renderScope.reset();
    for (const m of this.messages) {
      const bubble = this.chatEl.createDiv({ cls: 'asc-msg asc-msg-' + m.role });
      void MarkdownRenderer.render(this.app, m.content, bubble, '', this.renderScope);
    }
    this.chatEl.scrollTop = this.chatEl.scrollHeight;
    this.sendBtn.setText(this.busy ? t('drill.sending') : t('drill.send'));
    this.sendBtn.disabled = this.busy || this.finished;
  }

  /** 解析 drillResults → 更新术语清单状态 */
  private async applyResults(reply: string): Promise<void> {
    const parsed = extractJson<{ drillResults?: { term: string; pass: boolean }[] }>(reply);
    const results = parsed?.drillResults ?? [];
    if (!results.length) {
      new Notice(t('drill.termNoResult'));
      return;
    }
    const summary: string[] = [];
    for (const r of results) {
      const next = await this.plugin.terms.applyDrillResult(r.term, r.pass);
      if (next) summary.push(t('drill.resultRow', { expr: r.term, result: r.pass ? t('drill.passed') : t('drill.failed'), next }));
    }
    const el = this.contentEl.createDiv({ cls: 'asc-drill-summary' });
    el.createDiv( { text: t('drill.termUpdated'), cls: 'asc-strong' });
    for (const s of summary) el.createDiv( { text: s, cls: 'asc-row' });
    new Notice(t('drill.termDone'));
    this.onDone();
  }

  onClose(): void {
    this.renderScope.dispose();
    this.contentEl.empty();
  }
}

/**
 * 线下练习反馈：复习可以在插件外自己练，把结果用自然语言报回来，
 * AI 解析成三队（失分点/术语/表达）的结构化结果 → 复习页签确认卡片应用。
 */
import type { ReviewFeedback } from './MainView';

const REVIEW_FEEDBACK_PARSE_PROMPT = `You are the parsing module of a study plugin. Organize the student's offline review/practice results into JSON.
Current pending queues:
【Terms】
%s
【Expressions】
%s
【Due error points】
%s
【Uncorrected wrong answers】
%s

Output format (wrapped in a \`\`\`json code block):
{"reviewFeedback": {"terms": [{"name": "term name", "pass": true}], "expressions": [{"name": "expression", "pass": false}], "points": [{"topic": "topic", "pass": true}], "wrongs": [{"topic": "topic", "pass": true}]}}
Rules: only include items the student explicitly mentioned, keep names as close to the queue as possible; pass=true means mastered/passed/understood, false means forgotten/wrong again/not yet; don't invent items not mentioned; for items mentioned but not in the queue, use the closest name.`;

export class OfflineFeedbackModal extends Modal {
  constructor(app: App, private plugin: ALevelStudyCoachPlugin, private context: string, private onParsed: (fb: ReviewFeedback, raw: string) => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal');
    contentEl.createEl('h2', { text: t('offline.title') });
    contentEl.createEl('p', {
      text: t('offline.desc'),
      cls: 'setting-item-description',
    });
    const ta = contentEl.createEl('textarea', { cls: 'asc-textarea', attr: { rows: '6', placeholder: t('offline.placeholder') } });

    const bar = new Setting(contentEl);
    bar.addButton(b =>
      b.setButtonText(t('offline.parse')).setCta().onClick(async () => {
        const text = ta.value.trim();
        if (!text) return new Notice(t('offline.empty'));
        if (!this.plugin.llm.configured) return new Notice(t('offline.needLlm'));
        b.setButtonText(t('offline.parsing')).setDisabled(true);
        try {
          const seg = this.context.split('\n===\n');
          const reply = await this.plugin.llm.chat({
            messages: [
              { role: 'user', content: REVIEW_FEEDBACK_PARSE_PROMPT.replace('%s', seg[0] ?? '').replace('%s', seg[1] ?? '').replace('%s', seg[2] ?? '').replace('%s', seg[3] ?? '') },
              { role: 'user', content: text },
            ],
            maxTokens: 1500,
          });
          const { parseReviewFeedback } = await import('./MainView');
          const fb = parseReviewFeedback(reply);
          const total = fb.terms.length + fb.expressions.length + fb.points.length + fb.wrongs.length;
          if (!total) {
            new Notice(t('offline.none'));
            b.setButtonText(t('offline.parse')).setDisabled(false);
            return;
          }
          this.close();
          this.onParsed(fb, text);
        } catch (e) {
          new Notice(t('offline.fail', { msg: e instanceof Error ? e.message : String(e) }), 8000);
          b.setButtonText(t('offline.parse')).setDisabled(false);
        }
      }),
    );
    bar.addButton(b => b.setButtonText(t('common.cancel')).onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
