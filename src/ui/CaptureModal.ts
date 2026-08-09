import { App, Modal, Notice, Setting } from 'obsidian';
import type ALevelStudyCoachPlugin from '../main';
import { extractJson } from '../llm/LlmClient';
import type { CaptureCandidate } from '../types';
import { renderRow } from '../utils/markdown';
import { todayStr } from '../utils/date';
import { JOURNAL_PATH, TERM_LIST_PATH } from '../services/QuestionLogService';

const CAPTURE_PROMPT = `你是学习记录工具的随手记助手。请把学生的一句话提取为一个条目，只输出一个合法 JSON：
{"type":"progress|error|term|journal","confidence":"high|low","subject":"","text":"","topic":"","code":"","term":""}
判断规则：
- progress：学习进展、课堂内容、学了什么；error：丢分、做错了、不会做的线索；term：术语或定义方面的问题；journal：都不属于时。
- subject 用 Maths/Physics/Chem/CS/Econ 之一，不确定就留空。
- error 的 code 从 M,A,U,S,D,P,H,G,T,E,C,R,K,X,Z,DV,CL,LK（CS: L,V,N,B,Q,O；Chem: F,W,J,Y,I；Econ: CR,EV,DG,CX,DF,CF）里选，不确定留空；topic 用英文考点名，不确定留空。
- term 的 term 字段填英文术语名。
- text 是一句话摘要（保留学生原意）。
- 只提取学生明确说到的；拿不准的归类宁可给 journal + confidence low，不可错归类。`;

const TYPE_LABEL: Record<string, string> = {
  progress: '学习进展 → 记录/进展/',
  error: '失分线索 → error log',
  term: '术语问题 → 术语清单',
  journal: '学习日志 → 记录/学习日志.md',
};

/** 随手记：自然语言 → AI 提取候选 → 改/收/丢 三个动作 */
export class CaptureModal extends Modal {
  constructor(app: App, private plugin: ALevelStudyCoachPlugin) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal');
    contentEl.createEl('h2', { text: '随手记' });
    contentEl.createEl('p', { text: '用任何表达写一句：学到哪了、哪又错了、哪个术语又不稳。AI 会建议归类，你确认后才入库。' });

    const input = contentEl.createEl('textarea', {
      attr: { placeholder: '例：今天讲了 moments，杠杆平衡的题第一次做基本都对', rows: '3' },
    });

    const resultEl = contentEl.createDiv();

    new Setting(contentEl).addButton(b =>
      b
        .setButtonText('提取')
        .setCta()
        .onClick(async () => {
          const text = input.value.trim();
          if (!text) return new Notice('先写一句');
          if (!this.plugin.llm.configured) return new Notice('请先在设置里配置 LLM');
          b.setButtonText('提取中…').setDisabled(true);
          resultEl.empty();
          try {
            const reply = await this.plugin.llm.chat({
              system: CAPTURE_PROMPT,
              messages: [{ role: 'user', content: text }],
              temperature: 0,
              maxTokens: 512,
            });
            const c = extractJson<CaptureCandidate>(reply);
            if (!c || !c.type) {
              // 解析失败：降级为 journal，宁可不归类不可丢
              await this.saveAsJournal(text);
              new Notice('无法归类，已存入学习日志');
              this.close();
              return;
            }
            if (c.confidence === 'low') c.type = 'journal'; // 低置信度不强归类
            this.renderCandidate(resultEl, c, text);
          } catch (e) {
            new Notice(`提取失败：${e instanceof Error ? e.message : String(e)}`, 8000);
            b.setButtonText('提取').setDisabled(false);
          }
        }),
    );
  }

  private renderCandidate(el: HTMLElement, c: CaptureCandidate, source: string): void {
    el.empty();
    const card = el.createDiv({ cls: 'asc-candidate-card' });
    card.createDiv( { text: `归类：${TYPE_LABEL[c.type] ?? c.type}`, cls: 'asc-candidate-type' });
    const summary = card.createDiv( { text: c.text || source });
    summary.contentEditable = 'true';
    summary.addClass('asc-editable');
    if (c.type === 'error') {
      card.createDiv( {
        text: `【${c.subject || '?'}】${c.topic || '(考点待定)'} · 代码 ${c.code || '(待定)'}`,
        cls: 'asc-candidate-meta',
      });
    } else if (c.type === 'term') {
      card.createDiv( { text: `术语：${c.term || '(待定)'}${c.subject ? ' · ' + c.subject : ''}`, cls: 'asc-candidate-meta' });
    } else if (c.subject) {
      card.createDiv( { text: `科目：${c.subject}`, cls: 'asc-candidate-meta' });
    }

    new Setting(el)
      .addButton(b =>
        b
          .setButtonText('收')
          .setCta()
          .onClick(async () => {
            b.setDisabled(true);
            try {
              await this.save(c, summary.textContent?.trim() || source, source);
              this.close();
            } catch (e) {
              new Notice(`入库失败：${e instanceof Error ? e.message : String(e)}`, 8000);
              b.setDisabled(false);
            }
          }),
      )
      .addButton(b =>
        b.setButtonText('改为日志').onClick(async () => {
          await this.saveAsJournal(source);
          this.close();
        }),
      )
      .addButton(b => b.setButtonText('丢').onClick(() => this.close()));
  }

  private async save(c: CaptureCandidate, text: string, source: string): Promise<void> {
    const date = todayStr();
    switch (c.type) {
      case 'progress':
        await this.plugin.progress.append(c.subject || '其他', text, date);
        break;
      case 'error':
        await this.plugin.errorLog.addEntry({
          subject: c.subject ?? '',
          topic: c.topic || '(待补充)',
          code: c.code || 'K',
          desc: text,
        });
        break;
      case 'term': {
        const row = renderRow([c.term || '(待定)', c.subject ?? '', '（自己抄课本原文）', '', '', '', '未稳定']);
        await this.plugin.vaultService.append(TERM_LIST_PATH, row);
        break;
      }
      case 'journal':
      default:
        await this.saveAsJournal(source);
        break;
    }
    new Notice('已收录');
    void this.plugin.refreshStatusBar();
  }

  private async saveAsJournal(text: string): Promise<void> {
    await this.plugin.vaultService.append(JOURNAL_PATH, `- ${todayStr()} ${text}`);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
