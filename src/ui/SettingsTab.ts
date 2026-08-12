import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type ALevelStudyCoachPlugin from '../main';
import { LlmClient } from '../llm/LlmClient';
import { aliyunAsr, aliyunTts } from '../voice/AliyunNls';
import { t, setLang, type Lang } from '../i18n';
import { VIEW_TYPE } from './MainView';

// 审核 Warning 决策记录：声明式设置 API（getSettingDefinitions）有意不实现——
// minAppVersion=1.5.0 低于该 API 所需的 1.13.0，实现会使旧版 Obsidian 用户失去设置界面；
// 待 minAppVersion 提升到 ≥1.13.0 时再重新评估。
export class StudyCoachSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: ALevelStudyCoachPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const llm = this.plugin.settings.llm;

    // 语言：默认英文；切换后即时生效（设置页与打开的教练视图都重绘）
    new Setting(containerEl)
      .setName(t('settings.language'))
      .setDesc(t('settings.language.desc'))
      .addDropdown(d =>
        d
          .addOption('en', t('settings.lang.en'))
          .addOption('zh', t('settings.lang.zh'))
          .setValue(this.plugin.settings.language)
          .onChange(async v => {
            const lang = v as Lang;
            this.plugin.settings.language = lang;
            await this.plugin.saveSettings();
            setLang(lang);
            this.display();
            // 已打开的教练视图即时重绘为所选语言
            for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
              const view = leaf.view as unknown as { render: () => void };
              view.render();
            }
          }),
      );

    new Setting(containerEl).setName(t('settings.llm')).setHeading();
    containerEl.createEl('p', {
      text: t('settings.llm.desc'),
      cls: 'setting-item-description',
    });

    new Setting(containerEl)
      .setName(t('settings.llm.provider'))
      .addDropdown(d =>
        d
          .addOptions({ 'openai-compat': 'OpenAI-compatible (/v1/chat/completions)', anthropic: 'Anthropic native (/v1/messages)' })
          .setValue(llm.provider)
          .onChange(async v => {
            llm.provider = v as 'openai-compat' | 'anthropic';
            if (llm.provider === 'anthropic' && llm.baseUrl.includes('openai.com')) llm.baseUrl = 'https://api.anthropic.com';
            if (llm.provider === 'openai-compat' && llm.baseUrl.includes('anthropic.com')) llm.baseUrl = 'https://api.openai.com/v1';
            // 切接口自动应用该接口的默认模型
            const def = this.plugin.settings.modelDefaults[llm.provider] ?? '';
            if (def) llm.model = def;
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    new Setting(containerEl)
      .setName(t('settings.llm.baseUrl'))
      .addText(t =>
        t
          .setPlaceholder(llm.provider === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1')
          .setValue(llm.baseUrl)
          .onChange(async v => {
            llm.baseUrl = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t('settings.llm.apiKey'))
      .addText(t => {
        t.inputEl.type = 'password';
        t.setValue(llm.apiKey).onChange(async v => {
          llm.apiKey = v.trim();
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName(t('settings.llm.model'))
      .setDesc(t('settings.llm.model.desc'))
      .addText(t =>
        t.setValue(llm.model).onChange(async v => {
          llm.model = v.trim();
          await this.plugin.saveSettings();
        }),
      );

    // ── 模型管理：逐个添加、单独测试、设为默认、删除（按当前接口）──
    new Setting(containerEl).setName(t('settings.llm.models', { provider: llm.provider === 'anthropic' ? 'Anthropic' : 'OpenAI-compatible' })).setHeading();
    containerEl.createEl('p', {
      text: t('settings.llm.models.desc'),
      cls: 'setting-item-description',
    });
    const listEl = containerEl.createDiv({ cls: 'asc-model-list' });
    const renderList = () => {
      listEl.empty();
      const models = this.plugin.modelList();
      const def = this.plugin.currentModelDefault() || this.plugin.settings.llm.model;
      if (!models.length) {
        listEl.createDiv({ text: t('settings.llm.noModels'), cls: 'asc-muted' });
        return;
      }
      for (const m of models) {
        const item = listEl.createDiv({ cls: 'asc-model-item' });
        const name = item.createDiv({ cls: 'asc-model-name' });
        if (m === def) name.createSpan({ text: '★ ', cls: 'asc-model-star' });
        name.createSpan({ text: m });
        if (m === def) name.createSpan({ text: ' ' + t('settings.model.default'), cls: 'asc-model-badge' });
        const actions = item.createDiv({ cls: 'asc-model-actions' });
        if (m !== def) {
          actions.createEl('button', { text: t('settings.model.setDefault'), cls: 'asc-btn asc-btn-small' }).addEventListener('click', () => {
            void (async () => {
              await this.plugin.setModelDefault(m);
              new Notice(t('settings.llm.defaultSet', { name: m }));
              renderList();
            })();
          });
        }
        const testBtn = actions.createEl('button', { text: t('settings.llm.test'), cls: 'asc-btn asc-btn-small' });
        testBtn.addEventListener('click', () => void this.testModel(m, testBtn));
        actions.createEl('button', { text: '✕', cls: 'asc-btn asc-btn-small asc-btn-danger' }).addEventListener('click', () => {
          void (async () => {
            await this.plugin.removeModel(m);
            renderList();
          })();
        });
      }
    };
    renderList();

    const addRow = containerEl.createDiv({ cls: 'asc-model-add-row' });
    const inputEl = addRow.createEl('input', { type: 'text', placeholder: t('settings.llm.addPlaceholder') });
    const addBtn = addRow.createEl('button', { text: t('settings.llm.addModel'), cls: 'asc-btn' });
    const handleAdd = async () => {
      const name = inputEl.value.trim();
      if (!name) return;
      const existing = this.plugin.modelList();
      if (existing.includes(name)) {
        new Notice(t('settings.llm.exists', { name }));
        inputEl.value = '';
        return;
      }
      const merged = [...existing, name];
      await this.plugin.setModelCandidates(merged.join(', '));
      if (!this.plugin.currentModelDefault()) {
        await this.plugin.setModelDefault(name);
      }
      inputEl.value = '';
      new Notice(t('settings.llm.added', { name }));
      renderList();
    };
    addBtn.addEventListener('click', () => void handleAdd());
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); void handleAdd(); }
    });

    new Setting(containerEl)
      .setName(t('settings.llm.contextWindow'))
      .setDesc(t('settings.llm.contextWindow.desc'))
      .addText(t =>
        t.setValue(String(this.plugin.settings.contextWindow)).onChange(async v => {
          const n = Number(v);
          if (n > 0) {
            this.plugin.settings.contextWindow = n;
            await this.plugin.saveSettings();
          }
        }),
      );

    new Setting(containerEl)
      .setName(t('settings.llm.compressThreshold'))
      .setDesc(t('settings.llm.compressThreshold.desc'))
      .addText(t =>
        t.setValue(String(this.plugin.settings.compressThreshold)).onChange(async v => {
          const n = Number(v);
          if (n >= 10 && n <= 95) {
            this.plugin.settings.compressThreshold = n;
            await this.plugin.saveSettings();
          }
        }),
      );

    new Setting(containerEl).setName(t('settings.llm.testConn')).addButton(b =>
      b.setButtonText(t('settings.llm.testConn')).onClick(async () => {
        b.setButtonText(t('settings.llm.testingConn')).setDisabled(true);
        try {
          const reply = await this.plugin.llm.chat({
            messages: [{ role: 'user', content: 'Please reply with exactly two characters: OK' }],
            maxTokens: 32,
          });
          new Notice(t('settings.llm.connOk', { reply: reply.slice(0, 40) }));
        } catch (e) {
          new Notice(t('settings.llm.connFail', { msg: e instanceof Error ? e.message : String(e) }), 10000);
        } finally {
          b.setButtonText(t('settings.llm.testConn')).setDisabled(false);
        }
      }),
    );

    // ── 语音训练（阿里云 NLS；口语训练的按住说话/考官播报）──
    new Setting(containerEl).setName(t('settings.voice')).setHeading();
    containerEl.createEl('p', {
      text: t('settings.voice.desc'),
      cls: 'setting-item-description',
    });
    const voice = this.plugin.settings.voice;

    new Setting(containerEl)
      .setName(t('settings.voice.enabled'))
      .setDesc(t('settings.voice.enabled.desc'))
      .addToggle(t => t.setValue(voice.enabled).onChange(async v => { voice.enabled = v; await this.plugin.saveSettings(); await this.plugin.saveVoiceConfig(); }));

    new Setting(containerEl)
      .setName(t('settings.voice.akId'))
      .addText(t => t.setValue(voice.aliyunAccessKeyId).onChange(async v => { voice.aliyunAccessKeyId = v.trim(); await this.plugin.saveSettings(); await this.plugin.saveVoiceConfig(); }));

    new Setting(containerEl)
      .setName(t('settings.voice.akSecret'))
      .addText(t => {
        t.inputEl.type = 'password';
        t.setValue(voice.aliyunAccessKeySecret).onChange(async v => { voice.aliyunAccessKeySecret = v.trim(); await this.plugin.saveSettings(); await this.plugin.saveVoiceConfig(); });
      });

    new Setting(containerEl)
      .setName(t('settings.voice.appKey'))
      .setDesc(t('settings.voice.appKey.desc'))
      .addText(t => t.setValue(voice.aliyunAppKey).onChange(async v => { voice.aliyunAppKey = v.trim(); await this.plugin.saveSettings(); await this.plugin.saveVoiceConfig(); }));

    new Setting(containerEl)
      .setName(t('settings.voice.ttsVoice'))
      .setDesc(t('settings.voice.ttsVoice.desc'))
      .addDropdown(d =>
        d.addOption('annie', 'annie (British female)').addOption('abby', 'abby (American female)').addOption('andy', 'andy (American male)')
          .setValue(voice.ttsVoice).onChange(async v => { voice.ttsVoice = v; await this.plugin.saveSettings(); await this.plugin.saveVoiceConfig(); }),
      );

    new Setting(containerEl)
      .setName(t('settings.voice.autoPlay'))
      .setDesc(t('settings.voice.autoPlay.desc'))
      .addToggle(t => t.setValue(voice.autoPlayTts).onChange(async v => { voice.autoPlayTts = v; await this.plugin.saveSettings(); await this.plugin.saveVoiceConfig(); }));

    new Setting(containerEl)
      .setName(t('settings.voice.saveRec'))
      .setDesc(t('settings.voice.saveRec.desc'))
      .addToggle(t => t.setValue(voice.saveRecordings).onChange(async v => { voice.saveRecordings = v; await this.plugin.saveSettings(); await this.plugin.saveVoiceConfig(); }));

    new Setting(containerEl)
      .setName(t('settings.voice.connTest'))
      .setDesc(t('settings.voice.connTest.desc'))
      .addButton(b =>
        b.setButtonText(t('settings.voice.connTestBtn')).onClick(async () => {
          b.setButtonText(t('settings.llm.testingConn')).setDisabled(true);
          try {
            this.plugin.voiceToken = null; // 强制重新获取
            await this.plugin.getNlsToken();
            new Notice(t('settings.voice.connOk'), 6000);
          } catch (e) {
            new Notice(t('settings.voice.connFail', { msg: e instanceof Error ? e.message : String(e) }), 10000);
          } finally {
            b.setButtonText(t('settings.voice.connTestBtn')).setDisabled(false);
          }
        }),
      );

    new Setting(containerEl)
      .setName(t('settings.voice.playback'))
      .setDesc(t('settings.voice.playback.desc'))
      .addButton(b =>
        b.setButtonText(t('settings.voice.playbackBtn')).onClick(() => {
          void (async () => {
            b.setButtonText(t('settings.voice.testing')).setDisabled(true);
            try {
              const vcfg = await this.plugin.loadVoiceConfig();
              const token = await this.plugin.getNlsToken();
              const audio = await aliyunTts('Hello, this is a playback test.', { token, appKey: vcfg.aliyunAppKey, voice: vcfg.ttsVoice });
              const ctx = new AudioContext();
              const state0: string = ctx.state;
              if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
              const buf = await ctx.decodeAudioData(audio);
              await new Promise<void>(resolve => {
                const src = ctx.createBufferSource();
                src.buffer = buf;
                src.connect(ctx.destination);
                src.onended = (): void => resolve();
                src.start();
              });
              const state1: string = ctx.state;
              void ctx.close().catch(() => undefined);
              // 路径 B：<audio> 媒体元素（blob URL）——部分 iOS 配置下与 Web Audio 静音行为不同，对比测试
              const blob = new Blob([audio], { type: 'audio/mpeg' });
              const url = URL.createObjectURL(blob);
              const el = new Audio(url);
              await new Promise<void>(resolve => {
                el.onended = (): void => resolve();
                el.onerror = (): void => resolve();
                void el.play().catch(() => resolve());
              });
              URL.revokeObjectURL(url);
              void this.plugin.voiceDiag(t('settings.voice.diag.playback'), t('settings.voice.diag.playbackOk', { bytes: audio.byteLength, dur: buf.duration.toFixed(1), s0: state0, s1: state1 }));
              new Notice(t('settings.voice.playbackOk', { s0: state0, s1: state1 }), 12000);
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              void this.plugin.voiceDiag(t('settings.voice.diag.playback'), t('settings.voice.diag.fail', { msg }));
              new Notice(t('settings.voice.playbackFail', { msg }), 10000);
            } finally {
              b.setButtonText(t('settings.voice.playbackBtn')).setDisabled(false);
            }
          })();
        }),
      );

    new Setting(containerEl)
      .setName(t('settings.voice.diag'))
      .setDesc(t('settings.voice.diag.desc'))
      .addButton(b =>
        b.setButtonText(t('settings.voice.asrTest')).onClick(async () => {
          b.setButtonText(t('settings.llm.testingConn')).setDisabled(true);
          try {
            const vcfg = await this.plugin.loadVoiceConfig();
            const token = await this.plugin.getNlsToken();
            const silence = new ArrayBuffer(32000); // 1 秒 16k 16bit 静音
            const text = await aliyunAsr(silence, {
              token, appKey: vcfg.aliyunAppKey,
              onLog: (s, d) => void this.plugin.voiceDiag(s, d),
            });
            new Notice(t('settings.voice.asrOk', { text: text || '-' }), 6000);
          } catch (e) {
            new Notice(t('settings.voice.diagFail', { msg: e instanceof Error ? e.message : String(e) }), 10000);
          } finally {
            b.setButtonText(t('settings.voice.asrTest')).setDisabled(false);
          }
        }),
      )
      .addButton(b =>
        b.setButtonText(t('settings.voice.ttsTest')).onClick(async () => {
          b.setButtonText(t('settings.llm.testingConn')).setDisabled(true);
          try {
            const vcfg = await this.plugin.loadVoiceConfig();
            const token = await this.plugin.getNlsToken();
            const audio = await aliyunTts('Hello, this is a connection test.', { token, appKey: vcfg.aliyunAppKey, voice: vcfg.ttsVoice });
            void this.plugin.voiceDiag(t('settings.voice.diag.chain'), t('settings.voice.diag.chainOk', { bytes: audio.byteLength, voice: vcfg.ttsVoice }));
            new Notice(t('settings.voice.ttsOk', { bytes: audio.byteLength }), 6000);
          } catch (e) {
            void this.plugin.voiceDiag(t('settings.voice.diag.chain'), t('settings.voice.diag.fail', { msg: e instanceof Error ? e.message : String(e) }));
            new Notice(t('settings.voice.diagFail', { msg: e instanceof Error ? e.message : String(e) }), 10000);
          } finally {
            b.setButtonText(t('settings.voice.ttsTest')).setDisabled(false);
          }
        }),
      );

    new Setting(containerEl).setName(t('settings.data')).setHeading();
    containerEl.createEl('p', {
      text: t('settings.data.desc'),
      cls: 'setting-item-description',
    });
  }

  /** 单独测试某个模型：临时用当前接口配置 + 指定模型发一个小请求 */
  private async testModel(model: string, btn: HTMLButtonElement): Promise<void> {
    const s = this.plugin.settings.llm;
    if (!s.apiKey) {
      new Notice(t('settings.llm.needKey'));
      return;
    }
    const client = new LlmClient({ provider: s.provider, baseUrl: s.baseUrl, apiKey: s.apiKey, model });
    btn.setText(t('settings.llm.testing'));
    btn.disabled = true;
    try {
      const reply = await client.chat({
        messages: [{ role: 'user', content: 'Please reply with exactly two characters: OK' }],
        maxTokens: 32,
      });
      new Notice(t('settings.llm.testOk', { model, reply: reply.slice(0, 30) }), 6000);
    } catch (e) {
      new Notice(t('settings.llm.testFail', { model, msg: e instanceof Error ? e.message : String(e) }), 10000);
    } finally {
      btn.setText(t('settings.llm.test'));
      btn.disabled = false;
    }
  }
}
