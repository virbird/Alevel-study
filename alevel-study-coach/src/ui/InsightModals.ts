import { App, MarkdownRenderer, Modal, Notice, Setting, TFile } from 'obsidian';
import type ALevelStudyCoachPlugin from '../main';
import type { Suggestion } from '../services/SuggestionService';
import { buildDrillSystemPrompt } from '../services/TermService';
import type { TermEntry } from '../services/TermService';
import type { ChatMessage } from '../types';
import { extractJson } from '../llm/LlmClient';

/**
 * 建议卡片详情：展示证据 → 同意后生成学习建议（两段式，征得同意是硬性步骤）。
 */
export class SuggestionModal extends Modal {
  constructor(app: App, private plugin: ALevelStudyCoachPlugin, private suggestion: Suggestion, private onChanged: () => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal');
    contentEl.createEl('h2', { text: this.suggestion.title });
    contentEl.createEl('div', { text: `${this.suggestion.kind} · ${this.suggestion.created} · ${this.suggestion.status}`, cls: 'asc-muted' });

    const bodyEl = contentEl.createDiv();
    void MarkdownRenderer.render(this.app, this.suggestion.body, bodyEl, '', this.plugin);

    const bar = new Setting(contentEl);
    if (this.suggestion.status === '待处理' || !this.suggestion.hasPlan) {
      bar.addButton(b =>
        b
          .setButtonText('同意，生成学习建议')
          .setCta()
          .onClick(async () => {
            if (!this.plugin.llm.configured) return new Notice('请先在设置里配置 LLM');
            b.setButtonText('生成中…').setDisabled(true);
            try {
              const profile = await this.plugin.profiles.load();
              const plan = await this.plugin.suggestions.generatePlan(
                this.suggestion,
                this.plugin.llm,
                this.plugin.profiles.formatForInjection(profile),
              );
              const planEl = contentEl.createDiv();
              planEl.createEl('h3', { text: '学习建议（带回线下执行）' });
              void MarkdownRenderer.render(this.app, plan, planEl, '', this.plugin);
              bar.settingEl.remove();
              new Notice('学习建议已生成并保存到建议文件');
              this.onChanged();
            } catch (e) {
              new Notice(`生成失败：${e instanceof Error ? e.message : String(e)}`, 8000);
              b.setButtonText('同意，生成学习建议').setDisabled(false);
            }
          }),
      );
    }
    bar.addButton(b =>
      b.setButtonText('打开建议文件').onClick(() => {
        const file = this.app.vault.getAbstractFileByPath(this.suggestion.file);
        if (file instanceof TFile) void this.app.workspace.getLeaf(true).openFile(file);
      }),
    );
    if (this.suggestion.status === '待处理') {
      bar.addButton(b =>
        b.setButtonText('不准确').onClick(async () => {
          const note = window.prompt('哪里判断得不准确？（会记录到建议文件，帮助之后的分析）') ?? '';
          await this.plugin.suggestions.setStatus(this.suggestion.file, '不准确', note || undefined);
          new Notice('已标记为不准确');
          this.onChanged();
          this.close();
        }),
      );
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

const DRILL_CLOSE = '抽查结束。请汇总所有术语的结果，输出 drillResults JSON 代码块。';

/**
 * 模式 E 术语抽查：从题源随机抽 3 条，30 秒盲写，AI 只标结果，结束自动更新状态。
 */
export class DrillModal extends Modal {
  private system = '';
  private messages: ChatMessage[] = [];
  private busy = false;
  private finished = false;

  constructor(app: App, private plugin: ALevelStudyCoachPlugin, private sampled: TermEntry[], private onDone: () => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal', 'asc-drill');
    contentEl.createEl('h2', { text: `术语抽查（模式 E）· 抽到 ${this.sampled.length} 条` });
    contentEl.createEl('p', {
      text: `本次抽查：${this.sampled.map(t => t.term).join('、')}。每个术语 30 秒内凭记忆写英文定义，AI 只标「完整/漏成分/有口语词」。`,
      cls: 'asc-muted',
    });

    this.system = buildDrillSystemPrompt(this.sampled);

    this.chatEl = contentEl.createDiv({ cls: 'asc-chat asc-drill-chat' });
    const inputBar = contentEl.createDiv({ cls: 'asc-input-bar' });
    this.inputEl = inputBar.createEl('textarea', { attr: { rows: '2', placeholder: '写下你的英文定义……' } });
    this.sendBtn = inputBar.createEl('button', { text: '发送', cls: 'asc-btn asc-btn-cta' });
    this.sendBtn.addEventListener('click', () => this.doSend());
    this.inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); this.doSend(); }
    });
    const finishBtn = inputBar.createEl('button', { text: '抽查结束', cls: 'asc-btn' });
    finishBtn.addEventListener('click', () => {
      if (!this.finished) void this.send(DRILL_CLOSE);
    });

    void this.send('抽查开始，请给出第一个术语。');
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
      new Notice(`请求失败：${e instanceof Error ? e.message : String(e)}`, 8000);
      this.messages.pop();
    } finally {
      this.busy = false;
      this.renderMessages();
    }
  }

  private renderMessages(): void {
    this.chatEl.empty();
    for (const m of this.messages) {
      const bubble = this.chatEl.createDiv({ cls: 'asc-msg asc-msg-' + m.role });
      void MarkdownRenderer.render(this.app, m.content, bubble, '', this.plugin);
    }
    this.chatEl.scrollTop = this.chatEl.scrollHeight;
    this.sendBtn.setText(this.busy ? '回复中…' : '发送');
    this.sendBtn.disabled = this.busy || this.finished;
  }

  /** 解析 drillResults → 更新术语清单状态 */
  private async applyResults(reply: string): Promise<void> {
    const parsed = extractJson<{ drillResults?: { term: string; pass: boolean }[] }>(reply);
    const results = parsed?.drillResults ?? [];
    if (!results.length) {
      new Notice('未解析到抽查结果，请手动在术语清单更新状态');
      return;
    }
    const summary: string[] = [];
    for (const r of results) {
      const next = await this.plugin.terms.applyDrillResult(r.term, r.pass);
      if (next) summary.push(`${r.term}：${r.pass ? '通过' : '未通过'} → ${next}`);
    }
    const el = this.contentEl.createDiv({ cls: 'asc-drill-summary' });
    el.createEl('div', { text: '抽查结果已写入术语清单：', cls: 'asc-strong' });
    for (const s of summary) el.createEl('div', { text: s, cls: 'asc-row' });
    new Notice('抽查完成，术语状态已更新');
    this.onDone();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/**
 * 线下练习反馈：复习可以在插件外自己练，把结果用自然语言报回来，
 * AI 解析成三队（失分点/术语/表达）的结构化结果 → 复习页签确认卡片应用。
 */
import type { ReviewFeedback } from './MainView';

const REVIEW_FEEDBACK_PARSE_PROMPT = `你是学习插件的解析模块。把学生线下复习/练习的结果整理成 JSON。
当前待处理队列：
【术语】
%s
【表达】
%s
【到期失分点】
%s
【未订正错题】
%s

输出格式（用 \`\`\`json 代码块包裹）：
{"reviewFeedback": {"terms": [{"name": "术语名", "pass": true}], "expressions": [{"name": "表达", "pass": false}], "points": [{"topic": "考点", "pass": true}], "wrongs": [{"topic": "错题考点", "pass": true}]}}
规则：只收录学生明确提到的条目，名称尽量与队列一致；pass=true 表示掌握/通过/会了，false 表示忘了/又错/还不会；不要编造未提到的条目；学生提到但队列里没有的，用最接近的名称收录。`;

export class OfflineFeedbackModal extends Modal {
  constructor(app: App, private plugin: ALevelStudyCoachPlugin, private context: string, private onParsed: (fb: ReviewFeedback, raw: string) => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal');
    contentEl.createEl('h2', { text: '汇报线下练习结果' });
    contentEl.createEl('p', {
      text: '复习也可以线下自己练。把结果用自然语言写下来，例如：「ceteris paribus 和 opportunity cost 背熟了，effervescence 还是记混；inverse relationship 我会造句了；上次 moments 那道变式题线下重做，做对了。」',
      cls: 'setting-item-description',
    });
    const ta = contentEl.createEl('textarea', { cls: 'asc-textarea', attr: { rows: '6', placeholder: '今天线下练了什么？结果如何？' } });

    const bar = new Setting(contentEl);
    bar.addButton(b =>
      b.setButtonText('解析并汇报').setCta().onClick(async () => {
        const text = ta.value.trim();
        if (!text) return new Notice('先写点什么');
        if (!this.plugin.llm.configured) return new Notice('请先在设置里配置 LLM');
        b.setButtonText('解析中…').setDisabled(true);
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
            new Notice('没有解析出可应用的反馈，请写得更具体些（提到具体的术语/表达/考点名）');
            b.setButtonText('解析并汇报').setDisabled(false);
            return;
          }
          this.close();
          this.onParsed(fb, text);
        } catch (e) {
          new Notice(`解析失败：${e instanceof Error ? e.message : String(e)}`, 8000);
          b.setButtonText('解析并汇报').setDisabled(false);
        }
      }),
    );
    bar.addButton(b => b.setButtonText('取消').onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
