import { App, Modal, Notice, Setting } from 'obsidian';
import type ALevelStudyCoachPlugin from '../main';
import { extractJson } from '../llm/LlmClient';
import { t } from '../i18n';
import type { CaptureCandidate } from '../types';
import { renderRow } from '../utils/markdown';
import { todayStr } from '../utils/date';
import { JOURNAL_PATH, TERM_LIST_PATH } from '../services/QuestionLogService';

const CAPTURE_PROMPT = `You are the quick-capture assistant of a study-recording tool. Extract the student's single sentence into one entry, output only one valid JSON:
{"type":"progress|error|term|journal","confidence":"high|low","subject":"","text":"","topic":"","code":"","term":""}
Rules:
- progress: study progress, class content, what was learned; error: lost marks, wrong answers, unsolved clues; term: issues about terms or definitions; journal: anything else.
- subject uses one of Maths/Physics/Chem/CS/Econ; leave empty if unsure.
- error code from M,A,U,S,D,P,H,G,T,E,C,R,K,X,Z,DV,CL,LK (CS: L,V,N,B,Q,O; Chem: F,W,J,Y,I; Econ: CR,EV,DG,CX,DF,CF); leave empty if unsure; topic is the English exam-topic name, empty if unsure.
- term: fill the English term name.
- text is a one-sentence summary (keep the student's original meaning).
- Only extract what the student explicitly said; when unsure, prefer journal + confidence low over miscategorizing.`;

const TYPE_LABEL: Record<string, string> = {
  progress: t('capture.type.progress'),
  error: t('capture.type.error'),
  term: t('capture.type.term'),
  journal: t('capture.type.journal'),
};

/** 随手记：自然语言 → AI 提取候选 → 改/收/丢 三个动作 */
export class CaptureModal extends Modal {
  constructor(app: App, private plugin: ALevelStudyCoachPlugin) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal');
    contentEl.createEl('h2', { text: t('capture.title') });
    contentEl.createEl('p', { text: t('capture.desc') });

    const input = contentEl.createEl('textarea', {
      attr: { placeholder: t('capture.placeholder'), rows: '3' },
    });

    const resultEl = contentEl.createDiv();

    new Setting(contentEl).addButton(b =>
      b
        .setButtonText(t('capture.extract'))
        .setCta()
        .onClick(async () => {
          const text = input.value.trim();
          if (!text) return new Notice(t('capture.empty'));
          if (!this.plugin.llm.configured) return new Notice(t('capture.needLlm'));
          b.setButtonText(t('capture.extracting')).setDisabled(true);
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
              new Notice(t('capture.fallbackJournal'));
              this.close();
              return;
            }
            if (c.confidence === 'low') c.type = 'journal'; // 低置信度不强归类
            this.renderCandidate(resultEl, c, text);
          } catch (e) {
            new Notice(t('capture.fail', { msg: e instanceof Error ? e.message : String(e) }), 8000);
            b.setButtonText(t('capture.extract')).setDisabled(false);
          }
        }),
    );
  }

  private renderCandidate(el: HTMLElement, c: CaptureCandidate, source: string): void {
    el.empty();
    const card = el.createDiv({ cls: 'asc-candidate-card' });
    card.createDiv( { text: t('capture.category', { label: TYPE_LABEL[c.type] ?? c.type }), cls: 'asc-candidate-type' });
    const summary = card.createDiv( { text: c.text || source });
    summary.contentEditable = 'true';
    summary.addClass('asc-editable');
    if (c.type === 'error') {
      card.createDiv( {
        text: t('capture.errorLine', { subject: c.subject || '?', topic: c.topic || t('capture.topicPending'), code: c.code || t('capture.codePending') }),
        cls: 'asc-candidate-meta',
      });
    } else if (c.type === 'term') {
      card.createDiv( { text: `${t('capture.type.term')}：${c.term || t('capture.termPending')}${c.subject ? ' · ' + c.subject : ''}`, cls: 'asc-candidate-meta' });
    } else if (c.subject) {
      card.createDiv( { text: t('capture.subject', { subject: c.subject }), cls: 'asc-candidate-meta' });
    }

    new Setting(el)
      .addButton(b =>
        b
          .setButtonText(t('capture.keep'))
          .setCta()
          .onClick(async () => {
            b.setDisabled(true);
            try {
              await this.save(c, summary.textContent?.trim() || source, source);
              this.close();
            } catch (e) {
              new Notice(t('capture.saveFail', { msg: e instanceof Error ? e.message : String(e) }), 8000);
              b.setDisabled(false);
            }
          }),
      )
      .addButton(b =>
        b.setButtonText(t('capture.asJournal')).onClick(async () => {
          await this.saveAsJournal(source);
          this.close();
        }),
      )
      .addButton(b => b.setButtonText(t('capture.discard')).onClick(() => this.close()));
  }

  private async save(c: CaptureCandidate, text: string, source: string): Promise<void> {
    const date = todayStr();
    switch (c.type) {
      case 'progress':
        await this.plugin.progress.append(c.subject || t('capture.other'), text, date);
        break;
      case 'error':
        await this.plugin.errorLog.addEntry({
          subject: c.subject ?? '',
          topic: c.topic || t('capture.topicFill'),
          code: c.code || 'K',
          desc: text,
        });
        break;
      case 'term': {
        const row = renderRow([c.term || t('capture.termPending'), c.subject ?? '', t('capture.termSelf'), '', '', '', '未稳定']);
        await this.plugin.vaultService.append(TERM_LIST_PATH, row);
        break;
      }
      case 'journal':
      default:
        await this.saveAsJournal(source);
        break;
    }
    new Notice(t('capture.saved'));
    void this.plugin.refreshStatusBar();
  }

  private async saveAsJournal(text: string): Promise<void> {
    await this.plugin.vaultService.append(JOURNAL_PATH, `- ${todayStr()} ${text}`);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
