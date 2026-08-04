import { App, MarkdownRenderer, Modal, Notice, Setting, TFile } from 'obsidian';
import type ALevelStudyCoachPlugin from '../main';
import type { ExpressionRow } from '../services/ExpressionService';
import type { ChatMessage } from '../types';
import { extractJson } from '../llm/LlmClient';

/** 新建作文笔记：选 Task 类型 + 标题 → 生成模板并打开 */
export class NewEssayModal extends Modal {
  constructor(app: App, private plugin: ALevelStudyCoachPlugin) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal');
    contentEl.createEl('h2', { text: '新建雅思作文笔记' });

    let task = 2;
    new Setting(contentEl).setName('Task 类型').addDropdown(d =>
      d.addOptions({ '2': 'Task 2（议论文）', '1': 'Task 1（图表/书信）' }).setValue('2').onChange(v => { task = Number(v); }),
    );
    let title = '';
    new Setting(contentEl).setName('标题（可留空）').addText(t =>
      t.setPlaceholder('例：教育类 Agree or Disagree').onChange(v => { title = v; }),
    );
    new Setting(contentEl).addButton(b =>
      b.setButtonText('创建并打开').setCta().onClick(async () => {
        const path = await this.plugin.ielts.createEssayNote(task, title);
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) await this.app.workspace.getLeaf(true).openFile(file);
        new Notice('已创建：把作文粘贴到「## 原文」小节，然后「批改当前作文」');
        this.close();
      }),
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

const EXPR_DRILL_CLOSE = '抽查结束。请汇总所有表达的结果，输出 exprResults JSON 代码块。';

/** 表达造句抽查：到期表达逐个造句，AI 判定，结束自动更新间隔档位 */
export class ExpressionDrillModal extends Modal {
  private system = '';
  private messages: ChatMessage[] = [];
  private busy = false;
  private finished = false;

  constructor(app: App, private plugin: ALevelStudyCoachPlugin, private rows: ExpressionRow[]) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal', 'asc-drill');
    contentEl.createEl('h2', { text: `表达造句抽查 · 到期 ${this.rows.length} 条` });
    contentEl.createEl('p', {
      text: `本次抽查：${this.rows.map(r => r.expr).join('、')}。每个表达造一个雅思写作场景的句子，AI 判定后自动更新间隔。`,
      cls: 'asc-muted',
    });

    this.system = this.plugin.expressions.buildDrillPrompt(this.rows);
    this.chatEl = contentEl.createDiv({ cls: 'asc-chat asc-drill-chat' });
    const inputBar = contentEl.createDiv({ cls: 'asc-input-bar' });
    this.inputEl = inputBar.createEl('textarea', { attr: { rows: '2', placeholder: '写下你的英文句子……' } });
    this.sendBtn = inputBar.createEl('button', { text: '发送', cls: 'asc-btn asc-btn-cta' });
    this.sendBtn.addEventListener('click', () => this.doSend());
    this.inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); this.doSend(); }
    });
    inputBar.createEl('button', { text: '抽查结束', cls: 'asc-btn' }).addEventListener('click', () => {
      if (!this.finished) void this.send(EXPR_DRILL_CLOSE);
    });

    void this.send('抽查开始，请给出第一个表达。');
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
      if (text === EXPR_DRILL_CLOSE) {
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

  private async applyResults(reply: string): Promise<void> {
    const parsed = extractJson<{ exprResults?: { expr: string; pass: boolean }[] }>(reply);
    const results = parsed?.exprResults ?? [];
    if (!results.length) {
      new Notice('未解析到抽查结果，请手动在表达积累库更新');
      return;
    }
    const summary: string[] = [];
    for (const r of results) {
      const next = await this.plugin.expressions.applyResult(r.expr, r.pass);
      if (next) summary.push(`${r.expr}：${r.pass ? '通过' : '未通过'} → ${next.status === '已掌握' ? '已掌握' : `下次 ${next.next}`}`);
    }
    const el = this.contentEl.createDiv({ cls: 'asc-drill-summary' });
    el.createEl('div', { text: '抽查结果已更新间隔调度：', cls: 'asc-strong' });
    for (const s of summary) el.createEl('div', { text: s, cls: 'asc-row' });
    new Notice('表达抽查完成');
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
