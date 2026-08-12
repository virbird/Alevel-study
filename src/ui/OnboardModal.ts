import { App, Modal, Notice, Setting } from 'obsidian';
import type ALevelStudyCoachPlugin from '../main';
import { extractJson } from '../llm/LlmClient';
import { t } from '../i18n';
import type { OnboardResult } from '../types';
import { todayStr } from '../utils/date';

const EXTRACT_PROMPT = `You are the intake assistant of a study-recording tool. Extract a student's free-form description into structured entries, output only one valid JSON:
{
  "progress": [ {"subject": "subject name", "text": "one-sentence progress"} ],
  "errors": [ {"subject": "subject name", "topic": "English topic name", "code": "losing code", "desc": "one-sentence description", "fix": "correct approach", "specificity": "specific|vague"} ]
}
Rules:
1. Only extract what the student explicitly said — no guessing, no fabrication; anything uncertain goes into no array.
2. progress is what they said about "where they are / what they are studying"; errors is where they said "always wrong / always losing marks / can't do".
3. subject uses one of: Maths / Physics / Chem / CS / Econ.
4. code from: M,A,U,S,D,P,H,G,T,E,C,R,K,X,Z,DV,CL,LK; CS also L,V,N,B,Q,O; Chem also F,W,J,Y,I; Econ also CR,EV,DG,CX,DF,CF. Empty string if unsure.
5. errors.topic uses the English topic name; empty string if unsure.
6. 【Important】judge specificity for every error, choose one of three:
   - specific: did a specific problem, made a specific mistake (which step, miscalculation, missed condition), can point to the concrete wrong behavior → goes to the error log;
   - practice: a tendency about a question type or answering habit (e.g. "experiment questions rarely succeed" "short-answer questions tend to be colloquial" "this topic needs more practice"),
     even if a topic name is mentioned — as long as it describes success rate/habit/tendency rather than one concrete error, it is practice;
   - impression: a vague feeling about a subject or a big chapter (e.g. "mechanics is weak" "chemistry feels off"), cannot name any topic.`;

/**
 * 冷启动引导：用自己的话描述现状 → AI 提取 → 逐条确认入库。
 * 不要求一次说全，能记多少记多少。
 */
export class OnboardModal extends Modal {
  constructor(app: App, private plugin: ALevelStudyCoachPlugin) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('asc-modal');
    contentEl.createEl('h2', { text: t('onboard.title') });
    contentEl.createEl('p', {
      text: t('onboard.desc'),
    });

    const input = contentEl.createEl('textarea', {
      attr: { placeholder: t('onboard.placeholder'), rows: '6' },
    });

    const resultEl = contentEl.createDiv();
    let candidates: OnboardResult | null = null;

    new Setting(contentEl).addButton(b =>
      b
        .setButtonText(t('onboard.extract'))
        .setCta()
        .onClick(async () => {
          const text = input.value.trim();
          if (!text) return new Notice(t('onboard.empty'));
          if (!this.plugin.llm.configured) return new Notice(t('onboard.needLlm'));
          b.setButtonText(t('onboard.extracting')).setDisabled(true);
          resultEl.empty();
          try {
            const reply = await this.plugin.llm.chat({
              system: EXTRACT_PROMPT,
              messages: [{ role: 'user', content: text }],
              temperature: 0,
            });
            candidates = extractJson<OnboardResult>(reply);
            if (!candidates || (!candidates.progress?.length && !candidates.errors?.length)) {
              resultEl.createEl('p', { text: t('onboard.none') });
              return;
            }
            this.renderCandidates(resultEl, candidates, input.value.trim());
          } catch (e) {
            new Notice(t('onboard.fail', { msg: e instanceof Error ? e.message : String(e) }), 8000);
          } finally {
            b.setButtonText(t('onboard.extract')).setDisabled(false);
          }
        }),
    );
  }

  private renderCandidates(el: HTMLElement, c: OnboardResult, source: string): void {
    el.empty();
    const checks: { box: HTMLInputElement; kind: 'progress' | 'error' | 'impression' | 'practice'; idx: number }[] = [];

    if (c.progress?.length) {
      el.createEl('h4', { text: t('onboard.progress', { n: c.progress.length }) });
      c.progress.forEach((p, i) => {
        const row = el.createDiv({ cls: 'asc-candidate' });
        const box = row.createEl('input', { type: 'checkbox' });
        box.checked = true;
        row.createSpan({ text: `【${p.subject}】${p.text}` });
        checks.push({ box, kind: 'progress', idx: i });
      });
    }
    if (c.errors?.length) {
      const specific = c.errors.filter(e => e.specificity === 'specific' && (e.topic || e.desc));
      const practice = c.errors.filter(e => e.specificity === 'practice');
      const vague = c.errors.filter(e => e.specificity === 'impression' || (!e.specificity && !e.topic && !e.desc));
      if (specific.length) {
        el.createEl('h4', { text: t('onboard.specific', { n: specific.length }) });
        specific.forEach(e => {
          const row = el.createDiv({ cls: 'asc-candidate' });
          const box = row.createEl('input', { type: 'checkbox' });
          box.checked = true;
          row.createSpan({ text: `【${e.subject ?? '?'}】${e.topic || t('capture.topicPending')} · ${e.code || t('capture.codePending')} · ${e.desc ?? ''}` });
          checks.push({ box, kind: 'error', idx: c.errors.indexOf(e) });
        });
      }
      if (practice.length) {
        el.createEl('h4', { text: t('onboard.practice', { n: practice.length }) });
        practice.forEach(e => {
          const row = el.createDiv({ cls: 'asc-candidate' });
          const box = row.createEl('input', { type: 'checkbox' });
          box.checked = true;
          row.createSpan({ text: `【${e.subject ?? '?'}】${e.desc || e.topic || t('onboard.noDesc')}` });
          checks.push({ box, kind: 'practice', idx: c.errors.indexOf(e) });
        });
      }
      if (vague.length) {
        el.createEl('h4', { text: t('onboard.vague', { n: vague.length }) });
        vague.forEach(e => {
          const row = el.createDiv({ cls: 'asc-candidate' });
          const box = row.createEl('input', { type: 'checkbox' });
          box.checked = true;
          row.createSpan({ text: `【${e.subject ?? '?'}】${e.desc || t('onboard.noDesc')}` });
          checks.push({ box, kind: 'impression', idx: c.errors.indexOf(e) });
        });
      }
    }

    new Setting(el)
      .addButton(b =>
        b
          .setButtonText(t('onboard.keepSelected'))
          .setCta()
          .onClick(async () => {
            b.setDisabled(true);
            const date = todayStr();
            let saved = 0;
            try {
              for (const ck of checks) {
                if (!ck.box.checked) continue;
                if (ck.kind === 'progress') {
                  const p = c.progress[ck.idx];
                  await this.plugin.progress.append(p.subject, p.text, date);
                  saved++;
                } else if (ck.kind === 'impression') {
                  const e = c.errors[ck.idx];
                  if (!e.desc) continue;
                  await this.plugin.weakImpressions.append(e.subject ?? '', e.desc);
                  saved++;
                } else if (ck.kind === 'practice') {
                  const e = c.errors[ck.idx];
                  const text = e.desc || e.topic;
                  if (!text) continue;
                  await this.plugin.practiceFocus.append(e.subject ?? '', text);
                  saved++;
                } else {
                  const e = c.errors[ck.idx];
                  if (!e.topic && !e.desc) continue;
                  await this.plugin.errorLog.addEntry({
                    subject: e.subject ?? '',
                    topic: e.topic ?? t('capture.topicFill'),
                    code: e.code || 'K',
                    desc: e.desc ?? '',
                    fix: e.fix ?? '',
                  });
                  saved++;
                }
              }
              // 原文也留一份，允许模糊、拒绝空白
              await this.plugin.vaultService.append('StudyCoach/记录/学习日志.md', `\n## ${date} 冷启动记录\n\n${source}\n`);
              new Notice(t('onboard.saved', { n: saved }));
              this.close();
              void this.plugin.refreshStatusBar();
            } catch (err) {
              new Notice(t('onboard.saveFail', { msg: err instanceof Error ? err.message : String(err) }), 8000);
              b.setDisabled(false);
            }
          }),
      )
      .addButton(b => b.setButtonText(t('onboard.discardAll')).onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
