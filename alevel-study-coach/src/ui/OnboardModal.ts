import { App, Modal, Notice, Setting } from 'obsidian';
import type ALevelStudyCoachPlugin from '../main';
import { extractJson } from '../llm/LlmClient';
import type { OnboardResult } from '../types';
import { todayStr } from '../utils/date';

const EXTRACT_PROMPT = `你是学习记录工具的录入助手。请把学生的一段自由描述提取为结构化条目，只输出一个合法 JSON：
{
  "progress": [ {"subject": "科目名", "text": "一句话进展"} ],
  "errors": [ {"subject": "科目名", "topic": "考点英文名", "code": "失分代码", "desc": "一句话描述", "fix": "正确做法"} ]
}
规则：
1. 只提取学生明确说到的信息，不猜测不编造；无法确定的不放进任何数组。
2. progress 是他说的"学到哪了 / 最近在学什么"；errors 是他说的"老错 / 老丢分 / 不会"的地方。
3. subject 用：Maths / Physics / Chem / CS / Econ。
4. code 从下面选一个：M,A,U,S,D,P,H,G,T,E,C,R,K,X,Z,DV,CL,LK；CS 另有 L,V,N,B,Q,O；Chem 另有 F,W,J,Y,I；Econ 另有 CR,EV,DG,CX,DF,CF。不确定就填空字符串。
5. errors 的 topic 用英文考点名，不确定就填空字符串。`;

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
    contentEl.createEl('h2', { text: '冷启动：记录你的当前学习状况' });
    contentEl.createEl('p', {
      text: '用你自己的话说说：各科学到哪了？最近哪些地方老丢分？不用一次说全，想到什么写什么，之后随时可以用「随手记」补充。',
    });

    const input = contentEl.createEl('textarea', {
      attr: { placeholder: '例：数学 AS 学到 differentiation 了，物理上周考试受力分解又错了，化学方程式配平感觉还行……', rows: '6' },
    });
    input.style.width = '100%';

    const resultEl = contentEl.createDiv();
    let candidates: OnboardResult | null = null;

    new Setting(contentEl).addButton(b =>
      b
        .setButtonText('AI 提取')
        .setCta()
        .onClick(async () => {
          const text = input.value.trim();
          if (!text) return new Notice('先写点什么再提取');
          if (!this.plugin.llm.configured) return new Notice('请先在设置里配置 LLM（接口 / Key / 模型）');
          b.setButtonText('提取中…').setDisabled(true);
          resultEl.empty();
          try {
            const reply = await this.plugin.llm.chat({
              system: EXTRACT_PROMPT,
              messages: [{ role: 'user', content: text }],
              temperature: 0,
            });
            candidates = extractJson<OnboardResult>(reply);
            if (!candidates || (!candidates.progress?.length && !candidates.errors?.length)) {
              resultEl.createEl('p', { text: '没有提取到可入库的信息。可以说得更具体一点，或直接关闭此窗口。' });
              return;
            }
            this.renderCandidates(resultEl, candidates, input.value.trim());
          } catch (e) {
            new Notice(`提取失败：${e instanceof Error ? e.message : String(e)}`, 8000);
          } finally {
            b.setButtonText('AI 提取').setDisabled(false);
          }
        }),
    );
  }

  private renderCandidates(el: HTMLElement, c: OnboardResult, source: string): void {
    el.empty();
    const checks: { box: HTMLInputElement; kind: 'progress' | 'error'; idx: number }[] = [];

    if (c.progress?.length) {
      el.createEl('h4', { text: `学习进展（${c.progress.length} 条，写入 记录/进展/）` });
      c.progress.forEach((p, i) => {
        const row = el.createDiv({ cls: 'asc-candidate' });
        const box = row.createEl('input', { type: 'checkbox' });
        box.checked = true;
        row.createSpan({ text: `【${p.subject}】${p.text}` });
        checks.push({ box, kind: 'progress', idx: i });
      });
    }
    if (c.errors?.length) {
      el.createEl('h4', { text: `失分线索（${c.errors.length} 条，写入 error log，复查默认 7 天后）` });
      c.errors.forEach((e, i) => {
        const row = el.createDiv({ cls: 'asc-candidate' });
        const box = row.createEl('input', { type: 'checkbox' });
        box.checked = true;
        row.createSpan({ text: `【${e.subject ?? '?'}】${e.topic || '(考点待定)'} · ${e.code || '(代码待定)'} · ${e.desc ?? ''}` });
        checks.push({ box, kind: 'error', idx: i });
      });
    }

    new Setting(el)
      .addButton(b =>
        b
          .setButtonText('收入选中')
          .setCta()
          .onClick(async () => {
            b.setDisabled(true);
            const date = todayStr();
            let saved = 0;
            try {
              for (const ck of checks) {
                if (!ck.box.checked) continue;
                if (ck.kind === 'progress') {
                  const p = c.progress![ck.idx];
                  await this.plugin.progress.append(p.subject, p.text, date);
                  saved++;
                } else {
                  const e = c.errors![ck.idx];
                  if (!e.topic && !e.desc) continue;
                  await this.plugin.errorLog.addEntry({
                    subject: e.subject ?? '',
                    topic: e.topic ?? '(待补充)',
                    code: e.code || 'K',
                    desc: e.desc ?? '',
                    fix: e.fix ?? '',
                  });
                  saved++;
                }
              }
              // 原文也留一份，允许模糊、拒绝空白
              await this.plugin.vaultService.append('StudyCoach/记录/学习日志.md', `\n## ${date} 冷启动记录\n\n${source}\n`);
              new Notice(`已收录 ${saved} 条。之后随时用「随手记」补充。`);
              this.close();
              void this.plugin.refreshStatusBar();
            } catch (err) {
              new Notice(`入库失败：${err instanceof Error ? err.message : String(err)}`, 8000);
              b.setDisabled(false);
            }
          }),
      )
      .addButton(b => b.setButtonText('全部丢弃').onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
