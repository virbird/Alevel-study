import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type ALevelStudyCoachPlugin from '../main';
import { LlmClient } from '../llm/LlmClient';
import { aliyunAsr, aliyunTts } from '../voice/AliyunNls';

export class StudyCoachSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: ALevelStudyCoachPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const llm = this.plugin.settings.llm;

    containerEl.createEl('h2', { text: 'LLM 连接' });
    containerEl.createEl('p', {
      text: 'API Key 只保存在本机 Obsidian 设置里，直接调用提供商接口。OpenAI 兼容端点同样适用于 DeepSeek、Qwen、OpenRouter、本地代理等。',
      cls: 'setting-item-description',
    });

    new Setting(containerEl)
      .setName('接口类型')
      .addDropdown(d =>
        d
          .addOptions({ 'openai-compat': 'OpenAI 兼容（/v1/chat/completions）', anthropic: 'Anthropic 原生（/v1/messages）' })
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
      .setName('Base URL')
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
      .setName('API Key')
      .addText(t => {
        t.inputEl.type = 'password';
        t.setValue(llm.apiKey).onChange(async v => {
          llm.apiKey = v.trim();
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('当前模型')
      .setDesc('当前实际使用的模型（也可在下方模型列表「设为默认」或教练页签顶部切换）')
      .addText(t =>
        t.setValue(llm.model).onChange(async v => {
          llm.model = v.trim();
          await this.plugin.saveSettings();
        }),
      );

    // ── 模型管理：逐个添加、单独测试、设为默认、删除（按当前接口）──
    containerEl.createEl('h3', { text: `模型管理（当前接口：${llm.provider === 'anthropic' ? 'Anthropic' : 'OpenAI 兼容'}）` });
    containerEl.createEl('p', {
      text: '逐个添加该接口的模型；每个可单独测试、设为默认或删除。切换接口后此区显示对应接口的列表。',
      cls: 'setting-item-description',
    });
    const listEl = containerEl.createDiv({ cls: 'asc-model-list' });
    const renderList = () => {
      listEl.empty();
      const models = this.plugin.modelList();
      const def = this.plugin.currentModelDefault() || this.plugin.settings.llm.model;
      if (!models.length) {
        listEl.createDiv({ text: '还没有模型——在下方输入模型名添加', cls: 'asc-muted' });
        return;
      }
      for (const m of models) {
        const item = listEl.createDiv({ cls: 'asc-model-item' });
        const name = item.createDiv({ cls: 'asc-model-name' });
        if (m === def) name.createSpan({ text: '★ ', cls: 'asc-model-star' });
        name.createSpan({ text: m });
        if (m === def) name.createSpan({ text: ' 默认', cls: 'asc-model-badge' });
        const actions = item.createDiv({ cls: 'asc-model-actions' });
        if (m !== def) {
          actions.createEl('button', { text: '设为默认', cls: 'asc-btn asc-btn-small' }).addEventListener('click', async () => {
            await this.plugin.setModelDefault(m);
            new Notice(`默认模型已设为：${m}`);
            renderList();
          });
        }
        const testBtn = actions.createEl('button', { text: '测试', cls: 'asc-btn asc-btn-small' });
        testBtn.addEventListener('click', () => void this.testModel(m, testBtn));
        actions.createEl('button', { text: '✕', cls: 'asc-btn asc-btn-small asc-btn-danger' }).addEventListener('click', async () => {
          await this.plugin.removeModel(m);
          renderList();
        });
      }
    };
    renderList();

    const addRow = containerEl.createDiv({ cls: 'asc-model-add-row' });
    const inputEl = addRow.createEl('input', { type: 'text', placeholder: '模型名，如 gpt-4o-mini / deepseek-chat，回车添加' });
    const addBtn = addRow.createEl('button', { text: '添加模型', cls: 'asc-btn' });
    const handleAdd = async () => {
      const name = inputEl.value.trim();
      if (!name) return;
      const existing = this.plugin.modelList();
      if (existing.includes(name)) {
        new Notice(`模型已存在：${name}`);
        inputEl.value = '';
        return;
      }
      const merged = [...existing, name];
      await this.plugin.setModelCandidates(merged.join(', '));
      if (!this.plugin.currentModelDefault()) {
        await this.plugin.setModelDefault(name);
      }
      inputEl.value = '';
      new Notice(`已添加模型：${name}（可点「测试」验证）`);
      renderList();
    };
    addBtn.addEventListener('click', () => void handleAdd());
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); void handleAdd(); }
    });

    new Setting(containerEl)
      .setName('上下文窗口大小')
      .setDesc('token 数，用于教练会话的上下文展示与自动压缩阈值（超过 80% 自动压缩）')
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
      .setName('自动压缩阈值')
      .setDesc('上下文用量达到该百分比时，发送前自动压缩（默认 80，可设 10–95；超限会红色提示并可强制压缩）')
      .addText(t =>
        t.setValue(String(this.plugin.settings.compressThreshold)).onChange(async v => {
          const n = Number(v);
          if (n >= 10 && n <= 95) {
            this.plugin.settings.compressThreshold = n;
            await this.plugin.saveSettings();
          }
        }),
      );

    new Setting(containerEl).setName('测试连接').addButton(b =>
      b.setButtonText('测试').onClick(async () => {
        b.setButtonText('测试中…').setDisabled(true);
        try {
          const reply = await this.plugin.llm.chat({
            messages: [{ role: 'user', content: '请只回复两个字：正常' }],
            maxTokens: 32,
          });
          new Notice(`连接成功：${reply.slice(0, 40)}`);
        } catch (e) {
          new Notice(`连接失败：${e instanceof Error ? e.message : String(e)}`, 10000);
        } finally {
          b.setButtonText('测试').setDisabled(false);
        }
      }),
    );

    // ── 语音训练（阿里云 NLS；口语训练的按住说话/考官播报）──
    containerEl.createEl('h2', { text: '语音训练（阿里云）' });
    containerEl.createEl('p', {
      text: '口语训练支持按住说话（ASR）与考官播报（TTS）。配置存于 vault 的 雅思/口语/voice.json（会随 vault 同步到其他设备，介意请勿同步该文件）；不填则口语训练保持文字模式。建议为语音功能单独建低额度 AccessKey。',
      cls: 'setting-item-description',
    });
    const voice = this.plugin.settings.voice;

    new Setting(containerEl)
      .setName('启用语音')
      .setDesc('口语科目发送框出现 🎤 按住说话；考官回复可播报（P 维度评分待 P5c 发音评测）')
      .addToggle(t => t.setValue(voice.enabled).onChange(async v => { voice.enabled = v; (await this.plugin.saveSettings(), await this.plugin.saveVoiceConfig()); }));

    new Setting(containerEl)
      .setName('AccessKey ID')
      .addText(t => t.setValue(voice.aliyunAccessKeyId).onChange(async v => { voice.aliyunAccessKeyId = v.trim(); (await this.plugin.saveSettings(), await this.plugin.saveVoiceConfig()); }));

    new Setting(containerEl)
      .setName('AccessKey Secret')
      .addText(t => {
        t.inputEl.type = 'password';
        t.setValue(voice.aliyunAccessKeySecret).onChange(async v => { voice.aliyunAccessKeySecret = v.trim(); (await this.plugin.saveSettings(), await this.plugin.saveVoiceConfig()); });
      });

    new Setting(containerEl)
      .setName('智能语音 AppKey')
      .setDesc('阿里云控制台「智能语音交互」项目的 Appkey')
      .addText(t => t.setValue(voice.aliyunAppKey).onChange(async v => { voice.aliyunAppKey = v.trim(); (await this.plugin.saveSettings(), await this.plugin.saveVoiceConfig()); }));

    new Setting(containerEl)
      .setName('考官音色')
      .setDesc('TTS 播报声音')
      .addDropdown(d =>
        d.addOption('annie', 'annie（英音女声）').addOption('abby', 'abby（美音女声）').addOption('andy', 'andy（美音男声）')
          .setValue(voice.ttsVoice).onChange(async v => { voice.ttsVoice = v; (await this.plugin.saveSettings(), await this.plugin.saveVoiceConfig()); }),
      );

    new Setting(containerEl)
      .setName('自动播报考官回复')
      .setDesc('口语会话中 AI 回复完成后自动朗读（可随时点「停止播报」打断）')
      .addToggle(t => t.setValue(voice.autoPlayTts).onChange(async v => { voice.autoPlayTts = v; (await this.plugin.saveSettings(), await this.plugin.saveVoiceConfig()); }));

    new Setting(containerEl)
      .setName('保存录音')
      .setDesc('每次说话的录音存到 雅思/口语/（WAV 附件，默认关，避免 vault 膨胀）')
      .addToggle(t => t.setValue(voice.saveRecordings).onChange(async v => { voice.saveRecordings = v; (await this.plugin.saveSettings(), await this.plugin.saveVoiceConfig()); }));

    new Setting(containerEl)
      .setName('连接测试')
      .setDesc('用当前密钥获取一次阿里云 NLS Token，验证配置是否可用')
      .addButton(b =>
        b.setButtonText('测试连接').onClick(async () => {
          b.setButtonText('测试中…').setDisabled(true);
          try {
            this.plugin.voiceToken = null; // 强制重新获取
            await this.plugin.getNlsToken();
            new Notice('✅ 阿里云语音可用（Token 获取成功）', 6000);
          } catch (e) {
            new Notice(`❌ 语音连接失败：${e instanceof Error ? e.message : String(e)}`, 10000);
          } finally {
            b.setButtonText('测试连接').setDisabled(false);
          }
        }),
      );

    new Setting(containerEl)
      .setName('链路诊断')
      .setDesc('在插件环境内直接测 ASR/TTS 的 WebSocket 链路（不需要麦克风），过程与结果写入 雅思/口语/语音日志.md')
      .addButton(b =>
        b.setButtonText('识别链路测试').onClick(async () => {
          b.setButtonText('测试中…').setDisabled(true);
          try {
            const vcfg = await this.plugin.loadVoiceConfig();
            const token = await this.plugin.getNlsToken();
            const silence = new ArrayBuffer(32000); // 1 秒 16k 16bit 静音
            const text = await aliyunAsr(silence, {
              token, appKey: vcfg.aliyunAppKey,
              onLog: (s, d) => void this.plugin.voiceDiag(s, d),
            });
            new Notice(`✅ 识别链路正常（静音识别结果：${text || '空'}）`, 6000);
          } catch (e) {
            new Notice(`❌ ${e instanceof Error ? e.message : String(e)}（详见 雅思/口语/语音日志.md）`, 10000);
          } finally {
            b.setButtonText('识别链路测试').setDisabled(false);
          }
        }),
      )
      .addButton(b =>
        b.setButtonText('合成链路测试').onClick(async () => {
          b.setButtonText('测试中…').setDisabled(true);
          try {
            const vcfg = await this.plugin.loadVoiceConfig();
            const token = await this.plugin.getNlsToken();
            const audio = await aliyunTts('Hello, this is a connection test.', { token, appKey: vcfg.aliyunAppKey, voice: vcfg.ttsVoice });
            void this.plugin.voiceDiag('TTS 链路测试', `合成成功 ${audio.byteLength} 字节 voice=${vcfg.ttsVoice}`);
            new Notice(`✅ 合成链路正常（${audio.byteLength} 字节音频）`, 6000);
          } catch (e) {
            void this.plugin.voiceDiag('TTS 链路测试', `失败：${e instanceof Error ? e.message : String(e)}`);
            new Notice(`❌ ${e instanceof Error ? e.message : String(e)}（详见 雅思/口语/语音日志.md）`, 10000);
          } finally {
            b.setButtonText('合成链路测试').setDisabled(false);
          }
        }),
      );

    containerEl.createEl('h2', { text: '数据与提示词' });
    containerEl.createEl('p', {
      text: '所有学习数据保存在 vault 的 StudyCoach/ 目录（纯 Markdown，可用 git / iCloud 同步）。提示词在 StudyCoach/prompts/ 下，可直接编辑。',
      cls: 'setting-item-description',
    });
  }

  /** 单独测试某个模型：临时用当前接口配置 + 指定模型发一个小请求 */
  private async testModel(model: string, btn: HTMLButtonElement): Promise<void> {
    const s = this.plugin.settings.llm;
    if (!s.apiKey) {
      new Notice('请先填写 API Key');
      return;
    }
    const client = new LlmClient({ provider: s.provider, baseUrl: s.baseUrl, apiKey: s.apiKey, model });
    btn.setText('测试中…');
    btn.disabled = true;
    try {
      const reply = await client.chat({
        messages: [{ role: 'user', content: '请只回复两个字：正常' }],
        maxTokens: 32,
      });
      new Notice(`✅ ${model} 可用：${reply.slice(0, 30)}`, 6000);
    } catch (e) {
      new Notice(`❌ ${model} 不可用：${e instanceof Error ? e.message : String(e)}`, 10000);
    } finally {
      btn.setText('测试');
      btn.disabled = false;
    }
  }
}
